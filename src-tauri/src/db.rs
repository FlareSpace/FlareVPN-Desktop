use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub id: Option<i64>,
    pub name: String,
    pub uri: String,
    pub config_json: String,
    pub server_description: String,
    pub subscription_id: Option<String>,
    pub protocol: Option<String>,
}

use std::sync::Arc;

#[derive(Clone)]
pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppSettings {
    pub auto_update: bool,
    pub update_interval: bool,
    pub update_timeout: u8,
    pub user_agent: String,
    pub send_hwid: bool,
    pub send_os: bool,
    pub send_model: bool,
    pub anonymous_hwid: String,
    pub real_hwid: String,
    pub selected_profile_id: Option<String>,
    pub auto_update_interval: u32,
    pub split_tunneling_enabled: bool,
    pub split_tunneling_mode: String,
    pub split_tunneling_apps_mode: String,
    pub split_tunneling_domains_mode: String,
    pub split_tunneling_apps: Vec<String>,
    pub split_tunneling_domains: Vec<String>,
    pub fragmentation_enabled: bool,
    pub fragmentation_fallback: String,
    pub fragmentation_timeout: u32,
    pub mux_enabled: bool,
    pub mux_protocol: String,
    pub mux_concurrency: u32,
    pub mux_padding: bool,
    pub tls_spoof_enabled: bool,
    pub tls_spoof_domain: String,
    pub tls_spoof_method: String,
    pub tls_fingerprint: String,
    pub remote_dns: String,
    pub remote_dns_doh: bool,
    pub remote_dns_strictly_tun: bool,
    pub fake_ip_enabled: bool,
    pub reset_chain_on_disconnect: bool,
    pub mtu_auto: bool,
    pub mtu_value: u32,
    pub network_stack: String,
    pub proxy_port: u16,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_update: false,
            update_interval: true,
            update_timeout: 10,
            user_agent: "Happ/3.21.1".to_string(),
            send_hwid: false,
            send_os: false,
            send_model: false,
            anonymous_hwid: Uuid::new_v4().to_string(),
            real_hwid: get_real_hwid_or_generate(),
            selected_profile_id: None,
            auto_update_interval: 3600,
            split_tunneling_enabled: false,
            split_tunneling_mode: "whitelist".to_string(),
            split_tunneling_apps_mode: "whitelist".to_string(),
            split_tunneling_domains_mode: "whitelist".to_string(),
            split_tunneling_apps: Vec::new(),
            split_tunneling_domains: Vec::new(),
            fragmentation_enabled: false,
            fragmentation_fallback: "enabled".to_string(),
            fragmentation_timeout: 300,
            mux_enabled: false,
            mux_protocol: "h2mux".to_string(),
            mux_concurrency: 4,
            mux_padding: false,
            tls_spoof_enabled: false,
            tls_spoof_domain: "google.com".to_string(),
            tls_spoof_method: "wrong-ack".to_string(),
            tls_fingerprint: "auto".to_string(),
            remote_dns: "auto".to_string(),
            remote_dns_doh: true,
            remote_dns_strictly_tun: false,
            fake_ip_enabled: false,
            reset_chain_on_disconnect: false,
            mtu_auto: true,
            mtu_value: 1500,
            network_stack: "mixed".to_string(),
            proxy_port: 2080,
        }
    }
}






#[cfg(target_os = "windows")]
fn get_real_hwid_or_generate() -> String {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new("reg");
    cmd.creation_flags(0x08000000);
    if let Ok(output) = cmd
        .args(["query", "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("MachineGuid") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(guid) = parts.last() {
                    return guid.to_string();
                }
            }
        }
    }
    Uuid::new_v4().to_string()
}

#[cfg(target_os = "linux")]
fn get_real_hwid_or_generate() -> String {

    if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }

    if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    Uuid::new_v4().to_string()
}

#[cfg(target_os = "macos")]
fn get_real_hwid_or_generate() -> String {

    if let Ok(output) = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("IOPlatformSerialNumber") {

                if let Some(start) = line.rfind('"') {
                    let after = &line[..start];
                    if let Some(end) = after.rfind('"') {
                        let serial = &after[end + 1..];
                        if !serial.is_empty() {
                            return serial.to_string();
                        }
                    }
                }
            }
        }
    }
    Uuid::new_v4().to_string()
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn get_real_hwid_or_generate() -> String {
    Uuid::new_v4().to_string()
}

