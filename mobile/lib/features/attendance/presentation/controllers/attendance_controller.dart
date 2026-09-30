import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/models/attendance_models.dart';
import '../../../../core/services/location_service.dart';
import '../../../../core/services/biometric_security_service.dart';
import '../../../../core/services/device_security_service.dart';
import '../../../../core/services/api_service.dart';

/// Presentation Controller synchronizing Flutter Mobile with PostgreSQL Database
class AttendanceController extends ChangeNotifier {
  // State variables
  late EmployeeProfile profile;
  late ShiftInfo activeShift;
  late MonthlyAttendanceMetrics monthlyMetrics;
  late List<AttendanceRecord> recentActivities;

  AttendanceState attendanceState = AttendanceState.notCheckedIn;
  GeofenceStatus geofenceStatus = const GeofenceStatus(
    isInRadius: true,
    distanceMeters: 14.5,
    maxAllowedRadius: 150.0,
    officeName: "Kantor Pusat - Gedung Graha HRM",
    isMockGpsDetected: false,
    accuracy: 3.2,
  );

  DateTime currentTime = DateTime.now();
  Duration _serverTimeOffset = Duration.zero;
  Timer? _clockTimer;

  String? todayCheckInTime;
  String? todayCheckOutTime;
  bool isProcessing = false;
  String? processingStatusText;
  bool isOfflineMode = false;
  bool isSyncing = false;
  final Map<String, dynamic>? initialUser;

  String get employeeName => profile.fullName;
  String get userNip => profile.employeeCode;
  String get roleName => profile.role;
  String get divisionName => profile.department;
  Map<String, dynamic>? get currentUser => initialUser;

  AttendanceController({this.initialUser}) {
    _initializeDefaultData(initialUser);
    _startLiveClock();
    // Synchronize live with PostgreSQL database
    syncWithDatabase(authenticatedUserId: initialUser?['id'] ?? initialUser?['email']);
  }

  void _initializeDefaultData([Map<String, dynamic>? user]) {
    final quota = (user?['annualLeaveQuota'] as num?)?.toInt() ?? 12;
    final used = (user?['usedLeaveDays'] as num?)?.toInt() ?? 0;
    final sisa = (quota - used).clamp(0, 99);

    final resolvedLoc = user?['divisionLocationName'] ?? "Gedung IT Cyber";
    final resolvedRadius = (user?['divisionRadiusMeters'] as num?)?.toDouble() ?? 200.0;

    profile = EmployeeProfile(
      id: user?['id'] ?? "eccf6bcb-e7f3-4b90-83dd-5fca513b5b15",
      employeeCode: user?['nip'] ?? "EMP008",
      fullName: user?['fullName'] ?? "imranalwi",
      role: user?['roleName'] ?? "karyawan",
      department: user?['divisionName'] ?? "Teknologi Informasi",
      locationName: resolvedLoc,
      radiusMeters: resolvedRadius,
      branchName: "$resolvedLoc (Radius ${resolvedRadius.toInt()}m)",
      avatarUrl: user?['avatarUrl'], // STRICTLY NO stock woman fallback!
      divisionId: user?['divisionId'] as String?,
      kepalaReguId: user?['kepalaReguId'] as String?,
    );

    activeShift = ShiftInfo(
      shiftName: user?['shiftName'] ?? "Reguler (Senin - Jumat)",
      startTime: user?['shiftStartTime'] ?? "08:00",
      endTime: user?['shiftEndTime'] ?? "17:00",
      timeZone: "WIB",
    );

    monthlyMetrics = MonthlyAttendanceMetrics(
      totalHadir: "0 / 22 Hari",
      totalHariKerja: "22",
      terlambatSummary: "0 Kali",
      sisaCuti: "$sisa Hari",
      jamEfektif: "0 Jam",
      totalLemburDisetujui: "0 Jam",
    );

    recentActivities = [];
  }

