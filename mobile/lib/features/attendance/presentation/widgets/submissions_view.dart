import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';
import 'leave_request_sheet.dart';
import 'overtime_request_sheet.dart';
import 'shift_swap_sheet.dart';

class SubmissionsView extends StatefulWidget {
  final String userId;
  final String userName;
  final int initialTabIndex;

  const SubmissionsView({
    super.key,
    required this.userId,
    required this.userName,
    this.initialTabIndex = 0,
  });

  @override
  State<SubmissionsView> createState() => _SubmissionsViewState();
}

class _SubmissionsViewState extends State<SubmissionsView> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _leaves = [];
  List<dynamic> _overtimes = [];
  List<dynamic> _shiftSwaps = [];
  int _annualQuota = 12;
  int _usedDays = 0;
  // Lembur bulan berjalan (diambil dari database langsung)
  int _overtimeApprovedCount = 0;
  double _overtimeApprovedHours = 0.0;
  double _overtimeApprovedCompensation = 0.0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 2),
    );
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
    _loadData();
  }

  @override
  void didUpdateWidget(covariant SubmissionsView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialTabIndex != oldWidget.initialTabIndex) {
      _tabController.animateTo(widget.initialTabIndex.clamp(0, 2));
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      // Parallel fetch: all lists + authoritative balance from DB
      final results = await Future.wait([
        ApiService.fetchLeaveRequests(widget.userId),
        ApiService.fetchOvertimeRequests(widget.userId),
        ApiService.fetchShiftSwaps(widget.userId),
        ApiService.fetchLeaveBalance(widget.userId),
      ]);

      final leavesRes = results[0] as List<dynamic>;
      final overtimeRes = results[1] as List<dynamic>;
      final swapRes = results[2] as List<dynamic>;
      final balance = results[3] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          _leaves = leavesRes;
          _overtimes = overtimeRes;
          _shiftSwaps = swapRes;

          if (balance != null) {
            // ✅ Data resmi langsung dari hrm_profiles (selalu sinkron)
            _annualQuota = (balance['annualLeaveQuota'] as num? ?? 12).toInt();
            _usedDays = (balance['usedLeaveDays'] as num? ?? 0).toInt();

            // Lembur bulan berjalan
            final ot = balance['overtimeThisMonth'] as Map<String, dynamic>? ?? {};
            _overtimeApprovedCount = (ot['approvedCount'] as num? ?? 0).toInt();
            _overtimeApprovedHours = (ot['approvedHours'] as num? ?? 0.0).toDouble();
            _overtimeApprovedCompensation = (ot['approvedCompensation'] as num? ?? 0.0).toDouble();
          } else {
            // Fallback offline: hitung dari list data
            int used = 0;
            for (final l in _leaves) {
              if (l['status'] == 'approved' && l['leave_type'] == 'cuti_tahunan') {
                used += (l['total_days'] as num? ?? 1).toInt();
              }
            }
            _usedDays = used;
            // Lembur: hitung dari list overtime bulan ini
            final now = DateTime.now();
            for (final o in _overtimes) {
              if (o['status'] == 'approved') {
                final d = o['date']?.toString() ?? '';
                if (d.startsWith('${now.year}-${now.month.toString().padLeft(2,'0')}')) {
                  _overtimeApprovedCount++;
                  _overtimeApprovedHours += (o['duration_hours'] as num? ?? 0).toDouble();
                  _overtimeApprovedCompensation += (o['compensation_amount'] is num
                      ? o['compensation_amount'] as num
                      : num.tryParse(o['compensation_amount']?.toString() ?? '0') ?? 0).toDouble();
                }
              }
            }
          }
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Top Header
        Padding(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 14, bottom: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Daftar Pengajuan", style: AppTypography.titleMedium.copyWith(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text("Riwayat progres cuti, lembur & tukar dinas", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.primary),
                onPressed: _loadData,
                tooltip: "Segarkan Data",
              ),
            ],
          ),
        ),

        // Tabs Segmented Control (Clean & Premium)
        Container(
          height: 44,
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TabBar(
            controller: _tabController,
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            dividerHeight: 0,
            indicatorPadding: EdgeInsets.zero,
            splashFactory: NoSplash.splashFactory,
            overlayColor: WidgetStateProperty.all(Colors.transparent),
            indicator: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(9),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                  blurRadius: 4,
                  offset: const Offset(0, 1.5),
                ),
              ],
            ),
            labelColor: const Color(0xFF0F172A),
            unselectedLabelColor: const Color(0xFF64748B),
            labelStyle: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
            ),
            tabs: [
              Tab(
                height: 36,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("Cuti"),
                    const SizedBox(width: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: _tabController.index == 0
                            ? const Color(0xFF0284C7).withValues(alpha: 0.12)
                            : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        "${_leaves.length}",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _tabController.index == 0
                              ? const Color(0xFF0284C7)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Tab(
                height: 36,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("Lembur"),
                    const SizedBox(width: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: _tabController.index == 1
                            ? const Color(0xFF059669).withValues(alpha: 0.12)
                            : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        "${_overtimes.length}",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _tabController.index == 1
                              ? const Color(0xFF059669)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Tab(
                height: 36,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("Tukar Shift"),
                    const SizedBox(width: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: _tabController.index == 2
                            ? const Color(0xFFD97706).withValues(alpha: 0.12)
                            : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        "${_shiftSwaps.length}",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _tabController.index == 2
                              ? const Color(0xFFD97706)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Tab Views
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildLeaveTab(),
                    _buildOvertimeTab(),
                    _buildShiftSwapTab(),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildLeaveTab() {
    final remainingQuota = _annualQuota - _usedDays;

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF0284C7),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text("Ajukan Cuti", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        onPressed: () {
          LeaveRequestSheet.show(
            context,
            userId: widget.userId,
            userName: widget.userName,
            onSuccess: _loadData,
          );
        },
      ),
      body: Column(
        children: [
          // Quota Summary Banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFBAE6FD)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    Text("Hak Cuti Tahunan", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Text("$_annualQuota Hari", style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                  ],
                ),
                Container(height: 24, width: 1, color: const Color(0xFFBAE6FD)),
                Column(
                  children: [
                    Text("Cuti Terpakai", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Text("$_usedDays Hari", style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFFD97706))),
                  ],
                ),
                Container(height: 24, width: 1, color: const Color(0xFFBAE6FD)),
                Column(
                  children: [
                    Text("Sisa Kuota Cuti", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Text("$remainingQuota Hari", style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF0284C7))),
                  ],
                ),
              ],
            ),
          ),

          Expanded(
            child: _leaves.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.event_available_outlined, size: 48, color: AppColors.textDisabled),
                        const SizedBox(height: 12),
                        Text("Belum ada riwayat pengajuan izin/cuti", style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
                        const SizedBox(height: 4),
                        Text("Tekan tombol '+ Ajukan Cuti' di bawah untuk membuat permohonan", style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 11)),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _leaves.length,
                    itemBuilder: (context, idx) {
                      final item = _leaves[idx];
                      final status = (item['status'] ?? 'pending').toString().toLowerCase();
                      final isApproved = status == 'approved';
                      final isRejected = status == 'rejected';
                      final ticketId = (item['id'] ?? '').toString();
                      final shortTicket = ticketId.length > 8 ? ticketId.substring(0, 8).toUpperCase() : ticketId;

                      Color statusColor = const Color(0xFFD97706);
                      String statusText = "Menunggu Verifikasi";
                      if (isApproved) {
                        statusColor = const Color(0xFF059669);
                        statusText = "Disetujui";
                      } else if (isRejected) {
                        statusColor = AppColors.danger;
                        statusText = "Ditolak";
                      }

                      final startStr = item['start_date'] != null ? item['start_date'].toString().split('T')[0] : '';
                      final endStr = item['end_date'] != null ? item['end_date'].toString().split('T')[0] : '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      (item['leave_type'] ?? 'Cuti Tahunan').toString().replaceAll('_', ' ').toUpperCase(),
                                      style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF0284C7)),
                                    ),
                                    if (shortTicket.isNotEmpty) ...[
                                      const SizedBox(width: 6),
                                      Text("#$shortTicket", style: const TextStyle(color: AppColors.textDisabled, fontSize: 10, fontWeight: FontWeight.w600)),
                                    ],
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        isApproved ? Icons.check_circle_rounded : (isRejected ? Icons.cancel_rounded : Icons.schedule_rounded),
                                        size: 11,
                                        color: statusColor,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        statusText,
                                        style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              "$startStr s/d $endStr (${item['total_days'] ?? 1} Hari)",
                              style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item['reason'] ?? '',
                              style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted),
                            ),
                            if (item['approval_notes'] != null && item['approval_notes'].toString().trim().isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.info_outline_rounded, size: 14, color: AppColors.textSecondary),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        "Catatan: ${item['approval_notes']}",
                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildOvertimeTab() {
    final currencyFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    final now = DateTime.now();
    final bulanLabel = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ][now.month];

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF7C3AED),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text("Buat SPL", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        onPressed: () {
          OvertimeRequestSheet.show(
            context,
            userId: widget.userId,
            userName: widget.userName,
            onSuccess: _loadData,
          );
        },
      ),
      body: Column(
        children: [
          // ━━ Ringkasan Lembur Bulan Berjalan (Database Sync) ━━
          Container(
            margin: const EdgeInsets.fromLTRB(16, 6, 16, 4),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF5B21B6), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    const Text("SPL Disetujui", style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 3),
                    Text("$_overtimeApprovedCount SPL", style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                  ],
                ),
                Container(height: 28, width: 1, color: Colors.white24),
                Column(
                  children: [
                    Text("Jam Lembur $bulanLabel", style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 3),
                    Text("${_overtimeApprovedHours.toStringAsFixed(1)} Jam", style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                  ],
                ),
                Container(height: 28, width: 1, color: Colors.white24),
                Column(
                  children: [
                    const Text("Kompensasi", style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 3),
                    Text(currencyFormat.format(_overtimeApprovedCompensation), style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                  ],
                ),
              ],
            ),
          ),
          // ━━ List SPL ━━
          Expanded(
            child: _overtimes.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.timelapse_rounded, size: 48, color: AppColors.textDisabled),
                  const SizedBox(height: 12),
                  Text("Belum ada riwayat lembur diajukan", style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 4),
                  Text("Tekan tombol '+ Buat SPL' untuk mengajukan perintah lembur", style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 11)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _overtimes.length,
              itemBuilder: (context, idx) {
                final item = _overtimes[idx];
                final status = (item['status'] ?? 'pending').toString().toLowerCase();
                final isApproved = status == 'approved';
                final isRejected = status == 'rejected';
                final ticketId = (item['id'] ?? '').toString();
                final shortTicket = ticketId.length > 8 ? ticketId.substring(0, 8).toUpperCase() : ticketId;

                Color statusColor = const Color(0xFFD97706);
                String statusText = "Menunggu Verifikasi";
                if (isApproved) {
                  statusColor = const Color(0xFF059669);
                  statusText = "Disetujui Resmi";
                } else if (isRejected) {
                  statusColor = AppColors.danger;
                  statusText = "Ditolak";
                }

                final compensation = (item['compensation_amount'] is num)
                    ? item['compensation_amount'] as num
                    : num.tryParse(item['compensation_amount']?.toString() ?? '0') ?? 0;
                final dateStr = item['date'] != null ? item['date'].toString().split('T')[0] : '';

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text("SURAT PERINTAH LEMBUR", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF7C3AED))),
                              if (shortTicket.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                Text("#$shortTicket", style: const TextStyle(color: AppColors.textDisabled, fontSize: 10, fontWeight: FontWeight.w600)),
                              ],
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isApproved ? Icons.check_circle_rounded : (isRejected ? Icons.cancel_rounded : Icons.schedule_rounded),
                                  size: 11,
                                  color: statusColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  statusText,
                                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "$dateStr • ${item['duration_hours'] ?? 2.0} Jam Kerja",
                            style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                          Text(
                            currencyFormat.format(compensation),
                            style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item['task_description'] ?? 'Tugas operasional resmi',
                        style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted),
                      ),
                      if (item['payment_status'] != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.receipt_long_outlined, size: 13, color: AppColors.textDisabled),
                            const SizedBox(width: 4),
                            Text(
                              item['payment_status'] == 'paid'
                                  ? "Sudah dibayarkan di slip gaji"
                                  : "Masuk ke rekapitulasi slip gaji akhir bulan",
                              style: const TextStyle(fontSize: 10.5, color: AppColors.textDisabled),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),     // closes Expanded(child: _overtimes.isEmpty ? ... : ListView)
        ],
      ),        // closes outer Column(children: [banner, Expanded(list)])
    );
  }

  Widget _buildShiftSwapTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text("Tukar Shift", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        onPressed: () {
          ShiftSwapSheet.show(
            context,
            userId: widget.userId,
            userName: widget.userName,
            onSuccess: _loadData,
          );
        },
      ),
      body: _shiftSwaps.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(color: Color(0xFFFFFBEB), shape: BoxShape.circle),
                    child: const Icon(Icons.swap_horiz_rounded, size: 40, color: Color(0xFFD97706)),
                  ),
                  const SizedBox(height: 12),
                  Text("Belum ada riwayat tukar dinas", style: AppTypography.titleMedium.copyWith(fontSize: 15)),
                  const SizedBox(height: 4),
                  Text("Tekan tombol '+ Tukar Shift' untuk mengajukan koordinasi jadwal dinas", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _shiftSwaps.length,
              itemBuilder: (context, idx) {
                final item = _shiftSwaps[idx];
                final status = (item['status'] ?? 'pending_danru').toString().toLowerCase();
                final superStatus = (item['supervisor_status'] ?? '').toString().toLowerCase();

                final isApproved = status == 'approved' || superStatus == 'approved';
                final isPendingKorlap = status == 'pending_korlap';
                final isRejected = status.contains('rejected') || superStatus == 'rejected';

                Color statusColor = const Color(0xFFD97706);
                String statusText = "Menunggu Danru";
                if (isApproved) {
                  statusColor = const Color(0xFF059669);
                  statusText = "Disetujui Korlap";
                } else if (isPendingKorlap) {
                  statusColor = const Color(0xFF0284C7);
                  statusText = "Rekomendasi Danru • Menunggu Korlap";
                } else if (isRejected) {
                  statusColor = AppColors.danger;
                  statusText = "Ditolak";
                }

                final swapDate = item['swap_date'] != null ? item['swap_date'].toString().split('T')[0] : '';
                final subName = item['substitute_name']?.toString();
                final recDanruName = item['danru_recommended_name']?.toString();

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isApproved ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                      width: isApproved ? 1.5 : 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.shield_outlined, size: 14, color: Color(0xFFD97706)),
                              const SizedBox(width: 4),
                              Text(
                                "PENGISIAN POS DINAS",
                                style: AppTypography.labelSmall.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFFD97706),
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isApproved ? Icons.check_circle_rounded : (isRejected ? Icons.cancel_rounded : Icons.hourglass_top_rounded),
                                  size: 11,
                                  color: statusColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  statusText,
                                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "$swapDate • ${item['target_shift'] ?? 'Penggantian Pos Dinas'}",
                        style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      if (isApproved && subName != null && subName.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.verified_user_rounded, size: 15, color: Color(0xFF059669)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  "Pengganti Resmi Disahkan Korlap: $subName",
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else if (recDanruName != null && recDanruName.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0F9FF),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBAE6FD)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.recommend_rounded, size: 15, color: Color(0xFF0284C7)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  "Rekomendasi Danru: $recDanruName (Menunggu Pengesahan Korlap)",
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF075985)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        Text(
                          "Personil Pengganti: Sedang dipetakan oleh sistem pintar untuk ditelaah Danru -> disahkan Korlap",
                          style: AppTypography.bodyMedium.copyWith(fontSize: 11.5, color: const Color(0xFF64748B), fontStyle: FontStyle.italic),
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        "Alasan: ${item['reason'] ?? 'Penyesuaian jadwal dinas'}",
                        style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted),
                      ),
                      if (item['danru_notes'] != null && (item['danru_notes'] as String).isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          "Catatan Danru: ${item['danru_notes']}",
                          style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                        ),
                      ],
                      if (item['korlap_notes'] != null && (item['korlap_notes'] as String).isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          "Catatan Korlap: ${item['korlap_notes']}",
                          style: const TextStyle(fontSize: 11, color: Color(0xFF15803D), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}
