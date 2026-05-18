# Post-Setup Quick Check

## A. File Presence
- [ ] `flutter_hybrid/android/app/google-services.json` tersedia.
- [ ] `flutter_hybrid/android/app/build.gradle` memuat plugin `com.google.gms.google-services`.
- [ ] `flutter_hybrid/android/app/AndroidManifest.xml` memuat permission notif/kamera/media.

## B. Runtime Init
- [ ] `Firebase.initializeApp()` dieksekusi saat app startup.
- [ ] Background handler FCM sudah diregistrasi.

## C. Notification Flow
- [ ] Android 13+ permission popup muncul.
- [ ] Foreground notif tampil.
- [ ] Background notif tampil.
- [ ] Tap notif -> route task terbuka.

## D. Media Flow
- [ ] Kamera native terbuka.
- [ ] Galeri native terbuka.
- [ ] Upload task create/edit/update sukses.
- [ ] Upload avatar sukses.

## E. Build Artifacts
- [ ] `flutter build apk --release` sukses.
- [ ] `flutter build appbundle --release` sukses.
