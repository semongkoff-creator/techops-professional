import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PermissionManager {
  PermissionManager._();
  static final PermissionManager instance = PermissionManager._();

  static const String _notifRequestedKey = 'notif_requested_once';

  Future<void> requestBootstrapPermissions() async {
    final prefs = await SharedPreferences.getInstance();
    final bool alreadyRequested = prefs.getBool(_notifRequestedKey) ?? false;

    if (!alreadyRequested) {
      final status = await Permission.notification.status;
      if (status.isDenied || status.isRestricted || status.isLimited) {
        await Permission.notification.request();
      }
      await prefs.setBool(_notifRequestedKey, true);
    } else {
      final status = await Permission.notification.status;
      if (status.isDenied) {
        // Soft retry when app reopened after first install.
        await Permission.notification.request();
      }
    }

    await Permission.camera.request();
    await Permission.photos.request();
    await Permission.videos.request();
  }
}
