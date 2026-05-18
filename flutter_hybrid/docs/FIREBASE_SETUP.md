# Firebase + Android Setup (Flutter Hybrid)

Tanggal acuan: 2026-05-18
Target: `flutter_hybrid` Android app

## 1) Buat Project Firebase
1. Buka Firebase Console.
2. Pilih project existing atau buat baru untuk app Android.
3. Tambahkan Android app dengan package name:
- `com.satriapiranti.techops.hybrid`

## 2) Download dan Pasang `google-services.json`
1. Download `google-services.json` dari Firebase.
2. Letakkan file ke:
- `flutter_hybrid/android/app/google-services.json`

## 3) Verifikasi Gradle Plugin
Pastikan file berikut sudah benar.

### `flutter_hybrid/android/app/build.gradle`
Sudah harus memuat plugin:
```gradle
plugins {
  id "com.android.application"
  id "kotlin-android"
  id "dev.flutter.flutter-gradle-plugin"
  id "com.google.gms.google-services"
}
```

Dan dependency bom:
```gradle
dependencies {
  implementation platform('com.google.firebase:firebase-bom:33.2.0')
}
```

## 4) Android Manifest Permission
Pastikan di `flutter_hybrid/android/app/AndroidManifest.xml` ada:
- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.CAMERA`
- `android.permission.READ_MEDIA_IMAGES`
- `android.permission.READ_MEDIA_VIDEO`

Dan metadata channel notif:
```xml
<meta-data
  android:name="com.google.firebase.messaging.default_notification_channel_id"
  android:value="task_updates" />
```

## 5) Firebase Init Runtime
Pastikan bootstrap app memanggil:
- `Firebase.initializeApp()`
- `FirebaseMessaging.onBackgroundMessage(...)`

File saat ini:
- `flutter_hybrid/lib/main.dart`

## 6) FCM Token Registration Flow
Agar push ke user tepat sasaran:
1. Ambil token FCM di Flutter (`FirebaseMessaging.instance.getToken()`).
2. Kirim ke backend endpoint existing:
- `PATCH /api/users/me/push-token`
3. Simpan token per user dan per device.
4. Saat logout, opsional set token null di backend.

## 7) Testing Push (Manual)
Gunakan Firebase Console atau HTTP v1 API dengan payload:
```json
{
  "notification": {
    "title": "Tugas Baru",
    "body": "Ada tugas baru nih...! Segera cek dashboard kamu."
  },
  "data": {
    "deep_link": "/tasks/123",
    "type": "task"
  }
}
```

Expected:
- Foreground: local notif tampil.
- Background: notif tampil.
- Terminated: notif tampil.
- Tap notif: web route task terbuka.

## 8) Common Failure & Fix
1. Error: `Default FirebaseApp is not initialized`
- Pastikan `Firebase.initializeApp()` dipanggil sebelum service notif.

2. Notif tidak muncul Android 13+
- Pastikan permission `POST_NOTIFICATIONS` diminta runtime.

3. Push only foreground
- Pastikan payload mengandung field `notification` (bukan data-only saja) untuk Android behavior default.

4. Token null
- Cek Google Play Services aktif di device.
- Coba ulang setelah app restart + internet stabil.

## 9) Security Notes
- Jangan commit service account JSON ke repo.
- Simpan kredensial Firebase server di backend secret manager.
- Hindari hardcode API key sensitif di source terbuka.

## 10) Final Verification Command
Jalankan setelah Flutter SDK tersedia:
```bash
cd flutter_hybrid
flutter pub get
flutter build apk --release --dart-define=WEB_APP_URL=https://<your-vercel-domain>
flutter build appbundle --release --dart-define=WEB_APP_URL=https://<your-vercel-domain>
```
