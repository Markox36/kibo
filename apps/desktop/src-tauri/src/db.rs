use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn resolve_db_path(app: &AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("kibo.db"))
}

pub fn open_and_migrate(path: &PathBuf) -> anyhow::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(MIGRATION_001)?;
    Ok(conn)
}

const MIGRATION_001: &str = r#"
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'internal',
  external_url TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_calendars_ws ON calendars(workspace_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  ord INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_categories_ws ON categories(workspace_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_tags_ws ON tags(workspace_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  energy TEXT,
  category_id TEXT,
  tag_ids_json TEXT NOT NULL DEFAULT '[]',
  planned_date TEXT,
  planned_start TEXT,
  planned_end TEXT,
  time_block TEXT,
  due_date TEXT,
  estimated_minutes INTEGER,
  recurrence TEXT NOT NULL DEFAULT 'none',
  reminder TEXT NOT NULL DEFAULT 'none',
  subtasks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_tasks_ws_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_ws_planned ON tasks(workspace_id, planned_date);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  category_id TEXT,
  tag_ids_json TEXT NOT NULL DEFAULT '[]',
  reminder TEXT NOT NULL DEFAULT 'none',
  location TEXT,
  external_uid TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_events_ws_start ON events(workspace_id, start);

CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT,
  category_id TEXT,
  tag_ids_json TEXT NOT NULL DEFAULT '[]',
  date_hint TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_inbox_ws_status ON inbox(workspace_id, status);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'stopwatch',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(workspace_id, task_id);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_snapshot TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_ws ON sync_queue(workspace_id);

CREATE TABLE IF NOT EXISTS notifications_fired (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  anchor_at TEXT NOT NULL,
  reminder TEXT NOT NULL,
  fired_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, anchor_at, reminder)
);
CREATE INDEX IF NOT EXISTS idx_notif_fired_at ON notifications_fired(fired_at);
"#;
