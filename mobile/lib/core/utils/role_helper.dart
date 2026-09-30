/// Role Helper — single source of truth for HRM role-based feature gating.
/// Roles: karyawan | kepala_regu | korlap | admin | superadmin | pimpinan | keuangan | hrd | pengawas
class RoleHelper {
  static bool isKaryawan(String role) =>
      _norm(role) == 'karyawan';

  static bool isKepalaRegu(String role) =>
      _norm(role) == 'kepala_regu' || _norm(role) == 'kepalaregu';

  static bool isKorlap(String role) =>
      _norm(role) == 'korlap';

  static bool isAdmin(String role) =>
      _norm(role) == 'admin' || _norm(role) == 'superadmin';

  static bool isSuperAdmin(String role) =>
      _norm(role) == 'superadmin';

  static bool isPimpinan(String role) =>
      _norm(role) == 'pimpinan';

  static bool isKeuangan(String role) =>
      _norm(role) == 'keuangan';

  static bool isHrd(String role) =>
      _norm(role) == 'hrd';

  /// Can see ALL employee submissions (leave/overtime/swap) for approval
  static bool canSeeAllSubmissions(String role) {
    final r = _norm(role);
    return ['kepala_regu', 'kepalaregu', 'korlap', 'admin', 'superadmin',
            'pimpinan', 'keuangan', 'hrd', 'pengawas'].contains(r);
  }

  /// Can act as CHECKER (first-level review, recommend approve/reject)
  static bool isChecker(String role) {
    final r = _norm(role);
    return ['kepala_regu', 'kepalaregu'].contains(r);
  }

  /// Can act as APPROVER / final decision maker
  static bool isApprover(String role) {
    final r = _norm(role);
    return ['korlap', 'admin', 'superadmin', 'hrd', 'pimpinan'].contains(r);
  }

  /// Can see performance analytics charts
  static bool canSeeAnalytics(String role) {
    final r = _norm(role);
    return ['korlap', 'admin', 'superadmin', 'pimpinan', 'keuangan',
            'hrd', 'kepala_regu', 'kepalaregu', 'pengawas'].contains(r);
  }

  /// Role badge label (human-readable)
  static String roleLabel(String role) {
    switch (_norm(role)) {
      case 'superadmin':  return 'Super Admin';
      case 'admin':       return 'Admin';
      case 'pimpinan':    return 'Pimpinan';
      case 'keuangan':    return 'Keuangan';
      case 'hrd':         return 'HRD';
      case 'korlap':      return 'Korlap';
      case 'kepala_regu':
      case 'kepalaregu':  return 'Kepala Regu';
      case 'pengawas':    return 'Pengawas';
      default:            return 'Karyawan';
    }
  }

  /// Returns a hex-style color int for role badge
  static int roleBadgeColor(String role) {
    switch (_norm(role)) {
      case 'superadmin':  return 0xFF6D28D9; // violet
      case 'admin':       return 0xFF2563EB; // blue
      case 'pimpinan':    return 0xFF0F172A; // slate-900
      case 'keuangan':    return 0xFF0284C7; // sky
      case 'hrd':         return 0xFF0891B2; // cyan
      case 'korlap':      return 0xFF059669; // emerald
      case 'kepala_regu':
      case 'kepalaregu':  return 0xFF16A34A; // green
      case 'pengawas':    return 0xFF4F46E5; // indigo
      default:            return 0xFF64748B; // slate
    }
  }

  static String _norm(String r) => r.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}
