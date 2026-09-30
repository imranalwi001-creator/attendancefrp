import 'dart:math';
import 'package:geolocator/geolocator.dart';
import '../../features/attendance/domain/models/attendance_models.dart';

/// Production-ready Location & Geofencing Engine with Anti-Spoofing & Anomaly Defense
class LocationService {
  // Default Company Office Coordinate
  static const double officeLatitude = -6.2088; // Central Jakarta Office (Default HRM)
  static const double officeLongitude = 106.8456;
  static const double defaultAllowedRadius = 100.0; // 100 meters perimeter
  static const String defaultOfficeName = "Kantor Pusat - Graha HRM";

  // Cache last known valid position for impossible travel checks
  static Position? _lastKnownPosition;
  static DateTime? _lastKnownTime;

  /// Calculate distance using Haversine Great-Circle Formula
  static double calculateHaversineDistance({
    required double lat1,
    required double lon1,
    required double lat2,
    required double lon2,
  }) {
    const double earthRadiusMeters = 6371000.0;
    final dLat = _degreesToRadians(lat2 - lat1);
    final dLon = _degreesToRadians(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_degreesToRadians(lat1)) *
            cos(_degreesToRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusMeters * c; // In meters
  }

  static double _degreesToRadians(double degrees) {
    return degrees * pi / 180.0;
  }

  /// Request and verify GPS permissions, then check geofence and anti-mock status
  static Future<GeofenceStatus> verifyCurrentLocation({
    double targetLat = officeLatitude,
    double targetLon = officeLongitude,
    double allowedRadius = defaultAllowedRadius,
    String officeName = defaultOfficeName,
  }) async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return GeofenceStatus(
        isInRadius: false,
        distanceMeters: 9999,
        maxAllowedRadius: allowedRadius,
        officeName: officeName,
      );
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return GeofenceStatus(
          isInRadius: false,
          distanceMeters: 9999,
          maxAllowedRadius: allowedRadius,
          officeName: officeName,
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return GeofenceStatus(
        isInRadius: false,
        distanceMeters: 9999,
        maxAllowedRadius: allowedRadius,
        officeName: officeName,
      );
    }

    // High accuracy location reading
    final Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.bestForNavigation,
      timeLimit: const Duration(seconds: 10),
    );

    // ── DEFENSE 1: Mock Provider Detection ──────────────────────
    bool isMock = position.isMocked;

    // ── DEFENSE 2: Accuracy Ceiling Guard ────────────────────────
    // Reject cell-tower / approximate coordinates (accuracy > 60m)
    final bool isLowAccuracy = position.accuracy > 60.0;

    // ── DEFENSE 3: Impossible Travel / Teleportation Radar ───────
    bool isTeleportationAnomaly = false;
    if (_lastKnownPosition != null && _lastKnownTime != null) {
      final elapsedSeconds = DateTime.now().difference(_lastKnownTime!).inSeconds;
      if (elapsedSeconds > 0 && elapsedSeconds < 3600) { // Within 1 hour
        final distanceMoved = calculateHaversineDistance(
          lat1: _lastKnownPosition!.latitude,
          lon1: _lastKnownPosition!.longitude,
          lat2: position.latitude,
          lon2: position.longitude,
        );
        final speedKmH = (distanceMoved / elapsedSeconds) * 3.6;
        if (speedKmH > 150.0) { // Exceeding realistic terrestrial speed
          isTeleportationAnomaly = true;
          isMock = true;
        }
      }
    }

    _lastKnownPosition = position;
    _lastKnownTime = DateTime.now();

    final double distance = calculateHaversineDistance(
      lat1: position.latitude,
      lon1: position.longitude,
      lat2: targetLat,
      lon2: targetLon,
    );

    return GeofenceStatus(
      isInRadius: distance <= allowedRadius && !isMock && !isLowAccuracy,
      distanceMeters: distance,
      maxAllowedRadius: allowedRadius,
      officeName: officeName,
      isMockGpsDetected: isMock || isTeleportationAnomaly,
      accuracy: position.accuracy,
    );
  }
}
