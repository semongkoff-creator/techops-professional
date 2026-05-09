INSERT INTO users (name, username, email, password_hash, role, is_active) VALUES
('Atasan Utama', 'atasan1', 'atasan@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'atasan', TRUE),
('Supervisor Satu', 'spv1', 'spv@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'supervisor', TRUE),
('Teknisi A', 'teknisi1', 'tek1@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE),
('Teknisi B', 'teknisi2', 'tek2@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE)
ON CONFLICT (username) DO UPDATE
SET updated_at = NOW();

INSERT INTO tasks (code, title, description, location, priority, status, created_by_atasan_id, supervisor_id, technician_id, due_date, completion_percent)
SELECT 'TSK-202605-0001', 'Pengecekan Panel Listrik', 'Cek panel utama dan backup', 'Plant A', 'high', 'draft_to_supervisor', u_atasan.id, u_spv.id, NULL, CURRENT_DATE + INTERVAL '3 days', 0
FROM users u_atasan, users u_spv
WHERE u_atasan.username = 'atasan1'
  AND u_spv.username = 'spv1'
ON CONFLICT (code) DO NOTHING;
