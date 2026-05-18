import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../notifications/notification_service.dart';

class HybridWebViewPage extends StatefulWidget {
  const HybridWebViewPage({
    super.key,
    required this.initialUrl,
    required this.onNotificationPayload,
  });

  final String initialUrl;
  final void Function(Map<String, dynamic>) onNotificationPayload;

  @override
  State<HybridWebViewPage> createState() => _HybridWebViewPageState();
}

class _HybridWebViewPageState extends State<HybridWebViewPage>
    with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _loading = true;
  bool _hasError = false;
  late final String _safeInitialUrl;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _safeInitialUrl = widget.initialUrl.trim().isEmpty
        ? 'https://techops-professional.vercel.app/'
        : widget.initialUrl.trim();

    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is AndroidWebViewPlatform) {
      params = AndroidWebViewControllerCreationParams();
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    _controller = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() {
            _loading = true;
            _hasError = false;
          }),
          onPageFinished: (_) async {
            setState(() => _loading = false);
            await _controller.runJavaScript('''
              (function () {
                try {
                  var key = 'techops-theme';
                  var saved = window.localStorage.getItem(key);
                  if (!saved) {
                    window.localStorage.setItem(key, 'light');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            ''');
            await _pushPendingNativeEventsToWeb();
          },
          onWebResourceError: (_) {
            setState(() {
              _loading = false;
              _hasError = true;
            });
          },
        ),
      )
      ..addJavaScriptChannel(
        'NativeBridge',
        onMessageReceived: (JavaScriptMessage message) async {
          final Map<String, dynamic> data =
              jsonDecode(message.message) as Map<String, dynamic>;
          final String type = data['type'] as String? ?? '';

          if (type == 'pick_media') {
            await _pickMedia();
          }
          if (type == 'upload_task_media') {
            await _pickAndUploadTaskMedia(data);
          }
          if (type == 'notify_in_app') {
            final title = (data['title'] as String? ?? 'Notifikasi').trim();
            final message = (data['message'] as String? ?? '').trim();
            if (message.isNotEmpty) {
              NotificationService.instance.emitInAppBanner(
                title: title,
                message: message,
                type: data['notif_type'] as String?,
                taskId: int.tryParse('${data['task_id'] ?? ''}'),
              );
              _showInAppBanner(title: title, message: message);
            }
          }
          if (type == 'set_unread_count') {
            final count = int.tryParse('${data['count'] ?? 0}') ?? 0;
            NotificationService.instance.setUnreadCount(count);
          }
        },
      )
      ..loadRequest(Uri.parse(_safeInitialUrl));

    final platformController = _controller.platform;
    if (platformController is AndroidWebViewController) {
      platformController
        ..setMediaPlaybackRequiresUserGesture(false)
        ..enableZoom(false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _pushPendingNativeEventsToWeb();
    }
  }

  Future<void> _pickMedia() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              title: const Text('Ambil dari Kamera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              title: const Text('Pilih dari Galeri'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    final XFile? file;
    if (source == ImageSource.camera) {
      file = await picker.pickImage(source: source, imageQuality: 85);
    } else {
      file = await picker.pickMedia();
    }
    if (file == null) return;

    final bytes = await File(file.path).readAsBytes();
    final base64 = base64Encode(bytes);

    final payload = jsonEncode({
      'type': 'media_selected',
      'name': file.name,
      'mime': file.mimeType ?? 'application/octet-stream',
      'base64': base64,
    });

    await _controller.runJavaScript(
      "window.dispatchEvent(new CustomEvent('native-media', { detail: $payload }));",
    );
  }

  void _showInAppBanner({
    required String title,
    required String message,
  }) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(message),
          ],
        ),
      ),
    );
  }

  Future<XFile?> _pickMediaFile() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              title: const Text('Ambil dari Kamera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              title: const Text('Pilih dari Galeri'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return null;

    if (source == ImageSource.camera) {
      return picker.pickImage(source: source, imageQuality: 85);
    }
    return picker.pickMedia();
  }

  Future<void> _pickAndUploadTaskMedia(Map<String, dynamic> data) async {
    final XFile? picked = await _pickMediaFile();
    if (picked == null) return;

    final String uploadUrl = (data['upload_url'] as String? ?? '').trim();
    final String bearerToken = (data['bearer_token'] as String? ?? '').trim();
    final String taskId = (data['task_id'] as String? ?? '').trim();
    final String deviceId = (data['device_id'] as String? ?? '').trim();

    if (uploadUrl.isEmpty || bearerToken.isEmpty) {
      return;
    }

    try {
      final uri = Uri.parse(uploadUrl);
      final request = http.MultipartRequest('POST', uri)
        ..headers['Authorization'] = 'Bearer $bearerToken'
        ..headers['x-device-id'] = deviceId
        ..fields['task_id'] = taskId
        ..files.add(await http.MultipartFile.fromPath('media', picked.path));

      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          decoded['documentation_image_url'] != null) {
        final payload = jsonEncode({
          'ok': true,
          'documentation_image_url': decoded['documentation_image_url'],
        });
        await _controller.runJavaScript(
          "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
        );
      } else {
        final payload = jsonEncode({
          'ok': false,
          'message': decoded['message'] ?? 'Upload failed',
        });
        await _controller.runJavaScript(
          "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
        );
      }
    } catch (_) {
      final payload = jsonEncode({
        'ok': false,
        'message': 'Upload native gagal.',
      });
      await _controller.runJavaScript(
        "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
      );
    }
  }

  Future<void> _pushPendingNativeEventsToWeb() async {
    final queued = NotificationService.instance.drainWebCommands();
    for (final payload in queued) {
      await _controller.runJavaScript(
        "window.dispatchEvent(new CustomEvent('native-notification', { detail: $payload }));",
      );
    }
    await _controller.runJavaScript('''
      window.dispatchEvent(new CustomEvent('native-bridge-ready', {
        detail: {
          can_pick_media: true,
          platform: 'flutter_webview'
        }
      }));
    ''');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Stack(
          children: [
            if (!_hasError) WebViewWidget(controller: _controller),
            if (_loading)
              const Center(
                child: CircularProgressIndicator(),
              ),
            if (_hasError)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Gagal memuat halaman.'),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => _hasError = false);
                        _controller.reload();
                      },
                      child: const Text('Reload'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
