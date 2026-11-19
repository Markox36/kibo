use rusqlite::params;
use serde::Serialize;
use serde_json::Value;
use tauri::State;
use ulid::Ulid;

use crate::AppState;

const ALLOWED: &[&str] = &["task", "event", "inbox", "calendar", "category"];

fn table_for(entity_type: &str) -> Option<&'static str> {
    match entity_type {
        "task" => Some("tasks"),
        "event" => Some("events"),
        "inbox" => Some("inbox"),
        "calendar" => Some("calendars"),
        "category" => Some("categories"),
        _ => None,
    }
}

fn title_col(entity_type: &str) -> &'static str {
    match entity_type {
        "task" | "event" | "calendar" | "category" => "title",
        "inbox" => "text",
        _ => "id",
    }
}

fn enqueue(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    entity_type: &str,
    entity_id: &str,
    operation: &str,
    snapshot: &Value,
) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
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

#[derive(Serialize)]
pub struct TrashItem {
    pub entity_type: String,
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub deleted_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn list_trash(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<TrashItem>, String> {
    let conn = state.db.lock().await;
    let mut out: Vec<TrashItem> = Vec::new();
    for et in ALLOWED {
        let table = table_for(et).unwrap();
        let title = title_col(et);
        let sql = format!(
            "SELECT id, workspace_id, {title} AS title, deleted_at, updated_at
             FROM {table}
             WHERE workspace_id = ?1 AND deleted_at IS NOT NULL
             ORDER BY deleted_at DESC"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![workspace_id], |r| {
                Ok(TrashItem {
                    entity_type: (*et).into(),
                    id: r.get(0)?,
                    workspace_id: r.get(1)?,
                    title: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    deleted_at: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    updated_at: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    }
    out.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(out)
}

#[tauri::command]
pub async fn restore_entity(
    state: State<'_, AppState>,
    entity_type: String,
    id: String,
) -> Result<(), String> {
    let table = table_for(&entity_type).ok_or_else(|| "invalid_entity_type".to_string())?;
    let conn = state.db.lock().await;
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let ws: String = conn
        .query_row(
            &format!("SELECT workspace_id FROM {table} WHERE id = ?1"),
            params![id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let sql = format!(
        "UPDATE {table} SET deleted_at = NULL, updated_at = ?1, version = version + 1,
         sync_status = 'pending_update' WHERE id = ?2"
    );
    let n = conn.execute(&sql, params![now, id]).map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("not_found".into());
    }
    let snapshot: String = conn
        .query_row(
            &format!("SELECT json_object('id', id, 'deletedAt', deleted_at, 'updatedAt', updated_at) FROM {table} WHERE id = ?1"),
            params![id],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    let value: Value = serde_json::from_str(&snapshot).unwrap_or(Value::Null);
    enqueue(&conn, &ws, &entity_type, &id, "update", &value).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn purge_entity(
    state: State<'_, AppState>,
    entity_type: String,
    id: String,
) -> Result<(), String> {
    let table = table_for(&entity_type).ok_or_else(|| "invalid_entity_type".to_string())?;
    let conn = state.db.lock().await;
    let sql = format!("DELETE FROM {table} WHERE id = ?1 AND deleted_at IS NOT NULL");
    let n = conn.execute(&sql, params![id]).map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("not_found_or_not_trashed".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn empty_trash(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<u64, String> {
    let conn = state.db.lock().await;
    let mut total: u64 = 0;
    for et in ALLOWED {
        let table = table_for(et).unwrap();
        let sql = format!(
            "DELETE FROM {table} WHERE workspace_id = ?1 AND deleted_at IS NOT NULL"
        );
        let n = conn.execute(&sql, params![workspace_id]).map_err(|e| e.to_string())?;
        total += n as u64;
    }
    Ok(total)
}

#[tauri::command]
pub async fn purge_older_than(
    state: State<'_, AppState>,
    workspace_id: String,
    days: i64,
) -> Result<u64, String> {
    let conn = state.db.lock().await;
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(days)).to_rfc3339();
    let mut total: u64 = 0;
    for et in ALLOWED {
        let table = table_for(et).unwrap();
        let sql = format!(
            "DELETE FROM {table} WHERE workspace_id = ?1 AND deleted_at IS NOT NULL AND deleted_at < ?2"
        );
        let n = conn
            .execute(&sql, params![workspace_id, cutoff])
            .map_err(|e| e.to_string())?;
        total += n as u64;
    }
    Ok(total)
}
