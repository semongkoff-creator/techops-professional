import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import 'core/permission_manager.dart';
import 'features/notifications/notification_service.dart';
import 'features/webview/hybrid_webview_page.dart';

const String kWebAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: 'https://techops-professional.vercel.app/',
);

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await NotificationService.instance.handleBackgroundMessage(message);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
  };
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    debugPrint('Uncaught error: $error');
    debugPrint('$stack');
    return true;
  };

  try {
    await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  } catch (e, stack) {
    debugPrint('STARTUP ERROR: $e');
    debugPrint('$stack');
  }

  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await NotificationService.instance.initialize();
    await PermissionManager.instance.requestBootstrapPermissions();
    await NotificationService.instance.handleInitialMessage();
  } catch (e, stack) {
    debugPrint('NOTIFICATION BOOTSTRAP ERROR: $e');
    debugPrint('$stack');
  }

  runZonedGuarded(() {
    runApp(const TechOpsHybridApp());
  }, (Object error, StackTrace stackTrace) {
    debugPrint('Zone error: $error');
    debugPrint('$stackTrace');
  });
}

class TechOpsHybridApp extends StatelessWidget {
  const TechOpsHybridApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Satria Piranti Perkasa',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFFF7A45)),
        useMaterial3: true,
      ),
      home: const SplashGate(),
    );
  }
}

class SplashGate extends StatefulWidget {
  const SplashGate({super.key});

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> with WidgetsBindingObserver {
  bool _ready = false;
  bool _online = true;
  bool _notifChecked = false;
  bool _notifDialogShown = false;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final needRecheck = _ready;
      if (needRecheck) {
        _notifChecked = false;
        _requestNotifPermissionAfterUiReady();
      }
    }
  }

  Future<void> _init() async {
    final status = await Connectivity().checkConnectivity();
    _online = !status.contains(ConnectivityResult.none);

    _subscription = Connectivity().onConnectivityChanged.listen((statusList) {
      setState(() {
        _online = !statusList.contains(ConnectivityResult.none);
      });
    });

    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (mounted) {
      setState(() => _ready = true);
      _requestNotifPermissionAfterUiReady();
    }
  }

  Future<void> _requestNotifPermissionAfterUiReady() async {
    if (_notifChecked) return;
    _notifChecked = true;
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final granted = await PermissionManager.instance.ensureNotificationPermission();
    if (!granted && mounted && !_notifDialogShown) {
      _notifDialogShown = true;
      await showDialog<void>(
        context: context,
        barrierDismissible: true,
        builder: (ctx) => AlertDialog(
          title: const Text('Aktifkan Notifikasi'),
          content: const Text(
            'Agar tugas baru langsung masuk, aktifkan izin notifikasi di Pengaturan aplikasi.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Nanti'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.of(ctx).pop();
                await openAppSettings();
              },
              child: const Text('Buka Pengaturan'),
            ),
          ],
        ),
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (!_online) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Internet tidak tersedia.'),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _init,
                  child: const Text('Coba lagi'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return HybridWebViewPage(
      initialUrl: kWebAppUrl,
      onNotificationPayload: (Map<String, dynamic> payload) {
        final String? deepLink = payload['deep_link'] as String?;
        if (deepLink != null && deepLink.isNotEmpty) {
          final encoded = jsonEncode({'type': 'open_task', 'url': deepLink});
          NotificationService.instance.queueWebCommand(encoded);
        }
      },
    );
  }
}
