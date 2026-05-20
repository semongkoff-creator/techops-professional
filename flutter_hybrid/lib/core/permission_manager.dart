import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PermissionManager {
  PermissionManager._();
  static final PermissionManager instance = PermissionManager._();

  static const String _notifRequestedKey = 'notif_requested_once';

  Future<void> requestBootstrapPermissions() async {
    final prefs = await SharedPreferences.getInstance();
    final bool alreadyRequested = prefs.getBool(_notifRequestedKey) ?? false;

    final status = await Permission.notification.status;
    if (!status.isGranted) {
      await Permission.notification.request();
    }
    if (!alreadyRequested) {
      await prefs.setBool(_notifRequestedKey, true);
    }

    await Permission.camera.request();
    await Permission.photos.request();
    await Permission.videos.request();
  }
}