impl DbState {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                uri TEXT NOT NULL,
                config_json TEXT NOT NULL,
                server_description TEXT NOT NULL,
                subscription_id TEXT,
                protocol TEXT
            )",
            [],
        )?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    pub fn get_settings(&self) -> Result<AppSettings> {
        let (settings, has_any) = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            
            let mut settings = AppSettings::default();
            let mut has_any = false;
            
            for row in rows {
                if let Ok((key, value)) = row {
                    has_any = true;
                    match key.as_str() {
                        "auto_update" => settings.auto_update = value == "true",
                        "update_interval" => settings.update_interval = value == "true",
                        "update_timeout" => settings.update_timeout = value.parse().unwrap_or(10),
                        "user_agent" => settings.user_agent = value,
                        "send_hwid" => settings.send_hwid = value == "true",
                        "send_os" => settings.send_os = value == "true",
                        "send_model" => settings.send_model = value == "true",
                        "anonymous_hwid" => settings.anonymous_hwid = value,
                        "real_hwid" => settings.real_hwid = value,
                        "selected_profile_id" => {
                            if value.is_empty() {
                                settings.selected_profile_id = None;
                            } else {
                                settings.selected_profile_id = Some(value);
                            }
                        }
                        "auto_update_interval" => settings.auto_update_interval = value.parse().unwrap_or(3600),
                        "split_tunneling_enabled" => settings.split_tunneling_enabled = value == "true",
                        "split_tunneling_mode" => {
                            settings.split_tunneling_mode = value.clone();
                            settings.split_tunneling_apps_mode = value.clone();
                            settings.split_tunneling_domains_mode = value;
                        }
                        "split_tunneling_apps_mode" => settings.split_tunneling_apps_mode = value,
                        "split_tunneling_domains_mode" => settings.split_tunneling_domains_mode = value,
                        "split_tunneling_apps" => {
                            if let Ok(apps) = serde_json::from_str(&value) {
                                settings.split_tunneling_apps = apps;
                            }
                        }
                        "split_tunneling_domains" => {
                            if let Ok(domains) = serde_json::from_str(&value) {
                                settings.split_tunneling_domains = domains;
                            }
                        }
                        "fragmentation_enabled" => settings.fragmentation_enabled = value == "true",
                        "fragmentation_fallback" => settings.fragmentation_fallback = value,
                        "fragmentation_timeout" => settings.fragmentation_timeout = value.parse().unwrap_or(300),
                        "mux_enabled" => settings.mux_enabled = value == "true",
                        "mux_protocol" => settings.mux_protocol = value,
                        "mux_concurrency" => settings.mux_concurrency = value.parse().unwrap_or(4),
                        "mux_padding" => settings.mux_padding = value == "true",
                        "tls_spoof_enabled" => settings.tls_spoof_enabled = value == "true",
                        "tls_spoof_domain" => settings.tls_spoof_domain = value,
                        "tls_spoof_method" => settings.tls_spoof_method = value,
                        "tls_fingerprint" => settings.tls_fingerprint = value,
                        "remote_dns" => settings.remote_dns = value,
                        "remote_dns_doh" => settings.remote_dns_doh = value == "true",
                        "remote_dns_strictly_tun" => settings.remote_dns_strictly_tun = value == "true",
                        "fake_ip_enabled" => settings.fake_ip_enabled = value == "true",
                        "reset_chain_on_disconnect" => settings.reset_chain_on_disconnect = value == "true",
                        "mtu_auto" => settings.mtu_auto = value == "true",
                        "mtu_value" => settings.mtu_value = value.parse().unwrap_or(1500),
                        "network_stack" => settings.network_stack = value,
                        "proxy_port" => settings.proxy_port = value.parse().unwrap_or(2080),
                        _ => {}
                    }
                }
            }
            (settings, has_any)
        };
        
        if !has_any {
            self.save_settings(&settings)?;
        }
        
        Ok(settings)
    }
    
    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")?;
        
        stmt.execute(params!["auto_update", settings.auto_update.to_string()])?;
        stmt.execute(params!["update_interval", settings.update_interval.to_string()])?;
        stmt.execute(params!["update_timeout", settings.update_timeout.to_string()])?;
        stmt.execute(params!["user_agent", &settings.user_agent])?;
        stmt.execute(params!["send_hwid", settings.send_hwid.to_string()])?;
        stmt.execute(params!["send_os", settings.send_os.to_string()])?;
        stmt.execute(params!["send_model", settings.send_model.to_string()])?;
        stmt.execute(params!["anonymous_hwid", &settings.anonymous_hwid])?;
        stmt.execute(params!["real_hwid", &settings.real_hwid])?;
        
        let selected_profile_id = settings.selected_profile_id.clone().unwrap_or_default();
        stmt.execute(params!["selected_profile_id", selected_profile_id])?;
        stmt.execute(params!["auto_update_interval", settings.auto_update_interval.to_string()])?;
        stmt.execute(params!["split_tunneling_enabled", settings.split_tunneling_enabled.to_string()])?;
        stmt.execute(params!["split_tunneling_mode", &settings.split_tunneling_mode])?;
        stmt.execute(params!["split_tunneling_apps_mode", &settings.split_tunneling_apps_mode])?;
        stmt.execute(params!["split_tunneling_domains_mode", &settings.split_tunneling_domains_mode])?;
        stmt.execute(params!["split_tunneling_apps", serde_json::to_string(&settings.split_tunneling_apps).unwrap_or_else(|_| "[]".to_string())])?;
        stmt.execute(params!["split_tunneling_domains", serde_json::to_string(&settings.split_tunneling_domains).unwrap_or_else(|_| "[]".to_string())])?;
        stmt.execute(params!["fragmentation_enabled", settings.fragmentation_enabled.to_string()])?;
        stmt.execute(params!["fragmentation_fallback", &settings.fragmentation_fallback])?;
        stmt.execute(params!["fragmentation_timeout", settings.fragmentation_timeout.to_string()])?;
        stmt.execute(params!["mux_enabled", settings.mux_enabled.to_string()])?;
        stmt.execute(params!["mux_protocol", &settings.mux_protocol])?;
        stmt.execute(params!["mux_concurrency", settings.mux_concurrency.to_string()])?;
        stmt.execute(params!["mux_padding", settings.mux_padding.to_string()])?;
        stmt.execute(params!["tls_spoof_enabled", settings.tls_spoof_enabled.to_string()])?;
        stmt.execute(params!["tls_spoof_domain", &settings.tls_spoof_domain])?;
        stmt.execute(params!["tls_spoof_method", &settings.tls_spoof_method])?;
        stmt.execute(params!["tls_fingerprint", &settings.tls_fingerprint])?;
        stmt.execute(params!["remote_dns", &settings.remote_dns])?;
        stmt.execute(params!["remote_dns_doh", settings.remote_dns_doh.to_string()])?;
        stmt.execute(params!["remote_dns_strictly_tun", settings.remote_dns_strictly_tun.to_string()])?;
        stmt.execute(params!["fake_ip_enabled", settings.fake_ip_enabled.to_string()])?;
        stmt.execute(params!["reset_chain_on_disconnect", settings.reset_chain_on_disconnect.to_string()])?;
        stmt.execute(params!["mtu_auto", settings.mtu_auto.to_string()])?;
        stmt.execute(params!["mtu_value", settings.mtu_value.to_string()])?;
        stmt.execute(params!["network_stack", &settings.network_stack])?;
        stmt.execute(params!["proxy_port", settings.proxy_port.to_string()])?;
        
        Ok(())
    }
    
    pub fn insert_profile(&self, profile: &Profile) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO profiles (name, uri, config_json, server_description, subscription_id, protocol)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                profile.name,
                profile.uri,
                profile.config_json,
                profile.server_description,
                profile.subscription_id,
                profile.protocol,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }
    
    pub fn get_profiles(&self) -> Result<Vec<Profile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, uri, config_json, server_description, subscription_id, protocol FROM profiles")?;
        let profile_iter = stmt.query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                uri: row.get(2)?,
                config_json: row.get(3)?,
                server_description: row.get(4)?,
                subscription_id: row.get(5)?,
                protocol: row.get(6)?,
            })
        })?;
        
        let mut profiles = Vec::new();
        for profile in profile_iter {
            profiles.push(profile?);
        }
        Ok(profiles)
    }

    pub fn delete_subscription_profiles(&self, subscription_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM profiles WHERE subscription_id = ?1",
            params![subscription_id],
        )?;
        Ok(())
    }
}
