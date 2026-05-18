# QA Checklist - Flutter Hybrid Android

## A. Startup & Stability
- Install APK debug dan release di Android 10, 13, 14.
- Buka app 20x berulang: tidak ada force close / white screen.
- Matikan internet saat splash: fallback offline muncul.
- Nyalakan internet lalu retry: web app termuat normal.

## B. Auth & Session
- Login sekali, tutup app total, buka lagi: masih login.
- Kill app dari recent apps, buka lagi: session tetap valid.
- Logout: token bersih, kembali ke login page.
- Token expired: app kembali ke login tanpa crash.

## C. WebView Lifecycle
- Pindah app ke background 10 menit lalu resume: halaman tetap hidup.
- Rotasi tidak memicu blank/reload loop (portrait lock tetap aman).
- Keyboard di form login/task tidak menutupi input penting.

## D. Notification (FCM + Local)
- Android 13+: popup izin notif muncul saat first launch.
- Foreground: push masuk -> local notification tampil.
- Background: push masuk -> notifikasi tampil.
- Terminated: push masuk -> notifikasi tampil.
- Tap notifikasi task -> app buka halaman task terkait.

## E. Camera & Gallery Native
- Tombol "Ambil dari Kamera" membuka kamera native.
- Tombol "Pilih dari Galeri" membuka galeri native.
- Upload image sukses ke endpoint existing.
- Upload video sukses (uji file kecil dan mendekati limit).
- Preview media tampil, tidak crash.

## F. Realtime & Data Refresh
- Saat task dibuat di akun lain, akun teknisi menerima update cepat.
- Saat status task berubah, list task ikut update.
- Notifikasi list refresh tanpa freeze UI.

## G. Regression Existing Web
- Semua role (atasan/supervisor/staff/teknisi) masih bisa jalankan flow utama.
- Export PDF/XLSX tetap jalan.
- Upload avatar tetap jalan (native + fallback file input).

## H. Release Readiness
- `flutter build apk --release` sukses.
- `flutter build appbundle --release` sukses.
- Tidak ada crash fatal di logcat untuk alur utama.
- Mapping signing + package name final sesuai Play Store.
