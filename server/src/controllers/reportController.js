import { pool } from "../db/pool.js";
import { createAuditLog } from "../services/auditService.js";
import { createNotification } from "../services/notificationService.js";
import { buildTaskUpdatedNotification } from "../services/notificationTemplates.js";

export async function createReport(req, res) {
  const { task_id, report_date, supervisor_id, progress_percent, issue_text, summary_text } = req.body;

  const [taskRows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [task_id]);
  const task = taskRows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });
  const isTechnicianOwner = Number(task.technician_id) === Number(req.user.id);
  const isStaffOwner = Number(task.created_by_atasan_id) === Number(req.user.id);
  const isStaffRole = req.user.role === "staff";
  // Staff boleh submit laporan untuk task yang dia pegang, atau task yang berada di supervisor tujuan.
  const canSubmitAsStaff = isStaffRole && (isStaffOwner || Number(task.supervisor_id) === Number(supervisor_id));
  if (!isTechnicianOwner && !canSubmitAsStaff) return res.status(403).json({ message: "Forbidden" });
  const [spvRows] = await pool.execute("SELECT id FROM users WHERE id=? AND role='supervisor' LIMIT 1", [supervisor_id]);
  const supervisor = spvRows[0];
  if (!supervisor) return res.status(400).json({ message: "Supervisor tidak valid" });

  const [result] = await pool.execute(
    `INSERT INTO daily_reports (task_id,report_date,technician_id,supervisor_id,progress_percent,issue_text,summary_text,report_status,created_at,updated_at)
     VALUES (?,?,?,?,?,? ,?,'submitted_by_technician',NOW(),NOW())`,
    [task_id, report_date, req.user.id, supervisor_id, progress_percent, issue_text || null, summary_text],
  );

  await createAuditLog({ actorUserId: req.user.id, action: "report.submit", entityType: "report", entityId: result.insertId, newValue: { report_status: "submitted_by_technician" } });
  const notif = buildTaskUpdatedNotification({
    senderRole: req.user.role,
    senderName: req.user.name,
    status: "completed",
    completionPercent: 100,
  });
  const targetUserIds = [...new Set([Number(supervisor_id), Number(task.created_by_atasan_id)])]
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
        taskId: Number(task_id),
      }),
    ),
  );
  await createNotification({
    userId: req.user.id,
    title: "Laporan Selesai Berhasil Dikirim",
    message: `Laporan selesai untuk ${task.code} sudah masuk ke supervisor`,
    type: "report_submit_success",
    referenceType: "report",
    referenceId: result.insertId,
  });

  // Sinkronisasi: saat laporan selesai dibuat, task terkait dianggap selesai.
  await pool.execute(
    "UPDATE tasks SET completion_percent=100, status='completed', updated_at=NOW() WHERE id=?",
    [task_id],
  );
  await createAuditLog({
    actorUserId: req.user.id,
    action: "task.auto_complete_from_report",
    entityType: "task",
    entityId: Number(task_id),
    oldValue: { status: task.status, completion_percent: task.completion_percent },
    newValue: { status: "completed", completion_percent: 100 },
  });

  return res.status(201).json({ id: result.insertId });
}

export async function listReports(req, res) {
  let sql = "SELECT r.*, t.code as task_code, t.title as task_title FROM daily_reports r JOIN tasks t ON t.id=r.task_id WHERE 1=1";
  const params = [];
  if (req.user.role === "staff") {
    sql += " AND (r.technician_id=? OR t.created_by_atasan_id=?)";
    params.push(req.user.id, req.user.id);
  } else if (req.user.role === "atasan") {
    sql += " AND t.created_by_atasan_id=? AND r.report_status IN ('forwarded_to_atasan','approved_by_atasan','needs_revision')";
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
  const [rows] = await pool.execute(
    "SELECT r.*, t.created_by_atasan_id FROM daily_reports r JOIN tasks t ON t.id=r.task_id WHERE r.id=? LIMIT 1",
    [req.params.id],
  );
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  const isSupervisorOwner = Number(report.supervisor_id) === Number(req.user.id);
  const isStaffBackup = req.user.role === "staff" && Number(report.created_by_atasan_id) === Number(req.user.id);
  if (!isSupervisorOwner && !isStaffBackup) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='reviewed_by_supervisor', reviewed_at=NOW(), updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.review", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "reviewed_by_supervisor" } });

  return res.json({ message: "Report reviewed" });
}

export async function forwardReport(req, res) {
  const [rows] = await pool.execute("SELECT r.*, t.created_by_atasan_id FROM daily_reports r JOIN tasks t ON t.id=r.task_id WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  const isSupervisorOwner = Number(report.supervisor_id) === Number(req.user.id);
  const isStaffBackup = req.user.role === "staff" && Number(report.created_by_atasan_id) === Number(req.user.id);
  if (!isSupervisorOwner && !isStaffBackup) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='forwarded_to_atasan', forwarded_at=NOW(), updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.forward", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "forwarded_to_atasan" } });
  await createNotification({ userId: report.created_by_atasan_id, title: "Laporan Diteruskan Supervisor", message: `Report #${report.id}`, type: "report_forwarded", referenceType: "report", referenceId: Number(req.params.id) });

  return res.json({ message: "Report forwarded" });
}

export async function approveReport(req, res) {
  const [rows] = await pool.execute("SELECT r.*, t.created_by_atasan_id FROM daily_reports r JOIN tasks t ON t.id=r.task_id WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.created_by_atasan_id !== req.user.id) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='approved_by_atasan', updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.approve", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "approved_by_atasan" } });

  return res.json({ message: "Report approved" });
}

export async function revisionReport(req, res) {
  const [rows] = await pool.execute("SELECT r.*, t.created_by_atasan_id FROM daily_reports r JOIN tasks t ON t.id=r.task_id WHERE r.id=? LIMIT 1", [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (![report.created_by_atasan_id, report.supervisor_id].includes(req.user.id)) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE daily_reports SET report_status='needs_revision', updated_at=NOW() WHERE id=?", [req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "report.needs_revision", entityType: "report", entityId: Number(req.params.id), oldValue: { report_status: report.report_status }, newValue: { report_status: "needs_revision" } });

  return res.json({ message: "Revision requested" });
}
