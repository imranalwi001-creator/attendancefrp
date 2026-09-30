import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../domain/models/attendance_models.dart';
import '../controllers/attendance_controller.dart';

class AttendanceHistoryView extends StatefulWidget {
  final AttendanceController controller;

  const AttendanceHistoryView({super.key, required this.controller});

  @override
  State<AttendanceHistoryView> createState() => _AttendanceHistoryViewState();
}

class _AttendanceHistoryViewState extends State<AttendanceHistoryView> {
  String _selectedFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final allRecords = widget.controller.recentActivities;

    final onTimeCount = allRecords.where((r) => r.tagType == AttendanceTagType.onTime).length;
    final lateCount = allRecords.where((r) => r.tagType == AttendanceTagType.late).length;
    final wfhCount = allRecords.where((r) => r.tagType == AttendanceTagType.wfh).length;

    final filteredRecords = allRecords.where((r) {
      if (_selectedFilter == 'hadir') return r.tagType == AttendanceTagType.onTime;
      if (_selectedFilter == 'terlambat') return r.tagType == AttendanceTagType.late;
      if (_selectedFilter == 'izin') return r.tagType == AttendanceTagType.wfh;
      return true;
    }).toList();

    final currentMonthYear = DateFormat('MMM yyyy').format(widget.controller.currentTime);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Riwayat Presensi", style: AppTypography.titleMedium.copyWith(fontSize: 18)),
                  Text("Catatan audit biometrik & GPS terverifikasi", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.successBorder),
                ),
                child: Text(
                  currentMonthYear,
                  style: AppTypography.labelSmall.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', 'Semua (${allRecords.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('hadir', 'Tepat Waktu ($onTimeCount)'),
                const SizedBox(width: 8),
                _buildFilterChip('terlambat', 'Terlambat ($lateCount)'),
                const SizedBox(width: 8),
                _buildFilterChip('izin', 'Izin / Luar ($wfhCount)'),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Attendance Records List
          if (filteredRecords.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              alignment: Alignment.center,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: const BoxDecoration(
                      color: AppColors.subSurface,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.event_busy_rounded, size: 36, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "Tidak ada rekaman kehadiran untuk filter ini",
                    style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "Pilih filter lain atau lakukan absensi masuk/pulang.",
                    style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                  ),
                ],
              ),
            )
          else
            ...filteredRecords.map((item) => _buildHistoryCard(item)),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFilter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        color: isSelected ? Colors.white : AppColors.textPrimary,
      ),
      selectedColor: AppColors.primary,
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0)),
      ),
      onSelected: (val) {
        if (val) setState(() => _selectedFilter = key);
      },
    );
  }

  Widget _buildHistoryCard(AttendanceRecord item) {
    Color statusColor;
    Color statusBgColor;
    String statusTitle;

    switch (item.tagType) {
      case AttendanceTagType.onTime:
        statusColor = const Color(0xFF059669);
        statusBgColor = const Color(0xFFF0FDF4);
        statusTitle = "Tepat Waktu";
        break;
      case AttendanceTagType.late:
        statusColor = const Color(0xFFD97706);
        statusBgColor = const Color(0xFFFFFBEB);
        statusTitle = item.statusLabel.isNotEmpty ? item.statusLabel : "Terlambat";
        break;
      case AttendanceTagType.wfh:
        statusColor = const Color(0xFF2563EB);
        statusBgColor = const Color(0xFFEFF6FF);
        statusTitle = item.statusLabel.isNotEmpty ? item.statusLabel : "Izin / Dinas";
        break;
    }

    final dateFormatted = DateFormat('EEEE, dd MMM yyyy').format(item.date);
    final hasClockOut = item.checkOutTime != null && item.checkOutTime!.isNotEmpty;

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
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Date & Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.primary),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    dateFormatted,
                    style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBgColor,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: statusColor.withOpacity(0.3)),
                ),
                child: Text(
                  statusTitle,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 18),

          // Clock in & Clock out row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Jam Masuk", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.login_rounded, size: 14, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(item.checkInTime, style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Jam Pulang", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(
                          Icons.logout_rounded,
                          size: 14,
                          color: hasClockOut ? const Color(0xFF0284C7) : AppColors.textDisabled,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          hasClockOut ? item.checkOutTime! : "--:--",
                          style: AppTypography.labelSmall.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            color: hasClockOut ? AppColors.textPrimary : AppColors.textDisabled,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Status Shift", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 2),
                    Text(
                      hasClockOut ? "Lengkap" : "Sedang Dinas",
                      style: AppTypography.labelSmall.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: hasClockOut ? AppColors.primary : const Color(0xFF0284C7),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Biometric & GPS tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.face_retouching_natural_rounded, size: 13, color: AppColors.primary),
                    SizedBox(width: 4),
                    Text(
                      "Biometrik Valid • Liveness OK",
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.near_me_rounded, size: 13, color: Color(0xFF0284C7)),
                    const SizedBox(width: 4),
                    Text(
                      item.locationName,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF0284C7)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
