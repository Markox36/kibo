use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;

use crate::AppState;

const SCAN_INTERVAL_SECS: u64 = 30;
const LOOKAHEAD_SECS: i64 = 24 * 3600;
const LOOKBEHIND_SECS: i64 = 6 * 3600;
const CLEANUP_DAYS: i64 = 30;
const PREFS_KEY: &str = "notification_prefs";

#[derive(Serialize, Clone)]
struct FiredPayload {
    entity_type: String,
    entity_id: String,
    title: String,
    body: String,
    anchor_at: String,
    reminder: String,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
struct NotificationPrefs {
    #[serde(default = "default_false")]
    notifications_enabled: bool,
    #[serde(default = "default_true")]
    notify_events: bool,
    #[serde(default = "default_true")]
    notify_task_planned: bool,
    #[serde(default = "default_true")]
    notify_task_due: bool,
    #[serde(default = "default_lead")]
    reminder_lead_minutes: i64,
}

fn default_false() -> bool {
    false
}
fn default_true() -> bool {
    true
}
fn default_lead() -> i64 {
    10
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            notifications_enabled: false,
            notify_events: true,
            notify_task_planned: true,
            notify_task_due: true,
            reminder_lead_minutes: 10,
        }
    }
}

fn load_prefs(conn: &rusqlite::Connection) -> NotificationPrefs {
    let mut stmt = match conn.prepare("SELECT value FROM meta WHERE key = ?1") {
        Ok(s) => s,
        Err(_) => return NotificationPrefs::default(),
    };
    let mut rows = match stmt.query(params![PREFS_KEY]) {
        Ok(r) => r,
        Err(_) => return NotificationPrefs::default(),
    };
    let Some(row) = rows.next().ok().flatten() else {
        return NotificationPrefs::default();
    };
    let raw: String = match row.get(0) {
        Ok(s) => s,
        Err(_) => return NotificationPrefs::default(),
    };
    serde_json::from_str::<NotificationPrefs>(&raw).unwrap_or_default()
}

#[derive(Clone, Copy)]
enum DueKind {
    Event,
    TaskPlanned,
    TaskDue,
}

fn offset_seconds(reminder: &str, lead_minutes: i64) -> Option<i64> {
    match reminder {
        "at_time" => Some(lead_minutes.max(0) * 60),
        "5m_before" => Some(5 * 60),
        "15m_before" => Some(15 * 60),
        "1h_before" => Some(3600),
        "1d_before" => Some(86400),
        _ => None,
    }
}

fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&Utc))
}

struct Due {
    entity_type: &'static str,
    kind: DueKind,
    entity_id: String,
    title: String,
    body: String,
    anchor_at: String,
    reminder: String,
}

fn scan_due(conn: &rusqlite::Connection, lead_minutes: i64) -> rusqlite::Result<Vec<Due>> {
    let now = Utc::now();
    let mut out: Vec<Due> = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT id, title, start, reminder FROM events
         WHERE deleted_at IS NULL AND reminder != 'none'
         AND start >= ?1 AND start <= ?2",
    )?;
    let low = (now - chrono::Duration::seconds(LOOKBEHIND_SECS)).to_rfc3339();
    let high = (now + chrono::Duration::seconds(LOOKAHEAD_SECS)).to_rfc3339();
    let rows = stmt.query_map(params![low, high], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
        ))
    })?;
    for row in rows {
        let (id, title, start, reminder) = row?;
        let Some(offset) = offset_seconds(&reminder, lead_minutes) else { continue };
        let Some(anchor) = parse_iso(&start) else { continue };
        let fire_at = anchor - chrono::Duration::seconds(offset);
        if fire_at <= now && anchor + chrono::Duration::seconds(LOOKBEHIND_SECS) >= now {
            out.push(Due {
                entity_type: "event",
                kind: DueKind::Event,
                entity_id: id,
                body: format!("Empieza a las {}", anchor.format("%H:%M")),
                title,
                anchor_at: anchor.to_rfc3339(),
                reminder,
            });
        }
    }

    let mut stmt = conn.prepare(
        "SELECT id, title, planned_start, due_date, reminder FROM tasks
         WHERE deleted_at IS NULL AND reminder != 'none' AND status != 'done'
         AND (planned_start IS NOT NULL OR due_date IS NOT NULL)",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, Option<String>>(3)?,
            r.get::<_, String>(4)?,
        ))
    })?;
    for row in rows {
        let (id, title, planned_start, due_date, reminder) = row?;
        let Some(offset) = offset_seconds(&reminder, lead_minutes) else { continue };
        let (anchor_str, kind, body_prefix) = if let Some(s) = planned_start {
            (s, DueKind::TaskPlanned, "Empieza")
        } else if let Some(s) = due_date {
            (s, DueKind::TaskDue, "Vence")
        } else {
            continue;
        };
        let Some(anchor) = parse_iso(&anchor_str) else { continue };
        let fire_at = anchor - chrono::Duration::seconds(offset);
        if fire_at <= now
            && anchor + chrono::Duration::seconds(LOOKBEHIND_SECS) >= now
            && anchor <= now + chrono::Duration::seconds(LOOKAHEAD_SECS)
        {
            out.push(Due {
                entity_type: "task",
                kind,
                entity_id: id,
                body: format!("{} {}", body_prefix, anchor.format("%d/%m %H:%M")),
                title,
                anchor_at: anchor.to_rfc3339(),
                reminder,
            });
        }
    }

    Ok(out)
}

