import bcrypt from "bcrypt";
import { pool } from "../db/pool.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";

function refreshCookieConfig() {
  const secure = String(process.env.COOKIE_SECURE || "false") === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export async function login(req, res) {
  const { username, password } = req.body;
  const deviceId = req.headers["x-device-id"];
  if (!deviceId || typeof deviceId !== "string") return res.status(400).json({ message: "Missing device id" });
  const [rows] = await pool.execute(
    "SELECT id,name,username,password_hash,role,is_active FROM users WHERE username=? LIMIT 1",
    [username],
  );
  const user = rows[0];
  if (!user || !user.is_active) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken(user, deviceId);
  const refreshToken = signRefreshToken(user, deviceId);
  res.cookie("refresh_token", refreshToken, refreshCookieConfig());

  return res.json({ token: accessToken, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
}

export async function refresh(req, res) {
  const token = req.cookies?.refresh_token;
  const deviceId = req.headers["x-device-id"];
  if (!deviceId || typeof deviceId !== "string") return res.status(400).json({ message: "Missing device id" });
  if (!token) return res.status(401).json({ message: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    if (payload.did !== deviceId) return res.status(401).json({ message: "Session mismatch, login ulang di device ini." });
    const [rows] = await pool.execute("SELECT id,name,username,role,is_active FROM users WHERE id=? LIMIT 1", [payload.id]);
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ message: "Invalid refresh token" });

    const accessToken = signAccessToken(user, deviceId);
    const rotatedRefresh = signRefreshToken(user, deviceId);
    res.cookie("refresh_token", rotatedRefresh, refreshCookieConfig());
    return res.json({ token: accessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function me(req, res) {
  const [rows] = await pool.execute(
    "SELECT id,name,username,email,role,avatar_url,is_active,created_at,updated_at FROM users WHERE id=? LIMIT 1",
    [req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  return res.json(rows[0]);
}

export async function logout(req, res) {
  res.clearCookie("refresh_token", { path: "/api/auth" });
  return res.json({ message: "Logout success" });
}
