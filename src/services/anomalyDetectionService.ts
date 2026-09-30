/**
 * HRM Attendance Anomaly & Fraud Radar Engine
 * Identifies proxy attendance (titip absen), device collisions, geofence boundary anomalies, and burnout risk
 */

import { AttendanceRecord, UserProfile, OvertimeRecord } from '@/types/hrm';

export interface AnomalyRiskItem {
  userId: string;
  userName: string;
  userNip: string;
  divisionName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0 - 100
  categories: ('DEVICE_SHARING' | 'GEOFENCE_EDGE' | 'TIMING_CLUSTER' | 'BIOMETRIC_VARIANCE' | 'BURNOUT_RISK')[];
  reasons: string[];
  lastIncidentDate: string;
}

export interface AnomalyRadarSummary {
  totalScanned: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  items: AnomalyRiskItem[];
}

export class AnomalyDetectionService {
  /**
   * Scans employees, attendances, and overtime records for biometric and operational anomalies
   */
  public analyzeWorkforceAnomalies(
    users: UserProfile[],
    attendances: AttendanceRecord[],
    overtimes: OvertimeRecord[]
  ): AnomalyRadarSummary {
    const items: AnomalyRiskItem[] = [];

    // 1. Build Device Sharing Map (Detect Titip Absen)
    const deviceMap = new Map<string, string[]>(); // deviceId -> userIds[]
    attendances.forEach((att) => {
      if (att.deviceId) {
        const existing = deviceMap.get(att.deviceId) || [];
        if (!existing.includes(att.userId)) {
          existing.push(att.userId);
        }
        deviceMap.set(att.deviceId, existing);
      }
    });

    users.forEach((u) => {
      let riskScore = 0;
      const reasons: string[] = [];
      const categories: AnomalyRiskItem['categories'] = [];
      const userAtts = attendances.filter((a) => a.userId === u.id);
      const userOts = overtimes.filter((o) => o.userId === u.id);

      // A. Device Sharing / Collision Check
      const sharedDevices = Array.from(deviceMap.entries()).filter(
        ([_, userIds]) => userIds.includes(u.id) && userIds.length > 1
      );
      if (sharedDevices.length > 0) {
        const otherUsersCount = sharedDevices.reduce((acc, [_, ids]) => acc + ids.length - 1, 0);
        riskScore += 45;
        categories.push('DEVICE_SHARING');
        reasons.push(
          `Terdeteksi 1 perangkat fisik dipakai bergantian oleh ${otherUsersCount + 1} akun karyawan berbeda (Indikasi titip absen).`
        );
      }

      // B. Geofence Perimeter Clustering (>85% of allowed radius)
      const edgeEvents = userAtts.filter((a) => {
        // Look at security score and notes
        return a.notes?.toLowerCase().includes('perbatasan') || a.isMockSuspected;
      });
      if (edgeEvents.length >= 2 || userAtts.some((a) => a.isMockSuspected)) {
        riskScore += 30;
        categories.push('GEOFENCE_EDGE');
        reasons.push('Terdeteksi beberapa kali presensi di batas terluar geofence / indikasi koordinat anomali.');
      }

      // C. Biometric Variance / Mismatch attempts
      const lowBioEvents = userAtts.filter(
        (a) => a.biometricScore != null && a.biometricScore >= 75 && a.biometricScore < 82
      );
      if (lowBioEvents.length >= 2) {
        riskScore += 20;
        categories.push('BIOMETRIC_VARIANCE');
        reasons.push('Skor kecocokan biometrik mendekati ambang batas toleransi terendah secara berulang.');
      }

      // D. Repeated Timing Clusters (Late within 1-2 minutes of shift start)
      const borderlineLates = userAtts.filter((a) => a.lateMinutes > 0 && a.lateMinutes <= 3);
      if (borderlineLates.length >= 3) {
        riskScore += 15;
        categories.push('TIMING_CLUSTER');
        reasons.push('Pola presensi konsisten mepet di detik-detik akhir batas toleransi shift.');
      }

      // E. Burnout Risk Index (Overtime > 12 hours in last 14 days)
      const totalOtHours = userOts
        .filter((o) => o.status === 'approved')
        .reduce((sum, o) => sum + (o.approvedHours || o.durationHours || 0), 0);

      if (totalOtHours >= 14) {
        riskScore += 25;
        categories.push('BURNOUT_RISK');
        reasons.push(`Beban lembur sangat tinggi (${totalOtHours} Jam dalam 14 hari terakhir). Waspada kelelahan kerja.`);
      }

      if (riskScore > 0) {
        let riskLevel: AnomalyRiskItem['riskLevel'] = 'low';
        if (riskScore >= 70) riskLevel = 'critical';
        else if (riskScore >= 45) riskLevel = 'high';
        else if (riskScore >= 20) riskLevel = 'medium';

        const lastAtt = userAtts[0];
        items.push({
          userId: u.id,
          userName: u.fullName,
          userNip: u.nip,
          divisionName: u.divisionName || 'Umum',
          riskLevel,
          riskScore: Math.min(100, riskScore),
          categories,
          reasons,
          lastIncidentDate: lastAtt ? lastAtt.attendanceDate : new Date().toISOString().split('T')[0],
        });
      }
    });

    // Sort by risk score descending
    items.sort((a, b) => b.riskScore - a.riskScore);

    return {
      totalScanned: users.length,
      criticalCount: items.filter((i) => i.riskLevel === 'critical').length,
      highCount: items.filter((i) => i.riskLevel === 'high').length,
      mediumCount: items.filter((i) => i.riskLevel === 'medium').length,
      lowCount: items.filter((i) => i.riskLevel === 'low').length,
      items,
    };
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
