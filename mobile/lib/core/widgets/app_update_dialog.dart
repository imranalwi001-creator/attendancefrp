import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ota_update/ota_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../constants/app_colors.dart';
import '../constants/app_typography.dart';
import '../services/api_service.dart';

/// Fallback hardcoded version if package_info_plus is not yet available
const String kCurrentAppVersion = "1.0.3";
const int kCurrentVersionCode = 4;

class AppUpdateChecker {
  /// Check with server and prompt in-app update dialog if newer version is released
  static Future<void> checkForUpdate(BuildContext context, {bool showToastIfLatest = false}) async {
    try {
      PackageInfo? packageInfo;
      try {
        packageInfo = await PackageInfo.fromPlatform();
      } catch (_) {}

      final currentVersion = packageInfo?.version.isNotEmpty == true 
          ? packageInfo!.version 
          : kCurrentAppVersion;
      final currentCode = int.tryParse(packageInfo?.buildNumber ?? '') ?? kCurrentVersionCode;

      final res = await ApiService.checkAppVersion();
      if (res != null && res['success'] == true) {
        final String latestVersion = res['latestVersion'] ?? currentVersion;
        final int versionCode = res['versionCode'] ?? currentCode;
        final bool forceUpdate = res['forceUpdate'] == true;
        final String downloadUrl = res['downloadUrl'] ?? "https://fawwazreskiperwira.com/downloads/hrm-attendance.apk";
        final String title = res['title'] ?? "Pembaruan Aplikasi Tersedia";
        final String notes = res['releaseNotes'] ?? "Pembaruan sistem presensi biometrik dan penyempurnaan fitur.";

        // Compare version code or semver
        if (versionCode > currentCode || latestVersion != currentVersion) {
          if (!context.mounted) return;
          showDialog(
            context: context,
            barrierDismissible: !forceUpdate,
            builder: (ctx) => AppUpdateDialog(
              currentVersion: currentVersion,
              latestVersion: latestVersion,
              downloadUrl: downloadUrl,
              forceUpdate: forceUpdate,
              title: title,
              releaseNotes: notes,
            ),
          );
        } else if (showToastIfLatest && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Aplikasi Anda sudah versi terbaru (v$currentVersion)."),
              backgroundColor: AppColors.primary,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else if (showToastIfLatest && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Tidak dapat memeriksa pembaruan. Periksa koneksi internet Anda."),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      debugPrint("[AppUpdateChecker] check error: $e");
    }
  }
}

class AppUpdateDialog extends StatefulWidget {
  final String currentVersion;
  final String latestVersion;
  final String downloadUrl;
  final bool forceUpdate;
  final String title;
  final String releaseNotes;

  const AppUpdateDialog({
    super.key,
    required this.currentVersion,
    required this.latestVersion,
    required this.downloadUrl,
    required this.forceUpdate,
    required this.title,
    required this.releaseNotes,
  });

  @override
  State<AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<AppUpdateDialog> {
  bool _isDownloading = false;
  int _downloadPercent = 0;
  String _statusText = "";
  StreamSubscription<OtaEvent>? _otaSubscription;

  @override
  void dispose() {
    _otaSubscription?.cancel();
    super.dispose();
  }

  Future<void> _startOtaUpdate() async {
    setState(() {
      _isDownloading = true;
      _downloadPercent = 0;
      _statusText = "Menghubungkan ke server pembaruan...";
    });

    try {
      _otaSubscription = OtaUpdate().execute(
        widget.downloadUrl,
        destinationFilename: 'hrm-attendance.apk',
      ).listen(
        (OtaEvent event) {
          if (!mounted) return;
          switch (event.status) {
            case OtaStatus.DOWNLOADING:
              final percent = int.tryParse(event.value ?? '0') ?? _downloadPercent;
              setState(() {
                _downloadPercent = percent.clamp(0, 100);
                _statusText = "Mengunduh pembaruan... ($_downloadPercent%)";
              });
              break;
            case OtaStatus.INSTALLING:
              setState(() {
                _downloadPercent = 100;
                _statusText = "Membuka pemasangan aplikasi...";
              });
              break;
            case OtaStatus.ALREADY_RUNNING_ERROR:
              setState(() {
                _statusText = "Pengunduhan sedang berlangsung...";
              });
              break;
            case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
              setState(() {
                _isDownloading = false;
                _statusText = "Izin penginstalan belum aktif. Mengalihkan ke browser...";
              });
              _fallbackBrowserDownload();
              break;
            case OtaStatus.INTERNAL_ERROR:
            case OtaStatus.DOWNLOAD_ERROR:
            case OtaStatus.CHECKSUM_ERROR:
            default:
              setState(() {
                _isDownloading = false;
                _statusText = "Gagal mengunduh in-app. Membuka tautan peramban...";
              });
              _fallbackBrowserDownload();
              break;
          }
        },
        onError: (e) {
          debugPrint("[OtaUpdate] Stream error: $e");
          if (mounted) {
            setState(() {
              _isDownloading = false;
              _statusText = "Terjadi kesalahan koneksi.";
            });
            _fallbackBrowserDownload();
          }
        },
      );
    } catch (e) {
      debugPrint("[OtaUpdate] Execute error: $e");
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
        _fallbackBrowserDownload();
      }
    }
  }

  Future<void> _fallbackBrowserDownload() async {
    final uri = Uri.parse(widget.downloadUrl);
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint("[AppUpdateDialog] Fallback browser error: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Unduh manual melalui browser: ${widget.downloadUrl}"),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.forceUpdate && !_isDownloading,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: AppColors.surface,
        elevation: 20,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Icon
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary.withOpacity(0.25), width: 2),
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    size: 34,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              Text(
                widget.title,
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
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.subSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    "Versi Baru: v${widget.latestVersion}  (Saat ini: v${widget.currentVersion})",
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
                  color: AppColors.subSurface.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.stars_rounded, size: 16, color: AppColors.primary),
                        const SizedBox(width: 6),
                        Text(
                          "Pembaruan Terbaru:",
                          style: AppTypography.labelSmall.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      widget.releaseNotes,
                      style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.45,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // In-App Download Progress or Action Button
              if (_isDownloading) ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            _statusText,
                            style: AppTypography.labelSmall.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          "$_downloadPercent%",
                          style: AppTypography.labelSmall.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: _downloadPercent > 0 ? _downloadPercent / 100 : null,
                        minHeight: 10,
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "File APK diunduh langsung di aplikasi. Pemasangan akan terbuka otomatis begitu selesai.",
                      textAlign: TextAlign.center,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ] else ...[
                ElevatedButton.icon(
                  onPressed: _startOtaUpdate,
                  icon: const Icon(Icons.cloud_download_rounded, size: 20, color: Colors.white),
                  label: const Text(
                    "Perbarui Sekarang (Otomatis)",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 2,
                  ),
                ),
                if (!widget.forceUpdate) ...[
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
            ],
          ),
        ),
      ),
    );
  }
}
