import { pool } from "../db/pool.js";

let notificationSchemaReady = false;
async function ensureNotificationSchema() {
  if (notificationSchemaReady) return;
  await pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id BIGINT NULL", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_role VARCHAR(32) NULL", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id BIGINT NULL", []);
  notificationSchemaReady = true;
}

async function sendPushOneSignal({ token, title, body, data }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restApiKey || !token) return false;

  try {
    const res = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [token],
        headings: { en: title, id: title },
        contents: { en: body, id: body },
        data: data || {},
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendPushLegacy({ token, title, body, data }) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || !token) return false;
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
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
        data: data || {},
        priority: "high",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createNotification({
  userId,
  title,
  message,
  type,
  referenceType,
  referenceId,
  senderId = null,
  senderRole = null,
  taskId = null,
}) {
  await ensureNotificationSchema();
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, is_read, type, reference_type, reference_id, sender_id, sender_role, task_id, created_at)
     VALUES (?, ?, ?, FALSE, ?, ?, ?, ?, ?, ?, NOW())`,
    [userId, title, message, type, referenceType, referenceId, senderId, senderRole, taskId],
  );
  const [rows] = await pool.execute("SELECT push_token FROM users WHERE id=? LIMIT 1", [userId]);
  const token = rows?.[0]?.push_token || null;
  const pushData = {
    type: type || "general",
    reference_type: referenceType || "",
    reference_id: referenceId ? String(referenceId) : "",
    task_id: taskId ? String(taskId) : "",
    deep_link: taskId ? `/tasks?task_id=${taskId}` : referenceType === "report" ? "/reports" : "/notifications",
  };

  // Primary: OneSignal (if configured). Fallback: legacy FCM.
  const sentByOneSignal = await sendPushOneSignal({ token, title, body: message, data: pushData });
  if (!sentByOneSignal) {
    await sendPushLegacy({ token, title, body: message, data: pushData });
  }
}
