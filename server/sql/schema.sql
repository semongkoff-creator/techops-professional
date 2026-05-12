DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'atasan', 'supervisor', 'teknisi')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  customer VARCHAR(200),
  location VARCHAR(200) NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(30) NOT NULL DEFAULT 'draft_to_supervisor' CHECK (status IN ('draft_to_supervisor', 'assigned_to_technician', 'in_progress', 'completed', 'closed')),
  created_by_atasan_id BIGINT NOT NULL REFERENCES users(id),
  supervisor_id BIGINT NOT NULL REFERENCES users(id),
  technician_id BIGINT REFERENCES users(id),
  due_date DATE,
  completion_percent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id),
  assigned_by_user_id BIGINT NOT NULL REFERENCES users(id),
  assigned_to_user_id BIGINT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id),
  report_date DATE NOT NULL,
  technician_id BIGINT NOT NULL REFERENCES users(id),
  supervisor_id BIGINT NOT NULL REFERENCES users(id),
  progress_percent INT NOT NULL,
  issue_text TEXT,
  summary_text TEXT NOT NULL,
  report_status VARCHAR(30) NOT NULL DEFAULT 'submitted_by_technician' CHECK (report_status IN ('submitted_by_technician', 'reviewed_by_supervisor', 'forwarded_to_atasan', 'approved_by_atasan', 'needs_revision')),
  forwarded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  type VARCHAR(80) NOT NULL,
  reference_type VARCHAR(40) NOT NULL,
  reference_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT NOT NULL REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
