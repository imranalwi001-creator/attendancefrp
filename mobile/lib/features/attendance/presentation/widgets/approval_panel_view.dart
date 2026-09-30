import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';
import '../../../../core/utils/role_helper.dart';

/// Approval Panel — for Kepala Regu (checker) and Korlap (approver/final decision).
/// Layout: segmented tabs Pending | Semua, with action cards and checker/approver role gating.
class ApprovalPanelView extends StatefulWidget {
  final String userId;
  final String userName;
  final String userRole;
  final String? divisionId;

  const ApprovalPanelView({
    super.key,
    required this.userId,
    required this.userName,
    required this.userRole,
    this.divisionId,
  });

  @override
  State<ApprovalPanelView> createState() => _ApprovalPanelViewState();
}

class _ApprovalPanelViewState extends State<ApprovalPanelView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _leaves = [];
  List<dynamic> _overtimes = [];
  List<dynamic> _shiftSwaps = [];

  // Filter: 'pending' | 'all' | 'my_history'
  String _filter = 'pending';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final statusParam = _filter == 'pending' ? 'pending' : null;
      // For kepala_regu: scope by divisionId server-side; korlap/pimpinan see all
      final scopedDivId = widget.userRole == 'kepala_regu' ? widget.divisionId : null;
      final results = await Future.wait([
        ApiService.fetchAllLeaveRequests(status: statusParam, divisionId: scopedDivId),
        ApiService.fetchAllOvertimeRequests(status: statusParam, divisionId: scopedDivId),
        ApiService.fetchAllShiftSwaps(status: statusParam, divisionId: scopedDivId),
      ]);
      if (mounted) {
        setState(() {
          _leaves     = results[0];
          _overtimes  = results[1];
          _shiftSwaps = results[2];
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> get pendingLeaves   => _leaves.where((l) => l['status'] == 'pending').toList();
  List<dynamic> get pendingOvertimes=> _overtimes.where((o) => o['status'] == 'pending').toList();
  List<dynamic> get pendingSwaps    => _shiftSwaps.where((s) {
    final st = (s['status'] ?? '').toString().toLowerCase();
    return st == 'pending' || st == 'pending_danru' || st == 'pending_korlap';
  }).toList();

  @override
  Widget build(BuildContext context) {
    final isApprover = RoleHelper.isApprover(widget.userRole);
    final isChecker  = RoleHelper.isChecker(widget.userRole);
    final roleColor  = Color(RoleHelper.roleBadgeColor(widget.userRole));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Header ─────────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: roleColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          RoleHelper.roleLabel(widget.userRole).toUpperCase(),
                          style: TextStyle(
                            color: roleColor,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isApprover ? '• Final Approver' : '• Checker',
                        style: TextStyle(color: roleColor, fontSize: 10, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Panel Pengajuan', style: AppTypography.titleMedium.copyWith(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text('Verifikasi & keputusan pengajuan karyawan', style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.primary),
                onPressed: _loadData,
              ),
            ],
          ),
        ),

        // ── Filter Toggle ────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('Perlu Tindakan', 'pending'),
                const SizedBox(width: 8),
                _filterChip('Semua Tim', 'all'),
                const SizedBox(width: 8),
                _filterChip('Riwayat Saya', 'my_history'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),

        // ── Tab: Cuti | Lembur | Pengganti Pos ────────────────────────────
        Container(
          height: 40,
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
          ),
          child: TabBar(
            controller: _tabController,
            dividerColor: Colors.transparent,
            dividerHeight: 0,
            indicatorSize: TabBarIndicatorSize.tab,
            indicatorPadding: EdgeInsets.zero,
            splashFactory: NoSplash.splashFactory,
            overlayColor: WidgetStateProperty.all(Colors.transparent),
            indicator: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(7),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 1))],
            ),
            labelColor: AppColors.textPrimary,
            unselectedLabelColor: AppColors.textMuted,
            labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
            tabs: [
              Tab(
                height: 34,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Izin/Cuti'),
                    const SizedBox(width: 4),
                    _countBadge(pendingLeaves.length, const Color(0xFF0284C7)),
                  ],
                ),
              ),
              Tab(
                height: 34,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Lembur'),
                    const SizedBox(width: 4),
                    _countBadge(pendingOvertimes.length, const Color(0xFF7C3AED)),
                  ],
                ),
              ),
              Tab(
                height: 34,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Pengganti Pos'),
                    const SizedBox(width: 4),
                    _countBadge(pendingSwaps.length, const Color(0xFFD97706)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // ── Content ──────────────────────────────────────────────────────
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildLeaveList(isApprover, isChecker),
                    _buildOvertimeList(isApprover, isChecker),
                    _buildShiftSwapList(isApprover, isChecker),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _filterChip(String label, String value) {
    final isSelected = _filter == value;
    return GestureDetector(
      onTap: () {
        if (_filter != value) {
          setState(() => _filter = value);
          _loadData();
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _countBadge(int count, Color color) {
    if (count == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text('$count', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
    );
  }

  Widget _buildLeaveList(bool isApprover, bool isChecker) {
    final list = _filter == 'pending'
        ? pendingLeaves
        : _filter == 'my_history'
            ? _leaves.where((l) => l['user_id'] == widget.userId || l['userId'] == widget.userId).toList()
            : _leaves;
    if (list.isEmpty) return _emptyState('Tidak ada pengajuan izin/cuti', Icons.event_available_rounded);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      itemCount: list.length,
      itemBuilder: (ctx, i) => _LeaveApprovalCard(
        item: list[i],
        approverId: widget.userId,
        approverName: widget.userName,
        isApprover: isApprover,
        isChecker: isChecker,
        onAction: _loadData,
      ),
    );
  }

  Widget _buildOvertimeList(bool isApprover, bool isChecker) {
    final list = _filter == 'pending'
        ? pendingOvertimes
        : _filter == 'my_history'
            ? _overtimes.where((o) => o['user_id'] == widget.userId || o['userId'] == widget.userId).toList()
            : _overtimes;
    if (list.isEmpty) return _emptyState('Tidak ada pengajuan lembur (SPL)', Icons.timelapse_rounded);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      itemCount: list.length,
      itemBuilder: (ctx, i) => _OvertimeApprovalCard(
        item: list[i],
        approverId: widget.userId,
        approverName: widget.userName,
        isApprover: isApprover,
        isChecker: isChecker,
        onAction: _loadData,
      ),
    );
  }

  Widget _buildShiftSwapList(bool isApprover, bool isChecker) {
    final list = _filter == 'pending'
        ? pendingSwaps
        : _filter == 'my_history'
            ? _shiftSwaps.where((s) => s['requester_id'] == widget.userId || s['requesterId'] == widget.userId).toList()
            : _shiftSwaps;
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.only(top: 80),
          child: Column(
            children: [
              const Icon(Icons.swap_horiz_rounded, size: 56, color: Color(0xFFCBD5E1)),
              const SizedBox(height: 12),
              Text(
                _filter == 'my_history'
                    ? 'Anda belum memiliki riwayat pengajuan tukar shift'
                    : 'Tidak ada pengajuan tukar shift${_filter == 'pending' ? ' yang perlu tindakan' : ''}',
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      itemCount: list.length,
      itemBuilder: (context, i) {
        final raw = list[i];
        final item = raw is Map<String, dynamic>
            ? raw
            : Map<String, dynamic>.from(raw as Map);
        return _ShiftSwapApprovalCard(
          item: item,
          approverId: widget.userId,
          approverName: widget.userName,
          isApprover: isApprover,
          isChecker: isChecker,
          onAction: _loadData,
        );
      },
    );
  }

  Widget _emptyState(String label, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: AppColors.textDisabled),
          const SizedBox(height: 12),
          Text(label, style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

// ─── Leave Approval Card ───────────────────────────────────────────────────────
class _LeaveApprovalCard extends StatelessWidget {
  final dynamic item;
  final String approverId;
  final String approverName;
  final bool isApprover;
  final bool isChecker;
  final VoidCallback onAction;

  const _LeaveApprovalCard({
    required this.item,
    required this.approverId,
    required this.approverName,
    required this.isApprover,
    required this.isChecker,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final status = (item['status'] ?? 'pending').toString().toLowerCase();
    final isPending = status == 'pending';
    final isApproved = status == 'approved';
    final statusColor = isApproved
        ? const Color(0xFF059669)
        : (status == 'rejected' ? const Color(0xFFDC2626) : const Color(0xFFD97706));
    final statusText = isApproved ? 'Disetujui' : (status == 'rejected' ? 'Ditolak' : 'Menunggu');

    final typeRaw = (item['leave_type'] ?? 'Izin').toString();
    final typeLabel = typeRaw.replaceAll('_', ' ').toUpperCase();
    final startStr = item['start_date']?.toString().split('T')[0] ?? '';
    final endStr   = item['end_date']?.toString().split('T')[0] ?? '';
    final days     = item['total_days'] ?? 1;
    final name     = item['user_name'] ?? 'Karyawan';
    final nip      = item['user_nip'] ?? '';
    final division = item['division_name'] ?? '';
    final reason   = item['reason'] ?? '';
    final ticketId = (item['id'] ?? '').toString();
    final short    = ticketId.length > 8 ? '#${ticketId.substring(0, 8).toUpperCase()}' : '#$ticketId';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPending ? const Color(0xFFFDE68A) : AppColors.border,
          width: isPending ? 1.5 : 1,
        ),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name, style: AppTypography.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w800)),
                          const SizedBox(width: 6),
                          if (nip.isNotEmpty)
                            Text('• $nip', style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 10)),
                        ],
                      ),
                      if (division.isNotEmpty)
                        Text(division, style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Leave Type & Ticket Badge
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(5)),
                  child: Text(typeLabel, style: const TextStyle(color: Color(0xFF2563EB), fontSize: 10, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 8),
                Text(short, style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 10)),
              ],
            ),
            const SizedBox(height: 6),

            // Date & Duration
            Text(
              '$startStr ${endStr.isNotEmpty && endStr != startStr ? 's/d $endStr' : ''} ($days hari)',
              style: AppTypography.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w700),
            ),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(reason, style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],

            // Action Buttons
            if (isPending && (isApprover || isChecker)) ...[
              const SizedBox(height: 12),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 10),
              if (isApprover)
                _approvalButtons(context)
              else if (isChecker)
                _checkerNote(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _approvalButtons(BuildContext ctx) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.close_rounded, size: 15),
            label: const Text('Tolak', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
              side: const BorderSide(color: Color(0xFFFECACA)),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => _showDecisionSheet(ctx, 'rejected'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ElevatedButton.icon(
            icon: const Icon(Icons.check_rounded, size: 15, color: Colors.white),
            label: const Text('Setujui', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            onPressed: () => _showDecisionSheet(ctx, 'approved'),
          ),
        ),
      ],
    );
  }

  Widget _checkerNote(BuildContext ctx) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFD97706)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Anda sebagai Checker. Keputusan akhir ditetapkan oleh Korlap.',
              style: TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showDecisionSheet(BuildContext ctx, String action) async {
    final notesController = TextEditingController();
    final confirm = await showModalBottomSheet<bool>(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 16),
              Text(
                action == 'approved' ? '✅ Setujui Pengajuan' : '❌ Tolak Pengajuan',
                style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text('Catatan (opsional):', style: AppTypography.labelSmall),
              const SizedBox(height: 8),
              TextField(
                controller: notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: action == 'approved' ? 'Disetujui sesuai ketentuan...' : 'Alasan penolakan...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: action == 'approved' ? const Color(0xFF059669) : const Color(0xFFDC2626),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(
                    action == 'approved' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      final res = await ApiService.updateLeaveStatus(
        leaveId: item['id'].toString(),
        status: action,
        approverId: approverId,
        approverName: approverName,
        notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
      );
      if (res?['success'] == true) onAction();
    }
  }
}