fn was_fired(conn: &rusqlite::Connection, d: &Due) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(
        "SELECT 1 FROM notifications_fired
         WHERE entity_type = ?1 AND entity_id = ?2 AND anchor_at = ?3 AND reminder = ?4 LIMIT 1",
    )?;
    let mut rows = stmt.query(params![d.entity_type, d.entity_id, d.anchor_at, d.reminder])?;
    Ok(rows.next()?.is_some())
}

fn mark_fired(conn: &rusqlite::Connection, d: &Due) -> rusqlite::Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO notifications_fired
         (entity_type, entity_id, anchor_at, reminder, fired_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![d.entity_type, d.entity_id, d.anchor_at, d.reminder, now],
    )?;
    Ok(())
}

fn cleanup(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let cutoff = (Utc::now() - chrono::Duration::days(CLEANUP_DAYS)).to_rfc3339();
    conn.execute(
        "DELETE FROM notifications_fired WHERE fired_at < ?1",
        params![cutoff],
    )?;
    Ok(())
}

async fn tick(app: &AppHandle, db: &Arc<Mutex<rusqlite::Connection>>) {
    let (due, prefs) = {
        let conn = db.lock().await;
        let prefs = load_prefs(&conn);
        if !prefs.notifications_enabled {
            return;
        }
        match scan_due(&conn, prefs.reminder_lead_minutes) {
            Ok(d) => (d, prefs),
            Err(e) => {
                tracing::error!("scan_due failed: {e}");
                return;
            }
        }
    };

    for d in due {
        let allowed = match d.kind {
            DueKind::Event => prefs.notify_events,
            DueKind::TaskPlanned => prefs.notify_task_planned,
            DueKind::TaskDue => prefs.notify_task_due,
        };
        if !allowed {
            continue;
        }
        let already = {
            let conn = db.lock().await;
            was_fired(&conn, &d).unwrap_or(false)
        };
        if already {
            continue;
        }
        let notif = app
            .notification()
            .builder()
            .title(&d.title)
            .body(&d.body)
            .show();
        if let Err(e) = notif {
            tracing::error!("notification failed: {e}");
            continue;
        }
        let conn = db.lock().await;
        if let Err(e) = mark_fired(&conn, &d) {
            tracing::error!("mark_fired failed: {e}");
            continue;
        }
        drop(conn);
        let _ = app.emit(
            "kibo://notification-fired",
            FiredPayload {
                entity_type: d.entity_type.into(),
                entity_id: d.entity_id,
                title: d.title,
                body: d.body,
                anchor_at: d.anchor_at,
                reminder: d.reminder,
            },
        );
    }
}

pub fn spawn_scheduler(app: AppHandle, db: Arc<Mutex<rusqlite::Connection>>) {
    tauri::async_runtime::spawn(async move {
        let mut cleanup_counter: u32 = 0;
        loop {
            tick(&app, &db).await;
            cleanup_counter += 1;
            if cleanup_counter >= 120 {
                let conn = db.lock().await;
                let _ = cleanup(&conn);
                cleanup_counter = 0;
            }
            tokio::time::sleep(Duration::from_secs(SCAN_INTERVAL_SECS)).await;
        }
    });
}

#[tauri::command]
pub async fn notify_test(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reminders_rescan(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    tick(&app, &state.db).await;
    Ok(())
}
