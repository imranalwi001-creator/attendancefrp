import 'dart:async';
import 'package:flutter/foundation.dart';
import 'notification_bridge.dart';

class SystemNotificationService {
  static final Set<String> _notifiedIds = {};
  static bool _hasRequestedPermission = false;

  /// Request browser / device notification permission
  static Future<void> requestPermission() async {
    if (!kIsWeb) return;
    if (_hasRequestedPermission) return;
    _hasRequestedPermission = true;

    try {
      webRequestNotificationPermission();
    } catch (e) {
      debugPrint('[SystemNotificationService] Permission request error: $e');
    }
  }

  /// Show native phone / system lockscreen notification
  static void showNotification({
    required String id,
    required String title,
    required String body,
    String? url,
  }) {
    if (!kIsWeb) return;
    if (_notifiedIds.contains(id)) return;
    _notifiedIds.add(id);

    try {
      webShowSystemNotification(title, body, url ?? '/');
    } catch (e) {
      debugPrint('[SystemNotificationService] Show notification error: $e');
    }
  }

  /// Check newly arrived notifications and trigger system alerts
  static void checkAndNotifyNewItems(List<dynamic> notifications) {
    if (!kIsWeb || notifications.isEmpty) return;

    for (final item in notifications) {
      if (item is Map) {
        final id = item['id']?.toString() ?? '';
        final isRead = item['is_read'] == true;
        if (!isRead && id.isNotEmpty && !_notifiedIds.contains(id)) {
          final title = item['title']?.toString() ?? 'Pemberitahuan HRM';
          final message = item['message']?.toString() ?? '';
          showNotification(id: id, title: title, body: message);
        }
      }
    }
  }
}
