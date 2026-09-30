import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../domain/models/attendance_models.dart';

class RecentActivitySection extends StatelessWidget {
  final List<AttendanceRecord> records;
  final VoidCallback onViewAll;

  const RecentActivitySection({
    super.key,
    required this.records,
    required this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "Riwayat Presensi Terbaru",
              style: AppTypography.titleMedium,
            ),
            TextButton(
              onPressed: onViewAll,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                "Lihat Semua",
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: records.take(3).length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final record = records[index];
            return _buildRecordCard(record);
          },
        ),
      ],
    );
  }

  Widget _buildRecordCard(AttendanceRecord record) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          // Date Column
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.subSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Column(
              children: [
                Text(
                  DateFormat('dd').format(record.date),
                  style: AppTypography.titleMedium.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
                Text(
                  DateFormat('MMM').format(record.date).toUpperCase(),
                  style: AppTypography.labelSmall.copyWith(
                    fontSize: 10,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 14),

          // Clock in & out times
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "Masuk: ",
                      style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted),
                    ),
                    Text(
                      record.checkInTime,
                      style: AppTypography.bodyLarge.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      "Pulang: ",
                      style: AppTypography.bodyMedium.copyWith(fontSize: 12, color: AppColors.textMuted),
                    ),
                    Text(
                      record.checkOutTime ?? "--:--",
                      style: AppTypography.bodyLarge.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: record.checkOutTime == null ? AppColors.textDisabled : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  record.locationName,
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Status Badge Pill
          _buildTagBadge(record.tagType, record.statusLabel),
        ],
      ),
    );
  }

  Widget _buildTagBadge(AttendanceTagType tagType, String label) {
    Color bg;
    Color border;
    Color text;

    switch (tagType) {
      case AttendanceTagType.onTime:
        bg = AppColors.successBg;
        border = AppColors.successBorder;
        text = AppColors.success;
        break;
      case AttendanceTagType.late:
        bg = AppColors.warningBg;
        border = AppColors.warningBorder;
        text = AppColors.warning;
        break;
      case AttendanceTagType.wfh:
        bg = AppColors.infoBg;
        border = AppColors.infoBorder;
        text = AppColors.info;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: text,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
