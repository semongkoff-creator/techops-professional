import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
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
              _showInAppBanner(title: title, message: message);
            }
          }
          if (type == 'set_unread_count') {
            final count = int.tryParse('${data['count'] ?? 0}') ?? 0;
            await NotificationService.instance.setBadgeCount(count);
          }
          if (type == 'clear_badge') {
            await NotificationService.instance.clearBadge();
          }
          if (type == 'sync_push_token') {
            await _syncPushTokenFromWebSession(data);
          }
          if (type == 'clear_push_token') {
            await _clearPushTokenFromWebSession(data);
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
      _requestPushSyncFromWeb();
    }
  }

  Future<void> _pickMedia() async {
    final XFile? file = await _pickMediaFile();
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

  Future<XFile?> _pickMediaFile() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              title: const Text('Ambil Foto dari Kamera'),
              onTap: () => Navigator.pop(ctx, 'camera_image'),
            ),
            ListTile(
              title: const Text('Ambil Video dari Kamera'),
              onTap: () => Navigator.pop(ctx, 'camera_video'),
            ),
            ListTile(
              title: const Text('Pilih dari Galeri'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
          ],
        ),
      ),
    );
    if (source == null) return null;

    if (source == 'camera_image') {
      return picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    }
    if (source == 'camera_video') {
      return picker.pickVideo(source: ImageSource.camera, maxDuration: const Duration(minutes: 5));
    }
    return picker.pickMedia();
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

  Future<void> _pickAndUploadTaskMedia(Map<String, dynamic> data) async {
    final XFile? picked = await _pickMediaFile();
    if (picked == null) return;

    final String uploadUrl = (data['upload_url'] as String? ?? '').trim();
    final String bearerToken = (data['bearer_token'] as String? ?? '').trim();
    final String taskId = (data['task_id'] as String? ?? '').trim();
    final String deviceId = (data['device_id'] as String? ?? '').trim();

    if (uploadUrl.isEmpty || bearerToken.isEmpty) {
      final payload = jsonEncode({
        'ok': false,
        'message': 'Konfigurasi upload belum lengkap (URL/token kosong).',
      });
      await _controller.runJavaScript(
        "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
      );
      return;
    }

    try {
      final uri = _resolveUploadUri(uploadUrl);
      final mimeType = _normalizeMimeType(
        picked.mimeType,
        picked.name,
        picked.path,
      );
      final fileSize = await picked.length();
      debugPrint(
        'NATIVE_UPLOAD_START task=$taskId file=${picked.name} '
        'mime=$mimeType size=$fileSize url=$uri token=${bearerToken.isNotEmpty}',
      );
      final request = http.MultipartRequest('POST', uri)
        ..headers['Authorization'] = 'Bearer $bearerToken'
        ..headers['Accept'] = 'application/json'
        ..headers['x-device-id'] = deviceId
        ..files.add(
          await http.MultipartFile.fromPath(
            'media',
            picked.path,
            contentType: _tryParseMediaType(mimeType),
          ),
        );

      if (taskId.isNotEmpty) {
        request.fields['task_id'] = taskId;
      }

      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);
      final bodyText = response.body;
      final Map<String, dynamic> decoded = _safeJsonMap(bodyText);
      debugPrint(
        'NATIVE_UPLOAD_RESPONSE status=${response.statusCode} '
        'body=${bodyText.substring(0, bodyText.length > 350 ? 350 : bodyText.length)}',
      );

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
        String fallbackMessage = 'Upload gagal (${response.statusCode}).';
        if (response.statusCode == 413) {
          fallbackMessage = 'Ukuran file terlalu besar. Maks gambar 5MB dan video 25MB.';
        } else if (response.statusCode == 415) {
          fallbackMessage = 'Format file tidak didukung. Gunakan JPG/JPEG/PNG/WEBP/MP4/MOV/WEBM/OGG.';
        } else if (response.statusCode == 401 || response.statusCode == 403) {
          fallbackMessage = 'Sesi login berakhir atau akses ditolak. Silakan login ulang.';
        }
        final payload = jsonEncode({
          'ok': false,
          'message': decoded['message'] ?? fallbackMessage,
        });
        await _controller.runJavaScript(
          "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
        );
      }
    } catch (e) {
      debugPrint('NATIVE_UPLOAD_ERROR: $e');
      final payload = jsonEncode({
        'ok': false,
        'message': 'Upload native gagal. Coba ulang atau login ulang.',
      });
      await _controller.runJavaScript(
        "window.dispatchEvent(new CustomEvent('native-upload-result', { detail: $payload }));",
      );
    }
  }

  Uri _resolveUploadUri(String uploadUrl) {
    final parsed = Uri.parse(uploadUrl);
    if (parsed.hasScheme) return parsed;
    final base = Uri.parse(_safeInitialUrl);
    return base.resolve(uploadUrl);
  }

  Map<String, dynamic> _safeJsonMap(String raw) {
    try {
      final parsed = jsonDecode(raw);
      if (parsed is Map<String, dynamic>) return parsed;
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  MediaType? _tryParseMediaType(String value) {
    final chunks = value.split('/');
    if (chunks.length != 2) return null;
    final type = chunks[0].trim();
    final subtype = chunks[1].trim();
    if (type.isEmpty || subtype.isEmpty) return null;
    return MediaType(type, subtype);
  }

  String _normalizeMimeType(String? mime, String fileName, String filePath) {
    final normalized = String(mime ?? '').trim().toLowerCase();
    if (normalized.isNotEmpty && normalized != 'application/octet-stream') {
      return normalized;
    }
    final source = '${fileName.toLowerCase()}|${filePath.toLowerCase()}';
    if (source.contains('.jpg') || source.contains('.jpeg')) return 'image/jpeg';
    if (source.contains('.png')) return 'image/png';
    if (source.contains('.webp')) return 'image/webp';
    if (source.contains('.mp4')) return 'video/mp4';
    if (source.contains('.mov')) return 'video/quicktime';
    if (source.contains('.webm')) return 'video/webm';
    if (source.contains('.ogg')) return 'video/ogg';
    return 'application/octet-stream';
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
    await _requestPushSyncFromWeb();
  }

  Future<void> _requestPushSyncFromWeb() async {
    await _controller.runJavaScript('''
      window.dispatchEvent(new CustomEvent('native-push-sync-request', {
        detail: { source: 'flutter_native' }
      }));
    ''');
  }

  Future<void> _syncPushTokenFromWebSession(Map<String, dynamic> data) async {
    final apiBaseUrl = (data['api_base_url'] as String? ?? '').trim();
    final accessToken = (data['access_token'] as String? ?? '').trim();
    final deviceId = (data['device_id'] as String? ?? '').trim();
    if (apiBaseUrl.isEmpty || accessToken.isEmpty || deviceId.isEmpty) return;
    await NotificationService.instance.syncPushTokenToBackend(
      apiBaseUrl: apiBaseUrl,
      accessToken: accessToken,
      deviceId: deviceId,
    );
  }

  Future<void> _clearPushTokenFromWebSession(Map<String, dynamic> data) async {
    final apiBaseUrl = (data['api_base_url'] as String? ?? '').trim();
    final accessToken = (data['access_token'] as String? ?? '').trim();
    final deviceId = (data['device_id'] as String? ?? '').trim();
    if (apiBaseUrl.isEmpty || accessToken.isEmpty || deviceId.isEmpty) return;
    await NotificationService.instance.clearPushTokenFromBackend(
      apiBaseUrl: apiBaseUrl,
      accessToken: accessToken,
      deviceId: deviceId,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      floatingActionButton: kDebugMode
          ? FloatingActionButton.extended(
              heroTag: 'test_notif_fab',
              onPressed: () async {
                await NotificationService.instance.showTestNotification();
              },
              label: const Text('Test Notification'),
              icon: const Icon(Icons.notifications_active_outlined),
            )
          : null,
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
