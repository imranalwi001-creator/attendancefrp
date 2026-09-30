import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../domain/models/attendance_models.dart';
import '../controllers/attendance_controller.dart';
import 'biometric_verification_sheet.dart';

class HeroActionCard extends StatelessWidget {
  final AttendanceController controller;

  const HeroActionCard({
    super.key,
    required this.controller,
  });

  void _onTriggerAttendance(BuildContext context) {
    if (controller.geofenceStatus.isMockGpsDetected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Peringatan Keamanan: Fake GPS / Mock Location terdeteksi! Tombol absensi dinonaktifkan."),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (!controller.geofenceStatus.isInRadius) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Anda berada di luar perimeter kantor (${controller.geofenceStatus.distanceMeters.toStringAsFixed(1)}m dari batas maksimal ${controller.geofenceStatus.maxAllowedRadius.toStringAsFixed(0)}m).",
          ),
          backgroundColor: AppColors.warning,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => BiometricVerificationSheet(controller: controller),
    );
  }

  @override
  Widget build(BuildContext context) {
    final geofence = controller.geofenceStatus;
    final state = controller.attendanceState;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── GEOFENCING RADAR BADGE & REFRESH ─────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: _buildGeofencePill(geofence),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.my_location_rounded, size: 20, color: AppColors.textSecondary),
                onPressed: () => controller.checkLiveLocation(),
                tooltip: "Perbarui Akurasi GPS",
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.subSurface,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Office Location Context Info
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  geofence.officeName,
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (geofence.accuracy != null)
                Text(
                  "Akurasi: ±${geofence.accuracy!.toStringAsFixed(1)}m",
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                ),
            ],
          ),

          const SizedBox(height: 20),

          // ── PRIMARY DYNAMIC ATTENDANCE ACTION BUTTON ────────────────
          _buildActionButton(context, state, geofence),

          const SizedBox(height: 12),

          // Facial Biometric Security Hint
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.fingerprint_rounded, size: 15, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                "Dilengkapi Verifikasi Biometrik Wajah & Anti-Fake GPS",
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGeofencePill(GeofenceStatus geofence) {
    Color bg;
    Color border;
    Color text;
    IconData icon;

    if (geofence.isMockGpsDetected) {
      bg = AppColors.dangerBg;
      border = AppColors.dangerBorder;
      text = AppColors.danger;
      icon = Icons.gpp_bad_rounded;
    } else if (geofence.isInRadius) {
      bg = AppColors.successBg;
      border = AppColors.successBorder;
      text = AppColors.success;
      icon = Icons.verified_user_rounded;
    } else {
      bg = AppColors.warningBg;
      border = AppColors.warningBorder;
      text = AppColors.warning;
      icon = Icons.fmd_bad_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: text),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              geofence.badgeText,
              style: AppTypography.labelSmall.copyWith(
                color: text,
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(
    BuildContext context,
    AttendanceState state,
    GeofenceStatus geofence,
  ) {
    if (state == AttendanceState.checkedOut) {
      return ElevatedButton.icon(
        onPressed: null, // Disabled when finished
        icon: const Icon(Icons.check_circle_outline_rounded, color: AppColors.textDisabled),
        label: Text(
          "Presensi Hari Ini Selesai",
          style: AppTypography.titleMedium.copyWith(color: AppColors.textDisabled),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.subSurface,
          disabledBackgroundColor: AppColors.subSurface,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
        ),
      );
    }

    final isCheckIn = state == AttendanceState.notCheckedIn;
    final buttonColor = isCheckIn ? AppColors.primary : AppColors.navy;

    return ElevatedButton(
      onPressed: () => _onTriggerAttendance(context),
      style: ElevatedButton.styleFrom(
        backgroundColor: buttonColor,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation: 2,
        shadowColor: buttonColor.withOpacity(0.3),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.camera_alt_rounded, size: 20, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Text(
            isCheckIn ? "Check-In (Absen Masuk)" : "Check-Out (Absen Pulang)",
            style: AppTypography.titleMedium.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