// ─── Overtime Approval Card ────────────────────────────────────────────────────
class _OvertimeApprovalCard extends StatelessWidget {
  final dynamic item;
  final String approverId;
  final String approverName;
  final bool isApprover;
  final bool isChecker;
  final VoidCallback onAction;

  const _OvertimeApprovalCard({
    required this.item,
    required this.approverId,
    required this.approverName,
    required this.isApprover,
    required this.isChecker,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final status   = (item['status'] ?? 'pending').toString().toLowerCase();
    final isPending = status == 'pending';
    final isApproved = status == 'approved';
    final statusColor = isApproved
        ? const Color(0xFF059669)
        : (status == 'rejected' ? const Color(0xFFDC2626) : const Color(0xFFD97706));
    final statusText = isApproved ? 'Disetujui' : (status == 'rejected' ? 'Ditolak' : 'Menunggu');

    final fmt  = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    final comp = (item['compensation_amount'] is num)
        ? item['compensation_amount'] as num
        : num.tryParse(item['compensation_amount']?.toString() ?? '0') ?? 0;
    final hours    = item['duration_hours']?.toString() ?? '2.0';
    final dateStr  = item['date']?.toString().split('T')[0] ?? '';
    final name     = item['user_name'] ?? 'Karyawan';
    final nip      = item['user_nip'] ?? '';
    final division = item['division_name'] ?? '';
    final taskDesc = item['task_description'] ?? 'Operasional';
    final ticketId = (item['id'] ?? '').toString();
    final short    = ticketId.length > 8 ? '#${ticketId.substring(0, 8).toUpperCase()}' : '#$ticketId';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPending ? const Color(0xFFDDD6FE) : AppColors.border,
          width: isPending ? 1.5 : 1,
        ),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name, style: AppTypography.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w800)),
                          const SizedBox(width: 6),
                          if (nip.isNotEmpty)
                            Text('• $nip', style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 10)),
                        ],
                      ),
                      if (division.isNotEmpty)
                        Text(division, style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(5)),
                  child: const Text('SPL', style: TextStyle(color: Color(0xFF7C3AED), fontSize: 10, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 8),
                Text(short, style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 10)),
              ],
            ),
            const SizedBox(height: 6),
            Text('$dateStr • $hours Jam Kerja', style: AppTypography.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w700)),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text(taskDesc, style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted), maxLines: 2, overflow: TextOverflow.ellipsis)),
                Text(fmt.format(comp), style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800, fontSize: 13)),
              ],
            ),

            if (isPending && (isApprover || isChecker)) ...[
              const SizedBox(height: 12),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 10),
              if (isApprover)
                _approvalButtons(context)
              else if (isChecker)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFD97706)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Anda sebagai Checker. Keputusan akhir ditetapkan oleh Korlap.',
                          style: TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _approvalButtons(BuildContext ctx) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.close_rounded, size: 15),
            label: const Text('Tolak', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
              side: const BorderSide(color: Color(0xFFFECACA)),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => _showDecision(ctx, 'rejected'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ElevatedButton.icon(
            icon: const Icon(Icons.check_rounded, size: 15, color: Colors.white),
            label: const Text('Setujui', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C3AED),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            onPressed: () => _showDecision(ctx, 'approved'),
          ),
        ),
      ],
    );
  }

  Future<void> _showDecision(BuildContext ctx, String action) async {
    final notesCtrl = TextEditingController();
    final confirm = await showModalBottomSheet<bool>(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Text(action == 'approved' ? '✅ Setujui SPL' : '❌ Tolak SPL', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              TextField(
                controller: notesCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: action == 'approved' ? 'Disetujui sesuai perintah...' : 'Alasan penolakan...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: action == 'approved' ? const Color(0xFF7C3AED) : const Color(0xFFDC2626),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(action == 'approved' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      final res = await ApiService.updateOvertimeStatus(
        overtimeId: item['id'].toString(),
        status: action,
        approverId: approverId,
        approverName: approverName,
        notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      );
      if (res?['success'] == true) onAction();
    }
  }
}

