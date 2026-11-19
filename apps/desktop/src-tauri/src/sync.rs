use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::AppState;

const KEYRING_SERVICE: &str = "dev.markox.kibo";
const KEYRING_KEY: &str = "kibo.credentials";
const META_API_URL: &str = "api.url";
const META_CURSOR: &str = "sync.cursor";
const META_LAST_SYNC: &str = "sync.last_at";

#[derive(Serialize, Deserialize, Clone)]
struct StoredCredentials {
    access_token: String,
    refresh_token: String,
    workspace_id: String,
    api_url: String,
}

pub struct SyncEngine {
    #[allow(dead_code)]
    db: Arc<Mutex<Connection>>,
    http: reqwest::Client,
    creds: Mutex<Option<StoredCredentials>>,
}

impl SyncEngine {
    pub fn new(db: Arc<Mutex<Connection>>) -> Self {
        let creds = load_credentials().ok();
        Self {
            db,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("http client"),
            creds: Mutex::new(creds),
        }
    }

    async fn credentials(&self) -> Option<StoredCredentials> {
        self.creds.lock().await.clone()
    }
}

fn load_credentials() -> anyhow::Result<StoredCredentials> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_KEY)?;
    let raw = entry.get_password()?;
    Ok(serde_json::from_str(&raw)?)
}

fn store_credentials(c: &StoredCredentials) -> anyhow::Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_KEY)?;
    entry.set_password(&serde_json::to_string(c)?)?;
    Ok(())
}

fn delete_credentials() -> anyhow::Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_KEY)?;
    let _ = entry.delete_credential();
    Ok(())
}

fn get_meta(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| r.get(0))
        .ok()
}

fn set_meta(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

#[derive(Serialize)]
struct LocalChange {
    #[serde(rename = "entityType")]
    entity_type: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    operation: String,
    version: i64,
    #[serde(rename = "changedAt")]
    changed_at: String,
    payload: Value,
}

#[derive(Serialize)]
struct SyncRequest {
    #[serde(rename = "clientId")]
    client_id: String,
    cursor: Option<String>,
    changes: Vec<LocalChange>,
}

#[derive(Deserialize)]
struct RemoteChange {
    #[allow(dead_code)]
    id: String,
    #[serde(rename = "entityType")]
    entity_type: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    operation: String,
    version: i64,
    #[serde(rename = "payloadSnapshot")]
    payload_snapshot: Value,
}

#[derive(Deserialize)]
struct AppliedItem {
    #[serde(rename = "entityType")]
    entity_type: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    version: i64,
}

#[derive(Deserialize)]
struct SyncResponse {
    cursor: Option<String>,
    applied: Vec<AppliedItem>,
    #[serde(rename = "remoteChanges")]
    remote_changes: Vec<RemoteChange>,
    #[serde(rename = "fullResyncRequired")]
    full_resync_required: bool,
}

#[derive(Serialize)]
pub struct SyncResult {
    pub uploaded: usize,
    pub downloaded: usize,
    pub conflicts: usize,
    pub cursor: Option<String>,
    pub full_resync: bool,
}

#[derive(Serialize)]
pub struct SyncStatus {
    pub authenticated: bool,
    pub last_sync_at: Option<String>,
    pub cursor: Option<String>,
    pub pending_count: i64,
}

fn table_for(entity_type: &str) -> Option<&'static str> {
    match entity_type {
        "task" => Some("tasks"),
        "event" => Some("events"),
        "calendar" => Some("calendars"),
        "category" => Some("categories"),
        "tag" => Some("tags"),
        "inbox" => Some("inbox"),
        "time_entry" => Some("time_entries"),
        _ => None,
    }
}

