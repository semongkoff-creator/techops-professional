import { pool } from "../db/pool.js";
import { createAuditLog } from "../services/auditService.js";
import { createNotification } from "../services/notificationService.js";
import { buildReportSubmittedNotification } from "../services/notificationTemplates.js";

let reportSchemaReady = false;
async function ensureReportSchema() {
  if (reportSchemaReady) return;
  await pool.execute("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS task_code_ref VARCHAR(30)", []);
  await pool.execute("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS task_title_snapshot TEXT", []);
  await pool.execute("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS customer_snapshot TEXT", []);
  await pool.execute("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS location_snapshot TEXT", []);
  await pool.execute("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT NULL", []);
  await pool.execute("ALTER TABLE daily_reports ALTER COLUMN task_id DROP NOT NULL", []);
  await pool.execute(`
    DO $$
    DECLARE
      c_name text;
    BEGIN
      SELECT conname INTO c_name
      FROM pg_constraint
      WHERE conrelid = 'daily_reports'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%(task_id)%';
      IF c_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE daily_reports DROP CONSTRAINT %I', c_name);
      END IF;
    END $$;
  `, []);
  reportSchemaReady = true;
}

async function findLinkedTask({ taskId, taskCode, supervisorId, userId, userRole }) {
  if (taskId) {
    const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [taskId]);
    return rows[0] || null;
  }
  if (taskCode) {
    const [rows] = await pool.execute("SELECT * FROM tasks WHERE code=? LIMIT 1", [taskCode]);
    return rows[0] || null;
  }

  const params = [supervisorId];
  let sql = `
    SELECT *
    FROM tasks
    WHERE supervisor_id=?
      AND status IN ('draft_to_supervisor','assigned_to_technician','in_progress')
  `;
  if (userRole === "teknisi" || userRole === "technician") {
    sql += " AND technician_id=?";
    params.push(userId);
  } else if (userRole === "staff") {
    sql += " AND created_by_atasan_id=?";
    params.push(userId);
  }
  sql += " ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at ASC LIMIT 1";
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

export async function createReport(req, res) {
  await ensureReportSchema();
  const { task_id, task_code, report_date, supervisor_id, progress_percent, issue_text, summary_text, customer_name, location_name } = req.body;
  const taskId = task_id ? Number(task_id) : null;
  const taskCode = task_code ? String(task_code).trim() : "";
  const isTechnicianRole = req.user.role === "teknisi" || req.user.role === "technician";
  const isStaffRole = req.user.role === "staff";

  const [spvRows] = await pool.execute("SELECT id FROM users WHERE id=? AND role='supervisor' LIMIT 1", [supervisor_id]);
  const supervisor = spvRows[0];
  if (!supervisor) return res.status(400).json({ message: "Supervisor tidak valid" });

  const task = await findLinkedTask({
    taskId,
    taskCode,
    supervisorId: Number(supervisor_id),
    userId: Number(req.user.id),
    userRole: req.user.role,
  });
  if (task) {
    const isTechnicianOwner = Number(task.technician_id) === Number(req.user.id);
    const isStaffOwner = Number(task.created_by_atasan_id) === Number(req.user.id);
    const canSubmitAsStaff = isStaffRole && (isStaffOwner || Number(task.supervisor_id) === Number(supervisor_id));
    if (isTechnicianRole && !isTechnicianOwner) return res.status(403).json({ message: "Forbidden" });
    if (isStaffRole && !canSubmitAsStaff) return res.status(403).json({ message: "Forbidden" });
  } else if (isTechnicianRole && !taskCode) {
    return res.status(400).json({ message: "Pilih task aktif dulu atau isi kode task referensi." });
  }

  const linkedTaskId = task ? Number(task.id) : null;
  const linkedTaskCode = task ? String(task.code || "") : taskCode || null;
  const linkedTaskTitle = task ? String(task.title || "") : null;
  const reportCustomer = task?.customer || customer_name || null;
  const reportLocation = task?.location || location_name || null;
  const createdByStaffId = task?.created_by_atasan_id
    ? Number(task.created_by_atasan_id)
    : (isStaffRole ? Number(req.user.id) : null);

  const [result] = await pool.execute(
    `INSERT INTO daily_reports (task_id,task_code_ref,task_title_snapshot,customer_snapshot,location_snapshot,created_by_staff_id,report_date,technician_id,supervisor_id,progress_percent,issue_text,summary_text,report_status,created_at,updated_at)
     VALUES (?,?,?,?,?,?, ?,?,?,?,?,?,'submitted_by_technician',NOW(),NOW())`,
    [linkedTaskId, linkedTaskCode, linkedTaskTitle, reportCustomer, reportLocation, createdByStaffId, report_date, req.user.id, supervisor_id, progress_percent, issue_text || null, summary_text],
  );

  await createAuditLog({ actorUserId: req.user.id, action: "report.submit", entityType: "report", entityId: result.insertId, newValue: { report_status: "submitted_by_technician" } });
  const notif = buildReportSubmittedNotification({
    senderRole: req.user.role,
    senderName: req.user.name,
  });
  const targetUserIds = [...new Set([Number(supervisor_id), Number(createdByStaffId)])]
    .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(req.user.id));
  await Promise.all(
    targetUserIds.map((userId) =>
      createNotification({
        userId,
        ...notif,
        type: "report_submitted",
        referenceType: "report",
        referenceId: result.insertId,
        senderId: req.user.id,
        senderRole: req.user.role,
        taskId: linkedTaskId,
      }),
    ),
  );
  await createNotification({
    userId: req.user.id,
    title: "Laporan Selesai Berhasil Dikirim",
    message: `Laporan selesai untuk ${linkedTaskCode || "task referensi"} sudah masuk ke supervisor`,
    type: "report_submit_success",
    referenceType: "report",
    referenceId: result.insertId,
  });

  if (linkedTaskId) {
    await pool.execute(
      "UPDATE tasks SET completion_percent=100, status='completed', updated_at=NOW() WHERE id=?",
      [linkedTaskId],
    );
    await createAuditLog({
      actorUserId: req.user.id,
      action: "task.auto_complete_from_report",
      entityType: "task",
      entityId: linkedTaskId,
      oldValue: { status: task?.status, completion_percent: task?.completion_percent },
      newValue: { status: "completed", completion_percent: 100 },
    });
  }

  return res.status(201).json({ id: result.insertId });
}

