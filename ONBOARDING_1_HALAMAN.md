# Onboarding 1 Halaman - TechOps Professional

## Apa yang Kita Bangun
Aplikasi ini dipakai untuk manajemen kerja lapangan dengan alur:
Atasan -> Supervisor -> Teknisi -> Supervisor -> Atasan.

Fokus utamanya:
- Penugasan cepat
- Monitoring progres jelas
- Laporan harian rapi dan bisa direview

## Stack Singkat
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- DB: Supabase PostgreSQL
- Auth: JWT + refresh token

## Struktur Penting
- `src/` -> frontend
- `server/src/` -> backend
- `server/sql/schema.sql` -> skema DB
- `server/sql/seed.sql` -> data awal

## Setup Cepat
1. Copy env:
- `.env.example` -> `.env`
- `server/.env.example` -> `server/.env`

2. Install:
```bash
npm install
```

3. Migrate + seed DB:
```bash
npm run db:migrate-seed
```

4. Jalankan:
```bash
npm run dev:backend
npm run dev:frontend
```

## Akun Uji
- `atasan1`
- `spv1`
- `teknisi1`
- `teknisi2`
Password: `password`

## Alur Uji Wajib
1. Atasan buat tugas.
2. Supervisor assign ke teknisi.
3. Teknisi update progres + kirim laporan.
4. Supervisor review/forward laporan.
5. Atasan approve atau minta revisi.

## Aturan Main Tim
- Jangan ubah format response API tanpa koordinasi.
- Semua endpoint sensitif wajib auth + role guard.
- Perubahan DB wajib bareng update migration/seed.
- Pastikan fitur tetap oke di mobile dan desktop.

## Definition of Done (Minimum)
- Alur utama tugas-laporan jalan end-to-end.
- Tidak ada error runtime di console/server.
- Role permission sesuai ekspektasi.
- Export dashboard (`pdf`/`xls`) berfungsi.

## Baca Lanjutan
- Dokumen pondasi lengkap: `DASAR_FUNDAMENTAL.md`
