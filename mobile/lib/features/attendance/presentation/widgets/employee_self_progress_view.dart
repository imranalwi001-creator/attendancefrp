import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

/// Employee Self-Progress View — visible to ALL roles (but data is personal for karyawan,
/// division-wide for kepala_regu, global for korlap+).
/// Shows: Attendance heatmap (14 days), KPI cards, progress bars.
class EmployeeSelfProgressView extends StatefulWidget {
  final String userId;
  final String userName;
  final String userRole;
  final String? divisionId;

  const EmployeeSelfProgressView({
    super.key,
    required this.userId,
    required this.userName,
    required this.userRole,
    this.divisionId,
  });

  @override
  State<EmployeeSelfProgressView> createState() => _EmployeeSelfProgressViewState();
}

class _EmployeeSelfProgressViewState extends State<EmployeeSelfProgressView> {
  bool _isLoading = true;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final d = await ApiService.fetchSelfProgress(userId: widget.userId);
      if (mounted) setState(() => _data = d);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: _isLoading
            ? const Center(child: Padding(padding: EdgeInsets.only(top: 100), child: CircularProgressIndicator(color: AppColors.primary)))
            : _data == null
                ? _buildEmpty()
                : _buildContent(),
      ),
    );
  }

  Widget _buildEmpty() => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      const SizedBox(height: 80),
      const Icon(Icons.bar_chart_outlined, size: 56, color: Color(0xFFCBD5E1)),
      const SizedBox(height: 12),
      Text('Data progres belum tersedia', style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 14)),
      const SizedBox(height: 8),
      TextButton.icon(icon: const Icon(Icons.refresh, size: 16), label: const Text('Coba lagi'), onPressed: _load),
    ],
  );

  Widget _buildContent() {
    final att   = _data?['attendance']  as Map<String, dynamic>? ?? {};
    final ot    = _data?['overtime']    as Map<String, dynamic>? ?? {};
    final leave = _data?['leave']       as Map<String, dynamic>? ?? {};
    final days  = (_data?['last14Days'] as List<dynamic>?) ?? [];

    final hadir    = (att['hadirCount']     as num? ?? 0).toInt();
    final terlambat= (att['terlambatCount'] as num? ?? 0).toInt();
    final alpha    = (att['alphaCount']     as num? ?? 0).toInt();
    final target   = (att['targetDays']     as num? ?? 22).toInt();
    final pct      = (att['attendancePct']  as num? ?? 0).toDouble().clamp(0.0, 100.0);

    final otHours  = (ot['totalHours']      as num? ?? 0.0).toDouble();
    final otComp   = (ot['totalCompensation'] as num? ?? 0.0).toDouble();

    final quota    = (leave['annualQuota']  as num? ?? 12).toInt();
    final used     = (leave['usedDays']     as num? ?? 0).toInt();
    final remaining= (leave['remainingDays'] as num? ?? quota).toInt();

    final attendanceColor = pct >= 85 ? const Color(0xFF059669) : pct >= 60 ? const Color(0xFFD97706) : const Color(0xFFDC2626);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Header ───────────────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Progres & Kinerja Saya', style: AppTypography.titleMedium.copyWith(fontSize: 18, fontWeight: FontWeight.w800)),
                Text('Bulan berjalan — data real-time', style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
              ],
            ),
            IconButton(icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textMuted), onPressed: _load),
          ],
        ),
        const SizedBox(height: 16),

        // ── Main Attendance Score Card ────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [attendanceColor, attendanceColor.withValues(alpha: 0.7)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: attendanceColor.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tingkat Kehadiran', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('${pct.toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: -1)),
                    const SizedBox(height: 4),
                    Text('$hadir dari $target hari kerja', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        backgroundColor: Colors.white24,
                        color: Colors.white,
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(16)),
                child: Icon(
                  pct >= 85 ? Icons.emoji_events_rounded : pct >= 60 ? Icons.thumb_up_rounded : Icons.warning_rounded,
                  color: Colors.white,
                  size: 36,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Detail KPI Row ─────────────────────────────────────────────
        Row(
          children: [
            Expanded(child: _kpiMini('Terlambat', '$terlambat x', Icons.schedule_rounded, const Color(0xFFD97706), const Color(0xFFFFFBEB))),
            const SizedBox(width: 8),
            Expanded(child: _kpiMini('Alpha/Absen', '$alpha hari', Icons.cancel_outlined, const Color(0xFFDC2626), const Color(0xFFFEF2F2))),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _kpiMini('Lembur Bulan Ini', '${otHours.toStringAsFixed(1)} jam', Icons.access_time_filled_rounded, const Color(0xFF7C3AED), const Color(0xFFF5F3FF))),
            const SizedBox(width: 8),
            Expanded(child: _kpiMini('Kompensasi Lembur', _formatCurrency(otComp), Icons.payments_rounded, const Color(0xFF059669), const Color(0xFFF0FDF4))),
          ],
        ),
        const SizedBox(height: 16),

        // ── Hak Cuti ────────────────────────────────────────────────────
        _buildLeaveCard(quota, used, remaining),
        const SizedBox(height: 16),

        // ── Heatmap 14 Hari ─────────────────────────────────────────────
        _buildSectionHeader('Riwayat 14 Hari Terakhir', Icons.calendar_view_week_rounded),
        const SizedBox(height: 8),
        _buildHeatmap(days),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _kpiMini(String title, String value, IconData icon, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: 0.2))),
      child: Row(
        children: [
          Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 16, color: color)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800)),
                Text(title, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeaveCard(int quota, int used, int remaining) {
    final pct = quota > 0 ? used / quota : 0.0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.beach_access_rounded, size: 18, color: Color(0xFF0284C7)),
              const SizedBox(width: 8),
              Text('Saldo Hak Cuti Tahunan', style: AppTypography.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _leaveStat('Kuota', '$quota hari', const Color(0xFF0284C7))),
              Expanded(child: _leaveStat('Terpakai', '$used hari', const Color(0xFFD97706))),
              Expanded(child: _leaveStat('Sisa', '$remaining hari', const Color(0xFF059669))),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct.clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: const Color(0xFFF1F5F9),
              color: pct > 0.8 ? const Color(0xFFDC2626) : const Color(0xFF0284C7),
            ),
          ),
          const SizedBox(height: 6),
          Text('${(pct * 100).toStringAsFixed(0)}% hak cuti telah digunakan', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }

  Widget _leaveStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 7),
        Text(title, style: AppTypography.titleMedium.copyWith(fontSize: 14, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _buildHeatmap(List<dynamic> days) {
    const statusColors = {
      'hadir':     Color(0xFF059669),
      'terlambat': Color(0xFFD97706),
      'alpha':     Color(0xFFDC2626),
      'sakit':     Color(0xFF7C3AED),
      'izin':      Color(0xFF0284C7),
      'libur':     Color(0xFFF1F5F9),
    };
    const statusLabels = {
      'hadir': 'H', 'terlambat': 'T', 'alpha': 'A',
      'sakit': 'S', 'izin': 'I', 'libur': '-',
    };

    return Column(
      children: [
        // Legend
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: [
            _heatmapLegend('Hadir', const Color(0xFF059669)),
            _heatmapLegend('Terlambat', const Color(0xFFD97706)),
            _heatmapLegend('Alpha', const Color(0xFFDC2626)),
            _heatmapLegend('Sakit', const Color(0xFF7C3AED)),
            _heatmapLegend('Izin', const Color(0xFF0284C7)),
          ],
        ),
        const SizedBox(height: 10),
        // Grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 1,
          ),
          itemCount: days.length,
          itemBuilder: (context, i) {
            final d       = days[i] as Map<String, dynamic>;
            final dateStr = (d['date'] ?? '').toString();
            final status  = (d['status'] ?? 'libur').toString().toLowerCase();
            final color   = statusColors[status] ?? const Color(0xFFF1F5F9);
            final label   = statusLabels[status] ?? '-';
            final day     = dateStr.length >= 10 ? dateStr.substring(8, 10) : '';

            return Container(
              decoration: BoxDecoration(color: color.withValues(alpha: status == 'libur' ? 1.0 : 0.9), borderRadius: BorderRadius.circular(8)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(label, style: TextStyle(color: status == 'libur' ? const Color(0xFF94A3B8) : Colors.white, fontSize: 14, fontWeight: FontWeight.w900)),
                  Text(day, style: TextStyle(color: status == 'libur' ? const Color(0xFFCBD5E1) : Colors.white60, fontSize: 9)),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _heatmapLegend(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
      ],
    );
  }

  String _formatCurrency(double amount) {
    if (amount >= 1000000) return 'Rp ${(amount / 1000000).toStringAsFixed(1)}jt';
    if (amount >= 1000) return 'Rp ${(amount / 1000).toStringAsFixed(0)}rb';
    return 'Rp ${amount.toStringAsFixed(0)}';
  }
}
