use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessItem {
    pub name: String,
    pub display_name: Option<String>,
    pub path: Option<String>,
    pub icon: Option<String>,
    pub is_running: bool,
}

#[derive(Clone, Debug)]
pub struct DesktopApp {
    pub name: String,
    pub exec_bin: String,
    pub exec_path: Option<String>,
    pub icon: Option<String>,
}

const IGNORED_SYSTEM_PROCESSES: &[&str] = &[
    "system",
    "system idle process",
    "registry",
    "memory compression",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "sihost.exe",
    "dwm.exe",
    "taskhostw.exe",
    "conhost.exe",
    "searchindexer.exe",
    "searchhost.exe",
    "runtimebroker.exe",
    "ctfmon.exe",
    "wlanext.exe",
    "spoolsv.exe",
    "audiodg.exe",
    "dllhost.exe",
    "compattelrunner.exe",
    "smartscreen.exe",
    "securityhealthservice.exe",
    "securityhealthhost.exe",
    "adjustservice.exe",
    "aggregatorhost.exe",
    "wmiprvse.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "textinputhost.exe",
    "applicationframehost.exe",
    "usermodefontdriver.exe",
    "dashost.exe",

    "systemd",
    "systemd-journald",
    "systemd-udevd",
    "systemd-timesyncd",
    "systemd-logind",
    "systemd-resolved",
    "dbus-daemon",
    "dbus-broker",
    "dbus-broker-launch",
    "polkitd",
    "rtkit-daemon",
    "accounts-daemon",
    "wpa_supplicant",
    "networkmanager",
    "thermald",
    "bluetoothd",
    "snapd",
    "colord",
    "upowerd",
    "packagekitd",
    "cron",
    "crond",
    "auditd",
    "pipewire",
    "wireplumber",
    "pipewire-pulse",
    "xdg-permission-store",
    "xdg-document-portal",
    "at-spi-bus-launcher",
    "at-spi2-registryd",
    "gmenudbusmenuproxy",
    "xembedsniproxy",
    "kaccess",
    "ksmserver",
    "kactivitymanagerd",
    "dconf-service",
];

#[cfg(target_os = "linux")]
fn get_linux_desktop_apps() -> (HashMap<String, DesktopApp>, Vec<DesktopApp>) {
    let mut map = HashMap::new();
    let mut list = Vec::new();
    let home = std::env::var("HOME").unwrap_or_default();

    let mut search_dirs = vec![
        PathBuf::from("/usr/share/applications"),
        PathBuf::from("/usr/local/share/applications"),
        PathBuf::from("/var/lib/flatpak/exports/share/applications"),
        PathBuf::from("/var/lib/snapd/desktop/applications"),
    ];
    if !home.is_empty() {
        search_dirs.push(PathBuf::from(&home).join(".local/share/applications"));
        search_dirs.push(PathBuf::from(&home).join(".local/share/flatpak/exports/share/applications"));
    }

    for dir in search_dirs {
        if !dir.exists() {
            continue;
        }
        scan_desktop_dir(&dir, &mut map, &mut list);
    }
    (map, list)
}

