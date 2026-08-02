use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_shell::{ShellExt, process::CommandChild};
use crate::sys_proxy;

pub struct TunnelState {
    pub process: Mutex<Option<CommandChild>>,
    pub is_intentional_stop: Arc<AtomicBool>,
    pub current_config_path: Mutex<Option<PathBuf>>,
    pub is_proxy_mode: Arc<AtomicBool>,
}

impl TunnelState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            is_intentional_stop: Arc::new(AtomicBool::new(false)),
            current_config_path: Mutex::new(None),
            is_proxy_mode: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub fn get_temp_configs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;
    let temp_dir = app_data_dir.join("temp_configs");
    if !temp_dir.exists() {
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp_configs directory: {}", e))?;
    }
    Ok(temp_dir)
}

pub fn cleanup_orphaned_temp_configs(temp_dir: &std::path::Path) {
    if let Ok(entries) = std::fs::read_dir(temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("flarevpn_cfg_") || name.starts_with("ping_cfg_") {
                        let _ = std::fs::remove_file(path);
                    }
                }
            }
        }
    }
}

async fn cleanup_temp_config(state: &TunnelState) {
    let path_to_remove = {
        let mut path_guard = state.current_config_path.lock().await;
        path_guard.take()
    };
    if let Some(path) = path_to_remove {
        for _ in 0..5 {
            if tokio::fs::remove_file(&path).await.is_ok() {
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }
    }
}

#[cfg(target_os = "windows")]
async fn cleanup_stale_tun_bindings() {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let addresses_to_clean = ["172.19.0.1", "198.18.0.1", "172.28.0.1"];
    let interfaces_to_clean = ["FlareVPN-TUN", "sing-box", "wintun"];

    for iface in &interfaces_to_clean {
        for addr in &addresses_to_clean {
            let mut cmd = tokio::process::Command::new("netsh");
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.args(["interface", "ipv4", "delete", "address", iface, addr]);
            let _ = cmd.output().await;
        }
    }
}

async fn stop_child_process_gracefully(child: CommandChild) {
    let pid = child.pid();
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut soft_kill = tokio::process::Command::new("taskkill");
        soft_kill.creation_flags(CREATE_NO_WINDOW);
        soft_kill.args(["/PID", &pid.to_string()]);
        let _ = soft_kill.output().await;

        let check_interval = tokio::time::Duration::from_millis(50);
        let max_wait = tokio::time::Duration::from_millis(400);
        let start = tokio::time::Instant::now();

        while start.elapsed() < max_wait {
            let mut query = tokio::process::Command::new("tasklist");
            query.creation_flags(CREATE_NO_WINDOW);
            query.args(["/FI", &format!("PID eq {}", pid), "/NH"]);
            if let Ok(out) = query.output().await {
                let text = String::from_utf8_lossy(&out.stdout);
                if !text.contains(&pid.to_string()) {
                    return;
                }
            }
            tokio::time::sleep(check_interval).await;
        }

        let mut hard_kill = tokio::process::Command::new("taskkill");
        hard_kill.creation_flags(CREATE_NO_WINDOW);
        hard_kill.args(["/F", "/PID", &pid.to_string()]);
        let _ = hard_kill.output().await;
    }

    let _ = child.kill();
}

