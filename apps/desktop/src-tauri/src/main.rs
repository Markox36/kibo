#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;
mod sync;
mod backup;
mod notifications;
mod trash;
mod ics;
mod crypto_backup;
mod google_oauth;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub sync: Arc<sync::SyncEngine>,
}

fn main() {
    // WebKitGTK render fixes for common Linux setups (Wayland/Nvidia/GNOME).
    // Must be set before the webview is initialized.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let path = db::resolve_db_path(app.handle())?;
            let conn = db::open_and_migrate(&path)?;
            let db = Arc::new(Mutex::new(conn));
            let sync = Arc::new(sync::SyncEngine::new(db.clone()));
            app.manage(AppState { db: db.clone(), sync });
            notifications::spawn_scheduler(app.handle().clone(), db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            // tasks
            commands::list_tasks,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            // events
            commands::list_events,
            commands::create_event,
            commands::update_event,
            commands::delete_event,
            // calendars
            commands::list_calendars,
            commands::create_calendar,
            commands::update_calendar,
            commands::delete_calendar,
            // categories
            commands::list_categories,
            commands::create_category,
            // inbox
            commands::list_inbox,
            commands::create_inbox,
            commands::update_inbox,
            commands::delete_inbox,
            // meta
            commands::get_meta,
            commands::set_meta,
            // sync
            sync::sync_now,
            sync::get_sync_status,
            sync::set_credentials,
            sync::clear_credentials,
            // backup
            backup::export_backup,
            backup::import_backup,
            backup::export_csv,
            // notifications
            notifications::notify_test,
            notifications::reminders_rescan,
            // trash
            trash::list_trash,
            trash::restore_entity,
            trash::purge_entity,
            trash::empty_trash,
            trash::purge_older_than,
            // ics
            ics::export_ics,
            ics::import_ics,
            // encrypted backup
            crypto_backup::export_backup_encrypted,
            crypto_backup::import_backup_encrypted,
            // google oauth
            google_oauth::google_oauth_login,
            google_oauth::open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kibo");
}
