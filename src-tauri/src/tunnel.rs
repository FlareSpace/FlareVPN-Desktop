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
    #[cfg(target_os = "windows")]
    {
        let pid = child.pid();
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

#[cfg(target_os = "linux")]
pub fn ensure_sidecar_executable_linux(app: &AppHandle) {
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;

    let mut active_path: Option<PathBuf> = None;

    if let Ok(resource_dir) = app.path().resource_dir() {
        for name in &["sing-box-x86_64-unknown-linux-gnu", "sing-box", "bin/sing-box-x86_64-unknown-linux-gnu"] {
            let p = resource_dir.join(name);
            if p.is_file() {
                active_path = Some(p);
                break;
            }
        }
    }

    if active_path.is_none() {
        for p_str in &["/usr/bin/sing-box", "/usr/bin/sing-box-x86_64-unknown-linux-gnu", "/usr/lib/flare-vpn/sing-box", "/usr/lib/com.flare.vpn/sing-box"] {
            let p = PathBuf::from(p_str);
            if p.is_file() {
                active_path = Some(p);
                break;
            }
        }
    }

    if active_path.is_none() {
        if let Ok(cwd) = std::env::current_dir() {
            for name in &["src-tauri/bin/sing-box-x86_64-unknown-linux-gnu", "bin/sing-box-x86_64-unknown-linux-gnu"] {
                let p = cwd.join(name);
                if p.is_file() {
                    active_path = Some(p);
                    break;
                }
            }
        }
    }

    let path = match active_path {
        Some(p) => p,
        None => return,
    };

    if let Ok(metadata) = std::fs::metadata(&path) {
        let mode = metadata.permissions().mode();
        if mode & 0o111 == 0 || mode & 0o4000 != 0 {
            let mut perm = metadata.permissions();
            perm.set_mode(0o755);
            let _ = std::fs::set_permissions(&path, perm);
        }
    }

    let path_str = path.to_string_lossy().to_string();
    
    let has_cap = match Command::new("sh")
        .args(["-c", &format!("getcap '{}' || /sbin/getcap '{}' || /usr/sbin/getcap '{}'", path_str, path_str, path_str)])
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("cap_net_admin") && stdout.contains("cap_sys_ptrace") && stdout.contains("cap_dac_read_search")
        }
        Err(_) => false,
    };

    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
    let marker_path = app_data_dir.join("polkit_v3_installed");

    if has_cap && marker_path.exists() {
        return;
    }

    let temp_dir = std::env::temp_dir();
    let setup_script_path = temp_dir.join(format!("flarevpn_setup_{}.sh", uuid::Uuid::new_v4()));
    
    let script_content = format!(
        r#"#!/bin/sh
set -e

TARGET="{}"

if command -v setcap >/dev/null 2>&1; then
    setcap 'cap_net_admin,cap_net_raw,cap_sys_ptrace,cap_dac_read_search+ep' "$TARGET"
elif [ -x /sbin/setcap ]; then
    /sbin/setcap 'cap_net_admin,cap_net_raw,cap_sys_ptrace,cap_dac_read_search+ep' "$TARGET"
elif [ -x /usr/sbin/setcap ]; then
    /usr/sbin/setcap 'cap_net_admin,cap_net_raw,cap_sys_ptrace,cap_dac_read_search+ep' "$TARGET"
else
    echo "setcap not found"
    exit 1
fi

if [ -d "/etc/polkit-1/rules.d" ]; then
    cat << 'EOF' > /etc/polkit-1/rules.d/10-flarevpn-resolved.rules
polkit.addRule(function(action, subject) {{
    if ((action.id.indexOf("org.freedesktop.resolve1.") == 0 || 
         action.id.indexOf("org.freedesktop.network1.") == 0 ||
         action.id.indexOf("org.freedesktop.NetworkManager.") == 0) && 
        (subject.local || subject.isInGroup("wheel") || subject.isInGroup("network"))) {{
        return polkit.Result.YES;
    }}
}});
EOF
    chmod 644 /etc/polkit-1/rules.d/10-flarevpn-resolved.rules || true
fi

if [ -d "/etc/polkit-1/localauthority/50-local.d" ]; then
    cat << 'EOF' > /etc/polkit-1/localauthority/50-local.d/10-flarevpn-resolved.pkla
[FlareVPN resolved permissions]
Identity=unix-user:*
Action=org.freedesktop.resolve1.*
ResultAny=yes
ResultInactive=yes
ResultActive=yes
EOF
fi
"#,
        path_str
    );

    if std::fs::write(&setup_script_path, script_content).is_ok() {
        if Command::new("pkexec")
            .args(["sh", setup_script_path.to_str().unwrap()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false) 
        {
            let _ = std::fs::write(&marker_path, "1");
        }
        let _ = std::fs::remove_file(setup_script_path);
    }
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

    #[cfg(target_os = "linux")]
    ensure_sidecar_executable_linux(&app);

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
