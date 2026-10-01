import 'dart:convert';
import 'package:http/http.dart' as http;

/// Production API Service synchronizing Flutter Mobile with PostgreSQL Backend
class ApiService {
  // Base URL pointing to the running backend (supports --dart-define=API_URL=https://...)
  static String baseUrl = const String.fromEnvironment(
    'API_URL',
    defaultValue: "https://fawwazreskiperwira.com/api",
  );

  /// Authenticate employee with Email or NIP against PostgreSQL database
  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/auth/login"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'identifier': identifier.trim(),
          'password': password,
        }),
      ).timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      return body;
    } catch (e) {
      print("[ApiService] Login network error: $e");
      return {'success': false, 'error': 'Gagal terhubung ke server database.'};
    }
  }

  /// Fetch full bootstrap synchronization data from PostgreSQL
  static Future<Map<String, dynamic>?> fetchBootstrapData() async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/sync/bootstrap"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true && body['data'] != null) {
          return body['data'];
        }
      }
    } catch (e) {
      // Return null on offline / network error for graceful offline fallback
      print("[ApiService] Bootstrap sync error: $e");
    }
    return null;
  }

  /// Submit Clock-In to PostgreSQL database
  static Future<Map<String, dynamic>?> submitClockIn({
    required String userId,
    required String date,
    required String time,
    required double latitude,
    required double longitude,
    String? photo,
    String status = 'hadir',
    int lateMinutes = 0,
    String notes = '',
    double biometricScore = 96.8,
    bool biometricMatch = true,
    double geofenceDistance = 14.5,
    bool geofenceValid = true,
    bool isMockLocation = false,
    List<String> securityFlags = const ['BIOMETRIC_LIVENESS_VERIFIED', 'GEOFENCE_IN_RADIUS'],
    String? deviceId,
    String? deviceModel,
  }) async {
    try {
      final payload = {
        'userId': userId,
        'date': date,
        'time': time,
        'photo': photo,
        'latitude': latitude,
        'longitude': longitude,
        'status': status,
        'lateMinutes': lateMinutes,
        'notes': notes,
        'biometricScore': biometricScore,
        'biometricMatch': biometricMatch,
        'geofenceDistance': geofenceDistance,
        'geofenceValid': geofenceValid,
        'isMockLocation': isMockLocation,
        'securityFlags': securityFlags,
        if (deviceId != null) 'deviceId': deviceId,
        if (deviceModel != null) 'deviceModel': deviceModel,
      };

      final response = await http.post(
        Uri.parse("$baseUrl/attendances/clock-in"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body;
      }
    } catch (e) {
      print("[ApiService] Clock-in submit error: $e");
      rethrow;
    }
    return null;
  }

  /// Submit Clock-Out to PostgreSQL database
  static Future<Map<String, dynamic>?> submitClockOut({
    required String userId,
    required String date,
    required String time,
    required double latitude,
    required double longitude,
    String? photo,
    int earlyLeavingMinutes = 0,
    int workDurationMinutes = 480,
    double biometricScore = 96.8,
    bool biometricMatch = true,
    double geofenceDistance = 14.5,
    bool geofenceValid = true,
    bool isMockLocation = false,
    List<String> securityFlags = const ['BIOMETRIC_LIVENESS_VERIFIED', 'GEOFENCE_IN_RADIUS'],
  }) async {
    try {
      final payload = {
        'userId': userId,
        'date': date,
        'time': time,
        'photo': photo,
        'latitude': latitude,
        'longitude': longitude,
        'earlyLeavingMinutes': earlyLeavingMinutes,
        'workDurationMinutes': workDurationMinutes,
        'biometricScore': biometricScore,
        'biometricMatch': biometricMatch,
        'geofenceDistance': geofenceDistance,
        'geofenceValid': geofenceValid,
        'isMockLocation': isMockLocation,
        'securityFlags': securityFlags,
      };

      final response = await http.post(
        Uri.parse("$baseUrl/attendances/clock-out"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        return body;
      }
    } catch (e) {
      print("[ApiService] Clock-out submit error: $e");
      rethrow;
    }
    return null;
  }

  /// Submit Leave Request (Izin / Cuti / Sakit)
  static Future<Map<String, dynamic>?> submitLeaveRequest({
    required String userId,
    required String leaveType,
    required String startDate,
    required String endDate,
    required int totalDays,
    required String reason,
    String? attachmentUrl,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/leaves"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'leaveType': leaveType,
          'startDate': startDate,
          'endDate': endDate,
          'totalDays': totalDays,
          'reason': reason,
          'attachmentUrl': attachmentUrl,
        }),
      ).timeout(const Duration(seconds: 10));

      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Leave submit error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Leave Requests for User
  static Future<List<dynamic>> fetchLeaveRequests(String userId) async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/leaves?userId=$userId"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch leaves error: $e");
    }
    return [];
  }

  /// Fetch Live Leave Balance + Overtime-This-Month Stats for Employee
  static Future<Map<String, dynamic>?> fetchLeaveBalance(String userId) async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/leaves/balance?userId=$userId"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] != null) {
        return Map<String, dynamic>.from(body['data']);
      }
    } catch (e) {
      print("[ApiService] Fetch leave balance error: $e");
    }
    return null;
  }


  /// Submit Overtime Request (SPL)
  static Future<Map<String, dynamic>?> submitOvertimeRequest({
    required String userId,
    required String date,
    required String startTime,
    required String endTime,
    required double durationHours,
    required String taskDescription,
    int rateApplied = 25000,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/overtime"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'date': date,
          'startTime': startTime,
          'endTime': endTime,
          'durationHours': durationHours,
          'taskDescription': taskDescription,
          'rateApplied': rateApplied,
          'compensationAmount': (durationHours * rateApplied).round(),
        }),
      ).timeout(const Duration(seconds: 10));

      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Overtime submit error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Overtime Requests for User
  static Future<List<dynamic>> fetchOvertimeRequests(String userId) async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/overtime?userId=$userId"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch overtime error: $e");
    }
    return [];
  }

  /// Fetch Official Salary Slip for User
  static Future<Map<String, dynamic>?> fetchSalarySlip(String userId, {String? periodId}) async {
    try {
      String url = "$baseUrl/payroll/my-slip?userId=$userId";
      if (periodId != null && periodId.isNotEmpty) {
        url += "&periodId=$periodId";
      }
      final response = await http.get(
        Uri.parse(url),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print("[ApiService] Fetch salary slip error: $e");
    }
    return null;
  }

  /// Fetch Notifications for User and Role
  static Future<List<dynamic>> fetchNotifications(String userId, {String? role}) async {
    try {
      final url = role != null 
          ? "$baseUrl/notifications?userId=$userId&role=$role"
          : "$baseUrl/notifications?userId=$userId";
      final response = await http.get(
        Uri.parse(url),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch notifications error: $e");
    }
    return [];
  }

  /// Mark Notification as Read
  static Future<bool> markNotificationAsRead(String notifId) async {
    try {
      final response = await http.patch(
        Uri.parse("$baseUrl/notifications/$notifId/read"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      final body = jsonDecode(response.body);
      return body['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Mark All Notifications as Read for User or Role
  static Future<bool> markAllNotificationsAsRead({String? userId, String? role}) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/notifications/read-all"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'role': role,
        }),
      ).timeout(const Duration(seconds: 5));
      final body = jsonDecode(response.body);
      return body['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Submit Shift Swap / Vacancy Request (Karyawan tidak memilih pengganti sendiri)
  static Future<Map<String, dynamic>?> submitShiftSwap({
    required String requesterId,
    String? substituteId,
    required String swapDate,
    required String originalShift,
    required String targetShift,
    required String reason,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/shift-swaps"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'requesterId': requesterId,
          'substituteId': substituteId,
          'swapDate': swapDate,
          'originalShift': originalShift,
          'targetShift': targetShift,
          'reason': reason,
        }),
      ).timeout(const Duration(seconds: 10));

      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Submit shift swap error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Smart Candidate Recommendations
  static Future<List<dynamic>> fetchSmartCandidates({
    required String requesterId,
    required String swapDate,
    String originalShift = 'Reguler',
  }) async {
    try {
      final res = await http.get(
        Uri.parse("$baseUrl/shift-swaps/smart-candidates?requesterId=$requesterId&swapDate=$swapDate&originalShift=$originalShift"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(res.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch smart candidates error: $e");
    }
    return [];
  }

  /// Danru Recommend Candidate
  static Future<Map<String, dynamic>?> danruRecommendSwap({
    required String swapId,
    required String danruId,
    required String danruName,
    required String recommendedSubstituteId,
    required String danruNotes,
    String action = 'recommended',
  }) async {
    try {
      final res = await http.put(
        Uri.parse("$baseUrl/shift-swaps/$swapId/danru-recommend"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'danruId': danruId,
          'danruName': danruName,
          'recommendedSubstituteId': recommendedSubstituteId,
          'danruNotes': danruNotes,
          'action': action,
        }),
      ).timeout(const Duration(seconds: 10));

      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Korlap Final Approval & Assignment (Decision Maker)
  static Future<Map<String, dynamic>?> korlapApproveSwap({
    required String swapId,
    required String korlapId,
    required String korlapName,
    required String assignedSubstituteId,
    required String action,
    String? notes,
  }) async {
    try {
      final res = await http.put(
        Uri.parse("$baseUrl/shift-swaps/$swapId/approval"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'approverId': korlapId,
          'approverName': korlapName,
          'approverRole': 'korlap',
          'assignedSubstituteId': assignedSubstituteId,
          'status': action,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 10));

      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Shift Swaps for User or Role
  static Future<List<dynamic>> fetchShiftSwaps(String userId) async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/shift-swaps?userId=$userId"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch shift swaps error: $e");
    }
    return [];
  }

  /// Peer Action (Accept / Reject) Shift Swap
  static Future<Map<String, dynamic>?> peerActionShiftSwap({
    required String swapId,
    required String action,
    String? notes,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/shift-swaps/$swapId/peer-action"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'action': action,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 8));

      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Peer action error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  // ── SUPERVISOR / MANAGEMENT APIs ─────────────────────────────────────────

  /// Fetch ALL pending leave submissions (for Korlap / Kepala Regu panel)
  static Future<List<dynamic>> fetchAllLeaveRequests({String? status, String? divisionId}) async {
    try {
      final params = <String, String>{};
      if (status != null) params['status'] = status;
      if (divisionId != null) params['divisionId'] = divisionId;
      final uri = Uri.parse("$baseUrl/leaves").replace(queryParameters: params.isEmpty ? null : params);
      final response = await http.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch all leaves error: $e");
    }
    return [];
  }

  /// Fetch ALL overtime submissions (for Korlap / Kepala Regu panel)
  static Future<List<dynamic>> fetchAllOvertimeRequests({String? status, String? divisionId}) async {
    try {
      final params = <String, String>{};
      if (status != null) params['status'] = status;
      if (divisionId != null) params['divisionId'] = divisionId;
      final uri = Uri.parse("$baseUrl/overtime").replace(queryParameters: params.isEmpty ? null : params);
      final response = await http.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) {
        return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch all overtime error: $e");
    }
    return [];
  }

  /// Kepala Regu / Korlap: Update Leave Status (approve/reject)
  static Future<Map<String, dynamic>?> updateLeaveStatus({
    required String leaveId,
    required String status, // 'approved' | 'rejected'
    required String approverId,
    required String approverName,
    String? notes,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/leaves/$leaveId/status"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'status': status,
          'approverId': approverId,
          'approverName': approverName,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Update leave status error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Kepala Regu / Korlap: Update Overtime Status (approve/reject)
  static Future<Map<String, dynamic>?> updateOvertimeStatus({
    required String overtimeId,
    required String status,
    required String approverId,
    required String approverName,
    double? approvedHours,
    String? notes,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/overtime/$overtimeId/status"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'status': status,
          'approverId': approverId,
          'approverName': approverName,
          if (approvedHours != null) 'approvedHours': approvedHours,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      print("[ApiService] Update overtime status error: $e");
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Analytics Summary for Pimpinan / Keuangan dashboard
  static Future<Map<String, dynamic>?> fetchAnalyticsSummary({String? divisionId}) async {
    try {
      final url = divisionId != null
          ? "$baseUrl/analytics/summary?divisionId=$divisionId"
          : "$baseUrl/analytics/summary";
      final response = await http.get(
        Uri.parse(url),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch analytics error: $e");
    }
    return null;
  }

  /// Fetch per-employee attendance analytics (for individual progress chart)
  static Future<List<dynamic>> fetchEmployeeMetrics({String? divisionId, String? kepalaReguId}) async {
    try {
      final params = <String, String>{};
      if (divisionId != null) params['divisionId'] = divisionId;
      if (kepalaReguId != null) params['kepalaReguId'] = kepalaReguId;
      final uri = Uri.parse("$baseUrl/analytics/employees").replace(queryParameters: params.isEmpty ? null : params);
      final response = await http.get(uri, headers: {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 12));
      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) return body['data'];
    } catch (e) {
      print("[ApiService] Fetch employee metrics error: $e");
    }
    return [];
  }

  /// Fetch all shift swaps (for Approval Panel — Korlap & Kepala Regu)
  static Future<List<dynamic>> fetchAllShiftSwaps({String? status, String? divisionId}) async {
    try {
      final params = <String, String>{};
      if (status != null) params['status'] = status;
      if (divisionId != null) params['divisionId'] = divisionId;
      final uri = Uri.parse("$baseUrl/shift-swaps/all").replace(queryParameters: params.isEmpty ? null : params);
      final response = await http.get(uri, headers: {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 12));
      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) return body['data'];
    } catch (e) {
      print("[ApiService] Fetch all shift swaps error: $e");
    }
    return [];
  }

  /// Kepala Regu (Danru) approves/rejects shift swap as Checker
  static Future<Map<String, dynamic>> approveShiftSwapDanru({
    required String swapId,
    required String danruId,
    required String danruName,
    required String action, // 'recommended' | 'rejected'
    String? recommendedSubstituteId,
    String? notes,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/shift-swaps/$swapId/danru-approve"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'danruId': danruId,
          'danruName': danruName,
          'action': action,
          if (recommendedSubstituteId != null) 'recommendedSubstituteId': recommendedSubstituteId,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Korlap approves/rejects shift swap as Final Approver
  static Future<Map<String, dynamic>> approveShiftSwapKorlap({
    required String swapId,
    required String korlapId,
    required String korlapName,
    required String action, // 'approved' | 'rejected'
    String? substituteId,
    String? notes,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/shift-swaps/$swapId/korlap-approve"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({
          'korlapId': korlapId,
          'korlapName': korlapName,
          'action': action,
          if (substituteId != null) 'substituteId': substituteId,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Employee Self-Progress Analytics
  static Future<Map<String, dynamic>?> fetchSelfProgress({required String userId}) async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/analytics/self?userId=${Uri.encodeComponent(userId)}"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 12));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) return body['data'];
      }
    } catch (e) {
      print("[ApiService] Fetch self progress error: $e");
    }
    return null;
  }

  /// Fetch Kepala Regu list with assigned employees (Superadmin/Admin management)
  static Future<List<dynamic>> fetchKepalaReguList() async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/kepala-regu/list"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));
      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) return body['data'];
    } catch (e) {
      print("[ApiService] Fetch kepala regu list error: $e");
    }
    return [];
  }

  /// Fetch all employees with their kepala_regu assignment
  static Future<List<dynamic>> fetchKepalaReguEmployees() async {
    try {
      final response = await http.get(
        Uri.parse("$baseUrl/kepala-regu/employees"),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));
      final body = jsonDecode(response.body);
      if (body['success'] == true && body['data'] is List) return body['data'];
    } catch (e) {
      print("[ApiService] Fetch kepala regu employees error: $e");
    }
    return [];
  }

  /// Assign employee to a Kepala Regu
  static Future<Map<String, dynamic>> assignKepalaRegu({
    required String employeeId,
    String? kepalaReguId,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/kepala-regu/assign"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({'employeeId': employeeId, 'kepalaReguId': kepalaReguId}),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Bulk assign division to a Kepala Regu
  static Future<Map<String, dynamic>> bulkAssignKepalaRegu({
    required String kepalaReguId,
    required String divisionId,
  }) async {
    try {
      final response = await http.put(
        Uri.parse("$baseUrl/kepala-regu/bulk-assign"),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({'kepalaReguId': kepalaReguId, 'divisionId': divisionId}),
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}
