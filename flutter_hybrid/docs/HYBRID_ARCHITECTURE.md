# Flutter Hybrid Migration Blueprint (Capacitor -> Flutter)

## 1) Prinsip Arsitektur
- Web tetap jadi source of truth (1 codebase di Vercel).
- Flutter hanya shell native untuk stabilitas Android dan native capabilities.
- Komunikasi native <-> web via JS bridge events (`NativeBridge`, `native-media`, `native-notification`).
- Semua error native diisolasi dengan global handler + loading fallback + offline fallback.

## 2) Struktur Folder
- `flutter_hybrid/lib/main.dart`: bootstrap aman, splash gate, global error handling.
- `flutter_hybrid/lib/core/permission_manager.dart`: permission bootstrap Android 13+.
- `flutter_hybrid/lib/features/webview/hybrid_webview_page.dart`: WebView container stabil + media bridge.
- `flutter_hybrid/lib/features/notifications/notification_service.dart`: FCM + local notifications + deep link queue.

## 3) Mekanisme Notifikasi
1. Server kirim FCM data payload: contoh `{ "deep_link": "/tasks/123" }`.
2. Saat app background/terminated: notifikasi tampil via FCM Android.
3. Saat foreground: local notification ditrigger oleh `FirebaseMessaging.onMessage`.
4. Saat notif diklik: payload masuk queue -> dikirim ke web lewat event `native-notification`.
5. Web app handle event dan redirect route task.

## 4) Mekanisme Media Upload
1. Web memanggil bridge:
```js
window.NativeBridge.postMessage(JSON.stringify({ type: 'pick_media' }));
```
2. Flutter tampilkan action sheet kamera/galeri.
3. Flutter kirim hasil file base64 via event `native-media`.
4. Web konversi base64 ke Blob/File lalu upload ke Supabase Storage.

## 5) Hardening Anti Force Close
- `runZonedGuarded` + `PlatformDispatcher.onError` + `FlutterError.onError`.
- Cek koneksi di splash gate.
- Fallback layar error + tombol reload saat WebView gagal.
- Lifecycle resume: flush command queue notifikasi ke web.

## 6) Integrasi Web yang Perlu Ditambah
Tambahkan listener ini di web app (misal di bootstrap):
```js
window.addEventListener('native-notification', (e) => {
  const payload = e.detail;
  if (payload?.deep_link) window.location.assign(payload.deep_link);
});

window.addEventListener('native-media', async (e) => {
  const { name, mime, base64 } = e.detail || {};
  if (!base64) return;
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime || 'application/octet-stream' });
  const file = new File([blob], name || 'upload.bin', { type: mime || blob.type });

  // lanjutkan upload ke Supabase Storage sesuai flow existing.
});
```

## 7) Android Config Checklist
- `INTERNET`, `POST_NOTIFICATIONS`, `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`.
- Firebase `google-services.json` + plugin Gradle Android.
- Notification channel `task_updates`.
- `minSdk >= 23`, `targetSdk >= 34`.
- Release signing + Proguard rules untuk webview/firebase.

## 8) Build Commands
```bash
cd flutter_hybrid
flutter pub get
flutter run --dart-define=WEB_APP_URL=https://<app-vercel>.vercel.app
flutter build apk --release --dart-define=WEB_APP_URL=https://<app-vercel>.vercel.app
```

## 9) Catatan Realtime Supabase
- Karena realtime utama tetap berjalan di web app, pastikan tab webview tidak idle terlalu agresif.
- Hindari reload otomatis berkala.
- Gunakan ping/heartbeat dari sisi web jika ada issue websocket disconnect di background panjang.