#[tauri::command]
pub async fn start_tunnel(app: AppHandle, config_json: String) -> Result<(), String> {

    let parsed_val: serde_json::Value = serde_json::from_str(&config_json)
        .map_err(|e| format!("Invalid JSON config: {}", e))?;

    let is_tun = parsed_val.get("inbounds")
        .and_then(|i| i.as_array())
        .map(|inbounds| {
            inbounds.iter().any(|inb| inb.get("type").and_then(|t| t.as_str()) == Some("tun"))
        })
        .unwrap_or(true);

    #[cfg(target_os = "windows")]
    if is_tun {
        if !is_elevated::is_elevated() {
            return Err("admin_required".to_string());
        }
        cleanup_stale_tun_bindings().await;
    }

    let state = app.state::<TunnelState>();

    if state.is_proxy_mode.load(Ordering::SeqCst) {
        let _ = sys_proxy::disable_system_proxy();
    }
    
    let existing_child = {
        let mut proc_guard = state.process.lock().await;
        proc_guard.take()
    };

    if let Some(child) = existing_child {
        state.is_intentional_stop.store(true, Ordering::SeqCst);
        stop_child_process_gracefully(child).await;
    }

    cleanup_temp_config(&state).await;


    let temp_dir = get_temp_configs_dir(&app)?;
    let temp_filename = format!("flarevpn_cfg_{}.json", uuid::Uuid::new_v4());
    let config_path = temp_dir.join(temp_filename);
    tokio::fs::write(&config_path, &config_json)
        .await
        .map_err(|e| e.to_string())?;

    {
        let mut path_guard = state.current_config_path.lock().await;
        *path_guard = Some(config_path.clone());
    }

    let sidecar_command = app
        .shell()
        .sidecar("sing-box")
        .map_err(|e| e.to_string())?
        .args(["run", "-c", config_path.to_str().unwrap()]);

    let (mut rx, child) = sidecar_command
        .spawn()
        .map_err(|e| e.to_string())?;

    {
        let mut proc_guard = state.process.lock().await;
        *proc_guard = Some(child);
    }


    if !is_tun {
        state.is_proxy_mode.store(true, Ordering::SeqCst);
        let proxy_port = parsed_val.get("inbounds")
            .and_then(|i| i.as_array())
            .and_then(|arr| arr.first())
            .and_then(|inb| inb.get("listen_port"))
            .and_then(|p| p.as_u64())
            .unwrap_or(2080) as u16;

        let _ = sys_proxy::enable_system_proxy("127.0.0.1", proxy_port);
    } else {
        state.is_proxy_mode.store(false, Ordering::SeqCst);
    }


    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut started_emitted = false;
        let mut last_error_line = String::new();

        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let log = String::from_utf8_lossy(&line).to_string();
                    if log.contains("FATAL") || log.contains("ERROR") || log.contains("error") {
                        last_error_line = log.trim().to_string();
                    }
                    if !started_emitted && log.contains("sing-box started") {
                        let _ = app_clone.emit("tunnel-started", ());
                        started_emitted = true;
                    }
                    let _ = app_clone.emit("tunnel-log", log);
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let log = String::from_utf8_lossy(&line).to_string();
                    if log.contains("FATAL") || log.contains("ERROR") || log.contains("error") || log.contains("panic") {
                        last_error_line = log.trim().to_string();
                    }
                    if !started_emitted && log.contains("sing-box started") {
                        let _ = app_clone.emit("tunnel-started", ());
                        started_emitted = true;
                    }
                    let _ = app_clone.emit("tunnel-log", log);
                }
                tauri_plugin_shell::process::CommandEvent::Error(err) => {
                    last_error_line = err.clone();
                    let _ = app_clone.emit("tunnel-error", err);
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    let state_for_term = app_clone.state::<TunnelState>();
                    let is_intentional = state_for_term.is_intentional_stop.swap(false, Ordering::SeqCst);
                    {
                        let mut proc_guard = state_for_term.process.lock().await;
                        *proc_guard = None;
                    }

                    if state_for_term.is_proxy_mode.swap(false, Ordering::SeqCst) {
                        let _ = sys_proxy::disable_system_proxy();
                    }

                    cleanup_temp_config(&state_for_term).await;

                    if !is_intentional {
                        if !last_error_line.is_empty() {
                            let _ = app_clone.emit("tunnel-error", last_error_line.clone());
                        }
                        let _ = app_clone.emit("tunnel-stopped", payload.code);
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_tunnel(app: AppHandle) -> Result<(), String> {
    let state = app.state::<TunnelState>();

    if state.is_proxy_mode.swap(false, Ordering::SeqCst) {
        let _ = sys_proxy::disable_system_proxy();
    }

    let existing_child = {
        let mut proc_guard = state.process.lock().await;
        proc_guard.take()
    };
    if let Some(child) = existing_child {
        state.is_intentional_stop.store(true, Ordering::SeqCst);
        stop_child_process_gracefully(child).await;
    }

    cleanup_temp_config(&state).await;

    app.emit("tunnel-stopped", 0).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn is_tunnel_running(app: AppHandle) -> bool {
    let state = app.state::<TunnelState>();
    let running = state.process.lock().await.is_some();
    running
}
