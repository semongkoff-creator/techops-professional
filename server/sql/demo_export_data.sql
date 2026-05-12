-- Demo data generator for export PDF/XLSX preview
-- Safe to re-run: task code is unique and report rows are deduplicated by marker text.

DO $$
DECLARE
  v_staff_id BIGINT;
  v_spv_id BIGINT;
  v_tech_a BIGINT;
  v_tech_b BIGINT;
  i INT;
  v_task_id BIGINT;
  v_task_code TEXT;
  v_tech_id BIGINT;
  v_report_date DATE;
BEGIN
  SELECT id INTO v_staff_id FROM users WHERE username = 'staff1' LIMIT 1;
  SELECT id INTO v_spv_id FROM users WHERE username = 'spv1' LIMIT 1;
  SELECT id INTO v_tech_a FROM users WHERE username = 'teknisi1' LIMIT 1;
  SELECT id INTO v_tech_b FROM users WHERE username = 'teknisi2' LIMIT 1;

  IF v_staff_id IS NULL OR v_spv_id IS NULL OR v_tech_a IS NULL OR v_tech_b IS NULL THEN
    RAISE EXCEPTION 'User demo belum lengkap. Pastikan staff1, spv1, teknisi1, teknisi2 ada.';
  END IF;

  FOR i IN 1..40 LOOP
    v_task_code := 'TSK-DEMO-' || LPAD(i::TEXT, 4, '0');
    v_tech_id := CASE WHEN MOD(i, 2) = 0 THEN v_tech_a ELSE v_tech_b END;

    INSERT INTO tasks (
      code, title, description, customer, location, priority, status,
      created_by_atasan_id, supervisor_id, technician_id, due_date, completion_percent, created_at, updated_at
    ) VALUES (
      v_task_code,
      'Demo Task ' || i,
      'Pekerjaan demo untuk uji export PDF/XLSX',
      'Customer Demo ' || i,
      'Site ' || ((i % 8) + 1),
      CASE WHEN MOD(i, 3) = 0 THEN 'high' WHEN MOD(i, 3) = 1 THEN 'medium' ELSE 'low' END,
      CASE WHEN MOD(i, 5) = 0 THEN 'completed' WHEN MOD(i, 2) = 0 THEN 'in_progress' ELSE 'assigned_to_technician' END,
      v_staff_id, v_spv_id, v_tech_id,
      CURRENT_DATE + ((i % 10) || ' days')::INTERVAL,
      CASE WHEN MOD(i, 5) = 0 THEN 100 WHEN MOD(i, 2) = 0 THEN 60 ELSE 20 END,
      NOW() - ((i % 14) || ' days')::INTERVAL,
      NOW()
    )
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_task_id FROM tasks WHERE code = v_task_code LIMIT 1;
    v_report_date := CURRENT_DATE - ((i % 14) || ' days')::INTERVAL;

    INSERT INTO daily_reports (
      task_id, report_date, technician_id, supervisor_id, progress_percent,
      issue_text, summary_text, report_status, created_at, updated_at
    )
    SELECT
      v_task_id, v_report_date, v_tech_id, v_spv_id,
      CASE WHEN MOD(i, 5) = 0 THEN 100 WHEN MOD(i, 2) = 0 THEN 60 ELSE 20 END,
      CASE WHEN MOD(i, 4) = 0 THEN 'Menunggu material batch ' || i ELSE 'Tidak ada kendala besar' END,
      '[DEMO-PDF-1] Ringkasan task demo ' || i,
      CASE WHEN MOD(i, 5) = 0 THEN 'reviewed_by_supervisor' ELSE 'submitted_by_technician' END,
      NOW() - ((i % 14) || ' days')::INTERVAL,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM daily_reports r
      WHERE r.task_id = v_task_id
        AND r.report_date = v_report_date
        AND r.summary_text = '[DEMO-PDF-1] Ringkasan task demo ' || i
    );

    INSERT INTO daily_reports (
      task_id, report_date, technician_id, supervisor_id, progress_percent,
      issue_text, summary_text, report_status, created_at, updated_at
    )
    SELECT
      v_task_id, v_report_date + INTERVAL '1 day', v_tech_id, v_spv_id,
      CASE WHEN MOD(i, 5) = 0 THEN 100 WHEN MOD(i, 2) = 0 THEN 80 ELSE 40 END,
      'Update lanjutan task demo ' || i,
      '[DEMO-PDF-2] Follow up task demo ' || i,
      CASE WHEN MOD(i, 5) = 0 THEN 'forwarded_to_atasan' ELSE 'reviewed_by_supervisor' END,
      NOW() - ((i % 13) || ' days')::INTERVAL,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM daily_reports r
      WHERE r.task_id = v_task_id
        AND r.report_date = (v_report_date + INTERVAL '1 day')::DATE
        AND r.summary_text = '[DEMO-PDF-2] Follow up task demo ' || i
    );
  END LOOP;
END $$;

