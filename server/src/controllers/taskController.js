import { pool } from "../db/pool.js";
import { createAuditLog } from "../services/auditService.js";
import { generateTaskCode } from "../utils/taskCode.js";
import fs from "fs";
import path from "path";

const taskStatuses = ["draft_to_supervisor", "assigned_to_technician", "in_progress", "completed", "closed"];

function fileExtFromMime(mime) {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/ogg") return "ogg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function uploadTaskImageToSupabase({ file, userId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_TASK_MEDIA_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "task-media";
  if (!supabaseUrl || !serviceRoleKey) return null;

  const ext = fileExtFromMime(file.mimetype);
  const taskIdRaw = Number(file?.taskId || 0);
  const taskId = Number.isFinite(taskIdRaw) && taskIdRaw > 0 ? taskIdRaw : "draft";
  const mediaFolder = String(file.mimetype || "").startsWith("video/") ? "videos" : "images";
  const objectPath = `task-media/${taskId}/${mediaFolder}/${userId}-${Date.now()}.${ext}`;
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.mimetype || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file.buffer,
  });

  if (!res.ok) {
    const payload = await res.text().catch(() => "");
    const isMissingBucket = res.status === 404 && /bucket not found/i.test(payload || "");
    if (isMissingBucket) return null;
    throw new Error(`Gagal upload dokumentasi: ${payload || res.statusText}`);
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function saveTaskImageToLocal({ file, userId }) {
  const ext = fileExtFromMime(file.mimetype);
  const docsDir = path.resolve(process.cwd(), "server/uploads/tasks");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  const filename = `task-doc-${userId}-${Date.now()}.${ext}`;
  const localPath = path.join(docsDir, filename);
  fs.writeFileSync(localPath, file.buffer);
  return `/uploads/tasks/${filename}`;
}

export async function uploadTaskDocumentationImage(req, res) {
  if (!req.file) return res.status(400).json({ message: "File dokumentasi wajib dipilih" });
  const taskId = Number(req.body?.task_id || 0);
  if (taskId > 0) {
    const [rows] = await pool.execute("SELECT id, technician_id FROM tasks WHERE id=? LIMIT 1", [taskId]);
    const task = rows[0];
    if (!task) return res.status(404).json({ message: "Task tidak ditemukan." });
    if (Number(task.technician_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });
  }

  let imagePath = null;
  try {
    imagePath = await uploadTaskImageToSupabase({ file: { ...req.file, taskId }, userId: req.user.id });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Gagal upload dokumentasi" });
  }
  if (!imagePath) {
    imagePath = saveTaskImageToLocal({ file: req.file, userId: req.user.id });
  }
  const publicUrl = imagePath.startsWith("/uploads")
    ? `${req.protocol}://${req.get("host")}${imagePath}`
    : imagePath;
  return res.json({ message: "Dokumentasi berhasil diupload", documentation_image_url: publicUrl });
}

export async function createTask(req, res) {
  const { title, description, customer, location, priority, supervisor_id, staff_id, technician_id, documentation_image_url, due_date, completion_percent } = req.body;
  const isSupervisor = req.user.role === "supervisor";
  const isStaff = req.user.role === "staff" || req.user.role === "atasan";
  const isTechnician = req.user.role === "teknisi" || req.user.role === "technician";
  let selectedSupervisorId = isSupervisor ? req.user.id : (supervisor_id ? Number(supervisor_id) : null);
  let selectedStaffId = isSupervisor ? (staff_id ? Number(staff_id) : null) : isStaff ? req.user.id : (staff_id ? Number(staff_id) : null);
  const selectedTechnicianId = isTechnician ? req.user.id : (technician_id ? Number(technician_id) : null);
  const pct = Number.isFinite(Number(completion_percent)) ? Number(completion_percent) : 0;
  const initialStatus = selectedTechnicianId ? "assigned_to_technician" : "draft_to_supervisor";

  if (isStaff && !selectedSupervisorId) {
    return res.status(400).json({ message: "Supervisor wajib diisi oleh Staff." });
  }
  if (isStaff && !selectedTechnicianId) {
    return res.status(400).json({ message: "Teknisi wajib diisi oleh Staff." });
  }
  if (isTechnician && !selectedSupervisorId) {
    return res.status(400).json({ message: "Supervisor wajib diisi oleh Teknisi." });
  }
  if (isTechnician && !selectedStaffId) {
    return res.status(400).json({ message: "Staff wajib diisi oleh Teknisi." });
  }
  if (!selectedSupervisorId) return res.status(400).json({ message: "Supervisor wajib diisi." });

  const [spvRows] = await pool.execute("SELECT id FROM users WHERE id=? AND role='supervisor' LIMIT 1", [selectedSupervisorId]);
  if (!spvRows[0]) return res.status(400).json({ message: "Supervisor tidak valid" });

  // Staff optional: jika kosong (atau supervisor isi dirinya sendiri), tetap boleh lanjut.
  if (selectedStaffId) {
    const [staffRows] = await pool.execute(
      "SELECT id, role FROM users WHERE id=? LIMIT 1",
      [selectedStaffId],
    );
    const staffUser = staffRows[0];
    if (!staffUser || !["staff", "atasan"].includes(String(staffUser.role))) {
      return res.status(400).json({ message: "Staff tidak valid" });
    }
  }

  if (selectedTechnicianId) {
    const [techRows] = await pool.execute("SELECT id FROM users WHERE id=? AND role IN ('teknisi','technician') LIMIT 1", [selectedTechnicianId]);
    if (!techRows[0]) return res.status(400).json({ message: "Teknisi tidak valid" });
  }

  const [[seqRow]] = await pool.query("SELECT COALESCE(MAX(id),0)+1 AS seq FROM tasks");
  const code = generateTaskCode(seqRow.seq);
  const [result] = await pool.execute(
    `INSERT INTO tasks (code,title,description,customer,location,priority,status,created_by_atasan_id,supervisor_id,technician_id,documentation_image_url,due_date,completion_percent,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
    [code, title, description, customer || null, location, priority, initialStatus, selectedStaffId, selectedSupervisorId, selectedTechnicianId, documentation_image_url || null, due_date || null, pct],
  );

  await createAuditLog({
    actorUserId: req.user.id,
    action: "task.create",
    entityType: "task",
    entityId: result.insertId,
    newValue: { status: initialStatus, supervisor_id: selectedSupervisorId, technician_id: selectedTechnicianId },
  });

  return res.status(201).json({ id: result.insertId, code });
}

export async function listTasks(req, res) {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params = [];
  if (req.user.role === "staff" || req.user.role === "atasan") {
    sql += " AND created_by_atasan_id=?";
    params.push(req.user.id);
  }
  if (req.user.role === "supervisor") {
    sql += " AND supervisor_id=?";
    params.push(req.user.id);
  }
  if (req.user.role === "teknisi" || req.user.role === "technician") {
    sql += " AND (technician_id=? OR created_by_atasan_id=?)";
    params.push(req.user.id, req.user.id);
  }
  sql += " ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at ASC, id ASC";
  const [rows] = await pool.execute(sql, params);
  return res.json(rows);
}

export async function getTaskById(req, res) {
  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: "Task not found" });
  return res.json(rows[0]);
}

export async function assignTechnician(req, res) {
  const { technician_id, note } = req.body;
  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });
  const canAssignAsSupervisor = Number(task.supervisor_id) === Number(req.user.id);
  const canAssignAsStaff = Number(task.created_by_atasan_id) === Number(req.user.id);
  if (!canAssignAsSupervisor && !canAssignAsStaff) return res.status(403).json({ message: "Forbidden" });

  const oldStatus = task.status;
  const newStatus = "assigned_to_technician";

  await pool.execute(
    "UPDATE tasks SET technician_id=?, status=?, updated_at=NOW() WHERE id=?",
    [technician_id, newStatus, req.params.id],
  );
  await pool.execute(
    "INSERT INTO task_assignments (task_id,assigned_by_user_id,assigned_to_user_id,note,created_at) VALUES (?,?,?,?,NOW())",
    [req.params.id, req.user.id, technician_id, note || `status:${oldStatus}->${newStatus}`],
  );
  await createAuditLog({ actorUserId: req.user.id, action: "task.assign_technician", entityType: "task", entityId: Number(req.params.id), oldValue: { status: oldStatus, technician_id: task.technician_id }, newValue: { status: newStatus, technician_id } });
  await createNotification({ userId: technician_id, title: "Tugas Ditugaskan", message: `${task.code} - ${task.title}`, type: "task_assigned", referenceType: "task", referenceId: Number(req.params.id) });

  return res.json({ message: "Technician assigned" });
}

export async function updateTaskStatus(req, res) {
  const { status } = req.body;
  if (!taskStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });

  if ((req.user.role === "teknisi" || req.user.role === "technician") && Number(task.technician_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });
  if (req.user.role === "supervisor" && Number(task.supervisor_id) !== Number(req.user.id)) return res.status(403).json({ message: "Forbidden" });

  const oldStatus = task.status;
  await pool.execute("UPDATE tasks SET status=?, updated_at=NOW() WHERE id=?", [status, req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "task.status_update", entityType: "task", entityId: Number(req.params.id), oldValue: { status: oldStatus }, newValue: { status } });

  return res.json({ message: "Task status updated" });
}

export async function updateTaskProgress(req, res) {
  const { completion_percent } = req.body;
  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (![Number(task.technician_id), Number(task.supervisor_id)].includes(Number(req.user.id))) return res.status(403).json({ message: "Forbidden" });

  await pool.execute("UPDATE tasks SET completion_percent=?, updated_at=NOW() WHERE id=?", [completion_percent, req.params.id]);
  await createAuditLog({ actorUserId: req.user.id, action: "task.progress_update", entityType: "task", entityId: Number(req.params.id), oldValue: { completion_percent: task.completion_percent }, newValue: { completion_percent } });

  return res.json({ message: "Task progress updated" });
}

export async function getTaskHistory(req, res) {
  const [assignments] = await pool.execute("SELECT * FROM task_assignments WHERE task_id=? ORDER BY created_at DESC", [req.params.id]);
  const [audits] = await pool.execute("SELECT * FROM audit_logs WHERE entity_type='task' AND entity_id=? ORDER BY created_at DESC", [req.params.id]);
  return res.json({ assignments, audits });
}

export async function updateTask(req, res) {
  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });

  const {
    title = task.title,
    description = task.description,
    customer = task.customer,
    location = task.location,
    priority = task.priority,
    supervisor_id = task.supervisor_id,
    due_date = task.due_date,
    documentation_image_url = task.documentation_image_url,
    completion_percent = task.completion_percent,
  } = req.body;
  const pct = Number.isFinite(Number(completion_percent)) ? Number(completion_percent) : Number(task.completion_percent || 0);
  const nextStatus =
    pct >= 100 ? "completed" :
    pct > 0 ? "in_progress" :
    task.status === "assigned_to_technician" ? "assigned_to_technician" : "draft_to_supervisor";

  await pool.execute(
    "UPDATE tasks SET title=?, description=?, customer=?, location=?, priority=?, supervisor_id=?, technician_id=?, documentation_image_url=?, due_date=?, completion_percent=?, status=?, updated_at=NOW() WHERE id=?",
    [title, description, customer || null, location, priority, supervisor_id, req.body.technician_id ?? task.technician_id, documentation_image_url || null, due_date || null, pct, nextStatus, req.params.id],
  );
  await createAuditLog({
    actorUserId: req.user.id,
    action: "task.update",
    entityType: "task",
    entityId: Number(req.params.id),
    oldValue: task,
    newValue: { title, description, customer, location, priority, supervisor_id, documentation_image_url, due_date, completion_percent: pct, status: nextStatus },
  });
  return res.json({ message: "Task updated" });
}

export async function deleteTask(req, res) {
  const [rows] = await pool.execute("SELECT * FROM tasks WHERE id=? LIMIT 1", [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ message: "Task not found" });
  const canDeleteAsAtasan = task.created_by_atasan_id === req.user.id;
  const canDeleteAsSupervisor = req.user.role === "supervisor" && task.supervisor_id === req.user.id;
  if (!canDeleteAsAtasan && !canDeleteAsSupervisor) return res.status(403).json({ message: "Forbidden" });

  const taskId = Number(req.params.id);
  await pool.execute("DELETE FROM task_assignments WHERE task_id=?", [taskId]);
  await pool.execute("DELETE FROM daily_reports WHERE task_id=?", [taskId]);
  await pool.execute("DELETE FROM notifications WHERE reference_type='task' AND reference_id=?", [taskId]);
  await pool.execute("DELETE FROM audit_logs WHERE entity_type='task' AND entity_id=?", [taskId]);
  await pool.execute("DELETE FROM tasks WHERE id=?", [taskId]);
  await createAuditLog({
    actorUserId: req.user.id,
    action: "task.delete",
    entityType: "task",
    entityId: taskId,
    oldValue: task,
  });
  return res.json({ message: "Task deleted" });
}


