import { pool } from "../db/pool.js";

export async function createNotification({ userId, title, message, type, referenceType, referenceId }) {
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, is_read, type, reference_type, reference_id, created_at)
     VALUES (?, ?, ?, FALSE, ?, ?, ?, NOW())`,
    [userId, title, message, type, referenceType, referenceId],
  );
}