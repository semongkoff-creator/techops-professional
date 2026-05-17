import { pool } from "../db/pool.js";

async function sendPushLegacy({ token, title, body }) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || !token) return;
  try {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
          sound: "default",
        },
        priority: "high",
      }),
    });
  } catch {
    // keep DB notification flow stable even if push fails
  }
}

export async function createNotification({ userId, title, message, type, referenceType, referenceId }) {
  await pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT", []);
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, is_read, type, reference_type, reference_id, created_at)
     VALUES (?, ?, ?, FALSE, ?, ?, ?, NOW())`,
    [userId, title, message, type, referenceType, referenceId],
  );
  const [rows] = await pool.execute("SELECT push_token FROM users WHERE id=? LIMIT 1", [userId]);
  const token = rows?.[0]?.push_token || null;
  await sendPushLegacy({ token, title, body: message });
}
