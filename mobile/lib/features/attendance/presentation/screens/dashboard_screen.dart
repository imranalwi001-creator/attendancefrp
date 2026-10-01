import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';
import '../../../../core/services/system_notification_service.dart';
import '../../../../core/utils/role_helper.dart';
import '../controllers/attendance_controller.dart';
import '../widgets/header_section_widget.dart';
import '../widgets/hero_action_card.dart';
import '../widgets/quick_action_grid.dart';
import '../widgets/monthly_metrics_grid.dart';
import '../widgets/recent_activity_section.dart';
import '../widgets/attendance_history_view.dart';
import '../widgets/submissions_view.dart';
import '../widgets/profile_view.dart';
import '../widgets/notifications_sheet.dart';
import '../widgets/approval_panel_view.dart';
import '../widgets/analytics_dashboard_view.dart';
import '../widgets/employee_self_progress_view.dart';
import '../widgets/kepala_regu_management_view.dart';
import '../../../../core/widgets/app_update_dialog.dart';

import '../../../auth/presentation/screens/login_screen.dart';

class AttendanceDashboardScreen extends StatefulWidget {
  final Map<String, dynamic>? initialUser;

  const AttendanceDashboardScreen({super.key, this.initialUser});

  @override
  State<AttendanceDashboardScreen> createState() => _AttendanceDashboardScreenState();
}

class _AttendanceDashboardScreenState extends State<AttendanceDashboardScreen> {
  late final AttendanceController _controller;
  int _selectedBottomNavIndex = 0;
  int _submissionsInitialTab  = 0;
  int _unreadNotifCount       = 0;
  Timer? _notifPollTimer;

  // ── Role helpers ─────────────────────────────────────────────────────────
  String get _role => _controller.roleName;

  /// True for supervisor roles that see extra management tabs
  bool get _isSupervisory => RoleHelper.canSeeAllSubmissions(_role);
  bool get _canSeeAnalytics => RoleHelper.canSeeAnalytics(_role);

  /// Bottom nav items change based on role
  List<_NavItem> get _navItems {
    final base = [
      _NavItem(0, Icons.dashboard_rounded, 'Beranda'),
      _NavItem(1, Icons.history_rounded, 'Riwayat'),
    ];

    if (RoleHelper.isKaryawan(_role)) {
      // Karyawan: Beranda | Riwayat | Pengajuan | Progres | Profil
      return [
        ...base,
        _NavItem(2, Icons.assignment_outlined, 'Pengajuan'),
        _NavItem(7, Icons.insert_chart_outlined_rounded, 'Progres'),
        _NavItem(3, Icons.person_outline_rounded, 'Profil'),
      ];
    }

    if (RoleHelper.isChecker(_role)) {
      // Kepala Regu: Beranda | Riwayat | Pengajuan | Panel Checker | Analitik | Profil
      return [
        ...base,
        _NavItem(2, Icons.assignment_outlined, 'Pengajuan'),
        _NavItem(4, Icons.checklist_rounded, 'Panel'),
        _NavItem(5, Icons.bar_chart_rounded, 'Analitik'),
        _NavItem(3, Icons.person_outline_rounded, 'Profil'),
      ];
    }

    if (RoleHelper.isKorlap(_role)) {
      // Korlap: Beranda | Riwayat | Approvals | Analitik | Kelola | Profil
      return [
        ...base,
        _NavItem(4, Icons.verified_rounded, 'Approvals'),
        _NavItem(5, Icons.bar_chart_rounded, 'Analitik'),
        _NavItem(6, Icons.manage_accounts_rounded, 'Kelola'),
        _NavItem(3, Icons.person_outline_rounded, 'Profil'),
      ];
    }

    // Superadmin: same as Korlap but also sees KepalaRegu management
    if (RoleHelper.isSuperAdmin(_role) || RoleHelper.isAdmin(_role)) {
      return [
        ...base,
        _NavItem(4, Icons.verified_rounded, 'Approvals'),
        _NavItem(5, Icons.bar_chart_rounded, 'Analitik'),
        _NavItem(6, Icons.manage_accounts_rounded, 'Kelola KR'),
        _NavItem(3, Icons.person_outline_rounded, 'Profil'),
      ];
    }

    // Pimpinan / Keuangan / HRD:
    // Beranda | Riwayat | Approvals | Analitik | Profil
    return [
      ...base,
      _NavItem(4, Icons.verified_rounded, 'Approvals'),
      _NavItem(5, Icons.bar_chart_rounded, 'Analitik'),
      _NavItem(3, Icons.person_outline_rounded, 'Profil'),
    ];
  }

