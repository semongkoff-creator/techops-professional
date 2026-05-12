import { pool } from "../db/pool.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

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

export async function listUsers(req, res) {
  const { role } = req.query;
  const params = [];
  let sql = "SELECT id,name,username,email,role,avatar_url,is_active FROM users WHERE is_active=TRUE";
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
    "SELECT id,name,username,email,role,avatar_url,is_active,created_at,updated_at FROM users WHERE id=? LIMIT 1",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  return res.json(rows[0]);
}

export async function updateMyProfile(req, res) {
  const { name, avatar_url } = req.body;
  await pool.execute("UPDATE users SET name=?, avatar_url=?, updated_at=NOW() WHERE id=?", [name, avatar_url || null, req.user.id]);
  return res.json({ message: "Profile updated" });
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
