import 'package:flutter/foundation.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final List<String> _queuedWebCommands = <String>[];
  final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);
  final ValueNotifier<Map<String, dynamic>?> inAppBanner =
      ValueNotifier<Map<String, dynamic>?>(null);

  Future<void> initialize() async {
    try {
      // Local notifications-only mode: no Firebase/FCM bootstrap required.
    } catch (e, stack) {
      // Avoid startup crash if notification init fails.
      // ignore: avoid_print
      print('Notification initialize error: $e');
      // ignore: avoid_print
      print(stack);
    }
  }

  void queueWebCommand(String payload) {
    _queuedWebCommands.add(payload);
  }

  void setUnreadCount(int value) {
    unreadCount.value = value < 0 ? 0 : value;
  }

  void emitInAppBanner({
    required String title,
    required String message,
    String? type,
    int? taskId,
  }) {
    inAppBanner.value = <String, dynamic>{
      'title': title,
      'message': message,
      'type': type ?? 'general',
      'task_id': taskId,
      'ts': DateTime.now().millisecondsSinceEpoch,
    };
  }

  List<String> drainWebCommands() {
    final out = List<String>.from(_queuedWebCommands);
    _queuedWebCommands.clear();
    return out;
  }
}
