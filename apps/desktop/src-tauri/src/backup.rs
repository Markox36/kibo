use rusqlite::params;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::State;

use crate::AppState;

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        let escaped = s.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        s.to_string()
    }
}

fn table_for(entity_type: &str) -> Option<&'static str> {
    match entity_type {
        "task" | "tasks" => Some("tasks"),
        "event" | "events" => Some("events"),
        "inbox" => Some("inbox"),
        "calendar" | "calendars" => Some("calendars"),
        "category" | "categories" => Some("categories"),
        "tag" | "tags" => Some("tags"),
        "time_entry" | "time_entries" => Some("time_entries"),
        _ => None,
    }
}

#[derive(Serialize)]
pub struct CsvExportResult {
    pub path: String,
    pub rows: usize,
    pub entity_type: String,
}

#[tauri::command]
pub async fn export_csv(
    state: State<'_, AppState>,
    workspace_id: String,
    entity_type: String,
    path: String,
) -> Result<CsvExportResult, String> {
    let table = table_for(&entity_type).ok_or_else(|| "invalid_entity_type".to_string())?;
    let conn = state.db.lock().await;
    let sql = format!("SELECT * FROM {table} WHERE workspace_id = ?1 AND deleted_at IS NULL");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query(params![workspace_id]).map_err(|e| e.to_string())?;

    let mut buf = String::new();
    buf.push_str(&cols.iter().map(|c| csv_escape(c)).collect::<Vec<_>>().join(","));
    buf.push('\n');

    let mut count = 0usize;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut cells: Vec<String> = Vec::with_capacity(cols.len());
        for i in 0..cols.len() {
            let val = row.get_ref(i).map_err(|e| e.to_string())?;
            let s = match val {
                rusqlite::types::ValueRef::Null => String::new(),
                rusqlite::types::ValueRef::Integer(v) => v.to_string(),
                rusqlite::types::ValueRef::Real(v) => v.to_string(),
                rusqlite::types::ValueRef::Text(v) => {
                    String::from_utf8_lossy(v).into_owned()
                }
                rusqlite::types::ValueRef::Blob(_) => String::new(),
            };
            cells.push(csv_escape(&s));
        }
        buf.push_str(&cells.join(","));
        buf.push('\n');
        count += 1;
    }

    std::fs::write(&path, buf).map_err(|e| e.to_string())?;
    Ok(CsvExportResult {
        path,
        rows: count,
        entity_type,
    })
}

#[derive(Serialize)]
pub struct BackupResult {
    pub path: String,
    pub tasks: usize,
    pub events: usize,
    pub calendars: usize,
    pub categories: usize,
    pub inbox: usize,
}

fn dump_table(conn: &rusqlite::Connection, table: &str) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {}", table))?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query([])?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut obj = serde_json::Map::new();
        for (i, name) in col_names.iter().enumerate() {
            let val: Value = match row.get_ref(i)? {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(v) => json!(v),
                rusqlite::types::ValueRef::Real(v) => json!(v),
                rusqlite::types::ValueRef::Text(v) => {
                    Value::String(String::from_utf8_lossy(v).into_owned())
                }
                rusqlite::types::ValueRef::Blob(_) => Value::Null,
            };
            obj.insert(name.clone(), val);
        }
        out.push(Value::Object(obj));
    }
    Ok(out)
}

pub fn snapshot_json(conn: &rusqlite::Connection) -> rusqlite::Result<String> {
    let tasks = dump_table(conn, "tasks")?;
    let events = dump_table(conn, "events")?;
    let calendars = dump_table(conn, "calendars")?;
    let categories = dump_table(conn, "categories")?;
    let tags = dump_table(conn, "tags")?;
    let inbox = dump_table(conn, "inbox")?;
    let time_entries = dump_table(conn, "time_entries")?;
    let workspaces = dump_table(conn, "workspaces")?;

    let payload = json!({
        "version": 1,
        "app": "kibo",
        "exportedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "workspaces": workspaces,
        "calendars": calendars,
        "categories": categories,
        "tags": tags,
        "tasks": tasks,
        "events": events,
        "inbox": inbox,
        "timeEntries": time_entries,
    });
    Ok(serde_json::to_string_pretty(&payload).unwrap())
}

