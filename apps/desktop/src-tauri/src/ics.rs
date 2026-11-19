use chrono::{DateTime, NaiveDate, NaiveDateTime, TimeZone, Utc};
use rusqlite::params;
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use tauri::State;
use ulid::Ulid;

use crate::AppState;

#[derive(Serialize)]
pub struct IcsExportResult {
    pub path: String,
    pub count: usize,
}

#[derive(Serialize)]
pub struct IcsImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub calendar_id: String,
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\n', "\\n")
}

fn unescape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') | Some('N') => out.push('\n'),
                Some(other) => out.push(other),
                None => break,
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn to_ics_utc(dt: &DateTime<Utc>) -> String {
    dt.format("%Y%m%dT%H%M%SZ").to_string()
}

fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&Utc))
}

fn parse_ics_datetime(raw: &str, is_date: bool) -> Option<DateTime<Utc>> {
    let trimmed = raw.trim();
    if is_date {
        let d = NaiveDate::parse_from_str(trimmed, "%Y%m%d").ok()?;
        return Some(Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0)?));
    }
    if let Some(stripped) = trimmed.strip_suffix('Z') {
        let ndt = NaiveDateTime::parse_from_str(stripped, "%Y%m%dT%H%M%S").ok()?;
        return Some(Utc.from_utc_datetime(&ndt));
    }
    let ndt = NaiveDateTime::parse_from_str(trimmed, "%Y%m%dT%H%M%S").ok()?;
    Some(Utc.from_utc_datetime(&ndt))
}

fn fold_line(prop: &str, value: &str) -> String {
    let raw = format!("{prop}:{value}");
    let bytes = raw.as_bytes();
    if bytes.len() <= 75 {
        return raw;
    }
    let mut out = String::new();
    let mut idx = 0usize;
    let mut first = true;
    while idx < bytes.len() {
        let end = std::cmp::min(idx + if first { 75 } else { 74 }, bytes.len());
        let mut cut = end;
        while cut > idx && (bytes[cut - 1] & 0xC0) == 0x80 {
            cut -= 1;
        }
        let chunk = std::str::from_utf8(&bytes[idx..cut]).unwrap_or("");
        if first {
            out.push_str(chunk);
            first = false;
        } else {
            out.push_str("\r\n ");
            out.push_str(chunk);
        }
        idx = cut;
    }
    out
}

fn unfold(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for (i, line) in text.replace("\r\n", "\n").lines().enumerate() {
        if i > 0 && (line.starts_with(' ') || line.starts_with('\t')) {
            out.push_str(&line[1..]);
        } else {
            if i > 0 {
                out.push('\n');
            }
            out.push_str(line);
        }
    }
    out
}

#[tauri::command]
pub async fn export_ics(
    state: State<'_, AppState>,
    workspace_id: String,
    path: String,
) -> Result<IcsExportResult, String> {
    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, start, end, all_day, location, updated_at
             FROM events WHERE workspace_id = ?1 AND deleted_at IS NULL",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![workspace_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, i64>(5)? != 0,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, String>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut buf = String::new();
    buf.push_str("BEGIN:VCALENDAR\r\n");
    buf.push_str("VERSION:2.0\r\n");
    buf.push_str("PRODID:-//Kibo//Kibo Desktop//EN\r\n");
    buf.push_str("CALSCALE:GREGORIAN\r\n");

    let now = Utc::now();
    let dtstamp = to_ics_utc(&now);
    let mut count = 0usize;
    for row in rows {
        let (id, title, desc, start, end, all_day, location, updated_at) =
            row.map_err(|e| e.to_string())?;
        let Some(start_dt) = parse_iso(&start) else { continue };
        let Some(end_dt) = parse_iso(&end) else { continue };
        buf.push_str("BEGIN:VEVENT\r\n");
        buf.push_str(&fold_line("UID", &format!("{id}@kibo.local")));
        buf.push_str("\r\n");
        buf.push_str(&fold_line("DTSTAMP", &dtstamp));
        buf.push_str("\r\n");
        let last_mod = parse_iso(&updated_at).map(|d| to_ics_utc(&d)).unwrap_or_else(|| dtstamp.clone());
        buf.push_str(&fold_line("LAST-MODIFIED", &last_mod));
        buf.push_str("\r\n");
        if all_day {
            buf.push_str(&format!(
                "DTSTART;VALUE=DATE:{}\r\n",
                start_dt.format("%Y%m%d")
            ));
            buf.push_str(&format!(
                "DTEND;VALUE=DATE:{}\r\n",
                end_dt.format("%Y%m%d")
            ));
        } else {
            buf.push_str(&fold_line("DTSTART", &to_ics_utc(&start_dt)));
            buf.push_str("\r\n");
            buf.push_str(&fold_line("DTEND", &to_ics_utc(&end_dt)));
            buf.push_str("\r\n");
        }
        buf.push_str(&fold_line("SUMMARY", &escape(&title)));
        buf.push_str("\r\n");
        if let Some(d) = desc.filter(|s| !s.is_empty()) {
            buf.push_str(&fold_line("DESCRIPTION", &escape(&d)));
            buf.push_str("\r\n");
        }
        if let Some(l) = location.filter(|s| !s.is_empty()) {
            buf.push_str(&fold_line("LOCATION", &escape(&l)));
            buf.push_str("\r\n");
        }
        buf.push_str("END:VEVENT\r\n");
        count += 1;
    }
    buf.push_str("END:VCALENDAR\r\n");

    std::fs::write(&path, buf).map_err(|e| e.to_string())?;
    Ok(IcsExportResult { path, count })
}