fn apply_remote_change(conn: &Connection, change: &RemoteChange) -> rusqlite::Result<()> {
    let table = match table_for(&change.entity_type) {
        Some(t) => t,
        None => return Ok(()),
    };

    if change.operation == "delete" {
        conn.execute(
            &format!(
                "UPDATE {} SET deleted_at = COALESCE(?1, updated_at), updated_at = ?1,
                 version = ?2, sync_status = 'synced' WHERE id = ?3",
                table
            ),
            params![
                change
                    .payload_snapshot
                    .get("deletedAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
                change.version,
                change.entity_id,
            ],
        )?;
        return Ok(());
    }

    let p = &change.payload_snapshot;
    let get_str = |k: &str| p.get(k).and_then(|v| v.as_str()).map(String::from);
    let get_bool = |k: &str| p.get(k).and_then(|v| v.as_bool()).unwrap_or(false);
    let get_i64 = |k: &str| p.get(k).and_then(|v| v.as_i64());
    let get_json_as_str = |k: &str| p.get(k).map(|v| v.to_string()).unwrap_or_else(|| "[]".into());
    let ws = get_str("workspaceId").unwrap_or_default();
    let created_at = get_str("createdAt").unwrap_or_default();
    let updated_at = get_str("updatedAt").unwrap_or_default();

    match change.entity_type.as_str() {
        "task" => {
            conn.execute(
                "INSERT INTO tasks (id, workspace_id, title, description, status, priority, energy, category_id, tag_ids_json,
                 planned_date, planned_start, planned_end, time_block, due_date, estimated_minutes, recurrence, reminder,
                 subtasks_json, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                   title=excluded.title, description=excluded.description, status=excluded.status,
                   priority=excluded.priority, energy=excluded.energy, category_id=excluded.category_id,
                   tag_ids_json=excluded.tag_ids_json, planned_date=excluded.planned_date,
                   planned_start=excluded.planned_start, planned_end=excluded.planned_end,
                   time_block=excluded.time_block, due_date=excluded.due_date,
                   estimated_minutes=excluded.estimated_minutes, recurrence=excluded.recurrence,
                   reminder=excluded.reminder, subtasks_json=excluded.subtasks_json,
                   updated_at=excluded.updated_at, version=excluded.version, sync_status='synced'",
                params![
                    change.entity_id, ws,
                    get_str("title").unwrap_or_default(),
                    get_str("description"),
                    get_str("status").unwrap_or_else(|| "pending".into()),
                    get_str("priority").unwrap_or_else(|| "medium".into()),
                    get_str("energy"),
                    get_str("categoryId"),
                    get_json_as_str("tagIds"),
                    get_str("plannedDate"),
                    get_str("plannedStart"),
                    get_str("plannedEnd"),
                    get_str("timeBlock"),
                    get_str("dueDate"),
                    get_i64("estimatedMinutes"),
                    get_str("recurrence").unwrap_or_else(|| "none".into()),
                    get_str("reminder").unwrap_or_else(|| "none".into()),
                    get_json_as_str("subtasks"),
                    created_at, updated_at, change.version,
                ],
            )?;
        }
        "event" => {
            conn.execute(
                "INSERT INTO events (id, workspace_id, calendar_id, title, description, start, end, all_day,
                 category_id, tag_ids_json, reminder, location, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                   calendar_id=excluded.calendar_id, title=excluded.title, description=excluded.description,
                   start=excluded.start, end=excluded.end, all_day=excluded.all_day,
                   category_id=excluded.category_id, tag_ids_json=excluded.tag_ids_json,
                   reminder=excluded.reminder, location=excluded.location,
                   updated_at=excluded.updated_at, version=excluded.version, sync_status='synced'",
                params![
                    change.entity_id, ws,
                    get_str("calendarId").unwrap_or_default(),
                    get_str("title").unwrap_or_default(),
                    get_str("description"),
                    get_str("start").unwrap_or_default(),
                    get_str("end").unwrap_or_default(),
                    get_bool("allDay") as i64,
                    get_str("categoryId"),
                    get_json_as_str("tagIds"),
                    get_str("reminder").unwrap_or_else(|| "none".into()),
                    get_str("location"),
                    created_at, updated_at, change.version,
                ],
            )?;
        }
        "calendar" => {
            conn.execute(
                "INSERT INTO calendars (id, workspace_id, name, color, visible, type, external_url, is_default, ord, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name, color=excluded.color, visible=excluded.visible,
                   type=excluded.type, external_url=excluded.external_url, is_default=excluded.is_default,
                   updated_at=excluded.updated_at, version=excluded.version, sync_status='synced'",
                params![
                    change.entity_id, ws,
                    get_str("name").unwrap_or_default(),
                    get_str("color").unwrap_or_else(|| "#7c8cff".into()),
                    get_bool("visible") as i64,
                    get_str("type").unwrap_or_else(|| "internal".into()),
                    get_str("externalUrl"),
                    get_bool("isDefault") as i64,
                    get_i64("order").unwrap_or(0),
                    created_at, updated_at, change.version,
                ],
            )?;
        }
        "category" => {
            conn.execute(
                "INSERT INTO categories (id, workspace_id, name, color, icon, ord, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name, color=excluded.color, icon=excluded.icon,
                   updated_at=excluded.updated_at, version=excluded.version, sync_status='synced'",
                params![
                    change.entity_id, ws,
                    get_str("name").unwrap_or_default(),
                    get_str("color").unwrap_or_else(|| "#7c8cff".into()),
                    get_str("icon"),
                    get_i64("order").unwrap_or(0),
                    created_at, updated_at, change.version,
                ],
            )?;
        }
        "inbox" => {
            conn.execute(
                "INSERT INTO inbox (id, workspace_id, text, type, category_id, tag_ids_json, date_hint, status, created_at, updated_at, version, sync_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced')
                 ON CONFLICT(id) DO UPDATE SET
                   text=excluded.text, type=excluded.type, category_id=excluded.category_id,
                   tag_ids_json=excluded.tag_ids_json, date_hint=excluded.date_hint, status=excluded.status,
                   updated_at=excluded.updated_at, version=excluded.version, sync_status='synced'",
                params![
                    change.entity_id, ws,
                    get_str("text").unwrap_or_default(),
                    get_str("type"),
                    get_str("categoryId"),
                    get_json_as_str("tagIds"),
                    get_str("dateHint"),
                    get_str("status").unwrap_or_else(|| "pending".into()),
                    created_at, updated_at, change.version,
                ],
            )?;
        }
        _ => {}
    }
    Ok(())
}

fn mark_synced(conn: &Connection, entity_type: &str, entity_id: &str, version: i64) -> rusqlite::Result<()> {
    if let Some(table) = table_for(entity_type) {
        conn.execute(
            &format!("UPDATE {} SET sync_status = 'synced' WHERE id = ?1 AND version <= ?2", table),
            params![entity_id, version],
        )?;
    }
    Ok(())
}

async fn try_refresh(engine: &SyncEngine, creds: &StoredCredentials) -> anyhow::Result<StoredCredentials> {
    #[derive(Deserialize)]
    struct R { #[serde(rename = "accessToken")] access_token: String, #[serde(rename = "refreshToken")] refresh_token: String }
    let res = engine.http
        .post(format!("{}/auth/refresh", creds.api_url))
        .json(&serde_json::json!({ "refreshToken": creds.refresh_token }))
        .send().await?;
    if !res.status().is_success() {
        return Err(anyhow::anyhow!("refresh failed: {}", res.status()));
    }
    let r: R = res.json().await?;
    let updated = StoredCredentials {
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        workspace_id: creds.workspace_id.clone(),
        api_url: creds.api_url.clone(),
    };
    store_credentials(&updated)?;
    Ok(updated)
}

#[tauri::command]
pub async fn set_credentials(
    state: State<'_, AppState>,
    api_url: String,
    access_token: String,
    refresh_token: String,
    workspace_id: String,
) -> Result<(), String> {
    let creds = StoredCredentials { api_url: api_url.clone(), access_token, refresh_token, workspace_id };
    store_credentials(&creds).map_err(|e| e.to_string())?;
    let conn = state.db.lock().await;
    set_meta(&conn, META_API_URL, &api_url).map_err(|e| e.to_string())?;
    drop(conn);
    *state.sync.creds.lock().await = Some(creds);
    Ok(())
}

#[tauri::command]
pub async fn clear_credentials(state: State<'_, AppState>) -> Result<(), String> {
    let _ = delete_credentials();
    *state.sync.creds.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    let conn = state.db.lock().await;
    let cursor = get_meta(&conn, META_CURSOR);
    let last_sync = get_meta(&conn, META_LAST_SYNC);
    let pending: i64 = conn
        .query_row("SELECT COUNT(*) FROM sync_queue", [], |r| r.get(0))
        .unwrap_or(0);
    Ok(SyncStatus {
        authenticated: state.sync.credentials().await.is_some(),
        last_sync_at: last_sync,
        cursor,
        pending_count: pending,
    })
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let engine = state.sync.clone();
    let creds = match engine.credentials().await {
        Some(c) => c,
        None => return Err("not_authenticated".into()),
    };

    // 1) collect queue
    let (client_id, cursor, changes, queue_ids) = {
        let conn = state.db.lock().await;
        let client_id = get_meta(&conn, "client.id").unwrap_or_else(|| {
            let id = ulid::Ulid::new().to_string();
            let _ = set_meta(&conn, "client.id", &id);
            id
        });
        let cursor = get_meta(&conn, META_CURSOR);
        let mut stmt = conn
            .prepare("SELECT id, entity_type, entity_id, operation, payload_snapshot FROM sync_queue ORDER BY created_at ASC LIMIT 200")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        let mut changes: Vec<LocalChange> = Vec::new();
        let mut queue_ids: Vec<String> = Vec::new();
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let qid: String = row.get(0).map_err(|e| e.to_string())?;
            let entity_type: String = row.get(1).map_err(|e| e.to_string())?;
            let entity_id: String = row.get(2).map_err(|e| e.to_string())?;
            let operation: String = row.get(3).map_err(|e| e.to_string())?;
            let payload_str: String = row.get(4).map_err(|e| e.to_string())?;
            let payload: Value = serde_json::from_str(&payload_str).unwrap_or(Value::Null);
            let version = payload.get("version").and_then(|v| v.as_i64()).unwrap_or(1);
            let changed_at = payload.get("updatedAt")
                .or_else(|| payload.get("updated_at"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            changes.push(LocalChange {
                entity_type,
                entity_id,
                operation,
                version,
                changed_at,
                payload,
            });
            queue_ids.push(qid);
        }
        (client_id, cursor, changes, queue_ids)
    };

    let req = SyncRequest { client_id, cursor: cursor.clone(), changes };

    // 2) POST /sync (with refresh on 401)
    let post = |token: &str| {
        engine.http
            .post(format!("{}/sync", creds.api_url))
            .bearer_auth(token)
            .json(&req)
            .send()
    };

    let mut res = post(&creds.access_token).await.map_err(|e| e.to_string())?;
    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        let current = try_refresh(&engine, &creds).await.map_err(|e| e.to_string())?;
        *engine.creds.lock().await = Some(current.clone());
        res = post(&current.access_token).await.map_err(|e| e.to_string())?;
    }
    if !res.status().is_success() {
        return Err(format!("sync failed: {}", res.status()));
    }
    let sr: SyncResponse = res.json().await.map_err(|e| e.to_string())?;
    let uploaded = sr.applied.len();
    let downloaded = sr.remote_changes.len();

    // 3) apply results
    {
        let conn = state.db.lock().await;
        for a in &sr.applied {
            mark_synced(&conn, &a.entity_type, &a.entity_id, a.version).map_err(|e| e.to_string())?;
        }
        for id in &queue_ids {
            let _ = conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![id]);
        }
        for rc in &sr.remote_changes {
            apply_remote_change(&conn, rc).map_err(|e| e.to_string())?;
        }
        if let Some(new_cursor) = sr.cursor.clone() {
            let _ = set_meta(&conn, META_CURSOR, &new_cursor);
        }
        let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let _ = set_meta(&conn, META_LAST_SYNC, &now);
    }

    Ok(SyncResult {
        uploaded,
        downloaded,
        conflicts: 0,
        cursor: sr.cursor,
        full_resync: sr.full_resync_required,
    })
}
