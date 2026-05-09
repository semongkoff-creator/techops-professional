# TechOps Professional

Aplikasi web fullstack untuk manajemen operasional teknisi dengan alur:
Atasan -> Supervisor -> Teknisi -> Supervisor -> Atasan.

## Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- DB: Supabase PostgreSQL
- Auth: JWT + bcrypt
- Validasi: express-validator
- RBAC: middleware role guard

## Struktur
- `src/` frontend
- `server/src/` backend
- `server/sql/schema.sql`
- `server/sql/seed.sql`

## Konfigurasi
1. Salin env frontend:
   - `.env.example` -> `.env`
2. Salin env backend:
   - `server/.env.example` -> `server/.env`
3. Isi `SUPABASE_DB_URL` di `server/.env` (ambil dari Supabase Project Settings -> Database -> Connection string).

## Install
```bash
npm install
```

## Jalankan
1. Migrasi + seed (ke Supabase PostgreSQL):
```bash
npm run db:migrate-seed
```
2. Jalankan backend:
```bash
npm run dev:backend
```
3. Jalankan frontend:
```bash
npm run dev:frontend
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:5000`

## Akun Seed
Password semua akun: `password`
- Atasan: `atasan1`
- Supervisor: `spv1`
- Teknisi A: `teknisi1`
- Teknisi B: `teknisi2`

## Endpoint Utama
- Auth: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Auth refresh: `/api/auth/refresh` (refresh token via httpOnly cookie)
- Users: `/api/users`, `/api/users/:id`, `/api/users/me`
- Avatar Upload: `/api/users/me/avatar` (multipart/form-data, field: `avatar`)
- Tasks: `/api/tasks`, `/api/tasks/:id`, `/api/tasks/:id/assign-technician`, `/api/tasks/:id/status`, `/api/tasks/:id/progress`, `/api/tasks/:id/history`
- Reports: `/api/reports`, `/api/reports/:id`, `/api/reports/:id/review`, `/api/reports/:id/forward`, `/api/reports/:id/approve`, `/api/reports/:id/revision`
- Notifications: `/api/notifications`, `/api/notifications/read-all`, `/api/notifications/:id/read`
- Dashboard/Analytics/Export: `/api/dashboard/summary`, `/api/dashboard/charts`, `/api/dashboard/export`
  - Export real file:
    - `format=pdf` -> generate PDF
    - `format=xls` -> generate XLSX

## Checklist Uji Role
1. Atasan buat tugas ke supervisor
- Login `atasan1`
- Masuk halaman Tugas
- Isi form "Buat Tugas ke SPV"
- Pastikan tugas muncul dan supervisor menerima notifikasi

2. Supervisor assign teknisi
- Login `spv1`
- Buka halaman Tugas
- Pilih teknisi pada baris tugas
- Klik Assign
- Cek status jadi `assigned_to_technician`

3. Teknisi kirim laporan
- Login `teknisi1` / `teknisi2` yang ditugaskan
- Update status/progress tugas
- Buka Laporan -> Isi Laporan Harian -> Kirim

4. Supervisor forward laporan
- Login `spv1`
- Buka halaman Laporan
- Klik Review lalu Forward

5. Atasan lihat laporan forwarded
- Login `atasan1`
- Buka halaman Laporan
- Pastikan laporan status `forwarded_to_atasan` terlihat
- Uji Approve/Revisi

## Catatan UI
- Mobile-first dengan bottom navigation
- Desktop atasan/supervisor pakai sidebar kiri sticky
- Form dibuat inline panel (tanpa modal blocking) agar aman dari bug fokus/klik
- Tabel monitoring pakai badge status + zebra rows

## Export Real
- Endpoint: `GET /api/dashboard/export?from=YYYY-MM-DD&to=YYYY-MM-DD&technician_id=<id>&format=pdf|xls`
- Output `pdf`: dokumen ringkasan laporan harian
- Output `xls`: file Excel (`.xlsx`) berisi tabel laporan

## Security Hardening
- `helmet` untuk security headers
- Rate limiting:
  - Global API limiter
  - Auth limiter khusus login/refresh
- Refresh token flow:
  - Refresh token disimpan di cookie `httpOnly`
  - Access token short expiry (default `15m`)
  - Endpoint refresh merotasi refresh token

## Upload Avatar
- Backend menyimpan file avatar ke `server/uploads/avatars`
- File static disajikan dari `/uploads/...`
- Format yang didukung: JPG, PNG, WEBP
- Maksimal file: 2MB

## Deploy Vercel (Frontend + API 1 Project)
Checklist cepat sebelum klik Deploy:

1. Pastikan file ini sudah ada:
- `vercel.json`
- `api/index.js`
- `server/src/app.js`

2. Di Vercel -> Project Settings -> Environment Variables:
- `SUPABASE_DB_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN` (contoh: `15m`)
- `JWT_REFRESH_EXPIRES_IN` (contoh: `7d`)
- `DB_SSL=true`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=avatars`
- `COOKIE_SECURE=true` (untuk production https)

3. Buat bucket `avatars` di Supabase Storage:
- Set bucket sebagai `public` (agar URL avatar langsung bisa ditampilkan di UI)

4. Deploy:
- Build command: `npm run build`
- Output dir: `dist`

5. Verifikasi setelah deploy:
- `GET /api/health` -> `{ ok: true }`
- Login berhasil
- Upload avatar berhasil
- Export PDF/XLSX berhasil diunduh
