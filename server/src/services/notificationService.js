import { pool } from "../db/pool.js";
import fs from "fs";

let firebaseAdminMod = null;
let firebaseMessagingClient = null;
let firebaseInitAttempted = false;

let notificationSchemaReady = false;
async function ensureNotificationSchema() {
  if (notificationSchemaReady) return;
  await pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id BIGINT NULL", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_role VARCHAR(32) NULL", []);
  await pool.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id BIGINT NULL", []);
  notificationSchemaReady = true;
}

function isLikelyOneSignalPlayerId(token) {
  if (!token) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(token).trim());
}

function isLikelyFcmToken(token) {
  if (!token) return false;
  const raw = String(token).trim();
  if (isLikelyOneSignalPlayerId(raw)) return false;
  // FCM token biasanya panjang, bisa mengandung ":" "." "_" "-"
  return raw.length > 80 && /^[A-Za-z0-9:_\-.]+$/.test(raw);
}

async function getFirebaseMessagingClient() {
  if (firebaseMessagingClient) return firebaseMessagingClient;
  if (firebaseInitAttempted) return null;
  firebaseInitAttempted = true;

  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  const serviceAccountJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || "";
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";

  let serviceAccount = null;
  try {
    if (serviceAccountJsonRaw) {
      serviceAccount = JSON.parse(serviceAccountJsonRaw);
    } else if (serviceAccountBase64) {
      const decoded = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
      serviceAccount = JSON.parse(decoded);
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const filePayload = fs.readFileSync(serviceAccountPath, "utf8");
      serviceAccount = JSON.parse(filePayload);
    } else if (projectId && clientEmail && privateKey) {
      serviceAccount = {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      };
    }
  } catch (err) {
    console.error("FIREBASE_CREDENTIAL_PARSE_ERROR", err?.message || err);
    serviceAccount = null;
  }

  if (!serviceAccount) return null;

  try {
    firebaseAdminMod = firebaseAdminMod || (await import("firebase-admin"));
    const admin = firebaseAdminMod.default || firebaseAdminMod;
    const hasAnyApp = Array.isArray(admin.apps) && admin.apps.length > 0;
    if (!hasAnyApp) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    firebaseMessagingClient = admin.messaging();
    return firebaseMessagingClient;
  } catch (err) {
    console.error("FIREBASE_ADMIN_INIT_ERROR", err?.message || err);
    firebaseMessagingClient = null;
    return null;
  }
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

async function sendPushFirebaseAdmin({ token, title, body, data }) {
  if (!token) return false;
  const messaging = await getFirebaseMessagingClient();
  if (!messaging) return false;
  try {
    await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data: Object.entries(data || {}).reduce((acc, [k, v]) => {
        acc[String(k)] = String(v ?? "");
        return acc;
      }, {}),
      android: {
        priority: "high",
        notification: {
          channelId: "task_updates",
          sound: "default",
        },
      },
    });
    return true;
  } catch (err) {
    const msg = err?.message || String(err || "");
    console.error("FCM_SEND_ERROR", msg);
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

  // Route provider by token type to avoid cross-provider mismatch.
  if (!token) return;

  if (isLikelyOneSignalPlayerId(token)) {
    const sentByOneSignal = await sendPushOneSignal({ token, title, body: message, data: pushData });
    if (!sentByOneSignal) {
      await sendPushFirebaseAdmin({ token, title, body: message, data: pushData });
      await sendPushLegacy({ token, title, body: message, data: pushData });
    }
    return;
  }

  if (isLikelyFcmToken(token)) {
    const sentByFirebaseAdmin = await sendPushFirebaseAdmin({ token, title, body: message, data: pushData });
    if (!sentByFirebaseAdmin) {
      await sendPushLegacy({ token, title, body: message, data: pushData });
      await sendPushOneSignal({ token, title, body: message, data: pushData });
    }
    return;
  }

  // Unknown token format: try all providers in safe order.
  const sentByFirebaseAdmin = await sendPushFirebaseAdmin({ token, title, body: message, data: pushData });
  if (!sentByFirebaseAdmin) {
    const sentByOneSignal = await sendPushOneSignal({ token, title, body: message, data: pushData });
    if (!sentByOneSignal) {
      await sendPushLegacy({ token, title, body: message, data: pushData });
    }
  }
}
