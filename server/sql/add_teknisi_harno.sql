-- Tambah / update akun teknisi Harno
-- username: harno
-- password: harno@spp2626!

INSERT INTO users (name, username, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'Harno',
  'harno',
  'harno@techops.local',
  '$2b$10$0tCqp1Rvp6xhrL4cgN7BcuoIW/7zIHOWeERwOT54rvJk0uRtNid8O',
  'teknisi',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
