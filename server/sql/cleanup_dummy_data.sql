-- Jalankan file ini untuk bersihkan data dummy/demo yang sudah terlanjur masuk database.

DELETE FROM daily_reports
WHERE summary_text ILIKE '%[DEMO-PDF-%'
   OR summary_text ILIKE '%[PDF-FIX]%'
   OR summary_text ILIKE '%task demo%';

DELETE FROM daily_reports dr
USING tasks t
WHERE dr.task_id = t.id
  AND (
    t.code LIKE 'TSK-DEMO-%'
    OR t.title ILIKE '%demo task%'
    OR t.description ILIKE '%demo%'
    OR t.customer ILIKE '%contoh customer%'
    OR t.customer ILIKE '%customer dummy%'
    OR t.description ILIKE '%testing tampilan tabel%'
  );

DELETE FROM tasks
WHERE code LIKE 'TSK-DEMO-%'
   OR title ILIKE '%demo task%'
   OR description ILIKE '%demo%'
   OR customer ILIKE '%contoh customer%'
   OR customer ILIKE '%customer dummy%'
   OR description ILIKE '%testing tampilan tabel%';
