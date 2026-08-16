pub mod db;
pub mod parser;
pub mod ping;
pub mod process;
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
async fn get_active_processes() -> Result<Vec<process::ProcessItem>, String> {
    tokio::task::spawn_blocking(process::get_active_processes)
        .await
        .map_err(|e| e.to_string())
}



#[tauri::command]
async fn parse_clipboard(text: String, db_state: State<'_, DbState>) -> Result<SubscriptionParseResult, String> {
    let settings = db_state.get_settings().map_err(|e| e.to_string())?;
    parse_clipboard_data(&text, &settings).await
}

#[tauri::command]
async fn add_profile(profile: Profile, db_state: State<'_, DbState>) -> Result<(), String> {
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
async fn get_subscriptions(db_state: State<'_, DbState>) -> Result<Vec<db::Subscription>, String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.get_subscriptions())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_subscription(subscription: db::Subscription, db_state: State<'_, DbState>) -> Result<(), String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.save_subscription(&subscription))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_all_subscriptions(subscriptions: Vec<db::Subscription>, db_state: State<'_, DbState>) -> Result<(), String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.save_all_subscriptions(&subscriptions))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_subscription(subscription_id: String, db_state: State<'_, DbState>) -> Result<(), String> {
    let db = db_state.inner().clone();
    tokio::task::spawn_blocking(move || db.delete_subscription(&subscription_id))
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

#[cfg(target_os = "linux")]
pub fn apply_kde_blur_gtk(gtk_win: &gtk::ApplicationWindow) {
    use gtk::prelude::*;
    if let Some(gdk_win) = gtk_win.window() {
        let atom = gdk::Atom::intern("_KDE_NET_WM_BLUR_BEHIND_REGION");
        gdk::property_change(
            &gdk_win,
            &atom,
            &gdk::Atom::intern("CARDINAL"),
            32,
            gdk::PropMode::Replace,
            gdk::ChangeData::ULongs(&[0]),
        );
    }
}

#[cfg(target_os = "linux")]
pub fn ensure_linux_blur(window: &tauri::WebviewWindow) {
    if let Ok(gtk_win) = window.gtk_window() {
        apply_kde_blur_gtk(&gtk_win);
    }
}

#[cfg(target_os = "linux")]
pub fn ensure_linux_blur_window(window: &tauri::Window) {
    if let Ok(gtk_win) = window.gtk_window() {
        apply_kde_blur_gtk(&gtk_win);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {

        if std::env::var("WEBKIT_GPU_POLICY").is_err() {
            std::env::set_var("WEBKIT_GPU_POLICY", "always");
        }
    }

    tauri::Builder::default()
        .manage(tunnel::TunnelState::new())
        .setup(|app| {


            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let temp_configs_dir = app_data_dir.join("temp_configs");
            let _ = std::fs::create_dir_all(&temp_configs_dir);
            tunnel::cleanup_orphaned_temp_configs(&temp_configs_dir);

            let db_path = app_data_dir.join("profiles.db");
            let db_state = DbState::new(db_path.to_str().expect("Invalid db path"))
                .expect("Failed to initialize database");
            app.manage(db_state);

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    if window_vibrancy::apply_acrylic(&window, Some((18, 18, 18, 204))).is_err() {
                        let _ = window_vibrancy::apply_mica(&window, Some(true));
                    }
                }
                #[cfg(target_os = "linux")]
                {
                    use gtk::prelude::*;
                    if let Ok(gtk_win) = window.gtk_window() {
                        if let Some(screen) = gdk::Screen::default() {
                            if let Some(visual) = screen.rgba_visual() {
                                gtk_win.set_visual(Some(&visual));
                            }
                        }
                        gtk_win.set_app_paintable(true);

                        if gtk_win.is_realized() {
                            apply_kde_blur_gtk(&gtk_win);
                        }
                        gtk_win.connect_realize(move |win| {
                            apply_kde_blur_gtk(win);
                        });
                        gtk_win.connect_map(move |win| {
                            apply_kde_blur_gtk(win);
                        });
                        gtk_win.connect_show(move |win| {
                            apply_kde_blur_gtk(win);
                        });
                        gtk_win.connect_window_state_event(move |win, _| {
                            apply_kde_blur_gtk(win);
                            gtk::glib::Propagation::Proceed
                        });
                    }
                }
            }

            use tauri::Listener;

            let quit_i = MenuItem::with_id(app, "quit", "Закрыть Flare VPN", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Открыть Flare VPN", true, None::<&str>)?;
            let connect_i = MenuItem::with_id(app, "connect", "Подключить", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &connect_i, &quit_i])?;

            let connect_i_started = connect_i.clone();
            app.listen("tunnel-started", move |_| {
                let _ = connect_i_started.set_text("Отключить");
            });

            let connect_i_stopped = connect_i.clone();
            app.listen("tunnel-stopped", move |_| {
                let _ = connect_i_stopped.set_text("Подключить");
            });

            let connect_i_error = connect_i.clone();
            app.listen("tunnel-error", move |_| {
                let _ = connect_i_error.set_text("Подключить");
            });

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = tunnel::stop_tunnel(app_handle.clone()).await;
                            let _ = sys_proxy::disable_system_proxy();
                            app_handle.exit(0);
                        });
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            #[cfg(target_os = "linux")]
                            ensure_linux_blur(&window);
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
                            #[cfg(target_os = "linux")]
                            ensure_linux_blur(&window);
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
            #[cfg(target_os = "linux")]
            WindowEvent::Focused(true) => {
                ensure_linux_blur_window(window);
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
            get_subscriptions,
            save_subscription,
            save_all_subscriptions,
            delete_subscription,
            delete_subscription_profiles,
            ping_profiles_proxy,
            ping_profile_direct,
            get_app_settings,
            update_app_settings,
            get_active_processes,
            tunnel::start_tunnel,

            tunnel::stop_tunnel,
            tunnel::is_tunnel_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
