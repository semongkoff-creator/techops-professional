INSERT INTO users (name, username, email, password_hash, role, is_active) VALUES
('Staff Utama', 'staff1', 'staff@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'staff', TRUE),
('Supervisor Satu', 'spv1', 'spv@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'supervisor', TRUE),
('Teknisi A', 'teknisi1', 'tek1@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE),
('Teknisi B', 'teknisi2', 'tek2@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE)
ON CONFLICT (username) DO UPDATE
SET updated_at = NOW();

-- Tidak ada data task dummy pada seed.
