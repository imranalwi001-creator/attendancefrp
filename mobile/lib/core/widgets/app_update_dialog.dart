import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/app_colors.dart';
import '../constants/app_typography.dart';
import '../services/api_service.dart';

/// Current installed version of this APK client
const String kCurrentAppVersion = "1.0.1";
const int kCurrentVersionCode = 2;

class AppUpdateChecker {
  /// Check with server and prompt modal dialog if newer version is released
  static Future<void> checkForUpdate(BuildContext context) async {
    try {
      final res = await ApiService.checkAppVersion();
      if (res != null && res['success'] == true) {
        final String latestVersion = res['latestVersion'] ?? kCurrentAppVersion;
        final int versionCode = res['versionCode'] ?? kCurrentVersionCode;
        final bool forceUpdate = res['forceUpdate'] == true;
        final String downloadUrl = res['downloadUrl'] ?? "https://fawwazreskiperwira.com/downloads/hrm-attendance.apk";
        final String title = res['title'] ?? "Pembaruan Aplikasi Tersedia";
        final String notes = res['releaseNotes'] ?? "Pembaruan sistem dan sinkronisasi jadwal kerja terbaru.";

        // Compare version
        if (versionCode > kCurrentVersionCode || latestVersion != kCurrentAppVersion) {
          if (!context.mounted) return;
          showDialog(
            context: context,
            barrierDismissible: !forceUpdate,
            builder: (ctx) => AppUpdateDialog(
              latestVersion: latestVersion,
              downloadUrl: downloadUrl,
              forceUpdate: forceUpdate,
              title: title,
              releaseNotes: notes,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint("[AppUpdateChecker] check error: $e");
    }
  }
}

class AppUpdateDialog extends StatelessWidget {
  final String latestVersion;
  final String downloadUrl;
  final bool forceUpdate;
  final String title;
  final String releaseNotes;

  const AppUpdateDialog({
    super.key,
    required this.latestVersion,
    required this.downloadUrl,
    required this.forceUpdate,
    required this.title,
    required this.releaseNotes,
  });

  Future<void> _handleDownload(BuildContext context) async {
    final uri = Uri.parse(downloadUrl);
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint("[AppUpdateDialog] launch error: $e");
      try {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      } catch (err) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Silakan unduh manual melalui browser: $downloadUrl"),
              duration: const Duration(seconds: 5),
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !forceUpdate,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: AppColors.surface,
        elevation: 16,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Icon Header
              Center(
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary.withOpacity(0.2), width: 2),
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    size: 32,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTypography.titleLarge.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),

              // Version Badges
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.subSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    "Versi Baru: v$latestVersion  (Aktif: v$kCurrentAppVersion)",
                    style: AppTypography.labelSmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Release Notes Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.subSurface.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Catatan Rilis:",
                      style: AppTypography.labelSmall.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      releaseNotes,
                      style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // Download & Update Button
              ElevatedButton.icon(
                onPressed: () => _handleDownload(context),
                icon: const Icon(Icons.download_rounded, size: 20, color: Colors.white),
                label: const Text(
                  "Unduh & Pasang Pembaruan",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 1,
                ),
              ),

              if (!forceUpdate) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    "Nanti Saja",
                    style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
