/// Strictly typed domain models for Employee Attendance System

enum AttendanceState {
  notCheckedIn, // Belum Presensi
  checkedIn,    // Sudah Masuk (Siap Absen Pulang)
  checkedOut,   // Selesai Bertugas Hari Ini
}

enum AttendanceTagType {
  onTime,  // Tepat Waktu (Green)
  late,    // Terlambat (Amber/Red)
  wfh,     // WFH / Approval (Blue)
}

class EmployeeProfile {
  final String id;
  final String employeeCode;
  final String fullName;
  final String role;
  final String department;
  final String branchName;
  final String? locationName;
  final double radiusMeters;
  final String? avatarUrl;
  final String? divisionId;     // UUID of the employee's division
  final String? kepalaReguId;   // UUID of the assigned kepala_regu

  const EmployeeProfile({
    required this.id,
    required this.employeeCode,
    required this.fullName,
    required this.role,
    required this.department,
    required this.branchName,
    this.locationName,
    this.radiusMeters = 150.0,
    this.avatarUrl,
    this.divisionId,
    this.kepalaReguId,
  });
}

class ShiftInfo {
  final String shiftName;
  final String startTime;
  final String endTime;
  final String timeZone;

  const ShiftInfo({
    required this.shiftName,
    required this.startTime,
    required this.endTime,
    required this.timeZone,
  });

  String get formattedRange => "$shiftName: $startTime - $endTime $timeZone";
}

class GeofenceStatus {
  final bool isInRadius;
  final double distanceMeters;
  final double maxAllowedRadius;
  final String officeName;
  final bool isMockGpsDetected;
  final double? accuracy;

  const GeofenceStatus({
    required this.isInRadius,
    required this.distanceMeters,
    required this.maxAllowedRadius,
    required this.officeName,
    this.isMockGpsDetected = false,
    this.accuracy,
  });

  String get badgeText {
    if (isMockGpsDetected) {
      return "Peringatan: Fake GPS Terdeteksi!";
    }
    if (isInRadius) {
      return "Dalam Radius Kantor (${distanceMeters.toStringAsFixed(0)}m)";
    } else {
      return "Di Luar Radius Kantor (${distanceMeters.toStringAsFixed(0)}m)";
    }
  }
}

class AttendanceRecord {
  final String id;
  final DateTime date;
  final String checkInTime;
  final String? checkOutTime;
  final String statusLabel;
  final AttendanceTagType tagType;
  final String locationName;

  const AttendanceRecord({
    required this.id,
    required this.date,
    required this.checkInTime,
    this.checkOutTime,
    required this.statusLabel,
    required this.tagType,
    required this.locationName,
  });
}

class MonthlyAttendanceMetrics {
  final String totalHadir;
  final String totalHariKerja;
  final String terlambatSummary;
  final String sisaCuti;
  final String jamEfektif;
  final String totalLemburDisetujui;

  const MonthlyAttendanceMetrics({
    required this.totalHadir,
    required this.totalHariKerja,
    required this.terlambatSummary,
    required this.sisaCuti,
    required this.jamEfektif,
    this.totalLemburDisetujui = "0 Jam",
  });
}