  @override
  void initState() {
    super.initState();
    _controller = AttendanceController(initialUser: widget.initialUser);
    _fetchNotifications();
    SystemNotificationService.requestPermission();
    _notifPollTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      _fetchNotifications(silent: true);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      AppUpdateChecker.checkForUpdate(context);
    });
  }

  @override
  void dispose() {
    _notifPollTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _fetchNotifications({bool silent = false}) async {
    try {
      final activeUserId = _controller.profile.id;
      final activeRole   = _controller.roleName;
      final list = await ApiService.fetchNotifications(activeUserId, role: activeRole);
      SystemNotificationService.checkAndNotifyNewItems(list);
      if (mounted) {
        setState(() {
          _unreadNotifCount = list.where((n) => n is Map && n['is_read'] != true).length;
        });
      }
    } catch (_) {}
  }

  void _openNotificationsSheet() {
    NotificationsSheet.show(
      context,
      userId: _controller.profile.id,
      role: _controller.roleName,
      onUpdated: _fetchNotifications,
      onNotificationSelected: (notif) {
        final type    = (notif['type'] ?? '').toString().toLowerCase();
        final title   = (notif['title'] ?? '').toString().toLowerCase();
        final message = (notif['message'] ?? '').toString().toLowerCase();

        int targetTab = 0;
        if (type == 'overtime' || title.contains('lembur') || message.contains('lembur')) {
          targetTab = 1;
        } else if (type == 'swap' || title.contains('tukar') || message.contains('tukar')) {
          targetTab = 2;
        }

        // Supervisors go to Approval Panel on any notification
        if (_isSupervisory) {
          setState(() {
            _selectedBottomNavIndex = 4; // Approvals tab
            _submissionsInitialTab  = targetTab;
          });
        } else {
          setState(() {
            _selectedBottomNavIndex = 2;
            _submissionsInitialTab  = targetTab;
          });
        }
        _fetchNotifications();
      },
    );
  }

  Future<void> _onRefresh() async {
    await Future.wait([
      _controller.checkLiveLocation(),
      _controller.syncWithDatabase(
          authenticatedUserId: widget.initialUser?['id'] ?? widget.initialUser?['email']),
      _fetchNotifications(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final activeEmail    = _controller.currentUser?['email'] ?? '';
        final activeName     = _controller.employeeName;
        final activeUserId   = _controller.profile.id;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: _buildAppBar(),
          body: SafeArea(
            child: _buildBody(activeUserId, activeName, activeEmail),
          ),
          bottomNavigationBar: _buildBottomNav(),
        );
      },
    );
  }

  Widget _buildBody(String userId, String name, String email) {
    switch (_selectedBottomNavIndex) {
      // ── Tab 1: Riwayat Kehadiran ──────────────────────────────────────
      case 1:
        return AttendanceHistoryView(controller: _controller);

      // ── Tab 2: Pengajuan Saya (Karyawan + Kepala Regu) ───────────────
      case 2:
        return SubmissionsView(
          userId: userId,
          userName: name,
          initialTabIndex: _submissionsInitialTab,
        );

      // ── Tab 3: Profil ─────────────────────────────────────────────────
      case 3:
        return ProfileView(
          user: {
            ...?_controller.currentUser,
            'id': userId,
            'fullName': name,
            'nip': _controller.userNip,
            'email': email,
            'roleName': _role,
            'divisionName': _controller.divisionName,
            'avatarUrl': _controller.profile.avatarUrl,
          },
        );

      // ── Tab 4: Approval Panel (Kepala Regu + Korlap + Mgmt) ──────────
      case 4:
        return ApprovalPanelView(
          userId: userId,
          userName: name,
          userRole: _role,
          divisionId: _controller.profile.divisionId,
        );

      // ── Tab 5: Analytics Dashboard (Korlap + Pimpinan + Keuangan + Admin) ──
      case 5:
        return AnalyticsDashboardView(
          userRole: _role,
          userName: name,
          divisionId: _controller.profile.divisionId, // for kepala_regu scoping
        );

      // ── Tab 6: Kepala Regu Management (Superadmin / Admin / Korlap) ───────
      case 6:
        return KepalaReguManagementView(adminRole: _role);

      // ── Tab 7: Self Progress (Karyawan + all roles) ───────────────────────
      case 7:
        return EmployeeSelfProgressView(
          userId: userId,
          userName: name,
          userRole: _role,
          divisionId: _controller.profile.divisionId,
        );

      // ── Tab 0: Beranda (Home) ──────────────────────────────────────────
      default:
        return RefreshIndicator(
          onRefresh: _onRefresh,
          color: AppColors.primary,
          backgroundColor: AppColors.surface,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_controller.isOfflineMode) ...[
                  _buildOfflineBanner(),
                  const SizedBox(height: 12),
                ],

                // ── Role Banner for supervisors (non-karyawan) ───────────
                if (!RoleHelper.isKaryawan(_role)) ...[
                  _buildRoleBanner(),
                  const SizedBox(height: 12),
                ],

                // 1. Header (Profile Bar & Today's Shift)
                HeaderSectionWidget(controller: _controller),
                const SizedBox(height: 16),

                // 2. Hero Action Card (Geofencing Radar & Clock In/Out)
                HeroActionCard(controller: _controller),
                const SizedBox(height: 24),

                // 3. Quick Actions Grid
                QuickActionGrid(
                  userId: userId,
                  userName: name,
                  onRefresh: _onRefresh,
                ),
                const SizedBox(height: 24),

                // 4. Monthly Metric Summary
                MonthlyMetricsGrid(metrics: _controller.monthlyMetrics),
                const SizedBox(height: 24),

                // 5. Recent Activity
                RecentActivitySection(
                  records: _controller.recentActivities,
                  onViewAll: () => setState(() => _selectedBottomNavIndex = 1),
                ),

                // 6. Supervisor Quick Access Cards
                if (_isSupervisory) ...[
                  const SizedBox(height: 24),
                  _buildSupervisorQuickCards(),
                ],
                const SizedBox(height: 28),
              ],
            ),
          ),
        );
    }
  }

  // ── Role Banner ───────────────────────────────────────────────────────────
  Widget _buildRoleBanner() {
    final roleColor = Color(RoleHelper.roleBadgeColor(_role));
    final roleLabel = RoleHelper.roleLabel(_role);

    String subtitle = '';
    if (RoleHelper.isApprover(_role)) {
      subtitle = 'Anda memiliki wewenang keputusan akhir pengajuan karyawan';
    } else if (RoleHelper.isChecker(_role)) {
      subtitle = 'Anda bertindak sebagai Checker. Keputusan akhir oleh Korlap';
    } else if (RoleHelper.isPimpinan(_role) || RoleHelper.isKeuangan(_role)) {
      subtitle = 'Pantau kinerja & progres karyawan melalui menu Analitik';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [roleColor.withValues(alpha: 0.08), roleColor.withValues(alpha: 0.04)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: roleColor.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: roleColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              RoleHelper.isApprover(_role)
                  ? Icons.verified_rounded
                  : RoleHelper.isChecker(_role)
                      ? Icons.checklist_rounded
                      : Icons.analytics_rounded,
              color: roleColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(roleLabel, style: TextStyle(color: roleColor, fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(width: 8),
                    if (RoleHelper.isApprover(_role))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: roleColor, borderRadius: BorderRadius.circular(4)),
                        child: const Text('APPROVER', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                      )
                    else if (RoleHelper.isChecker(_role))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: roleColor.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(4)),
                        child: Text('CHECKER', style: TextStyle(color: roleColor, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                      ),
                  ],
                ),
                if (subtitle.isNotEmpty)
                  Text(subtitle, style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontWeight: FontWeight.w400, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Supervisor Quick Access Cards ─────────────────────────────────────────
  Widget _buildSupervisorQuickCards() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Akses Cepat Manajemen', style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _quickMgmtCard(
                icon: Icons.pending_actions_rounded,
                label: 'Panel Approval',
                subtitle: 'Setujui pengajuan',
                color: const Color(0xFF059669),
                bg: const Color(0xFFF0FDF4),
                onTap: () => setState(() => _selectedBottomNavIndex = 4),
              ),
            ),
            const SizedBox(width: 10),
            if (_canSeeAnalytics)
              Expanded(
                child: _quickMgmtCard(
                  icon: Icons.bar_chart_rounded,
                  label: 'Analitik',
                  subtitle: 'Grafik kinerja',
                  color: const Color(0xFF2563EB),
                  bg: const Color(0xFFEFF6FF),
                  onTap: () => setState(() => _selectedBottomNavIndex = 5),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _quickMgmtCard({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required Color bg,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 12, color: color.withValues(alpha: 0.5)),
          ],
        ),
      ),
    );
  }

  // ── App Bar ────────────────────────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: Colors.black.withValues(alpha: 0.04),
      titleSpacing: 16,
      title: Row(
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: Image.asset('assets/images/logo.png', fit: BoxFit.contain, filterQuality: FilterQuality.high),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PT. FAWWAZ RESKI PERWIRA',
                style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, letterSpacing: 0.5, color: AppColors.textPrimary),
              ),
              Text(
                'Presensi Wajah & Lokasi',
                style: AppTypography.labelSmall.copyWith(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ],
      ),
      actions: [
        // Notification Bell
        Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            IconButton(
              icon: Icon(
                _unreadNotifCount > 0 ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
                color: _unreadNotifCount > 0 ? AppColors.primary : AppColors.textSecondary,
                size: 22,
              ),
              onPressed: _openNotificationsSheet,
              tooltip: 'Notifikasi',
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
            if (_unreadNotifCount > 0)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: Text(
                    _unreadNotifCount > 9 ? '9+' : '$_unreadNotifCount',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w900, height: 1.0),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(width: 2),
        IconButton(
          icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary, size: 20),
          onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
          tooltip: 'Keluar Akun',
        ),
        const SizedBox(width: 6),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(color: AppColors.border, height: 1),
      ),
    );
  }

  // ── Offline Banner ────────────────────────────────────────────────────────
  Widget _buildOfflineBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warningBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.warning, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Mode Offline Aktif: Presensi disimpan lokal terenkripsi.',
              style: AppTypography.labelSmall.copyWith(color: AppColors.warning, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // ── Bottom Navigation Bar ─────────────────────────────────────────────────
  Widget _buildBottomNav() {
    final items = _navItems;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.map((item) => _buildNavItem(item)).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(_NavItem item) {
    final isSelected = _selectedBottomNavIndex == item.index;
    final color      = isSelected ? AppColors.primary : AppColors.textMuted;

    return InkWell(
      onTap: () => setState(() {
        _selectedBottomNavIndex = item.index;
        if (item.index == 2) _submissionsInitialTab = 0;
      }),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(item.icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              item.label,
              style: AppTypography.labelSmall.copyWith(
                color: color,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Nav Item Model ─────────────────────────────────────────────────────────────
class _NavItem {
  final int index;
  final IconData icon;
  final String label;
  const _NavItem(this.index, this.icon, this.label);
}
