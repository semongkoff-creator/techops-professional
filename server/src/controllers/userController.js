import { pool } from "../db/pool.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { createAuditLog } from "../services/auditService.js";

function fileExtFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function uploadToSupabaseStorage({ file, userId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "avatars";
  if (!supabaseUrl || !serviceRoleKey) return null;

  const ext = fileExtFromMime(file.mimetype);
  const objectPath = `users/${userId}/avatar-${Date.now()}.${ext}`;
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
    if (isMissingBucket) {
      return null;
    }
    throw new Error(`Gagal upload avatar ke storage: ${payload || res.statusText}`);
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function saveAvatarToLocal({ file, userId }) {
  const ext = fileExtFromMime(file.mimetype);
  const avatarsDir = path.resolve(process.cwd(), "server/uploads/avatars");
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
  const filename = `avatar-${userId}-${Date.now()}.${ext}`;
  const localPath = path.join(avatarsDir, filename);
  fs.writeFileSync(localPath, file.buffer);
  return `/uploads/avatars/${filename}`;
}

function maskToken(token) {
  const value = String(token || "");
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

export async function listUsers(req, res) {
  const { role } = req.query;
  const params = [];
  let sql = "SELECT id,name,username,email,phone_number,role,avatar_url,is_active FROM users WHERE is_active=TRUE";
  if (role) {
    if (role === "teknisi" || role === "technician") {
      sql += " AND role IN (?,?)";
      params.push("teknisi", "technician");
    } else if (role === "staff") {
      sql += " AND role IN (?,?)";
      params.push("staff", "atasan");
    } else {
      sql += " AND role=?";
      params.push(role);
    }
  }
  sql += " ORDER BY name";
  const [rows] = await pool.execute(sql, params);
  return res.json(rows);
}

export async function getUserById(req, res) {
  const [rows] = await pool.execute(
    "SELECT id,name,username,email,phone_number,role,avatar_url,is_active,created_at,updated_at FROM users WHERE id=? LIMIT 1",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  return res.json(rows[0]);
}

export async function createMember(req, res) {
  const { name, username, email, phone_number, password, role } = req.body;
  const selectedRole = (role === "technician" ? "teknisi" : role);
  if (!["teknisi", "staff"].includes(selectedRole)) {
    return res.status(400).json({ message: "Role member tidak valid." });
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    "INSERT INTO users (name,username,email,phone_number,password_hash,role,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,TRUE,NOW(),NOW())",
    [name, username, email || null, phone_number || null, hash, selectedRole],
  );
  return res.status(201).json({ message: "Member berhasil ditambahkan." });
}

export async function updateMyProfile(req, res) {
  const { name, avatar_url } = req.body;
  await pool.execute("UPDATE users SET name=?, avatar_url=?, updated_at=NOW() WHERE id=?", [name, avatar_url || null, req.user.id]);
  return res.json({ message: "Profile updated" });
}

export async function updateMyPushToken(req, res) {
  const { push_token } = req.body;
  const nextToken = push_token || null;
  const deviceId = req.headers["x-device-id"] || null;
  const userAgent = req.headers["user-agent"] || null;
  const ip = req.ip || req.socket?.remoteAddress || null;

  try {
    await pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT", []);
    const [rows] = await pool.execute("SELECT push_token FROM users WHERE id=? LIMIT 1", [req.user.id]);
    const prevToken = rows?.[0]?.push_token || null;

    await pool.execute("UPDATE users SET push_token=?, updated_at=NOW() WHERE id=?", [nextToken, req.user.id]);

    await createAuditLog({
      actorUserId: req.user.id,
      action: nextToken ? "push_token_updated" : "push_token_revoked",
      entityType: "user",
      entityId: req.user.id,
      oldValue: {
        push_token: maskToken(prevToken),
      },
      newValue: {
        push_token: maskToken(nextToken),
        device_id: deviceId,
        user_agent: userAgent,
        ip,
      },
    });

    return res.json({ message: "Push token updated" });
  } catch (err) {
    try {
      await createAuditLog({
        actorUserId: req.user?.id || null,
        action: "push_token_update_failed",
        entityType: "user",
        entityId: req.user?.id || null,
        oldValue: null,
        newValue: {
          push_token: maskToken(nextToken),
          device_id: deviceId,
          user_agent: userAgent,
          ip,
          error: err?.message || "unknown_error",
        },
      });
    } catch (_) {
      // do not block response if audit logging fails
    }
    throw err;
  }
}

export async function pushTokenHealth(req, res) {
  const limitRaw = Number(req.query.limit || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.trunc(limitRaw)))
    : 50;

  const [rows] = await pool.execute(
    `
    SELECT
      u.id,
      u.name,
      u.username,
      u.role,
      u.push_token,
      u.updated_at,
      al.action AS last_audit_action,
      al.created_at AS last_audit_at
    FROM users u
    LEFT JOIN LATERAL (
      SELECT action, created_at
      FROM audit_logs
      WHERE entity_type='user'
        AND entity_id=u.id
        AND action IN ('push_token_updated', 'push_token_revoked', 'push_token_update_failed')
      ORDER BY created_at DESC
      LIMIT 1
    ) al ON TRUE
    WHERE u.is_active=TRUE
    ORDER BY u.updated_at DESC
    LIMIT ?
    `,
    [limit],
  );

  const summary = {
    total_users: rows.length,
    token_active: rows.filter((r) => !!r.push_token).length,
    token_missing: rows.filter((r) => !r.push_token).length,
    last_failed: rows.filter((r) => r.last_audit_action === "push_token_update_failed")
      .length,
  };

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    role: r.role,
    token_status: r.push_token ? "active" : "missing",
    token_masked: maskToken(r.push_token),
    updated_at: r.updated_at,
    last_audit_action: r.last_audit_action || null,
    last_audit_at: r.last_audit_at || null,
  }));

  return res.json({ summary, items });
}

export async function uploadMyAvatar(req, res) {
  if (!req.file) return res.status(400).json({ message: "Avatar file is required" });

  let avatarPath = null;
  try {
    avatarPath = await uploadToSupabaseStorage({ file: req.file, userId: req.user.id });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Gagal upload avatar" });
  }
  if (!avatarPath) {
    avatarPath = saveAvatarToLocal({ file: req.file, userId: req.user.id });
  }
  await pool.execute("UPDATE users SET avatar_url=?, updated_at=NOW() WHERE id=?", [avatarPath, req.user.id]);

  return res.json({ message: "Avatar uploaded", avatar_url: avatarPath });
}

export async function changeMyPassword(req, res) {
  const { current_password, new_password } = req.body;
  const [rows] = await pool.execute("SELECT password_hash FROM users WHERE id=? LIMIT 1", [req.user.id]);
  const me = rows[0];
  if (!me) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(current_password, me.password_hash);
  if (!ok) return res.status(400).json({ message: "Password lama tidak sesuai" });

  const same = await bcrypt.compare(new_password, me.password_hash);
  if (same) return res.status(400).json({ message: "Password baru harus berbeda" });

  const hash = await bcrypt.hash(new_password, 10);
  await pool.execute("UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?", [hash, req.user.id]);
  return res.json({ message: "Password berhasil diubah" });
}
