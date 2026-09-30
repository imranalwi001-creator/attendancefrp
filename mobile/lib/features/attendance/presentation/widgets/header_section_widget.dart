import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../domain/models/attendance_models.dart';
import '../controllers/attendance_controller.dart';

class HeaderSectionWidget extends StatelessWidget {
  final AttendanceController controller;

  const HeaderSectionWidget({
    super.key,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final profile = controller.profile;
    final shift = controller.activeShift;
    final attendanceState = controller.attendanceState;

    final timeFormat = DateFormat('HH:mm:ss');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── 1. USER PROFILE BAR ──────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 12,
                offset: const Offset(0, 4),
              )
            ],
          ),
          child: Row(
            children: [
              // Avatar with online/active indicator
              Stack(
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 2),
                    ),
                    child: ClipOval(
                      child: _buildAvatar(profile.avatarUrl, profile.fullName),
                    ),
                  ),
                  Positioned(
                    bottom: 1,
                    right: 1,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),

              // Name, Division, Role & Radius Badge
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.fullName,
                      style: AppTypography.titleMedium.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          Icons.corporate_fare_rounded,
                          size: 13,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            "${profile.department} • ${profile.role.toUpperCase()}",
                            style: AppTypography.bodyMedium.copyWith(
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                              fontSize: 11.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Division Location & Radius Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFDCFCE7)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.location_on_rounded,
                            size: 13,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              profile.branchName,
                              style: AppTypography.labelSmall.copyWith(
                                color: const Color(0xFF166534),
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ── 2. TODAY'S SHIFT CARD ────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              )
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Shift Title & Status Pill
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppColors.navyLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.navy),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            shift.formattedRange,
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusBadge(attendanceState),
                ],
              ),

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14.0),
                child: Divider(color: AppColors.divider, height: 1),
              ),

              // Live Digital Clock & Formatted Date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "WAKTU SAAT INI",
                        style: AppTypography.labelSmall.copyWith(
                          letterSpacing: 0.8,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        timeFormat.format(controller.currentTime),
                        style: AppTypography.displayLarge.copyWith(
                          fontSize: 28,
                          fontFeatures: [const FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      DateFormat('EEEE, d MMM yyyy').format(controller.currentTime),
                      style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(AttendanceState state) {
    Color bg;
    Color border;
    Color text;
    String label;
    IconData icon;

    switch (state) {
      case AttendanceState.notCheckedIn:
        bg = AppColors.warningBg;
        border = AppColors.warningBorder;
        text = AppColors.warning;
        label = "Belum Presensi";
        icon = Icons.radio_button_unchecked_rounded;
        break;
      case AttendanceState.checkedIn:
        bg = AppColors.successBg;
        border = AppColors.successBorder;
        text = AppColors.success;
        label = "Sudah Masuk";
        icon = Icons.check_circle_rounded;
        break;
      case AttendanceState.checkedOut:
        bg = AppColors.infoBg;
        border = AppColors.infoBorder;
        text = AppColors.info;
        label = "Selesai Bertugas";
        icon = Icons.task_alt_rounded;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: text),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(
              color: text,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(String? avatarUrl, String fullName) {
    if (avatarUrl != null && avatarUrl.trim().isNotEmpty) {
      if (avatarUrl.startsWith('data:image')) {
        try {
          final base64Content = avatarUrl.split(',').last;
          final bytes = base64Decode(base64Content);
          return Image.memory(
            bytes,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: (_, __, ___) => _buildInitials(fullName),
          );
        } catch (_) {}
      } else if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
        return Image.network(
          avatarUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, __, ___) => _buildInitials(fullName),
        );
      }
    }
    return _buildInitials(fullName);
  }

  Widget _buildInitials(String fullName) {
    final clean = fullName.trim();
    final initials = clean.length >= 2
        ? clean.substring(0, 2).toUpperCase()
        : (clean.isNotEmpty ? clean.toUpperCase() : 'HR');
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