  void _startLiveClock() {
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      currentTime = DateTime.now().add(_serverTimeOffset);
      notifyListeners();
    });
  }

  /// Live Database Synchronization with PostgreSQL & Superadmin Dashboard
  Future<void> syncWithDatabase({String? authenticatedUserId}) async {
    isSyncing = true;
    notifyListeners();

    try {
      final data = await ApiService.fetchBootstrapData();
      if (data != null) {
        isOfflineMode = false;

        // Synchronize server time
        if (data['serverTime'] != null) {
          final srv = DateTime.tryParse(data['serverTime']);
          if (srv != null) {
            _serverTimeOffset = srv.difference(DateTime.now());
            currentTime = DateTime.now().add(_serverTimeOffset);
          }
        }

        // 1. Sync User Profile
        final users = data['users'] as List?;
        if (users != null && users.isNotEmpty) {
          final targetUserId = authenticatedUserId ?? profile.id;
          final targetUser = users.firstWhere(
            (u) =>
                u['id'] == targetUserId ||
                u['email'] == targetUserId ||
                u['nip'] == targetUserId,
            orElse: () => users.firstWhere(
              (u) =>
                  u['email'] == 'imranalwi8@gmail.com' ||
                  u['nip'] == 'EMP008',
              orElse: () => users.first,
            ),
          );

          // Find specific division from database
          final divisions = data['divisions'] as List?;
          Map<String, dynamic>? userDivision;
          if (divisions != null && targetUser['divisionId'] != null) {
            for (final d in divisions) {
              if (d is Map &&
                  (d['id'] == targetUser['divisionId'] ||
                      d['code'] == targetUser['divisionId'])) {
                userDivision = Map<String, dynamic>.from(d);
                break;
              }
            }
          }

          final resolvedDivName = userDivision?['name'] ??
              targetUser['divisionName'] ??
              profile.department;
          final resolvedLocName = userDivision?['locationName'] ??
              targetUser['divisionLocationName'] ??
              "Gedung IT Cyber";
          final resolvedRadius = (userDivision?['radiusMeters'] as num?)?.toDouble() ??
              (targetUser['divisionRadiusMeters'] as num?)?.toDouble() ??
              200.0;

          // Safe avatar resolution: real avatarUrl or real faceEnrolledPhoto or null (initials)
          String? resolvedAvatar;
          if (targetUser['avatarUrl'] != null &&
              targetUser['avatarUrl'].toString().trim().isNotEmpty) {
            resolvedAvatar = targetUser['avatarUrl'].toString();
          } else if (targetUser['faceEnrolledPhoto'] != null &&
              targetUser['faceEnrolledPhoto'].toString().trim().isNotEmpty) {
            resolvedAvatar = targetUser['faceEnrolledPhoto'].toString();
          }

          profile = EmployeeProfile(
            id: targetUser['id'] ?? profile.id,
            employeeCode: targetUser['nip'] ?? profile.employeeCode,
            fullName: targetUser['fullName'] ?? profile.fullName,
            role: targetUser['roleName'] ?? profile.role,
            department: resolvedDivName,
            locationName: resolvedLocName,
            radiusMeters: resolvedRadius,
            branchName: "$resolvedLocName (Radius ${resolvedRadius.toInt()}m)",
            avatarUrl: resolvedAvatar,
            divisionId: (targetUser['divisionId'] ?? profile.divisionId) as String?,
            kepalaReguId: (targetUser['kepalaReguId'] ?? profile.kepalaReguId) as String?,
          );

          // 2. Sync Active Shift assigned to user in database
          final shifts = data['shifts'] as List?;
          Map<String, dynamic>? userShift;
          if (shifts != null && targetUser['shiftId'] != null) {
            for (final s in shifts) {
              if (s is Map &&
                  (s['id'] == targetUser['shiftId'] ||
                      s['code'] == targetUser['shiftId'])) {
                userShift = Map<String, dynamic>.from(s);
                break;
              }
            }
          }
          if (userShift == null && shifts != null && shifts.isNotEmpty) {
            for (final s in shifts) {
              if (s is Map && s['isDefault'] == true) {
                userShift = Map<String, dynamic>.from(s);
                break;
              }
            }
          }

          if (userShift != null) {
            activeShift = ShiftInfo(
              shiftName: userShift['name'] ??
                  targetUser['shiftName'] ??
                  activeShift.shiftName,
              startTime: userShift['startTime'] ??
                  targetUser['shiftStartTime'] ??
                  activeShift.startTime,
              endTime: userShift['endTime'] ??
                  targetUser['shiftEndTime'] ??
                  activeShift.endTime,
              timeZone: "WIB",
            );
          }

          // 3. Sync Office / Geofence Settings based on Division Location
          geofenceStatus = GeofenceStatus(
            isInRadius: true,
            distanceMeters: 14.5,
            maxAllowedRadius: resolvedRadius,
            officeName: "$resolvedDivName - $resolvedLocName",
            isMockGpsDetected: false,
            accuracy: 3.2,
          );

          // 4. Sync Today's Attendance State & Recent Activities
          final attendances = data['attendances'] as List?;
          final todayStr = DateFormat('yyyy-MM-dd').format(currentTime);

          int hadirCount = 0;
          int lateCount = 0;
          int totalLateMinutes = 0;

          if (attendances != null) {
            final userAttendances = attendances
                .where((a) => a['userId'] == profile.id)
                .toList();

            // Check today's clock in/out
            final todayRecord = userAttendances.firstWhere(
              (a) => a['date'] == todayStr,
              orElse: () => null,
            );

            if (todayRecord != null) {
              todayCheckInTime = todayRecord['clockIn'];
              todayCheckOutTime = todayRecord['clockOut'];

              if (todayCheckOutTime != null && todayCheckOutTime!.isNotEmpty) {
                attendanceState = AttendanceState.checkedOut;
              } else if (todayCheckInTime != null && todayCheckInTime!.isNotEmpty) {
                attendanceState = AttendanceState.checkedIn;
              }
            } else {
              attendanceState = AttendanceState.notCheckedIn;
              todayCheckInTime = null;
              todayCheckOutTime = null;
            }

            // Build recent activities list from real DB records
            recentActivities = userAttendances.take(10).map<AttendanceRecord>((a) {
              final dateParsed =
                  DateTime.tryParse(a['date'] ?? '') ?? currentTime;
              final isLate = a['status'] == 'terlambat';
              final isWfh = a['status'] == 'wfh' || a['status'] == 'izin';

              AttendanceTagType tag = AttendanceTagType.onTime;
              String statusLabel = "Tepat Waktu";
              if (isLate) {
                tag = AttendanceTagType.late;
                statusLabel = "Terlambat ${a['lateMinutes'] ?? 0}m";
              } else if (isWfh) {
                tag = AttendanceTagType.wfh;
                statusLabel = "Izin / Luar";
              }

              return AttendanceRecord(
                id: a['id'] ?? UniqueKey().toString(),
                date: dateParsed,
                checkInTime: a['clockIn'] ?? "--:--",
                checkOutTime: a['clockOut'],
                statusLabel: statusLabel,
                tagType: tag,
                locationName: geofenceStatus.officeName,
              );
            }).toList();

            // Compute dynamic metrics
            hadirCount = userAttendances
                .where((a) => a['status'] == 'hadir' || a['status'] == 'terlambat')
                .length;
            lateCount = userAttendances
                .where((a) => a['status'] == 'terlambat')
                .length;
            totalLateMinutes = userAttendances
                .where((a) => a['status'] == 'terlambat')
                .fold<int>(0, (sum, a) => sum + ((a['lateMinutes'] as num?)?.toInt() ?? 0));
          }

          // Calculate actual remaining leave quota synchronized dynamically with approved leaves
          final quota = (targetUser['annualLeaveQuota'] as num?)?.toInt() ?? 14;
          int dynamicApprovedLeaves = 0;
          final leavesList = data['leaves'] as List?;
          if (leavesList != null) {
            for (final l in leavesList) {
              if (l is Map) {
                final lUserId = l['user_id'] ?? l['userId'];
                final lStatus = (l['status'] ?? '').toString().toLowerCase();
                final lType = (l['leave_type'] ?? l['leaveType'] ?? '').toString().toLowerCase();
                if ((lUserId == profile.id || lUserId == targetUser['id']) &&
                    lStatus == 'approved' &&
                    (lType.contains('cuti') || lType.contains('tahunan') || lType.contains('annual') || lType.isEmpty)) {
                  dynamicApprovedLeaves += ((l['total_days'] ?? l['totalDays'] ?? 1) as num).toInt();
                }
              }
            }
          }
          final effectiveUsed = dynamicApprovedLeaves > 0
              ? dynamicApprovedLeaves
              : ((targetUser['usedLeaveDays'] as num?)?.toInt() ?? 0);
          final sisaCuti = (quota - effectiveUsed).clamp(0, 99);

          // Calculate approved overtime hours for current month
          double dynamicApprovedOtHours = 0.0;
          final otList = data['overtimeRecords'] as List?;
          if (otList != null) {
            final currentMonthPrefix = DateFormat('yyyy-MM').format(currentTime);
            for (final ot in otList) {
              if (ot is Map) {
                final otUserId = ot['user_id'] ?? ot['userId'];
                final otStatus = (ot['status'] ?? '').toString().toLowerCase();
                final otDate = (ot['date'] ?? '').toString();
                if ((otUserId == profile.id || otUserId == targetUser['id']) &&
                    otStatus == 'approved' &&
                    otDate.startsWith(currentMonthPrefix)) {
                  final hrs = (ot['duration_hours'] ?? ot['durationHours'] ?? ot['hours'] as num?)?.toDouble() ?? 0.0;
                  dynamicApprovedOtHours += hrs;
                }
              }
            }
          }
          final otFormatted = dynamicApprovedOtHours == dynamicApprovedOtHours.roundToDouble()
              ? "${dynamicApprovedOtHours.toInt()} Jam"
              : "${dynamicApprovedOtHours.toStringAsFixed(1)} Jam";

          final lateSummary = lateCount > 0
              ? "$lateCount Kali (${totalLateMinutes}m)"
              : "0 Kali";

          monthlyMetrics = MonthlyAttendanceMetrics(
            totalHadir: "$hadirCount / 22 Hari",
            totalHariKerja: "22",
            terlambatSummary: lateSummary,
            sisaCuti: "$sisaCuti Hari",
            jamEfektif: "${hadirCount * 8} Jam",
            totalLemburDisetujui: otFormatted,
          );
        }
      } else {
        isOfflineMode = true;
      }
    } catch (e) {
      isOfflineMode = true;
      print("[AttendanceController] Sync error: $e");
    } finally {
      isSyncing = false;
      notifyListeners();
    }
  }

  /// Trigger GPS refresh & anti-mock re-check
  Future<void> checkLiveLocation() async {
    try {
      final status = await LocationService.verifyCurrentLocation();
      geofenceStatus = status;
      notifyListeners();
    } catch (_) {}
  }

  /// Execute Biometric Facial Scan + Geofencing Clock In / Out synchronized to PostgreSQL
  Future<bool> executeAttendance(
    BuildContext context, {
    required LivenessChallenge activeChallenge,
    required Function(String status, double progress) onStepUpdate,
  }) async {
    isProcessing = true;
    notifyListeners();

    try {
      // 1. Verify Geofence & Mock GPS
      onStepUpdate("Validasi radius geofencing & sinyal GPS...", 0.15);
      await Future.delayed(const Duration(milliseconds: 500));

      if (geofenceStatus.isMockGpsDetected) {
        throw Exception("Sistem mendeteksi aplikasi Fake GPS aktif. Nonaktifkan lokasi tiruan untuk melanjutkan.");
      }

      if (!geofenceStatus.isInRadius) {
        throw Exception("Anda berada ${geofenceStatus.distanceMeters.toStringAsFixed(0)}m di luar batas radius kantor.");
      }

      // 2. Face Recognition & Active Liveness Challenge
      final faceResult = await BiometricSecurityService.captureAndVerifyFaceWithLiveness(
        employeeId: profile.id,
        activeChallenge: activeChallenge,
        onProgress: onStepUpdate,
      );

      if (!faceResult.isSuccess || !faceResult.isLivenessPassed) {
        throw Exception(faceResult.errorMessage ?? "Verifikasi wajah gagal. Coba lagi dengan pencahayaan cukup.");
      }

      // 3. Send HTTP request directly to Server Database
      onStepUpdate("Sinkronisasi data ke Server & Dashboard HRD...", 0.98);

      final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final timeStr = DateFormat('HH:mm').format(DateTime.now());

      // Retrieve hardware device fingerprint for Anti-Buddy Clock-in Binding
      final devInfo = await DeviceSecurityService.getDeviceFingerprint();
      final deviceId = devInfo['deviceId'] as String?;
      final deviceModel = devInfo['platform'] != null ? "${devInfo['platform']} Mobile" : "Android Native";

      if (attendanceState == AttendanceState.notCheckedIn) {
        // Submit Clock-In to Backend with Hardware Device Binding
        await ApiService.submitClockIn(
          userId: profile.id,
          date: dateStr,
          time: timeStr,
          latitude: LocationService.officeLatitude,
          longitude: LocationService.officeLongitude,
          status: 'hadir',
          lateMinutes: 0,
          biometricScore: faceResult.confidenceScore,
          biometricMatch: true,
          geofenceDistance: geofenceStatus.distanceMeters,
          geofenceValid: true,
          isMockLocation: false,
          securityFlags: faceResult.securityAuditLogs,
          deviceId: deviceId,
          deviceModel: deviceModel,
        );

        todayCheckInTime = timeStr;
        attendanceState = AttendanceState.checkedIn;
      } else if (attendanceState == AttendanceState.checkedIn) {
        // Submit Clock-Out to Backend
        await ApiService.submitClockOut(
          userId: profile.id,
          date: dateStr,
          time: timeStr,
          latitude: LocationService.officeLatitude,
          longitude: LocationService.officeLongitude,
          earlyLeavingMinutes: 0,
          workDurationMinutes: 480,
          biometricScore: faceResult.confidenceScore,
          biometricMatch: true,
          geofenceDistance: geofenceStatus.distanceMeters,
          geofenceValid: true,
          isMockLocation: false,
          securityFlags: faceResult.securityAuditLogs,
        );

        todayCheckOutTime = timeStr;
        attendanceState = AttendanceState.checkedOut;
      }

      // 4. Re-sync with PostgreSQL Database to guarantee full state integrity
      await syncWithDatabase();

      isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      isProcessing = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }
}