fn split_prop(line: &str) -> Option<(String, HashMap<String, String>, String)> {
    let colon = line.find(':')?;
    let (head, rest) = line.split_at(colon);
    let value = rest[1..].to_string();
    let mut parts = head.split(';');
    let name = parts.next()?.to_uppercase();
    let mut params = HashMap::new();
    for p in parts {
        if let Some(eq) = p.find('=') {
            let (k, v) = p.split_at(eq);
            params.insert(k.to_uppercase(), v[1..].to_string());
        }
    }
    Some((name, params, value))
}

fn enqueue_create(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    entity_id: &str,
    snapshot: &serde_json::Value,
) -> rusqlite::Result<()> {
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    conn.execute(
        "INSERT INTO sync_queue (id, workspace_id, entity_type, entity_id, operation, payload_snapshot, attempts, created_at, updated_at)
         VALUES (?1, ?2, 'event', ?3, 'create', ?4, 0, ?5, ?5)",
        params![
            Ulid::new().to_string(),
            workspace_id,
            entity_id,
            snapshot.to_string(),
            now,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn import_ics(
    state: State<'_, AppState>,
    workspace_id: String,
    calendar_id: String,
    path: String,
) -> Result<IcsImportResult, String> {
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let unfolded = unfold(&raw);

    let conn = state.db.lock().await;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut inside = false;
    let mut current: Option<HashMap<String, (HashMap<String, String>, String)>> = None;

    for line in unfolded.lines() {
        let line = line.trim_end_matches('\r');
        if line == "BEGIN:VEVENT" {
            inside = true;
            current = Some(HashMap::new());
            continue;
        }
        if line == "END:VEVENT" {
            inside = false;
            if let Some(fields) = current.take() {
                match insert_event(&tx, &workspace_id, &calendar_id, &fields) {
                    Ok(true) => imported += 1,
                    Ok(false) => skipped += 1,
                    Err(_) => skipped += 1,
                }
            }
            continue;
        }
        if !inside {
            continue;
        }
        if let Some((name, params, value)) = split_prop(line) {
            if let Some(map) = current.as_mut() {
                map.insert(name, (params, value));
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(IcsImportResult { imported, skipped, calendar_id })
}

fn insert_event(
    tx: &rusqlite::Transaction,
    workspace_id: &str,
    calendar_id: &str,
    fields: &HashMap<String, (HashMap<String, String>, String)>,
) -> rusqlite::Result<bool> {
    let Some((dtstart_params, dtstart_val)) = fields.get("DTSTART") else {
        return Ok(false);
    };
    let is_date = dtstart_params.get("VALUE").map(|s| s == "DATE").unwrap_or(false);
    let Some(start_dt) = parse_ics_datetime(dtstart_val, is_date) else {
        return Ok(false);
    };
    let end_dt = if let Some((p, v)) = fields.get("DTEND") {
        let d = p.get("VALUE").map(|s| s == "DATE").unwrap_or(false);
        parse_ics_datetime(v, d).unwrap_or(start_dt + chrono::Duration::hours(1))
    } else {
        start_dt + chrono::Duration::hours(1)
    };

    let title = fields
        .get("SUMMARY")
        .map(|(_, v)| unescape(v))
        .unwrap_or_else(|| "(sin título)".into());
    let description = fields.get("DESCRIPTION").map(|(_, v)| unescape(v));
    let location = fields.get("LOCATION").map(|(_, v)| unescape(v));

    let id = Ulid::new().to_string();
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let start_iso = start_dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let end_iso = end_dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

    tx.execute(
        "INSERT INTO events (id, workspace_id, calendar_id, title, description, start, end, all_day,
         tag_ids_json, reminder, location, created_at, updated_at, version, sync_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '[]', 'none', ?9, ?10, ?10, 1, 'pending_create')",
        params![
            id, workspace_id, calendar_id, title, description,
            start_iso, end_iso, is_date as i64,
            location, now,
        ],
    )?;

    let snapshot = json!({
        "id": id,
        "workspaceId": workspace_id,
        "calendarId": calendar_id,
        "title": title,
        "description": description,
        "start": start_iso,
        "end": end_iso,
        "allDay": is_date,
        "location": location,
    });
    enqueue_create(tx, workspace_id, &id, &snapshot)?;
    Ok(true)
}
