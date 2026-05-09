import { pool } from "../db/pool.js";

export async function listNotifications(req, res) {
  const userId = String(req.user.id);
  const [rows] = await pool.execute("SELECT * FROM notifications WHERE CAST(user_id AS TEXT)=? ORDER BY created_at DESC", [userId]);
  return res.json(rows);
}

export async function markAllRead(req, res) {
  const userId = String(req.user.id);
  const [result] = await pool.execute("UPDATE notifications SET is_read=TRUE WHERE CAST(user_id AS TEXT)=?", [userId]);
  return res.json({ message: "All notifications marked as read", affectedRows: result.affectedRows || 0 });
}

export async function markRead(req, res) {
  const userId = String(req.user.id);
  const [result] = await pool.execute("UPDATE notifications SET is_read=TRUE WHERE id=? AND CAST(user_id AS TEXT)=?", [Number(req.params.id), userId]);
  return res.json({ message: "Notification marked as read", affectedRows: result.affectedRows || 0 });
}
