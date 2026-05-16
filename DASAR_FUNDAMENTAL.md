# Dasar Fundamental TechOps Professional

Dokumen ini jadi pondasi kerja tim agar pengembangan fitur tetap konsisten, aman, dan terukur.

## 1) Tujuan Produk
- Menyederhanakan alur kerja operasional: Supervisor -> Teknisi.
                                                     -> Staff-> Teknisi
- Mempercepat penugasan, monitoring, dan validasi laporan teknisi.
- Menjaga akurasi data operasional untuk kebutuhan evaluasi dan export.

## 2) Prinsip Utama
- Sederhana dulu: utamakan alur yang jelas sebelum menambah kompleksitas.
- Aman by default: semua endpoint sensitif wajib autentikasi + otorisasi.
- Konsisten: pola penamaan, struktur file, dan response API harus seragam.
- Bisa diaudit: perubahan status tugas/laporan harus tercatat.

## 3) Fondasi Teknis
- Frontend: React + Vite + TypeScript (`src/`)
- Backend: Node.js + Express (`server/src/`)
- Database: PostgreSQL Supabase (`server/sql/`)
- Auth: JWT + refresh token + bcrypt
- Keamanan: Helmet, rate limiter, validasi input

## 4) Fondasi Domain
- Role utama: `atasan`, `supervisor`, `teknisi`
- Entitas utama: user, task, report, notification
- Alur minimum:
  1. supervisor membuat tugas.
  2. Staff assign teknisi.
  3. Teknisi update progres + kirim laporan.
  4. Supervisor review/forward.
  5. Atasan approve/revisi.

## 5) Standar API Dasar
- Gunakan prefix konsisten: `/api/...`
- Response sukses konsisten:
  - `success: true`
  - `data: ...`
  - `message: string` (opsional)
- Response error konsisten:
  - `success: false`
  - `message: string`
  - `errors: []` (jika validasi)

## 6) Standar Kode Dasar
- Gunakan TypeScript type/interface di frontend untuk data lintas halaman.
- Pisahkan tanggung jawab:
  - `routes` untuk mapping endpoint
  - `controllers` untuk orkestrasi request-response
  - `services` untuk logika bisnis lintas modul
  - `db` untuk akses data
- Hindari hardcode role/status di banyak tempat; gunakan konstanta terpusat.

## 7) Kualitas Minimum Sebelum Merge
- Fitur berjalan di mobile dan desktop.
- Role guard teruji untuk tiap endpoint sensitif.
- Tidak ada error runtime di alur utama tugas dan laporan.
- Struktur response API tidak berubah tanpa catatan.
- Perubahan skema DB disertai migration/seed relevan.

## 8) Checklist Operasional
- Env frontend dan backend sudah terisi.
- DB migrate + seed berhasil.
- Login 3 role berjalan.
- Notifikasi masuk saat tugas/laporan berubah.
- Export dashboard (`pdf`/`xls`) bisa diunduh.

## 9) Cara Pakai Dokumen Ini
- Jadikan acuan saat mulai fitur baru.
- Jika ada keputusan arsitektur baru, update dokumen ini di hari yang sama.
- Review dokumen ini minimal 1x per sprint agar tetap relevan.