export async function listReports(req, res) {
  await ensureReportSchema();
  let sql = `
    SELECT
      r.*,
      COALESCE(t.code, r.task_code_ref) AS task_code,
      COALESCE(t.title, r.task_title_snapshot) AS task_title
    FROM daily_reports r
    LEFT JOIN tasks t ON t.id=r.task_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === "staff") {
    sql += " AND (r.technician_id=? OR r.created_by_staff_id=?)";
    params.push(req.user.id, req.user.id);
  } else if (req.user.role === "atasan") {
    sql += " AND r.created_by_staff_id=? AND r.report_status IN ('forwarded_to_atasan','approved_by_atasan','needs_revision')";
    params.push(req.user.id);
  }
  if (req.user.role === "supervisor") {
    sql += " AND r.supervisor_id=?";
    params.push(req.user.id);
  }
  if (req.user.role === "teknisi") {
    sql += " AND r.technician_id=?";
    params.push(req.user.id);
  }
  sql += " ORDER BY r.created_at DESC";
  const [rows] = await pool.execute(sql, params);
  return res.json(rows);
}

export async function getReportById(req, res) {
  const [rows] = await pool.execute("SELECT * FROM daily_reports WHERE id=? LIMIT 1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: "Report not found" });
  return res.json(rows[0]);
}

export async function reviewReport(req, res) {
  await ensureReportSchema();
  const [rows] = await pool.execute("SELECT r.* FROM daily_reports r WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  const isSupervisorOwner = Number(report.supervisor_id) === Number(req.user.id);
  const isStaffBackup = req.user.role === "staff" && Number(report.created_by_staff_id) === Number(req.user.id);
  if (!isSupervisorOwner && !isStaffBackup) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='reviewed_by_supervisor', reviewed_at=NOW(), updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.review", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "reviewed_by_supervisor" } });

  return res.json({ message: "Report reviewed" });
}

export async function forwardReport(req, res) {
  await ensureReportSchema();
  const [rows] = await pool.execute("SELECT r.* FROM daily_reports r WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  const isSupervisorOwner = Number(report.supervisor_id) === Number(req.user.id);
  const isStaffBackup = req.user.role === "staff" && Number(report.created_by_staff_id) === Number(req.user.id);
  if (!isSupervisorOwner && !isStaffBackup) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='forwarded_to_atasan', forwarded_at=NOW(), updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.forward", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "forwarded_to_atasan" } });
  if (Number(report.created_by_staff_id) > 0) {
    await createNotification({ userId: report.created_by_staff_id, title: "Laporan Diteruskan Supervisor", message: `Report #${report.id}`, type: "report_forwarded", referenceType: "report", referenceId: Number(req.params.id) });
  }

  return res.json({ message: "Report forwarded" });
}

export async function approveReport(req, res) {
  await ensureReportSchema();
  const [rows] = await pool.execute("SELECT r.* FROM daily_reports r WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (Number(report.created_by_staff_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='approved_by_atasan', updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.approve", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "approved_by_atasan" } });

  return res.json({ message: "Report approved" });
}

export async function revisionReport(req, res) {
  await ensureReportSchema();
  const [rows] = await pool.execute("SELECT r.* FROM daily_reports r WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (![Number(report.created_by_staff_id), Number(report.supervisor_id)].includes(Number(req.user.id))) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='needs_revision', updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.needs_revision", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "needs_revision" } });

  return res.json({ message: "Revision requested" });
}
