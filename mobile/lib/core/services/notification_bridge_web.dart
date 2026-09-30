// ignore: avoid_web_libraries_in_flutter
import 'dart:js' as js;

void webRequestNotificationPermission() {
  try {
    if (js.context.hasProperty('requestNotificationPermission')) {
      js.context.callMethod('requestNotificationPermission');
    }
  } catch (_) {}
}

void webShowSystemNotification(String title, String body, String url) {
  try {
    if (js.context.hasProperty('showSystemNotification')) {
      js.context.callMethod('showSystemNotification', [title, body, url]);
    }
  } catch (_) {}
}
