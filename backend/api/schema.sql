-- D1 SQLite Database Schema for Employee Daily Update System (EMS)

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager_name TEXT,
  manager_email TEXT,
  manager_github_username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'employee', -- 'employee', 'manager', 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily updates table
CREATE TABLE IF NOT EXISTS daily_updates (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD in Asia/Dhaka
  todays_tasks TEXT NOT NULL, -- JSON array of strings
  sudden_tasks TEXT NOT NULL, -- JSON array of strings
  blockers TEXT NOT NULL, -- JSON array of strings
  plans_going_forward TEXT NOT NULL, -- JSON array of strings
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'locked'
  submitted_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, date)
);

-- Report delivery records for idempotency and audit
CREATE TABLE IF NOT EXISTS report_deliveries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  report_type TEXT NOT NULL, -- 'employee_individual', 'team_manager', 'company_wide'
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  message_id TEXT,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, report_type, recipient_email)
);

-- Application settings / key-value store
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_updates_date ON daily_updates(date);
CREATE INDEX IF NOT EXISTS idx_updates_employee ON daily_updates(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_reports_date_type ON report_deliveries(date, report_type);

-- Initial seed teams if needed
INSERT OR IGNORE INTO teams (id, name, manager_name, manager_email, manager_github_username)
VALUES 
  ('team-core', 'Core Engineering', 'Mohiuddin Reyad', 'mohiuddin.reyad@adnsemicon.com', 'm-reyad'),
  ('team-vlsi', 'VLSI Design', 'Farhan Efty', 'farhan.efty@adnsemicon.com', 'farhan-efty'),
  ('team-software', 'Software & Tools', 'Foez Ahmed', 'foez.ahmed@adnsemicon.com', 'foez-ahmed');
