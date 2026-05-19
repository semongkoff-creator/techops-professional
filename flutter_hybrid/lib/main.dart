import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
      title: 'Santria Piranti Perkasa',
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

class _SplashGateState extends State<SplashGate> {
  bool _ready = false;
  bool _online = true;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  @override
  void initState() {
    super.initState();
    _init();
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
    }
  }

  @override
  void dispose() {
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
