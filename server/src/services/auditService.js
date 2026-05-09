import { pool } from "../db/pool.js";

export async function createAuditLog({ actorUserId, action, entityType, entityId, oldValue = null, newValue = null }) {
  await pool.execute(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [actorUserId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null],
  );
}