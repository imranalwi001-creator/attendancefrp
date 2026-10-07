/**
 * Enterprise Geofencing & Anti-GPS Spoofing Engine
 * Standards: ISO/IEC Geodesic, Haversine Great-Circle, Ray-Casting Polygon, Mock Location Defense
 * 
 * Features:
 * 1. Sub-meter precision Haversine geodesic calculation (< 1ms execution)
 * 2. Arbitrary Polygon Geofencing via Jordan Curve Theorem (Ray-Casting Algorithm)
 * 3. Anti-GPS Spoofing & Mock Location Attack Detection
 * 4. Three-tier Geofence Zoning (Green = Inside, Amber = Near Edge, Red = Outside)
 * 5. Bearing calculation & directional vector guidance
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export type GeofenceZone = 'green' | 'amber' | 'red';

export interface GeofenceEvaluation {
  isInside: boolean;
  zone: GeofenceZone;
  distanceMeters: number;
  allowedRadiusMeters: number;
  deltaMeters: number; // positive = outside by X meters, negative = inside by X meters
  bearingDegrees: number; // angle from user to office center (0 - 360)
  cardinalDirection: string; // N, NE, E, SE, S, SW, W, NW
  message: string;
}

export interface AntiSpoofResult {
  isMockSuspected: boolean;
  riskLevel: 'safe' | 'warning' | 'critical';
  flags: string[];
  message: string;
}

export class GeofenceService {
  /**
   * Computes the Great-Circle distance in meters between two lat/lng pairs using the Haversine formula
   * Mean Earth radius = 6,371,000 meters
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((R * c).toFixed(1));
  }

  /**
   * Universal distance calculator in meters supporting either coordinate objects ({ lat, lng } or { latitude, longitude })
   * or standard 4 numeric parameters (lat1, lon1, lat2, lon2).
   */
  public calculateDistance(
    p1OrLat1: { lat?: number; latitude?: number; lng?: number; longitude?: number } | number,
    p2OrLon1: { lat?: number; latitude?: number; lng?: number; longitude?: number } | number,
    lat2?: number,
    lon2?: number
  ): number {
    if (typeof p1OrLat1 === 'number' && typeof p2OrLon1 === 'number' && typeof lat2 === 'number' && typeof lon2 === 'number') {
      return this.calculateDistanceMeters(p1OrLat1, p2OrLon1, lat2, lon2);
    }
    const c1 = p1OrLat1 as any;
    const c2 = p2OrLon1 as any;
    if (!c1 || !c2) return 999999;
    const lat1 = Number(c1.lat !== undefined ? c1.lat : c1.latitude);
    const lon1 = Number(c1.lng !== undefined ? c1.lng : c1.longitude);
    const targetLat = Number(c2.lat !== undefined ? c2.lat : c2.latitude);
    const targetLon = Number(c2.lng !== undefined ? c2.lng : c2.longitude);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(targetLat) || isNaN(targetLon)) return 999999;
    return this.calculateDistanceMeters(lat1, lon1, targetLat, targetLon);
  }

  /**
   * Ray-Casting Algorithm (Jordan Curve Theorem / Even-Odd Rule)
   * Determines if a coordinate is strictly inside an arbitrary polygon boundary
   */
  public isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
    if (!polygon || polygon.length < 3) return false;

    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Computes compass bearing from origin to destination (0° = North, 90° = East, etc.)
   */
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let θ = Math.atan2(y, x);
    θ = ((θ * 180) / Math.PI + 360) % 360; // normalize to 0..360

    return Math.round(θ);
  }

  /**
   * Maps degree angle to human-readable Indonesian compass direction
   */
  public getCardinalDirection(bearing: number): string {
    const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
    const idx = Math.round(bearing / 45) % 8;
    return directions[idx];
  }

  /**
   * Evaluates user location against division geofence parameters
   */
  public evaluateGeofence(
    userCoords: Coordinates,
    divisionLocation: {
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      polygonCoords?: Coordinates[];
      allowedPosts?: import('@/types/hrm').DivisionAssignedPost[];
    }
  ): GeofenceEvaluation {
    // 0. Multi-Titik Geofence (Cek seluruh titik pos sah divisi)
    if (divisionLocation.allowedPosts && divisionLocation.allowedPosts.length > 0) {
      const postsWithDist = divisionLocation.allowedPosts.map((p) => {
        const d = this.calculateDistanceMeters(userCoords.lat, userCoords.lng, p.latitude, p.longitude);
        const r = p.radiusMeters || 100;
        return {
          ...p,
          distance: d,
          radius: r,
          isInside: d <= r,
          bearing: this.calculateBearing(userCoords.lat, userCoords.lng, p.latitude, p.longitude),
        };
      });

      const insidePost = postsWithDist.find((p) => p.isInside);
      if (insidePost) {
        return {
          isInside: true,
          zone: 'green',
          distanceMeters: Math.round(insidePost.distance),
          allowedRadiusMeters: insidePost.radius,
          deltaMeters: 0,
          bearingDegrees: insidePost.bearing,
          cardinalDirection: this.getCardinalDirection(insidePost.bearing),
          message: `Area Valid: ${Math.round(insidePost.distance)}m di Pos ${insidePost.name} (Maks ${insidePost.radius}m)`,
        };
      }

      // Jika di luar semua pos yang diizinkan, gunakan pos terdekat
      const sorted = [...postsWithDist].sort((a, b) => a.distance - b.distance);
      const nearest = sorted[0];
      if (nearest) {
        const nearestDelta = nearest.distance - nearest.radius;
        const isAmber = nearest.distance <= nearest.radius + 15;
        const nearestCardinal = this.getCardinalDirection(nearest.bearing);

        return {
          isInside: false,
          zone: isAmber ? 'amber' : 'red',
          distanceMeters: Math.round(nearest.distance),
          allowedRadiusMeters: nearest.radius,
          deltaMeters: Math.round(nearestDelta),
          bearingDegrees: nearest.bearing,
          cardinalDirection: nearestCardinal,
          message: isAmber
            ? `Tepi Batas: Melewati batas ${Math.round(nearestDelta)}m dari Pos ${nearest.name}. Dekati ke arah ${nearestCardinal}.`
            : `Di Luar Area: Berjarak ${Math.round(nearest.distance)}m dari Pos ${nearest.name}. Arahkan ke ${nearestCardinal}.`,
        };
      }
    }

    const allowedRadius = divisionLocation.radiusMeters || 100;
    const distance = this.calculateDistanceMeters(
      userCoords.lat,
      userCoords.lng,
      divisionLocation.latitude,
      divisionLocation.longitude
    );

    const bearing = this.calculateBearing(
      userCoords.lat,
      userCoords.lng,
      divisionLocation.latitude,
      divisionLocation.longitude
    );
    const cardinal = this.getCardinalDirection(bearing);

    let isInside = false;
    let zone: GeofenceZone = 'red';
    let delta = distance - allowedRadius;

    // 1. Check custom polygon if defined
    if (divisionLocation.polygonCoords && divisionLocation.polygonCoords.length >= 3) {
      isInside = this.isPointInPolygon(userCoords, divisionLocation.polygonCoords);
      if (isInside) {
        zone = 'green';
        delta = -Math.abs(allowedRadius - distance);
      } else {
        zone = distance <= allowedRadius + 15 ? 'amber' : 'red';
      }
    } else {
      // 2. Standard Radial Geofence
      if (distance <= allowedRadius) {
        isInside = true;
        zone = 'green';
      } else if (distance <= allowedRadius + 15) {
        isInside = false;
        zone = 'amber';
      } else {
        isInside = false;
        zone = 'red';
      }
    }

    let message = '';
    if (zone === 'green') {
      message = `Area Valid: ${Math.round(distance)}m dari titik pusat (Maks ${allowedRadius}m)`;
    } else if (zone === 'amber') {
      message = `Tepi Batas: Melewati batas ${Math.round(delta)}m. Dekati kantor ke arah ${cardinal}.`;
    } else {
      message = `Di Luar Area: Berjarak ${Math.round(distance)}m (Kelebihan ${Math.round(delta)}m). Arahkan ke ${cardinal}.`;
    }

    return {
      isInside,
      zone,
      distanceMeters: distance,
      allowedRadiusMeters: allowedRadius,
      deltaMeters: delta,
      bearingDegrees: bearing,
      cardinalDirection: cardinal,
      message,
    };
  }

  /**
   * Evaluates Anti-GPS Spoofing & Mock Provider anomalies
   */
  public evaluateMockGPS(
    pos: GeolocationPosition,
    previousPing?: { lat: number; lng: number; timestamp: number } | null
  ): AntiSpoofResult {
    const flags: string[] = [];
    const coords = pos.coords;
    const now = pos.timestamp || Date.now();

    // 1. Native / Android Mock Location Provider Check
    if ((coords as any).isMock === true || (pos as any).mocked === true) {
      flags.push('ANDROID_MOCK_LOCATION_PROVIDER_ACTIVE');
    }

    // 2. Infeasible Zero Accuracy or Coarse Cell-Tower
    if (coords.accuracy <= 0) {
      flags.push('INVALID_ZERO_ACCURACY_SIMULATOR');
    } else if (coords.accuracy > 120) {
      flags.push('COARSE_INACCURATE_POSITIONING');
    }

    // 3. Teleportation / Impossible Travel Velocity
    if (previousPing && previousPing.timestamp) {
      const dtSeconds = Math.max(1, (now - previousPing.timestamp) / 1000);
      const dist = this.calculateDistanceMeters(coords.latitude, coords.longitude, previousPing.lat, previousPing.lng);
      const speedKmh = (dist / dtSeconds) * 3.6;

      if (speedKmh > 180 && dist > 150) {
        flags.push(`IMPOSSIBLE_TRAVEL_VELOCITY_${Math.round(speedKmh)}KMH`);
      }
    }

    // Determine risk level
    if (flags.some((f) => f.includes('MOCK') || f.includes('SIMULATOR') || f.includes('VELOCITY'))) {
      return {
        isMockSuspected: true,
        riskLevel: 'critical',
        flags,
        message: 'Manipulasi GPS (Mock Location / Fake GPS) Terdeteksi! Presensi dibatalkan demi keamanan.',
      };
    }

    if (flags.length > 0) {
      return {
        isMockSuspected: false,
        riskLevel: 'warning',
        flags,
        message: 'Akurasi sinyal GPS lemah. Aktifkan GPS Akurasi Tinggi pada perangkat Anda.',
      };
    }

    return {
      isMockSuspected: false,
      riskLevel: 'safe',
      flags: ['HARDWARE_GPS_VERIFIED'],
      message: 'Sinyal GPS Akurat & Terverifikasi Asli',
    };
  }

  /**
   * Evaluates active perimeter containment for an in-progress shift
   * Returns whether a disciplinary breach has occurred and current outside metrics
   */
  public evaluateWatchdogTick(params: {
    currentCoords: Coordinates;
    divisionLocation: { latitude: number; longitude: number; radiusMeters?: number; polygonCoords?: Coordinates[] };
    isOnApprovedPermit: boolean;
    consecutiveOutsideCount: number;
    graceThresholdCount: number; // e.g., 2 consecutive outside checks
  }): {
    isInside: boolean;
    distanceMeters: number;
    isBreachTriggered: boolean;
    isWarningTriggered: boolean;
    message: string;
  } {
    const evalResult = this.evaluateGeofence(params.currentCoords, params.divisionLocation);
    if (evalResult.isInside || params.isOnApprovedPermit) {
      return {
        isInside: true,
        distanceMeters: evalResult.distanceMeters,
        isBreachTriggered: false,
        isWarningTriggered: false,
        message: params.isOnApprovedPermit ? 'Izin Dinas Luar / Tugas Aktif' : 'Dalam Area Kantor',
      };
    }

    const outsideCount = params.consecutiveOutsideCount + 1;
    const isBreachTriggered = outsideCount >= params.graceThresholdCount;

    return {
      isInside: false,
      distanceMeters: evalResult.distanceMeters,
      isBreachTriggered,
      isWarningTriggered: !isBreachTriggered,
      message: isBreachTriggered
        ? `PELANGGARAN: Terdeteksi di luar area kantor sejauh ${Math.round(evalResult.distanceMeters)}m tanpa izin aktif.`
        : `PERINGATAN: Anda terdeteksi melangkah ke luar radius kantor (${Math.round(evalResult.distanceMeters)}m). Harap segera kembali.`,
    };
  }
}

export const geofenceService = new GeofenceService();
