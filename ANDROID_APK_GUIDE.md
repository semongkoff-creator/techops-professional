# Android APK Guide (Capacitor)

Dokumen ini untuk build aplikasi Android dari codebase web yang sama (tanpa duplikasi code).

## Arsitektur

- Frontend: React + Vite
- Backend/API: Express + Supabase
- Android shell: Capacitor
- Single codebase: Android memuat web app production (`https://techops-professional.vercel.app`)

## Yang Sudah Dikonfigurasi

- `capacitor.config.ts`
  - `appId`: `com.satriapiranti.techops`
  - `appName`: `Satria Piranti Perkasa`
  - `server.url`: `https://techops-professional.vercel.app`
- Plugin Android:
  - `@capacitor/app`
  - `@capacitor/keyboard`
  - `@capacitor/status-bar`
  - `@capacitor/camera`
- Branding:
  - icon + splash sudah digenerate ke folder `android/app/src/main/res/*`

## Prasyarat Build APK

1. Install Android Studio
2. Install Android SDK + Build Tools (API 34+ disarankan)
3. Set environment variable:
   - `JAVA_HOME`
   - `ANDROID_HOME` / `ANDROID_SDK_ROOT`
4. Pastikan Gradle bisa jalan dari terminal

## Perintah Utama

```bash
npm install
npm run build
npx cap sync android
```

## Build Debug APK

```bash
npm run apk:debug
```

Output APK debug:

- `android/app/build/outputs/apk/debug/app-debug.apk`

## Build Release APK

```bash
npm run apk:release
```

Output APK release:

- `android/app/build/outputs/apk/release/app-release-unsigned.apk`

Catatan: untuk Play Store perlu signing config (`keystore`) di Android Studio/Gradle.

## Workflow Harian (Aman)

Setiap ada perubahan frontend:

```bash
npm run build
npx cap sync android
```

Lalu test di emulator/device dari Android Studio.

## Catatan Stabilitas Mobile

- Session login menggunakan token + cookie web app production (persist di WebView storage).
- Upload media (avatar, dokumentasi task) tetap ke Supabase storage via API existing.
- Keyboard mobile sudah ditangani plugin Keyboard (`resize: body`) untuk mencegah input ketutup.
- Status bar di-set agar konsisten dengan UI app.

## Jika Ingin Pakai Environment URL Berbeda

Override URL web Android shell:

```bash
set CAPACITOR_WEB_URL=https://your-staging-domain.vercel.app
npx cap sync android
```

## Troubleshooting Singkat

- `SDK location not found`: cek `ANDROID_SDK_ROOT`
- `JAVA_HOME not set`: set Java 17
- APK build fail setelah ubah package/plugin:
  - `npx cap sync android`
  - clean project di Android Studio
