import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import 'leave_request_sheet.dart';
import 'overtime_request_sheet.dart';
import 'shift_swap_sheet.dart';
import 'salary_slip_modal.dart';

class QuickActionGrid extends StatelessWidget {
  final String userId;
  final String userName;
  final VoidCallback? onRefresh;

  const QuickActionGrid({
    super.key,
    this.userId = 'imranalwi8@gmail.com',
    this.userName = 'imranalwi',
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final actions = [
      _QuickActionData(
        title: "Izin / Cuti",
        description: "Pengajuan libur & sakit",
        badge: "Online",
        icon: Icons.event_available_rounded,
        iconColor: const Color(0xFF0284C7),
        iconBgColor: const Color(0xFFF0F9FF),
        borderColor: const Color(0xFFE0F2FE),
        onTap: () {
          LeaveRequestSheet.show(
            context,
            userId: userId,
            userName: userName,
            onSuccess: onRefresh,
          );
        },
      ),
      _QuickActionData(
        title: "Lembur",
        description: "Surat Perintah Lembur",
        badge: "SPL Resmi",
        icon: Icons.timelapse_rounded,
        iconColor: const Color(0xFF7C3AED),
        iconBgColor: const Color(0xFFF5F3FF),
        borderColor: const Color(0xFFEDE9FE),
        onTap: () {
          OvertimeRequestSheet.show(
            context,
            userId: userId,
            userName: userName,
            onSuccess: onRefresh,
          );
        },
      ),
      _QuickActionData(
        title: "Tukar Shift",
        description: "Penyesuaian jadwal dinas",
        badge: "Jadwal",
        icon: Icons.swap_horiz_rounded,
        iconColor: const Color(0xFFD97706),
        iconBgColor: const Color(0xFFFFFBEB),
        borderColor: const Color(0xFFFEF3C7),
        onTap: () {
          ShiftSwapSheet.show(
            context,
            userId: userId,
            userName: userName,
            onSuccess: onRefresh,
          );
        },
      ),
      _QuickActionData(
        title: "Slip Gaji",
        description: "Dokumen gaji terenkripsi",
        badge: "PDF",
        icon: Icons.receipt_long_rounded,
        iconColor: AppColors.primary,
        iconBgColor: const Color(0xFFF0FDF4),
        borderColor: const Color(0xFFDCFCE7),
        onTap: () {
          SalarySlipModal.show(
            context,
            userId: userId,
            userName: userName,
          );
        },
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
                  "Layanan Cepat",
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
                    "4 Layanan",
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            Text(
              "Ketuk untuk membuka",
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textDisabled,
                fontSize: 11,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: actions.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.38,
          ),
          itemBuilder: (context, index) {
            final action = actions[index];
            return Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                onTap: action.onTap,
                borderRadius: BorderRadius.circular(16),
                splashColor: action.iconColor.withOpacity(0.08),
                highlightColor: action.iconColor.withOpacity(0.04),
                child: Container(
                  padding: const EdgeInsets.all(14),
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
                      // Top Row: Icon Container + Badge Pill
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: action.iconBgColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: action.borderColor),
                            ),
                            child: Icon(action.icon, color: action.iconColor, size: 20),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: action.iconBgColor,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  action.badge,
                                  style: TextStyle(
                                    color: action.iconColor,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 2),
                                Icon(Icons.arrow_forward_ios_rounded, size: 8, color: action.iconColor),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // Bottom Text Info
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            action.title,
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w800,
                              fontSize: 14.5,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            action.description,
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
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
}

class _QuickActionData {
  final String title;
  final String description;
  final String badge;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final Color borderColor;
  final VoidCallback onTap;

  const _QuickActionData({
    required this.title,
    required this.description,
    required this.badge,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.borderColor,
    required this.onTap,
  });
}