#[cfg(target_os = "linux")]
fn scan_desktop_dir(dir: &Path, map: &mut HashMap<String, DesktopApp>, list: &mut Vec<DesktopApp>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_desktop_dir(&path, map, list);
        } else if path.extension().and_then(|s| s.to_str()) == Some("desktop") {
            if let Some(app) = parse_desktop_file(&path) {
                let key_name = app.exec_bin.to_lowercase();
                if !map.contains_key(&key_name) {
                    map.insert(key_name.clone(), app.clone());
                    list.push(app.clone());
                }
                if let Some(ref p) = app.exec_path {
                    let key_path = p.to_lowercase();
                    if !map.contains_key(&key_path) {
                        map.insert(key_path, app);
                    }
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
fn parse_desktop_file(path: &Path) -> Option<DesktopApp> {
    let content = std::fs::read_to_string(path).ok()?;
    let mut in_desktop_entry = false;
    let mut name = None;
    let mut exec = None;
    let mut icon = None;
    let mut no_display = false;
    let mut is_app = true;

    for line in content.lines() {
        let line = line.trim();
        if line == "[Desktop Entry]" {
            in_desktop_entry = true;
            continue;
        } else if line.starts_with('[') && line.ends_with(']') {
            in_desktop_entry = false;
            continue;
        }

        if !in_desktop_entry {
            continue;
        }

        if let Some((k, v)) = line.split_once('=') {
            let k = k.trim();
            let v = v.trim();
            match k {
                "Name" if name.is_none() => name = Some(v.to_string()),
                "Exec" if exec.is_none() => exec = Some(v.to_string()),
                "Icon" if icon.is_none() => icon = Some(v.to_string()),
                "NoDisplay" if v.eq_ignore_ascii_case("true") => no_display = true,
                "Type" if !v.eq_ignore_ascii_case("Application") => is_app = false,
                _ => {}
            }
        }
    }

    if no_display || !is_app {
        return None;
    }

    let name = name?;
    let raw_exec = exec?;

    let mut tokens = raw_exec.split_whitespace();
    let first_token = tokens.next()?;
    let clean_token = first_token.trim_matches(|c| c == '"' || c == '\'');

    let bin_str = if clean_token == "env" || clean_token == "/usr/bin/env" {
        tokens.find(|t| !t.contains('=') && !t.starts_with('-')).unwrap_or(clean_token)
    } else if clean_token == "flatpak" {
        tokens.find(|t| *t != "run" && !t.starts_with('-')).unwrap_or(clean_token)
    } else {
        clean_token
    };

    let bin_path = Path::new(bin_str);
    let bin_name = bin_path.file_name()?.to_string_lossy().to_string();
    let exec_path = if bin_str.starts_with('/') {
        Some(bin_str.to_string())
    } else {
        None
    };

    Some(DesktopApp {
        name,
        exec_bin: bin_name,
        exec_path,
        icon,
    })
}

#[cfg(target_os = "linux")]
fn get_processes_linux() -> Vec<ProcessItem> {
    let (desktop_map, desktop_list) = get_linux_desktop_apps();
    let mut processes_map: BTreeMap<String, ProcessItem> = BTreeMap::new();
    let mut seen_execs: HashSet<String> = HashSet::new();

    let proc_dir = match std::fs::read_dir("/proc") {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    for entry in proc_dir.flatten() {
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();
        if !name_str.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }

        let pid_path = entry.path();
        let exe_link = pid_path.join("exe");

        let path_buf = match std::fs::read_link(&exe_link) {
            Ok(p) => p,
            Err(_) => continue,
        };

        let mut path_str = path_buf.to_string_lossy().to_string();
        if let Some(stripped) = path_str.strip_suffix(" (deleted)") {
            path_str = stripped.to_string();
        }

        if path_str.is_empty() {
            continue;
        }

        let real_name = match Path::new(&path_str).file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        let key = real_name.to_lowercase();
        if IGNORED_SYSTEM_PROCESSES.contains(&key.as_str()) {
            continue;
        }

        let (display_name, icon) = if let Some(app) = desktop_map.get(&key) {
            (Some(app.name.clone()), app.icon.clone())
        } else if let Some(app) = desktop_map.get(&path_str.to_lowercase()) {
            (Some(app.name.clone()), app.icon.clone())
        } else {
            (None, None)
        };

        let dedup_key = format!("{}::{}", key, path_str.to_lowercase());
        seen_execs.insert(key);

        if !processes_map.contains_key(&dedup_key) {
            processes_map.insert(
                dedup_key,
                ProcessItem {
                    name: real_name,
                    display_name,
                    path: Some(path_str),
                    icon,
                    is_running: true,
                },
            );
        }
    }


    for app in desktop_list {
        let key = app.exec_bin.to_lowercase();
        if seen_execs.contains(&key) {
            continue;
        }
        let dedup_key = format!("{}::app", key);
        if !processes_map.contains_key(&dedup_key) {
            processes_map.insert(
                dedup_key,
                ProcessItem {
                    name: app.exec_bin,
                    display_name: Some(app.name),
                    path: app.exec_path,
                    icon: app.icon,
                    is_running: false,
                },
            );
        }
    }

    let mut list: Vec<ProcessItem> = processes_map.into_values().collect();

    list.sort_by(|a, b| {
        b.is_running.cmp(&a.is_running).then_with(|| {
            let name_a = a.display_name.as_deref().unwrap_or(&a.name).to_lowercase();
            let name_b = b.display_name.as_deref().unwrap_or(&b.name).to_lowercase();
            name_a.cmp(&name_b)
        })
    });

    list
}

#[cfg(target_os = "windows")]
fn get_processes_windows() -> Vec<ProcessItem> {
    use sysinfo::{ProcessesToUpdate, System};

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut processes_map: BTreeMap<String, ProcessItem> = BTreeMap::new();

    for (_pid, process) in sys.processes() {
        let raw_name = process.name().to_string_lossy().to_string();
        if raw_name.is_empty() {
            continue;
        }

        let path_buf = process.exe();
        let path_str = path_buf.map(|p| p.to_string_lossy().to_string());

        let real_name = if let Some(ref p) = path_buf {
            if let Some(f_name) = p.file_name() {
                f_name.to_string_lossy().to_string()
            } else {
                raw_name.clone()
            }
        } else {
            raw_name.clone()
        };

        let key = real_name.to_lowercase();

        if key.starts_with('[') || key.ends_with(']') || IGNORED_SYSTEM_PROCESSES.contains(&key.as_str()) {
            continue;
        }

        let display_name = if real_name.ends_with(".exe") || real_name.ends_with(".EXE") {
            let stripped = &real_name[..real_name.len() - 4];
            if !stripped.is_empty() {
                Some(stripped.to_string())
            } else {
                None
            }
        } else {
            None
        };

        let dedup_key = if let Some(ref p) = path_str {
            format!("{}::{}", key, p.to_lowercase())
        } else {
            key
        };

        if !processes_map.contains_key(&dedup_key) {
            processes_map.insert(
                dedup_key,
                ProcessItem {
                    name: real_name,
                    display_name,
                    path: path_str,
                    icon: None,
                    is_running: true,
                },
            );
        }
    }

    let mut list: Vec<ProcessItem> = processes_map.into_values().collect();
    list.sort_by(|a, b| {
        let name_a = a.display_name.as_deref().unwrap_or(&a.name).to_lowercase();
        let name_b = b.display_name.as_deref().unwrap_or(&b.name).to_lowercase();
        name_a.cmp(&name_b)
    });

    list
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
fn get_processes_generic() -> Vec<ProcessItem> {
    use sysinfo::{ProcessesToUpdate, System};

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut processes_map: BTreeMap<String, ProcessItem> = BTreeMap::new();

    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_string();
        if name.is_empty() {
            continue;
        }

        let path_str = process.exe().map(|p| p.to_string_lossy().to_string());
        let key = name.to_lowercase();

        if key.starts_with('[') || key.ends_with(']') || IGNORED_SYSTEM_PROCESSES.contains(&key.as_str()) {
            continue;
        }

        if !processes_map.contains_key(&key) {
            processes_map.insert(
                key,
                ProcessItem {
                    name,
                    display_name: None,
                    path: path_str,
                    icon: None,
                    is_running: true,
                },
            );
        }
    }

    let mut list: Vec<ProcessItem> = processes_map.into_values().collect();
    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    list
}

pub fn get_active_processes() -> Vec<ProcessItem> {
    #[cfg(target_os = "linux")]
    {
        get_processes_linux()
    }

    #[cfg(target_os = "windows")]
    {
        get_processes_windows()
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        get_processes_generic()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_active_processes() {
        let procs = get_active_processes();
        assert!(!procs.is_empty(), "Process list should not be empty");

        for p in &procs {
            assert!(!p.name.is_empty(), "Process name should not be empty");
            assert!(!p.name.starts_with('['), "Kernel threads should be filtered out");
            assert!(!p.name.ends_with(']'), "Kernel threads should be filtered out");

            if let Some(ref path) = p.path {
                assert!(!path.is_empty(), "Path if present should not be empty");
            }
        }
    }
}
