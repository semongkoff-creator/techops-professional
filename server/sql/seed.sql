INSERT INTO users (name, username, email, password_hash, role, is_active) VALUES
('Staff Utama', 'staff1', 'staff@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'staff', TRUE),
('Eko Mulyanto', 'staff2', 'eko.mulyanto@techops.local', '$2b$10$ORuPYc/t/1Urmlr7Lo.x9uj93nFymEy3jY8W1NheLTL7Qrw51vAcO', 'staff', TRUE),
('Ajat', 'spv1', 'ajat@techops.local', '$2b$10$Bq3XAZTudEkwrpYt.9PkvuMzXIeEpJAsvpdeyQPRv22bhIXgdwdUW', 'supervisor', TRUE),
('Teknisi A', 'teknisi1', 'tek1@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE),
('Teknisi B', 'teknisi2', 'tek2@example.com', '$2b$10$9rE5LZ6N38JpxVOQgIBX/OBfgWy8IGUwla.6tRqQxwkCv2QWiwwDG', 'teknisi', TRUE),
('Ahmad Ansore-Bashori', 'mekanik1', 'ahmad.ansore@techops.local', '$2b$10$TceR5A5r85RMndqw23yUJeXKjZP/aNgJWR0f/o2ixptj.PtggBlTu', 'teknisi', TRUE),
('Bambang -Fachru', 'mekanik2', 'bambang.fachru@techops.local', '$2b$10$599TMppYiyFl8q7TdqA5fOqk4s1xObc/gGFB..u1odD.dH10dTC8a', 'teknisi', TRUE),
('muhdi lutvi', 'mekanik3', 'muhdi.lutvi@techops.local', '$2b$10$ag5I8pR/wvQPOEqf.thAiejrL3J446ml67yf2rQ0aaM2O7ttq1mNm', 'teknisi', TRUE)
ON CONFLICT (username) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Tidak ada data task dummy pada seed.