// ─── Shift Swap Approval Card ──────────────────────────────────────────────────
class _ShiftSwapApprovalCard extends StatefulWidget {
  final Map<String, dynamic> item;
  final String approverId;
  final String approverName;
  final bool isApprover;
  final bool isChecker;
  final VoidCallback onAction;

  const _ShiftSwapApprovalCard({
    required this.item,
    required this.approverId,
    required this.approverName,
    required this.isApprover,
    required this.isChecker,
    required this.onAction,
  });

  @override
  State<_ShiftSwapApprovalCard> createState() => _ShiftSwapApprovalCardState();
}

class _ShiftSwapApprovalCardState extends State<_ShiftSwapApprovalCard> {
  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 12, color: const Color(0xFF94A3B8)),
          const SizedBox(width: 6),
          Text('$label: ', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 11, color: Color(0xFF374151)), maxLines: 2, overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final item         = widget.item;
    final isApprover   = widget.isApprover;
    final isChecker    = widget.isChecker;
    final status       = (item['status'] ?? '').toString().toLowerCase();
    final requesterName= item['requester_name'] ?? 'Karyawan';
    final division     = item['requester_division'] ?? '';
    final swapDate     = item['swap_date']?.toString().substring(0, 10) ?? '-';
    final originalShift= item['original_shift'] ?? 'Reguler';
    final reason       = item['reason'] ?? '';
    final danruName    = item['danru_name'];
    final korlapName   = item['korlap_name'];
    final substituteName = item['substitute_name'] ?? item['danru_substitute_name'];

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'approved':
        statusColor = const Color(0xFF059669); statusLabel = '✓ Disetujui';   break;
      case 'rejected':
        statusColor = const Color(0xFFDC2626); statusLabel = '✗ Ditolak';     break;
      case 'pending_korlap':
        statusColor = const Color(0xFF2563EB); statusLabel = '⟳ Menunggu Korlap'; break;
      default:
        statusColor = const Color(0xFFD97706); statusLabel = '⌛ Menunggu Danru'; break;
    }

    final isPending = status == 'pending' || status == 'pending_danru' || status == 'pending_korlap';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isPending ? const Color(0xFFD97706).withValues(alpha: 0.3) : AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: const Color(0xFFD97706).withValues(alpha: 0.1), shape: BoxShape.circle),
                      child: const Icon(Icons.swap_horiz_rounded, color: Color(0xFFD97706), size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(requesterName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                          if (division.isNotEmpty)
                            Text(division, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _infoRow(Icons.calendar_today_rounded, 'Tanggal', swapDate),
                _infoRow(Icons.schedule_rounded, 'Shift Asli', originalShift),
                if (reason.isNotEmpty) _infoRow(Icons.notes_rounded, 'Alasan', reason),
                if (substituteName != null) _infoRow(Icons.person_rounded, 'Personil Pengganti', substituteName),
                if (danruName != null) _infoRow(Icons.check_rounded, 'Ditelaah Danru', danruName),
                if (korlapName != null) _infoRow(Icons.verified_rounded, 'Diputuskan Korlap', korlapName),
              ],
            ),
          ),
          // Action Buttons
          if (isPending) ...[
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  if (isChecker && (status == 'pending' || status == 'pending_danru')) ...[
                    // Kepala Regu: Telaah & Teruskan ke Korlap
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.forward_rounded, size: 14),
                        label: const Text('Teruskan ke Korlap'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF2563EB),
                          side: const BorderSide(color: Color(0xFF2563EB)),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                        onPressed: () => _handleSwapDanruAction('recommended'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      icon: const Icon(Icons.close_rounded, size: 14),
                      label: const Text('Tolak'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626)),
                        textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onPressed: () => _handleSwapDanruAction('rejected'),
                    ),
                  ] else if (isApprover && (status == 'pending_korlap' || status == 'pending' || status == 'pending_danru')) ...[
                    // Korlap: Setujui atau Tolak
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_rounded, size: 14),
                        label: const Text('Setujui'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          elevation: 0,
                        ),
                        onPressed: () => _handleSwapKorlapAction('approved'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.cancel_rounded, size: 14),
                        label: const Text('Tolak'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFDC2626)),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        onPressed: () => _handleSwapKorlapAction('rejected'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _handleSwapDanruAction(String action) async {
    final item = widget.item;
    final notesCtrl = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(action == 'recommended' ? 'Teruskan ke Korlap' : 'Tolak Pengajuan',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(item['requester_name'] ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 14),
            TextField(
              controller: notesCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: action == 'recommended' ? 'Catatan rekomendasi (opsional)' : 'Alasan penolakan (opsional)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: action == 'recommended' ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(action == 'recommended' ? 'Teruskan ke Korlap' : 'Konfirmasi Tolak',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final res = await ApiService.approveShiftSwapDanru(
        swapId: item['id'].toString(),
        danruId: widget.approverId,
        danruName: widget.approverName,
        action: action,
        notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? (res['success'] == true ? 'Berhasil!' : 'Gagal')),
          backgroundColor: res['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
        ));
        if (res['success'] == true) widget.onAction();
      }
    }
  }

  Future<void> _handleSwapKorlapAction(String action) async {
    final item = widget.item;
    final notesCtrl = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(action == 'approved' ? '✅ Setujui Pengajuan Tukar Shift' : '❌ Tolak Pengajuan Tukar Shift',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('${item['requester_name'] ?? ''} — ${item['swap_date']?.toString().substring(0, 10) ?? ''}',
                style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 14),
            if (action == 'approved')
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10)),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF059669)),
                    SizedBox(width: 8),
                    Expanded(child: Text('Keputusan Anda sebagai Korlap bersifat FINAL dan akan segera dinotifikasikan ke karyawan.',
                        style: TextStyle(fontSize: 11, color: Color(0xFF059669)))),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            TextField(
              controller: notesCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: action == 'approved' ? 'Catatan persetujuan (opsional)' : 'Alasan penolakan',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: action == 'approved' ? const Color(0xFF059669) : const Color(0xFFDC2626),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(action == 'approved' ? 'Konfirmasi Setujui (Final)' : 'Konfirmasi Tolak',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final res = await ApiService.approveShiftSwapKorlap(
        swapId: item['id'].toString(),
        korlapId: widget.approverId,
        korlapName: widget.approverName,
        action: action,
        notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? (res['success'] == true ? 'Berhasil!' : 'Gagal')),
          backgroundColor: res['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
        ));
        if (res['success'] == true) widget.onAction();
      }
    }
  }
}
