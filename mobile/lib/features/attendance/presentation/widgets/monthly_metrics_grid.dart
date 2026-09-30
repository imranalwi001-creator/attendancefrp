import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../domain/models/attendance_models.dart';

class MonthlyMetricsGrid extends StatelessWidget {
  final MonthlyAttendanceMetrics metrics;

  const MonthlyMetricsGrid({
    super.key,
    required this.metrics,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      _MetricCardData(
        title: "Total Hadir",
        value: metrics.totalHadir,
        subtitle: "Bulan Ini",
        trendPill: "Target 22 Hari",
        accentColor: const Color(0xFF059669), // Emerald
        bgColor: const Color(0xFFF0FDF4),
        borderColor: const Color(0xFFDCFCE7),
        icon: Icons.how_to_reg_rounded,
        dialogTitle: "Rincian Kehadiran",
        dialogDescription: "Total kehadiran bulan berjalan tercatat di database resmi perusahaan. Kehadiran dihitung berdasarkan jam masuk terverifikasi biometrik dan geofence kantor.",
      ),
      _MetricCardData(
        title: "Terlambat",
        value: metrics.terlambatSummary,
        subtitle: "Toleransi 15 mnt",
        trendPill: "Disiplin",
        accentColor: const Color(0xFFD97706), // Amber
        bgColor: const Color(0xFFFFFBEB),
        borderColor: const Color(0xFFFEF3C7),
        icon: Icons.history_toggle_off_rounded,
        dialogTitle: "Aturan Toleransi Keterlambatan",
        dialogDescription: "Perusahaan memberlakukan toleransi keterlambatan maksimal 15 menit dari jadwal shift. Keterlambatan di atas toleransi akan dikenakan penyesuaian pada tunjangan operasional.",
      ),
      _MetricCardData(
        title: "Lembur Disetujui",
        value: metrics.totalLemburDisetujui,
        subtitle: "Bulan Berjalan",
        trendPill: "SPL Resmi",
        accentColor: const Color(0xFF7C3AED), // Violet
        bgColor: const Color(0xFFF5F3FF),
        borderColor: const Color(0xFFDDD6FE),
        icon: Icons.more_time_rounded,
        dialogTitle: "Rincian Lembur Disetujui",
        dialogDescription: "Total akumulasi jam lembur resmi yang telah disetujui oleh supervisor/Korlap selama bulan berjalan. Nilai kompensasi dihitung otomatis berdasarkan tarif per-jam resmi dan dibayarkan pada slip gaji.",
      ),
      _MetricCardData(
        title: "Sisa Cuti",
        value: metrics.sisaCuti,
        subtitle: "Hak Cuti Tahunan",
        trendPill: "Live Database",
        accentColor: const Color(0xFF0284C7), // Sky Blue
        bgColor: const Color(0xFFF0F9FF),
        borderColor: const Color(0xFFBAE6FD),
        icon: Icons.beach_access_rounded,
        dialogTitle: "Hak Cuti Tahunan Terverifikasi",
        dialogDescription: "Hak cuti tahunan disinkronkan langsung dengan database. Sisa cuti otomatis berkurang saat pengajuan cuti tahunan disetujui oleh atasan.",
      ),
      _MetricCardData(
        title: "Jam Efektif",
        value: metrics.jamEfektif,
        subtitle: "Target: 160 Jam",
        trendPill: "40 Jam / Mgg",
        accentColor: const Color(0xFF4F46E5), // Indigo
        bgColor: const Color(0xFFEEF2FF),
        borderColor: const Color(0xFFC7D2FE),
        icon: Icons.timer_outlined,
        dialogTitle: "Akumulasi Jam Kerja Efektif",
        dialogDescription: "Jam kerja efektif dihitung otomatis dari selisih waktu Clock-In hingga Clock-Out (dikurangi istirahat 60 menit). Memenuhi target 160 jam/bulan menjamin hak gaji penuh.",
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  "Ringkasan Bulan Ini",
                  style: AppTypography.titleMedium.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    "Live Data",
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            Text(
              () {
                final now = DateTime.now();
                const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                return '${months[now.month - 1]} ${now.year}';
              }(),
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textMuted,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.34,
          ),
          itemBuilder: (context, index) {
            final item = items[index];
            return Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                onTap: () {
                  _showDetailModal(context, item);
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Header Row: Title & Styled Icon Box
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: AppTypography.labelSmall.copyWith(
                                color: AppColors.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: item.bgColor,
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: item.borderColor),
                            ),
                            child: Icon(item.icon, color: item.accentColor, size: 16),
                          ),
                        ],
                      ),

                      // Metric Value & Trend Pill
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.value,
                            style: AppTypography.statNumber.copyWith(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item.subtitle,
                                style: AppTypography.labelSmall.copyWith(
                                  color: AppColors.textDisabled,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: item.bgColor,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  item.trendPill,
                                  style: TextStyle(
                                    color: item.accentColor,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  void _showDetailModal(BuildContext context, _MetricCardData item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: item.bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(item.icon, color: item.accentColor, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item.dialogTitle,
                style: AppTypography.titleMedium.copyWith(fontSize: 16),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.subSurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Nilai Saat Ini:", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                  Text(item.value, style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: item.accentColor, fontSize: 14)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              item.dialogDescription,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted, fontSize: 13, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Tutup", style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary)),
          ),
        ],
      ),
    );
  }
}

class _MetricCardData {
  final String title;
  final String value;
  final String subtitle;
  final String trendPill;
  final Color accentColor;
  final Color bgColor;
  final Color borderColor;
  final IconData icon;
  final String dialogTitle;
  final String dialogDescription;

  const _MetricCardData({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.trendPill,
    required this.accentColor,
    required this.bgColor,
    required this.borderColor,
    required this.icon,
    required this.dialogTitle,
    required this.dialogDescription,
  });
}
