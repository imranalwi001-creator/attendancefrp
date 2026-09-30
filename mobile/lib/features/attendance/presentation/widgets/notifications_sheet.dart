import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

class NotificationsSheet extends StatefulWidget {
  final String userId;
  final String? role;
  final VoidCallback? onUpdated;
  final ValueChanged<Map<String, dynamic>>? onNotificationSelected;

  const NotificationsSheet({
    super.key,
    required this.userId,
    this.role,
    this.onUpdated,
    this.onNotificationSelected,
  });

  static Future<void> show(
    BuildContext context, {
    required String userId,
    String? role,
    VoidCallback? onUpdated,
    ValueChanged<Map<String, dynamic>>? onNotificationSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NotificationsSheet(
        userId: userId,
        role: role,
        onUpdated: onUpdated,
        onNotificationSelected: onNotificationSelected,
      ),
    );
  }

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  bool _isLoading = true;
  List<dynamic> _notifications = [];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    try {
      final list = await ApiService.fetchNotifications(widget.userId, role: widget.role);
      if (mounted) {
        setState(() {
          _notifications = list;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markAllAsRead() async {
    setState(() => _isLoading = true);
    try {
      await ApiService.markAllNotificationsAsRead(userId: widget.userId, role: widget.role);
      if (mounted) {
        setState(() {
          for (var n in _notifications) {
            if (n is Map) {
              n['is_read'] = true;
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Semua notifikasi ditandai sudah dibaca"),
            backgroundColor: AppColors.primary,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
          ),
        );
      }
      widget.onUpdated?.call();
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleNotificationClick(Map<String, dynamic> notif) async {
    final notifId = notif['id']?.toString() ?? '';
    final isRead = notif['is_read'] == true;

    if (!isRead && notifId.isNotEmpty) {
      ApiService.markNotificationAsRead(notifId);
      setState(() {
        notif['is_read'] = true;
      });
      widget.onUpdated?.call();
    }

    Navigator.pop(context);
    widget.onNotificationSelected?.call(notif);
  }

  Future<void> _handlePeerAction(String swapId, String notifId, String action) async {
    setState(() => _isLoading = true);
    try {
      await ApiService.peerActionShiftSwap(
        swapId: swapId,
        action: action,
        notes: action == 'accepted' ? 'Disetujui oleh rekan pengganti' : 'Ditolak oleh rekan pengganti',
      );

      await ApiService.markNotificationAsRead(notifId);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(action == 'accepted'
              ? "Anda telah menyetujui permohonan rekan pengganti. Menunggu persetujuan atasan."
              : "Anda telah menolak permohonan tukar shift."),
          backgroundColor: action == 'accepted' ? AppColors.primary : AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );

      widget.onUpdated?.call();
      _loadNotifications();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Gagal memproses aksi: $e"), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => n is Map && n['is_read'] != true).length;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      padding: const EdgeInsets.only(left: 20, right: 20, top: 16, bottom: 24),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderSubtle,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.notifications_active_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            "Notifikasi Masuk",
                            style: AppTypography.titleMedium.copyWith(fontSize: 17, fontWeight: FontWeight.w800),
                          ),
                          if (unreadCount > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                "$unreadCount Baru",
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      Text(
                        "Cuti, lembur & tukar dinas",
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  if (unreadCount > 0)
                    TextButton.icon(
                      onPressed: _markAllAsRead,
                      icon: const Icon(Icons.done_all_rounded, size: 15, color: AppColors.primary),
                      label: const Text(
                        "Tandai Dibaca",
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textSecondary),
                    onPressed: _loadNotifications,
                    tooltip: "Segarkan",
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    padding: EdgeInsets.zero,
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 24),

          // List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _notifications.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.notifications_off_outlined, size: 48, color: AppColors.textDisabled),
                            const SizedBox(height: 12),
                            Text("Tidak ada pemberitahuan", style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
                            const SizedBox(height: 4),
                            Text("Semua pembaruan sistem akan muncul di sini", style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled, fontSize: 11)),
                          ],
                        ),
                      )
                    : ListView.builder(
                        physics: const BouncingScrollPhysics(),
                        itemCount: _notifications.length,
                        itemBuilder: (context, idx) {
                          final notif = _notifications[idx] is Map ? _notifications[idx] as Map<String, dynamic> : <String, dynamic>{};
                          final notifId = notif['id']?.toString() ?? '';
                          final isRead = notif['is_read'] == true;
                          final title = notif['title']?.toString() ?? 'Pemberitahuan';
                          final message = notif['message']?.toString() ?? '';
                          final type = (notif['type'] ?? 'info').toString();
                          final metadata = notif['metadata'] is Map ? notif['metadata'] as Map : {};
                          final isPeerConfirmation = metadata['action'] == 'peer_confirmation' ||
                              title.toLowerCase().contains('pengganti') ||
                              message.toLowerCase().contains('karyawan pengganti');
                          final swapId = metadata['swapId']?.toString();

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: isRead ? Colors.white : const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isPeerConfirmation
                                    ? const Color(0xFFD97706)
                                    : (isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBBF7D0)),
                                width: isPeerConfirmation ? 1.5 : 1.0,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(isRead ? 0.02 : 0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(16),
                                onTap: () => _handleNotificationClick(notif),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(
                                            type == 'leave'
                                                ? Icons.event_available_rounded
                                                : type == 'overtime'
                                                    ? Icons.timelapse_rounded
                                                    : (isPeerConfirmation ? Icons.swap_horiz_rounded : Icons.notifications_rounded),
                                            size: 18,
                                            color: isPeerConfirmation ? const Color(0xFFD97706) : AppColors.primary,
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              title,
                                              style: AppTypography.labelSmall.copyWith(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 13,
                                                color: isPeerConfirmation ? const Color(0xFFB45309) : AppColors.textPrimary,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          if (isRead)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF1F5F9),
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.done_all_rounded, size: 12, color: Color(0xFF059669)),
                                                  SizedBox(width: 3),
                                                  Text(
                                                    "Sudah dibaca",
                                                    style: TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight: FontWeight.w600,
                                                      color: Color(0xFF64748B),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            )
                                          else
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: AppColors.primary.withOpacity(0.12),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.circle, size: 6, color: AppColors.primary),
                                                  SizedBox(width: 3),
                                                  Text(
                                                    "Baru",
                                                    style: TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight: FontWeight.bold,
                                                      color: AppColors.primary,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        message,
                                        style: AppTypography.bodyMedium.copyWith(
                                          fontSize: 12.5,
                                          color: isRead ? AppColors.textSecondary : AppColors.textPrimary,
                                          height: 1.35,
                                        ),
                                      ),

                                      // Peer action buttons if swap approval
                                      if (isPeerConfirmation && swapId != null && !isRead) ...[
                                        const SizedBox(height: 12),
                                        Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFFFBEB),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: const Color(0xFFFDE68A)),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                "Konfirmasi Kesediaan Rekan Kerja Pengganti:",
                                                style: AppTypography.labelSmall.copyWith(
                                                  fontWeight: FontWeight.w700,
                                                  color: const Color(0xFF92400E),
                                                  fontSize: 11,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: ElevatedButton.icon(
                                                      style: ElevatedButton.styleFrom(
                                                        backgroundColor: const Color(0xFF059669),
                                                        foregroundColor: Colors.white,
                                                        padding: const EdgeInsets.symmetric(vertical: 8),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                        elevation: 0,
                                                      ),
                                                      icon: const Icon(Icons.check_circle_rounded, size: 16),
                                                      label: const Text("Terima Shift", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                                                      onPressed: () => _handlePeerAction(swapId, notifId, 'accepted'),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: OutlinedButton.icon(
                                                      style: OutlinedButton.styleFrom(
                                                        foregroundColor: AppColors.danger,
                                                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                                                        padding: const EdgeInsets.symmetric(vertical: 8),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                      ),
                                                      icon: const Icon(Icons.cancel_outlined, size: 16),
                                                      label: const Text("Tolak", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                                                      onPressed: () => _handlePeerAction(swapId, notifId, 'rejected'),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ] else ...[
                                        const SizedBox(height: 8),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.end,
                                          children: [
                                            Text(
                                              "Buka detail",
                                              style: TextStyle(
                                                fontSize: 10.5,
                                                color: AppColors.primary.withOpacity(0.85),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const SizedBox(width: 2),
                                            Icon(
                                              Icons.arrow_forward_ios_rounded,
                                              size: 10,
                                              color: AppColors.primary.withOpacity(0.85),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
