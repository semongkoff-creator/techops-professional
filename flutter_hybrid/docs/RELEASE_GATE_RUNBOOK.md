# Release Gate Runbook - Flutter Hybrid (Android)

Tanggal acuan: 2026-05-18
Scope: Validasi production readiness sebelum publish Play Store.

## 0) Prasyarat
- Build web terbaru sudah deploy ke Vercel.
- Backend API dan FCM server key aktif.
- `google-services.json` sudah dipasang di `flutter_hybrid/android/app/`.
- Tester punya minimal 3 device:
  - Android 10
  - Android 13
  - Android 14

## 1) Build Validation
1. Jalankan:
```bash
cd flutter_hybrid
flutter pub get
flutter build apk --debug --dart-define=WEB_APP_URL=https://<vercel-app>
flutter build apk --release --dart-define=WEB_APP_URL=https://<vercel-app>
flutter build appbundle --release --dart-define=WEB_APP_URL=https://<vercel-app>
```
2. Expected:
- Semua command sukses tanpa crash build.
- APK debug/release bisa diinstal.

## 2) Smoke Startup (No Force Close)
1. Install APK release.
2. Buka-tutup app 20x beruntun.
3. Force stop dari App Info, buka lagi.
4. Expected:
- Tidak ada white screen permanen.
- Tidak force close.
- Splash -> web load stabil.

## 3) Notification Permission (Android 13+)
1. Fresh install di Android 13/14.
2. Buka app pertama kali.
3. Expected:
- Popup izin notifikasi muncul sekali.
- Menolak izin tidak crash.
- App tetap berjalan normal.

## 4) FCM End-to-End
Gunakan payload contoh:
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

Skenario:
1. Foreground: kirim push.
2. Background: kirim push.
3. Terminated: kirim push.
4. Tap notifikasi.

Expected:
- Notif tampil di semua state.
- Tap notif membuka app dan mengarah ke halaman task.

## 5) Native Upload (Camera/Gallery)
Skenario per role teknisi:
1. Create task: upload image + video.
2. Edit task: ganti dokumentasi image/video.
3. Update progress: upload dokumentasi image/video.
4. Upload avatar dari profile.

Expected:
- Native picker muncul (camera/gallery).
- Upload sukses, URL tersimpan.
- Preview tampil.
- Tidak crash/OOM pada video ukuran menengah.

## 6) Session Persistence
1. Login valid.
2. Tutup app total, buka ulang.
3. Reboot device, buka app.
4. Tunggu access token expired lalu trigger request.

Expected:
- Session tetap login setelah reopen/reboot.
- Refresh token flow berjalan.
- Jika sesi invalid, redirect login tanpa crash.

## 7) Realtime & Lifecycle
1. Login 2 device akun berbeda.
2. Device A buat/update task.
3. Device B pantau list task/notifikasi.
4. Device B background 10 menit lalu resume.

Expected:
- Update data tetap masuk tanpa manual hard refresh.
- Resume dari background tidak blank/reload loop.

## 8) Network Resilience
1. Putuskan internet saat app dipakai.
2. Buka ulang app saat offline.
3. Nyalakan internet, retry.

Expected:
- Offline fallback muncul.
- Retry kembali normal.
- Tidak stuck di layar putih.

## 9) Acceptance Criteria (Gate)
Release dinyatakan GO jika:
- 0 crash blocker pada startup/notif/upload/session.
- 0 data-loss pada upload media.
- 0 bug high untuk login/logout/realtime utama.
- Seluruh skenario di atas PASS pada minimal 2 device berbeda.

## 10) Bug Triage Label
Gunakan label:
- `BLOCKER`: crash/force close/white screen permanen.
- `HIGH`: fitur inti gagal (notif, upload, login).
- `MEDIUM`: degradasi UX non-kritis.
- `LOW`: kosmetik.
