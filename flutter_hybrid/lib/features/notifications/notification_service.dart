import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  final List<String> _queuedWebCommands = <String>[];
  final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);
  String? _lastSyncedFcmToken;
  String? _lastSyncedUserToken;
  String? _apiBaseUrl;
  String? _accessToken;
  String? _deviceId;
  String? get lastSyncedUserToken => _lastSyncedUserToken;

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    try {
      const android = AndroidInitializationSettings('@mipmap/ic_launcher');
      const settings = InitializationSettings(android: android);

      await _local.initialize(
        settings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('NOTIF CLICK payload=${response.payload}');
          if (response.payload != null && response.payload!.isNotEmpty) {
            queueWebCommand(response.payload!);
          }
          _decrementBadge();
        },
      );

      final androidImpl = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidImpl?.createNotificationChannel(
        const AndroidNotificationChannel(
          'task_updates',
          'Task Updates',
          description: 'Notifikasi tugas realtime',
          importance: Importance.max,
          playSound: true,
        ),
      );

      final messaging = FirebaseMessaging.instance;
      final permission = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('FCM permission status=${permission.authorizationStatus}');

      final token = await messaging.getToken();
      debugPrint('FCM TOKEN=$token');

      FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
        debugPrint('FCM foreground message data=${message.data}');
        await showFromRemoteMessage(message);
      });

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('FCM onMessageOpenedApp data=${message.data}');
        queueWebCommand(jsonEncode(message.data));
        _decrementBadge();
      });

      FirebaseMessaging.instance.onTokenRefresh.listen((String token) async {
        debugPrint('FCM TOKEN REFRESHED=$token');
        final apiBaseUrl = _apiBaseUrl;
        final accessToken = _accessToken;
        final deviceId = _deviceId;
        if (apiBaseUrl == null || accessToken == null || deviceId == null) {
          return;
        }
        await syncPushTokenToBackend(
          apiBaseUrl: apiBaseUrl,
          accessToken: accessToken,
          deviceId: deviceId,
        );
      });

      _initialized = true;
    } catch (e, stack) {
      debugPrint('Notification initialize error: $e');
      debugPrint('$stack');
    }
  }

  Future<void> handleInitialMessage() async {
    try {
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial == null) return;
      debugPrint('FCM initial message data=${initial.data}');
      queueWebCommand(jsonEncode(initial.data));
      _decrementBadge();
    } catch (e, stack) {
      debugPrint('Initial message handler error: $e');
      debugPrint('$stack');
    }
  }

  Future<void> handleBackgroundMessage(RemoteMessage message) async {
    debugPrint('FCM background message data=${message.data}');
    await showFromRemoteMessage(message);
  }

  Future<void> showFromRemoteMessage(RemoteMessage message) async {
    final title = message.notification?.title ?? 'Tugas Baru';
    final body = message.notification?.body ??
        'Ada tugas baru nih...! Segera cek dashboard kamu.';
    final payload = jsonEncode(message.data);

    await _local.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'task_updates',
          'Task Updates',
          channelDescription: 'Notifikasi tugas realtime',
          importance: Importance.max,
          priority: Priority.high,
          ticker: 'task_updates',
          visibility: NotificationVisibility.public,
        ),
      ),
      payload: payload,
    );

    _incrementBadge();
  }

  void queueWebCommand(String payload) {
    _queuedWebCommands.add(payload);
  }

  List<String> drainWebCommands() {
    final out = List<String>.from(_queuedWebCommands);
    _queuedWebCommands.clear();
    return out;
  }

  Future<void> syncPushTokenToBackend({
    required String apiBaseUrl,
    required String accessToken,
    required String deviceId,
  }) async {
    _apiBaseUrl = apiBaseUrl;
    _accessToken = accessToken;
    _deviceId = deviceId;

    final fcmToken = await FirebaseMessaging.instance.getToken();
    debugPrint('SYNC FCM TOKEN=$fcmToken');
    if (fcmToken == null || fcmToken.isEmpty) return;

    final alreadySynced =
        _lastSyncedFcmToken == fcmToken && _lastSyncedUserToken == accessToken;
    if (alreadySynced) return;

    final response = await _patchPushTokenWithRetry(
      apiBaseUrl: apiBaseUrl,
      accessToken: accessToken,
      deviceId: deviceId,
      pushToken: fcmToken,
    );

    debugPrint('SYNC TOKEN STATUS=${response.statusCode}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      _lastSyncedFcmToken = fcmToken;
      _lastSyncedUserToken = accessToken;
    }
  }

  Future<void> clearPushTokenFromBackend({
    required String apiBaseUrl,
    required String accessToken,
    required String deviceId,
  }) async {
    final response = await _patchPushTokenWithRetry(
      apiBaseUrl: apiBaseUrl,
      accessToken: accessToken,
      deviceId: deviceId,
      pushToken: '',
    );
    debugPrint('CLEAR TOKEN STATUS=${response.statusCode}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      _lastSyncedFcmToken = null;
      _lastSyncedUserToken = null;
      clearBadge();
    }
  }

  Future<http.Response> _patchPushTokenWithRetry({
    required String apiBaseUrl,
    required String accessToken,
    required String deviceId,
    required String pushToken,
  }) async {
    const delays = <Duration>[
      Duration(milliseconds: 0),
      Duration(milliseconds: 600),
      Duration(milliseconds: 1400),
    ];

    http.Response? lastResponse;
    for (final delay in delays) {
      if (delay.inMilliseconds > 0) {
        await Future<void>.delayed(delay);
      }
      final uri = Uri.parse('$apiBaseUrl/users/me/push-token');
      try {
        lastResponse = await http.patch(
          uri,
          headers: <String, String>{
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
            'x-device-id': deviceId,
          },
          body: jsonEncode(<String, String>{'push_token': pushToken}),
        );
      } catch (_) {
        continue;
      }

      final ok = lastResponse.statusCode >= 200 && lastResponse.statusCode < 300;
      final retryable =
          lastResponse.statusCode >= 500 || lastResponse.statusCode == 429;
      if (ok || !retryable) {
        return lastResponse;
      }
    }
    return lastResponse ?? http.Response('network_error', 599);
  }

  Future<void> setBadgeCount(int value) async {
    final normalized = value < 0 ? 0 : value;
    unreadCount.value = normalized;
    debugPrint('BADGE UPDATED=$normalized');
  }

  Future<void> clearBadge() async => setBadgeCount(0);

  void _incrementBadge() {
    unawaited(setBadgeCount(unreadCount.value + 1));
  }

  void _decrementBadge() {
    final next = unreadCount.value > 0 ? unreadCount.value - 1 : 0;
    unawaited(setBadgeCount(next));
  }
}
