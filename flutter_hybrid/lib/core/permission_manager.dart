import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';

class PermissionManager {
  PermissionManager._();
  static final PermissionManager instance = PermissionManager._();

  static const String _notifRequestedKey = 'notif_requested_once';
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  Future<void> requestBootstrapPermissions() async {
    final prefs = await SharedPreferences.getInstance();
    final bool alreadyRequested = prefs.getBool(_notifRequestedKey) ?? false;

    debugPrint('PERMISSION bootstrap start (alreadyRequested=$alreadyRequested)');
    await ensureNotificationPermission();
    if (!alreadyRequested) {
      await prefs.setBool(_notifRequestedKey, true);
    }

    final cameraStatus = await Permission.camera.request();
    final photoStatus = await Permission.photos.request();
    final videoStatus = await Permission.videos.request();
    debugPrint('PERMISSION camera=$cameraStatus photos=$photoStatus videos=$videoStatus');
  }

  Future<bool> ensureNotificationPermission() async {
    var status = await Permission.notification.status;
    debugPrint('PERMISSION notification before request=$status');
    if (!status.isGranted) {
      status = await Permission.notification.request();
      debugPrint('PERMISSION notification requested result=$status');
    }
    try {
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    } catch (_) {}
    status = await Permission.notification.status;
    debugPrint('PERMISSION notification final=$status');
    return status.isGranted;
  }
}
