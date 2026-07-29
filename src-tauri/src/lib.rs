pub mod db;
pub mod parser;
pub mod ping;
pub mod sys_proxy;
pub mod tunnel;

use db::{DbState, Profile, AppSettings};
use parser::clipboard::{parse_clipboard_data, SubscriptionParseResult};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager, WindowEvent, State, Emitter,
};

#[tauri::command]
async fn parse_clipboard(text: String, db_state: State<'_, DbState>) -> Result<SubscriptionParseResult, String> {
    let settings = db_state.get_settings().map_err(|e| e.to_string())?;
    parse_clipboard_data(&text, &settings).await
}

#[tauri::command]
async fn add_profile(profile: Profile, db_state: State<'_, DbState>) -> Result<i64, String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.insert_profile(&profile))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_profiles(db_state: State<'_, DbState>) -> Result<Vec<Profile>, String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.get_profiles())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_subscription_profiles(subscription_id: String, db_state: State<'_, DbState>) -> Result<(), String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.delete_subscription_profiles(&subscription_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_app_settings(db_state: State<'_, DbState>) -> Result<AppSettings, String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.get_settings())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_app_settings(settings: AppSettings, db_state: State<'_, DbState>) -> Result<(), String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.save_settings(&settings))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ping_profiles_proxy(
    app: tauri::AppHandle,
    profiles: Vec<ping::PingProfile>,
    test_url: String,
    timeout_ms: u64,
) -> Result<Vec<ping::PingResult>, String> {
    ping::ping_via_proxy(app, profiles, test_url, timeout_ms).await
}

#[tauri::command]
async fn ping_profile_direct(
    profile: ping::PingProfile,
    method: String,
    timeout_ms: u64,
) -> Result<ping::PingResult, String> {
    tokio::task::spawn_blocking(move || {
        if method.eq_ignore_ascii_case("icmp") {
            ping::ping_direct_icmp(profile, timeout_ms)
        } else {
            ping::ping_direct_tcp(profile, timeout_ms)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(tunnel::TunnelState::new())
        .setup(|app| {


            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            let db_path = app_data_dir.join("profiles.db");
            let db_state = DbState::new(db_path.to_str().expect("Invalid db path"))
                .expect("Failed to initialize database");
            app.manage(db_state);
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let connect_i = MenuItem::with_id(app, "connect", "Connect/Disconnect", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &connect_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let _ = sys_proxy::disable_system_proxy();
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "connect" => {
                        let _ = app.emit("toggle-connect", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            parse_clipboard, 
            add_profile, 
            get_profiles,
            delete_subscription_profiles,
            ping_profiles_proxy,
            ping_profile_direct,
            get_app_settings,
            update_app_settings,
            tunnel::start_tunnel,
            tunnel::stop_tunnel,
            tunnel::is_tunnel_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
