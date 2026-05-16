# Contributing Guide - TechOps Professional

Dokumen ini jadi panduan kontribusi tim agar perubahan cepat di-review, aman di-merge, dan minim regresi.

## 1) Branching Strategy
- `main` -> branch stabil/produksi.
- Gunakan branch fitur dari `main`:
  - `feature/<nama-fitur>`
  - `fix/<nama-bug>`
  - `chore/<kebutuhan-internal>`

Contoh:
- `feature/task-assign-bulk`
- `fix/report-status-validation`

## 2) Commit Message
Gunakan gaya singkat, jelas, dan konsisten.

Format rekomendasi:
- `feat: tambah endpoint assign teknisi`
- `fix: perbaiki validasi input laporan`
- `chore: rapikan struktur service notifikasi`
- `refactor: pisahkan logika export dashboard`

## 3) Aturan Sebelum Push
- Pastikan perubahan sesuai scope branch.
- Jangan ikut mendorong file/log yang tidak relevan.
- Cek ulang env rahasia tidak ikut ter-commit.

## 4) Pull Request (PR)
Setiap PR wajib berisi:
- Ringkasan perubahan.
- Alasan perubahan (problem yang diselesaikan).
- Dampak ke fitur lain (jika ada).
- Cara uji singkat.
- Screenshot (jika ada perubahan UI).

## 5) PR Checklist Minimum
- Alur utama tidak rusak (tugas -> laporan -> review).
- Endpoint sensitif tetap dilindungi auth + role guard.
- Response API tetap konsisten (`success`, `message`, `data`).
- Tidak ada error runtime di backend/frontend.
- Perubahan DB disertai update schema/seed yang relevan.
- UI tetap layak di mobile dan desktop.

## 6) Review Checklist (Untuk Reviewer)
- Apakah solusi menyelesaikan masalah inti?
- Apakah ada potensi bug/edge case yang belum tertangani?
- Apakah naming dan struktur kode masih konsisten?
- Apakah perubahan berisiko mengganggu role lain (atasan/spv/teknisi)?
- Apakah logging/error handling sudah memadai?

## 7) Standar Kode Singkat
- Gunakan pemisahan tanggung jawab:
  - `routes` -> definisi endpoint
  - `controllers` -> request/response flow
  - `services` -> logika bisnis
  - `db` -> akses data
- Hindari duplikasi konstanta role/status di banyak file.
- Tambah komentar hanya jika blok kode tidak langsung jelas.

## 8) Pengujian Manual Wajib
Uji minimal dengan akun seed:
- `atasan1`
- `spv1`
- `teknisi1` atau `teknisi2`

Skenario minimal:
1. Atasan buat tugas.
2. Supervisor assign teknisi.
3. Teknisi update progres + kirim laporan.
4. Supervisor review/forward.
5. Atasan approve/revisi.

## 9) Hal yang Harus Dihindari
- Merge PR besar tanpa scope jelas.
- Mengubah banyak modul sekaligus tanpa alasan kuat.
- Mengubah kontrak API tanpa komunikasi tim.
- Menunda perbaikan kecil yang bisa jadi debt berulang.

## 10) Definition of Ready (Opsional, Sebelum Coding)
Task dianggap siap dikerjakan jika:
- Tujuan bisnis jelas.
- Role yang terdampak jelas.
- Endpoint/data yang terlibat sudah dipetakan.
- Kriteria selesai bisa diuji.

## 11) Definition of Done
Task dianggap selesai jika:
- Kebutuhan terpenuhi.
- Lolos checklist PR minimum.
- Sudah direview dan disetujui.
- Tidak ada blocker deployment.
