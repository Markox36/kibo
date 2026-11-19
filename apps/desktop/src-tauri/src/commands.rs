use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use ulid::Ulid;

use crate::AppState;

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn enqueue_sync(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    entity_type: &str,
    entity_id: &str,
    operation: &str,
    snapshot: &Value,
) -> rusqlite::Result<()> {
    let now = now_iso();
    conn.execute(
        "INSERT INTO sync_queue (id, workspace_id, entity_type, entity_id, operation, payload_snapshot, attempts, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7)",
        params![
            Ulid::new().to_string(),
            workspace_id,
            entity_type,
            entity_id,
            operation,
            snapshot.to_string(),
            now,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

// ---------------- meta ----------------

#[tauri::command]
pub async fn get_meta(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT value FROM meta WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn set_meta(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- tasks ----------------

#[derive(Serialize, Clone)]
pub struct TaskRow {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub energy: Option<String>,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub planned_date: Option<String>,
    pub planned_start: Option<String>,
    pub planned_end: Option<String>,
    pub time_block: Option<String>,
    pub due_date: Option<String>,
    pub estimated_minutes: Option<i64>,
    pub recurrence: String,
    pub reminder: String,
    pub subtasks: Vec<Value>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub version: i64,
    pub sync_status: String,
}

impl TaskRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let tag_ids_json: String = row.get("tag_ids_json")?;
        let subtasks_json: String = row.get("subtasks_json")?;
        Ok(Self {
            id: row.get("id")?,
            workspace_id: row.get("workspace_id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            status: row.get("status")?,
            priority: row.get("priority")?,
            energy: row.get("energy")?,
            category_id: row.get("category_id")?,
            tag_ids: serde_json::from_str(&tag_ids_json).unwrap_or_default(),
            planned_date: row.get("planned_date")?,
            planned_start: row.get("planned_start")?,
            planned_end: row.get("planned_end")?,
            time_block: row.get("time_block")?,
            due_date: row.get("due_date")?,
            estimated_minutes: row.get("estimated_minutes")?,
            recurrence: row.get("recurrence")?,
            reminder: row.get("reminder")?,
            subtasks: serde_json::from_str(&subtasks_json).unwrap_or_default(),
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            deleted_at: row.get("deleted_at")?,
            version: row.get("version")?,
            sync_status: row.get("sync_status")?,
        })
    }
}

#[derive(Deserialize)]
pub struct CreateTaskInput {
    pub workspace_id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub energy: Option<String>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub planned_date: Option<String>,
    #[serde(default)]
    pub planned_start: Option<String>,
    #[serde(default)]
    pub planned_end: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub estimated_minutes: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpdateTaskInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<Option<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub planned_date: Option<Option<String>>,
    #[serde(default)]
    pub planned_start: Option<Option<String>>,
    #[serde(default)]
    pub planned_end: Option<Option<String>>,
    #[serde(default)]
    pub due_date: Option<Option<String>>,
    #[serde(default)]
    pub estimated_minutes: Option<Option<i64>>,
    #[serde(default)]
    pub subtasks: Option<Vec<Value>>,
}

#[tauri::command]
pub async fn list_tasks(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<TaskRow>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT * FROM tasks WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], TaskRow::from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, AppState>,
    input: CreateTaskInput,
) -> Result<TaskRow, String> {
    let id = Ulid::new().to_string();
    let now = now_iso();
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    let tag_ids_json = serde_json::to_string(&input.tag_ids).unwrap();
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO tasks (id, workspace_id, title, description, status, priority, energy, category_id, tag_ids_json,
         planned_date, planned_start, planned_end, due_date, estimated_minutes,
         subtasks_json, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, '[]', ?15, ?15, 1, 'pending_create')",
        params![
            id, input.workspace_id, input.title, input.description, status, priority,
            input.energy, input.category_id, tag_ids_json,
            input.planned_date, input.planned_start, input.planned_end, input.due_date,
            input.estimated_minutes, now,
        ],
    )
    .map_err(|e| e.to_string())?;

    let row = conn
        .query_row("SELECT * FROM tasks WHERE id = ?1", params![id], TaskRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(
        &conn,
        &row.workspace_id,
        "task",
        &row.id,
        "create",
        &serde_json::to_value(&row).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, AppState>,
    id: String,
    input: UpdateTaskInput,
) -> Result<TaskRow, String> {
    let conn = state.db.lock().await;
    let now = now_iso();

    let mut set_clauses = vec![
        "updated_at = ?".to_string(),
        "version = version + 1".to_string(),
        "sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END".to_string(),
    ];
    let mut binds: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];

    if let Some(v) = input.title { set_clauses.push("title = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.description { set_clauses.push("description = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.status { set_clauses.push("status = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.priority { set_clauses.push("priority = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.planned_date { set_clauses.push("planned_date = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.planned_start { set_clauses.push("planned_start = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.planned_end { set_clauses.push("planned_end = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.due_date { set_clauses.push("due_date = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.estimated_minutes { set_clauses.push("estimated_minutes = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.subtasks {
        set_clauses.push("subtasks_json = ?".into());
        binds.push(Box::new(serde_json::to_string(&v).unwrap()));
    }

    let sql = format!("UPDATE tasks SET {} WHERE id = ?", set_clauses.join(", "));
    binds.push(Box::new(id.clone()));

    let params_slice: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|b| b.as_ref()).collect();
    let n = conn.execute(&sql, params_slice.as_slice()).map_err(|e| e.to_string())?;
    if n == 0 { return Err("not_found".into()); }

    let row = conn
        .query_row("SELECT * FROM tasks WHERE id = ?1", params![id], TaskRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "task", &row.id, "update",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let ws: String = conn
        .query_row("SELECT workspace_id FROM tasks WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1, version = version + 1,
         sync_status = 'pending_delete' WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    let snapshot = serde_json::json!({ "id": id, "deletedAt": now });
    enqueue_sync(&conn, &ws, "task", &id, "delete", &snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- events ----------------

#[derive(Serialize, Clone)]
pub struct EventRow {
    pub id: String,
    pub workspace_id: String,
    pub calendar_id: String,
    pub title: String,
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    pub all_day: bool,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub reminder: String,
    pub location: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub version: i64,
    pub sync_status: String,
}

impl EventRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let tag_ids_json: String = row.get("tag_ids_json")?;
        let all_day_i: i64 = row.get("all_day")?;
        Ok(Self {
            id: row.get("id")?,
            workspace_id: row.get("workspace_id")?,
            calendar_id: row.get("calendar_id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            start: row.get("start")?,
            end: row.get("end")?,
            all_day: all_day_i != 0,
            category_id: row.get("category_id")?,
            tag_ids: serde_json::from_str(&tag_ids_json).unwrap_or_default(),
            reminder: row.get("reminder")?,
            location: row.get("location")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            deleted_at: row.get("deleted_at")?,
            version: row.get("version")?,
            sync_status: row.get("sync_status")?,
        })
    }
}

#[derive(Deserialize)]
pub struct CreateEventInput {
    pub workspace_id: String,
    pub calendar_id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    #[serde(default)]
    pub all_day: bool,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub location: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateEventInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<Option<String>>,
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub end: Option<String>,
    #[serde(default)]
    pub all_day: Option<bool>,
    #[serde(default)]
    pub location: Option<Option<String>>,
}

#[tauri::command]
pub async fn list_events(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<EventRow>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT * FROM events WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY start ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], EventRow::from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn create_event(
    state: State<'_, AppState>,
    input: CreateEventInput,
) -> Result<EventRow, String> {
    let id = Ulid::new().to_string();
    let now = now_iso();
    let tag_ids_json = serde_json::to_string(&input.tag_ids).unwrap();
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO events (id, workspace_id, calendar_id, title, description, start, end, all_day,
         category_id, tag_ids_json, location, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12, 1, 'pending_create')",
        params![
            id, input.workspace_id, input.calendar_id, input.title, input.description,
            input.start, input.end, input.all_day as i64,
            input.category_id, tag_ids_json, input.location, now,
        ],
    )
    .map_err(|e| e.to_string())?;
    let row = conn
        .query_row("SELECT * FROM events WHERE id = ?1", params![id], EventRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "event", &row.id, "create",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn update_event(
    state: State<'_, AppState>,
    id: String,
    input: UpdateEventInput,
) -> Result<EventRow, String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let mut set_clauses = vec![
        "updated_at = ?".to_string(),
        "version = version + 1".to_string(),
        "sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END".to_string(),
    ];
    let mut binds: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

    if let Some(v) = input.title { set_clauses.push("title = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.description { set_clauses.push("description = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.start { set_clauses.push("start = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.end { set_clauses.push("end = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.all_day { set_clauses.push("all_day = ?".into()); binds.push(Box::new(v as i64)); }
    if let Some(v) = input.location { set_clauses.push("location = ?".into()); binds.push(Box::new(v)); }

    let sql = format!("UPDATE events SET {} WHERE id = ?", set_clauses.join(", "));
    binds.push(Box::new(id.clone()));
    let params_slice: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|b| b.as_ref()).collect();
    let n = conn.execute(&sql, params_slice.as_slice()).map_err(|e| e.to_string())?;
    if n == 0 { return Err("not_found".into()); }

    let row = conn
        .query_row("SELECT * FROM events WHERE id = ?1", params![id], EventRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "event", &row.id, "update",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_event(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let ws: String = conn
        .query_row("SELECT workspace_id FROM events WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE events SET deleted_at = ?1, updated_at = ?1, version = version + 1,
         sync_status = 'pending_delete' WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    let snapshot = serde_json::json!({ "id": id, "deletedAt": now });
    enqueue_sync(&conn, &ws, "event", &id, "delete", &snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- calendars ----------------

#[derive(Serialize, Clone)]
pub struct CalendarRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub color: String,
    pub visible: bool,
    pub r#type: String,
    pub external_url: Option<String>,
    pub is_default: bool,
    pub ord: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub sync_status: String,
}

impl CalendarRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let visible_i: i64 = row.get("visible")?;
        let default_i: i64 = row.get("is_default")?;
        Ok(Self {
            id: row.get("id")?,
            workspace_id: row.get("workspace_id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            visible: visible_i != 0,
            r#type: row.get("type")?,
            external_url: row.get("external_url")?,
            is_default: default_i != 0,
            ord: row.get("ord")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            sync_status: row.get("sync_status")?,
        })
    }
}

#[derive(Deserialize)]
pub struct CreateCalendarInput {
    pub workspace_id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub is_default: bool,
}

#[tauri::command]
pub async fn list_calendars(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<CalendarRow>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT * FROM calendars WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY ord ASC, name ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], CalendarRow::from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows { out.push(r.map_err(|e| e.to_string())?); }
    Ok(out)
}

#[tauri::command]
pub async fn create_calendar(
    state: State<'_, AppState>,
    input: CreateCalendarInput,
) -> Result<CalendarRow, String> {
    let id = Ulid::new().to_string();
    let now = now_iso();
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO calendars (id, workspace_id, name, color, visible, type, is_default, ord, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, 1, 'internal', ?5, 0, ?6, ?6, 1, 'pending_create')",
        params![id, input.workspace_id, input.name, input.color, input.is_default as i64, now],
    )
    .map_err(|e| e.to_string())?;
    let row = conn
        .query_row("SELECT * FROM calendars WHERE id = ?1", params![id], CalendarRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "calendar", &row.id, "create",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[derive(Deserialize)]
pub struct UpdateCalendarInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub visible: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[tauri::command]
pub async fn update_calendar(
    state: State<'_, AppState>,
    id: String,
    input: UpdateCalendarInput,
) -> Result<CalendarRow, String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let mut set_clauses = vec![
        "updated_at = ?".to_string(),
        "version = version + 1".to_string(),
        "sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END".to_string(),
    ];
    let mut binds: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

    if let Some(v) = input.name { set_clauses.push("name = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.color { set_clauses.push("color = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.visible { set_clauses.push("visible = ?".into()); binds.push(Box::new(v as i64)); }
    if let Some(v) = input.is_default { set_clauses.push("is_default = ?".into()); binds.push(Box::new(v as i64)); }

    let sql = format!("UPDATE calendars SET {} WHERE id = ?", set_clauses.join(", "));
    binds.push(Box::new(id.clone()));
    let params_slice: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, params_slice.as_slice()).map_err(|e| e.to_string())?;

    let row = conn
        .query_row("SELECT * FROM calendars WHERE id = ?1", params![id], CalendarRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "calendar", &row.id, "update",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_calendar(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let ws: String = conn
        .query_row("SELECT workspace_id FROM calendars WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE calendars SET deleted_at = ?1, updated_at = ?1, version = version + 1,
         sync_status = 'pending_delete' WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &ws, "calendar", &id, "delete",
        &serde_json::json!({ "id": id, "deletedAt": now })).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- categories ----------------

#[derive(Serialize, Clone)]
pub struct CategoryRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub ord: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub sync_status: String,
}

impl CategoryRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            workspace_id: row.get("workspace_id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            icon: row.get("icon")?,
            ord: row.get("ord")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            sync_status: row.get("sync_status")?,
        })
    }
}

#[derive(Deserialize)]
pub struct CreateCategoryInput {
    pub workspace_id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub icon: Option<String>,
}

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<CategoryRow>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT * FROM categories WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY ord ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], CategoryRow::from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows { out.push(r.map_err(|e| e.to_string())?); }
    Ok(out)
}

#[tauri::command]
pub async fn create_category(
    state: State<'_, AppState>,
    input: CreateCategoryInput,
) -> Result<CategoryRow, String> {
    let id = Ulid::new().to_string();
    let now = now_iso();
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO categories (id, workspace_id, name, color, icon, ord, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6, 1, 'pending_create')",
        params![id, input.workspace_id, input.name, input.color, input.icon, now],
    )
    .map_err(|e| e.to_string())?;
    let row = conn
        .query_row("SELECT * FROM categories WHERE id = ?1", params![id], CategoryRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "category", &row.id, "create",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

// ---------------- inbox ----------------

#[derive(Serialize, Clone)]
pub struct InboxRow {
    pub id: String,
    pub workspace_id: String,
    pub text: String,
    pub r#type: Option<String>,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub date_hint: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub sync_status: String,
}

impl InboxRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let tag_ids_json: String = row.get("tag_ids_json")?;
        Ok(Self {
            id: row.get("id")?,
            workspace_id: row.get("workspace_id")?,
            text: row.get("text")?,
            r#type: row.get("type")?,
            category_id: row.get("category_id")?,
            tag_ids: serde_json::from_str(&tag_ids_json).unwrap_or_default(),
            date_hint: row.get("date_hint")?,
            status: row.get("status")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            sync_status: row.get("sync_status")?,
        })
    }
}

#[derive(Deserialize)]
pub struct CreateInboxInput {
    pub workspace_id: String,
    pub text: String,
    #[serde(default)]
    pub r#type: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateInboxInput {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[tauri::command]
pub async fn list_inbox(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<InboxRow>, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT * FROM inbox WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], InboxRow::from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows { out.push(r.map_err(|e| e.to_string())?); }
    Ok(out)
}

#[tauri::command]
pub async fn create_inbox(
    state: State<'_, AppState>,
    input: CreateInboxInput,
) -> Result<InboxRow, String> {
    let id = Ulid::new().to_string();
    let now = now_iso();
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO inbox (id, workspace_id, text, type, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, 1, 'pending_create')",
        params![id, input.workspace_id, input.text, input.r#type, now],
    )
    .map_err(|e| e.to_string())?;
    let row = conn
        .query_row("SELECT * FROM inbox WHERE id = ?1", params![id], InboxRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "inbox", &row.id, "create",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn update_inbox(
    state: State<'_, AppState>,
    id: String,
    input: UpdateInboxInput,
) -> Result<InboxRow, String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let mut set_clauses = vec![
        "updated_at = ?".to_string(),
        "version = version + 1".to_string(),
        "sync_status = CASE WHEN sync_status = 'synced' THEN 'pending_update' ELSE sync_status END".to_string(),
    ];
    let mut binds: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];
    if let Some(v) = input.text { set_clauses.push("text = ?".into()); binds.push(Box::new(v)); }
    if let Some(v) = input.status { set_clauses.push("status = ?".into()); binds.push(Box::new(v)); }
    let sql = format!("UPDATE inbox SET {} WHERE id = ?", set_clauses.join(", "));
    binds.push(Box::new(id.clone()));
    let params_slice: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|b| b.as_ref()).collect();
    conn.execute(&sql, params_slice.as_slice()).map_err(|e| e.to_string())?;

    let row = conn
        .query_row("SELECT * FROM inbox WHERE id = ?1", params![id], InboxRow::from_row)
        .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &row.workspace_id, "inbox", &row.id, "update",
        &serde_json::to_value(&row).unwrap()).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_inbox(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().await;
    let now = now_iso();
    let ws: String = conn
        .query_row("SELECT workspace_id FROM inbox WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE inbox SET deleted_at = ?1, updated_at = ?1, version = version + 1,
         sync_status = 'pending_delete' WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    enqueue_sync(&conn, &ws, "inbox", &id, "delete",
        &serde_json::json!({ "id": id, "deletedAt": now })).map_err(|e| e.to_string())?;
    Ok(())
}