#[tauri::command]
pub async fn export_backup(
    state: State<'_, AppState>,
    path: String,
) -> Result<BackupResult, String> {
    let conn = state.db.lock().await;
    let payload = snapshot_json(&conn).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&payload).unwrap();
    let counts = (
        v.get("tasks").and_then(|x| x.as_array()).map(|a| a.len()).unwrap_or(0),
        v.get("events").and_then(|x| x.as_array()).map(|a| a.len()).unwrap_or(0),
        v.get("calendars").and_then(|x| x.as_array()).map(|a| a.len()).unwrap_or(0),
        v.get("categories").and_then(|x| x.as_array()).map(|a| a.len()).unwrap_or(0),
        v.get("inbox").and_then(|x| x.as_array()).map(|a| a.len()).unwrap_or(0),
    );
    std::fs::write(&path, payload).map_err(|e| e.to_string())?;

    Ok(BackupResult {
        path,
        tasks: counts.0,
        events: counts.1,
        calendars: counts.2,
        categories: counts.3,
        inbox: counts.4,
    })
}

pub fn apply_snapshot(
    conn: &rusqlite::Connection,
    v: &Value,
) -> Result<BackupResult, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut counts = (0usize, 0usize, 0usize, 0usize, 0usize);

    if let Some(arr) = v.get("calendars").and_then(|x| x.as_array()) {
        for c in arr {
            let get_s = |k: &str| c.get(k).and_then(|v| v.as_str()).unwrap_or("");
            let get_i = |k: &str| c.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
            tx.execute(
                "INSERT OR REPLACE INTO calendars
                 (id, workspace_id, name, color, visible, type, external_url, is_default, ord, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending_update')",
                params![
                    get_s("id"), get_s("workspace_id"), get_s("name"), get_s("color"),
                    get_i("visible"), get_s("type"),
                    c.get("external_url").and_then(|v| v.as_str()),
                    get_i("is_default"), get_i("ord"),
                    get_s("created_at"), get_s("updated_at"), get_i("version"),
                ],
            ).map_err(|e| e.to_string())?;
            counts.2 += 1;
        }
    }

    if let Some(arr) = v.get("tasks").and_then(|x| x.as_array()) {
        for t in arr {
            let get_s = |k: &str| t.get(k).and_then(|v| v.as_str()).unwrap_or("");
            let get_opt = |k: &str| t.get(k).and_then(|v| v.as_str());
            let get_i = |k: &str| t.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
            tx.execute(
                "INSERT OR REPLACE INTO tasks (id, workspace_id, title, description, status, priority, energy, category_id,
                 tag_ids_json, planned_date, planned_start, planned_end, time_block, due_date, estimated_minutes,
                 recurrence, reminder, subtasks_json, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 'pending_update')",
                params![
                    get_s("id"), get_s("workspace_id"), get_s("title"), get_opt("description"),
                    get_s("status"), get_s("priority"), get_opt("energy"), get_opt("category_id"),
                    t.get("tag_ids_json").and_then(|v| v.as_str()).unwrap_or("[]"),
                    get_opt("planned_date"), get_opt("planned_start"), get_opt("planned_end"),
                    get_opt("time_block"), get_opt("due_date"),
                    t.get("estimated_minutes").and_then(|v| v.as_i64()),
                    get_s("recurrence"), get_s("reminder"),
                    t.get("subtasks_json").and_then(|v| v.as_str()).unwrap_or("[]"),
                    get_s("created_at"), get_s("updated_at"), get_i("version"),
                ],
            ).map_err(|e| e.to_string())?;
            counts.0 += 1;
        }
    }

    if let Some(arr) = v.get("events").and_then(|x| x.as_array()) {
        for ev in arr {
            let get_s = |k: &str| ev.get(k).and_then(|v| v.as_str()).unwrap_or("");
            let get_opt = |k: &str| ev.get(k).and_then(|v| v.as_str());
            let get_i = |k: &str| ev.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
            tx.execute(
                "INSERT OR REPLACE INTO events (id, workspace_id, calendar_id, title, description, start, end, all_day,
                 category_id, tag_ids_json, reminder, location, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'pending_update')",
                params![
                    get_s("id"), get_s("workspace_id"), get_s("calendar_id"), get_s("title"),
                    get_opt("description"), get_s("start"), get_s("end"), get_i("all_day"),
                    get_opt("category_id"),
                    ev.get("tag_ids_json").and_then(|v| v.as_str()).unwrap_or("[]"),
                    get_s("reminder"), get_opt("location"),
                    get_s("created_at"), get_s("updated_at"), get_i("version"),
                ],
            ).map_err(|e| e.to_string())?;
            counts.1 += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(BackupResult {
        path: String::new(),
        tasks: counts.0,
        events: counts.1,
        calendars: counts.2,
        categories: counts.3,
        inbox: counts.4,
    })
}

#[tauri::command]
pub async fn import_backup(
    state: State<'_, AppState>,
    path: String,
) -> Result<BackupResult, String> {
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let conn = state.db.lock().await;
    let mut r = apply_snapshot(&conn, &v)?;
    r.path = path;
    Ok(r)
}
