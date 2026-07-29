use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tempfile::NamedTempFile;
use uuid::Uuid;
use std::io::Write;
use serde_json::{json, Value};
use std::net::{TcpListener, ToSocketAddrs};

use tokio::time::sleep;
use reqwest::Client;

#[derive(Serialize, Clone)]
pub struct PingResult {
    pub profile_id: String,
    pub latency_ms: i64,
    pub error: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct PingProfile {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub config_json: String,
    pub server_description: String,
    pub protocol: Option<String>,
}

fn get_available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(9094)
}

fn extract_host_port(config_json: &str) -> Option<(String, u16)> {
    let json_val: Value = serde_json::from_str(config_json).ok()?;
    
    if let Some(endpoints) = json_val.get("endpoints").and_then(|e| e.as_array()) {
        for ep in endpoints {
            if ep.get("type").and_then(|t| t.as_str()) == Some("wireguard") {
                if let Some(peers) = ep.get("peers").and_then(|p| p.as_array()) {
                    if let Some(peer) = peers.first() {
                        let host = peer.get("address").and_then(|a| a.as_str())?;
                        let port = peer.get("port").and_then(|p| p.as_u64()).unwrap_or(51820) as u16;
                        return Some((host.to_string(), port));
                    }
                }
            }
        }
    }

    if let Some(outbounds) = json_val.get("outbounds").and_then(|o| o.as_array()) {
        for ob in outbounds {
            let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if type_str != "direct" && type_str != "block" && type_str != "dns" && type_str != "urltest" && type_str != "selector" && !type_str.is_empty() {
                let host = ob.get("server").and_then(|s| s.as_str());
                let port = ob.get("server_port").and_then(|p| p.as_u64()).unwrap_or(443) as u16;
                if let Some(h) = host {
                    return Some((h.to_string(), port));
                }
            }
        }
    }
    None
}

pub fn ping_direct_tcp(profile: PingProfile, timeout_ms: u64) -> PingResult {
    let (host, port) = match extract_host_port(&profile.config_json) {
        Some(hp) => hp,
        None => return PingResult {
            profile_id: profile.id,
            latency_ms: 0,
            error: Some("No host/port found in config".into()),
        },
    };
    
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    let addr_str = format!("{}:{}", host, port);
    
    match addr_str.to_socket_addrs() {
        Ok(mut addrs) => {
            if let Some(addr) = addrs.next() {
                match std::net::TcpStream::connect_timeout(&addr, timeout) {
                    Ok(_) => {
                        PingResult {
                            profile_id: profile.id,
                            latency_ms: start.elapsed().as_millis() as i64,
                            error: None,
                        }
                    }
                    Err(e) => {
                        PingResult {
                            profile_id: profile.id,
                            latency_ms: -1,
                            error: Some(e.to_string()),
                        }
                    }
                }
            } else {
                PingResult {
                    profile_id: profile.id,
                    latency_ms: -1,
                    error: Some("DNS resolution failed".to_string()),
                }
            }
        }
        Err(e) => PingResult {
            profile_id: profile.id.clone(),
            latency_ms: 0,
            error: Some(format!("TCP Ping failed: {}", e)),
        }
    }
}

pub fn ping_direct_icmp(profile: PingProfile, timeout_ms: u64) -> PingResult {
    let host = match extract_host_port(&profile.config_json) {
        Some((h, _)) => h,
        None => return PingResult {
            profile_id: profile.id,
            latency_ms: 0,
            error: Some("No host found in config".into()),
        },
    };

    #[cfg(target_os = "windows")]
    let mut cmd = {
        use std::os::windows::process::CommandExt;
        let mut c = std::process::Command::new("ping");
        c.creation_flags(0x08000000);
        c
    };
    #[cfg(target_os = "windows")]
    cmd.arg("-n").arg("1").arg("-w").arg(timeout_ms.to_string()).arg(&host);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = std::process::Command::new("ping");
    #[cfg(not(target_os = "windows"))]
    cmd.arg("-c").arg("1").arg("-W").arg((timeout_ms / 1000).max(1).to_string()).arg(&host);

    let output = cmd.output();

    match output {
        Ok(out) => {
            let out_str = String::from_utf8_lossy(&out.stdout);
            for line in out_str.lines() {
                if line.contains(":") && (line.contains("bytes=") || line.contains("байт=") || line.contains("TTL=") || line.contains("time=") || line.contains("=")) {
                    let mut numbers = Vec::new();
                    let mut current_num = String::new();
                    let mut in_num = false;
                    for c in line.chars() {
                        if c == '=' || c == '<' {
                            in_num = true;
                            current_num.clear();
                        } else if in_num {
                            if c.is_ascii_digit() {
                                current_num.push(c);
                            } else if !current_num.is_empty() {
                                if let Ok(n) = current_num.parse::<i64>() {
                                    numbers.push(n);
                                }
                                in_num = false;
                                current_num.clear();
                            }
                        }
                    }
                    if in_num && !current_num.is_empty() {
                        if let Ok(n) = current_num.parse::<i64>() {
                            numbers.push(n);
                        }
                    }
                    
                    if numbers.len() >= 2 {
                        return PingResult {
                            profile_id: profile.id,
                            latency_ms: numbers[1],
                            error: None,
                        };
                    } else if numbers.len() == 1 {
                        return PingResult {
                            profile_id: profile.id,
                            latency_ms: numbers[0],
                            error: None,
                        };
                    }
                }
            }

            PingResult {
                profile_id: profile.id.clone(),
                latency_ms: -1,
                error: Some("Unreachable".to_string()),
            }
        }
        Err(e) => PingResult {
            profile_id: profile.id.clone(),
            latency_ms: -1,
            error: Some(e.to_string()),
        },
    }
}

pub async fn ping_via_proxy(
    app: AppHandle,
    profiles: Vec<PingProfile>,
    test_url: String,
    timeout_ms: u64,
) -> Result<Vec<PingResult>, String> {
    if profiles.is_empty() {
        return Ok(vec![]);
    }

    let port = get_available_port();
    let secret = Uuid::new_v4().to_string();

    let mut outbounds = Vec::new();
    let mut proxy_tags = Vec::new();
    let mut profile_results = Vec::new();
    let mut proxy_server_hosts: Vec<String> = Vec::new();

    for (index, profile) in profiles.iter().enumerate() {
        if let Ok(mut json_val) = serde_json::from_str::<Value>(&profile.config_json) {

            if let Some(endpoints) = json_val.get("endpoints").and_then(|e| e.as_array()) {
                let has_wg = endpoints.iter().any(|ep| {
                    ep.get("type").and_then(|t| t.as_str()) == Some("wireguard")
                });
                if has_wg {
                    profile_results.push(PingResult {
                        profile_id: profile.id.clone(),
                        latency_ms: -1,
                        error: Some("UDP".to_string()),
                    });
                    continue;
                }
            }

            let mut main_tag = String::new();
            
            if let Some(obs) = json_val.get("outbounds").and_then(|o| o.as_array()) {
                for ob in obs {
                    let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    if type_str != "direct" && type_str != "block" && type_str != "dns" && type_str != "urltest" && type_str != "selector" && !type_str.is_empty() {
                        main_tag = ob.get("tag").and_then(|t| t.as_str()).unwrap_or("").to_string();
                        break;
                    }
                }
            }

            if main_tag.is_empty() {
                profile_results.push(PingResult {
                    profile_id: profile.id.clone(),
                    latency_ms: -1,
                    error: Some("Config Err".to_string()),
                });
                continue;
            }

            let main_tag_mapped = format!("proxy-{}", index);
            proxy_tags.push(main_tag_mapped.clone());

            if let Some(obs) = json_val.get_mut("outbounds").and_then(|o| o.as_array_mut()) {
                for ob in obs {
                    let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();
                    if type_str == "direct" || type_str == "block" || type_str == "dns" || type_str == "urltest" || type_str == "selector" {
                        continue;
                    }


                    if let Some(server) = ob.get("server").and_then(|s| s.as_str()) {
                        if !server.is_empty() 
                            && !server.chars().all(|c| c.is_ascii_digit() || c == '.') 
                            && !server.contains(':') 
                        {
                            if !proxy_server_hosts.contains(&server.to_string()) {
                                proxy_server_hosts.push(server.to_string());
                            }
                        }
                    }

                    if let Some(tag_val) = ob.get_mut("tag") {
                        if let Some(t) = tag_val.as_str() {
                            if t == main_tag {
                                *tag_val = json!(main_tag_mapped);
                            } else {
                                *tag_val = json!(format!("{}-{}", t, index));
                            }
                        }
                    }

                    if let Some(detour_val) = ob.get_mut("detour") {
                        if let Some(d) = detour_val.as_str() {
                            if d.eq_ignore_ascii_case("direct") {
                                *detour_val = json!("direct");
                            } else if d.eq_ignore_ascii_case("block") {
                                *detour_val = json!("block");
                            } else if d == main_tag {
                                *detour_val = json!(main_tag_mapped);
                            } else {
                                *detour_val = json!(format!("{}-{}", d, index));
                            }
                        }
                    }


                    if ob.get("server").and_then(|s| s.as_str()).map_or(false, |s| {
                        !s.is_empty() && !s.chars().all(|c| c.is_ascii_digit() || c == '.') && !s.contains(':')
                    }) {
                        if ob.get("domain_resolver").is_none() {
                            ob.as_object_mut().map(|m| {
                                m.insert("domain_resolver".to_string(), json!({
                                    "server": "dns-direct"
                                }));
                            });
                        }
                    }

                    outbounds.push(ob.clone());
                }
            }
        } else {
            profile_results.push(PingResult {
                profile_id: profile.id.clone(),
                latency_ms: -1,
                error: Some("Config Err".to_string()),
            });
        }
    }

    if outbounds.is_empty() {
        return Ok(profile_results);
    }

    outbounds.push(json!({
        "type": "urltest",
        "tag": "urltest-ping",
        "outbounds": proxy_tags,
        "url": test_url,
        "interval": "10m"
    }));
    outbounds.push(json!({ "type": "direct", "tag": "direct" }));
    outbounds.push(json!({ "type": "block", "tag": "block" }));


    let mut dns_rules = Vec::new();
    

    if !proxy_server_hosts.is_empty() {
        dns_rules.push(json!({
            "domain": proxy_server_hosts,
            "action": "route",
            "server": "dns-direct"
        }));
    }


    if let Some(test_host) = extract_url_host(&test_url) {
        let mut domains = vec![test_host.clone()];
        if test_host.starts_with("www.") {
            domains.push(test_host[4..].to_string());
        } else {
            domains.push(format!("www.{}", test_host));
        }
        dns_rules.push(json!({
            "domain": domains,
            "action": "route",
            "server": "dns-fakeip"
        }));
    }

    let config = json!({
        "experimental": {
            "clash_api": {
                "external_controller": format!("127.0.0.1:{}", port),
                "secret": secret
            }
        },
        "log": { "level": "info" },
        "dns": {
            "independent_cache": true,
            "servers": [
                { "tag": "dns-direct", "type": "udp", "server": "1.1.1.1" },
                { "tag": "dns-fakeip", "type": "fakeip", "inet4_range": "198.18.0.0/15" }
            ],
            "rules": dns_rules,
            "final": "dns-direct"
        },
        "inbounds": [],
        "outbounds": outbounds,
        "route": {
            "auto_detect_interface": true,
            "default_domain_resolver": {
                "server": "dns-direct"
            },
            "final": "direct"
        }
    });

    let mut temp_file = NamedTempFile::new().map_err(|e| e.to_string())?;
    let config_str = serde_json::to_string_pretty(&config).unwrap();
    temp_file.write_all(config_str.as_bytes()).map_err(|e| e.to_string())?;
    let temp_path = temp_file.path().to_string_lossy().to_string();

    let (mut rx, child) = app.shell().sidecar("sing-box")
        .map_err(|e| format!("Sidecar err: {}", e))?
        .args(["run", "-c", &temp_path])
        .spawn()
        .map_err(|e| format!("Spawn err: {}", e))?;


    tokio::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(_) = event {
                break;
            }
        }
    });

    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms + 2000))
        .build()
        .unwrap();


    let mut ready = false;
    for _ in 0..50 {
        if let Ok(resp) = client.get(format!("http://127.0.0.1:{}/", port))
            .header("Authorization", format!("Bearer {}", secret))
            .send().await 
        {
            if resp.status().as_u16() != 0 {
                ready = true;
                break;
            }
        }
        sleep(Duration::from_millis(100)).await;
    }

    if !ready {
        let _ = child.kill();
        return Err("Clash API failed to start".to_string());
    }

    let mut final_results = profile_results.clone();
    

    for res in &final_results {
        let _ = app.emit("ping_result", res);
    }
    
    let mut tasks = Vec::new();

    for (index, profile) in profiles.iter().enumerate() {
        if final_results.iter().any(|r| r.profile_id == profile.id) {
            continue;
        }

        let tag = format!("proxy-{}", index);
        let url = format!(
            "http://127.0.0.1:{}/proxies/{}/delay?url={}&timeout={}",
            port, urlencoding::encode(&tag), urlencoding::encode(&test_url), timeout_ms
        );

        let client_clone = client.clone();
        let secret_clone = secret.clone();
        let profile_id = profile.id.clone();

        let app_clone = app.clone();

        tasks.push(tokio::spawn(async move {
            let res = match client_clone.get(&url).header("Authorization", format!("Bearer {}", secret_clone)).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if let Ok(json_resp) = resp.json::<Value>().await {
                        if status.is_success() {
                            if let Some(delay) = json_resp.get("delay").and_then(|d| d.as_i64()) {
                                if delay > 0 {
                                    PingResult { profile_id, latency_ms: delay, error: None }
                                } else {
                                    PingResult { profile_id, latency_ms: -1, error: Some("Timeout".to_string()) }
                                }
                            } else {
                                PingResult { profile_id, latency_ms: -1, error: Some("Timeout".to_string()) }
                            }
                        } else {
                            let err_msg = json_resp.get("message")
                                .and_then(|m| m.as_str())
                                .map(|m| classify_proxy_error(m))
                                .unwrap_or_else(|| format!("{}", status.as_u16()));
                            PingResult { profile_id, latency_ms: -1, error: Some(err_msg) }
                        }
                    } else {
                        PingResult { profile_id, latency_ms: -1, error: Some("Parse err".to_string()) }
                    }
                }
                Err(e) => {
                    let err_msg = classify_proxy_error(&e.to_string());
                    PingResult { profile_id, latency_ms: -1, error: Some(err_msg) }
                }
            };
            let _ = app_clone.emit("ping_result", &res);
            res
        }));
    }

    for task in tasks {
        if let Ok(res) = task.await {
            final_results.push(res);
        }
    }

    let _ = child.kill();

    Ok(final_results)
}

fn extract_url_host(url_str: &str) -> Option<String> {
    url::Url::parse(url_str).ok().and_then(|u| u.host_str().map(|h| h.to_string()))
}

fn classify_proxy_error(message: &str) -> String {
    let msg = message.to_lowercase();
    if msg.contains("timeout") || msg.contains("deadline exceeded") || msg.contains("i/o timeout") {
        "Timeout".to_string()
    } else if msg.contains("tls") || msg.contains("certificate") || msg.contains("handshake") || msg.contains("x509") {
        "TLS Failed".to_string()
    } else if msg.contains("unreachable") || msg.contains("no route") {
        "Unreachable".to_string()
    } else if msg.contains("refused") {
        "Refused".to_string()
    } else if msg.contains("reset") || msg.contains("eof") || msg.contains("closed") || msg.contains("broken pipe") {
        "Reset".to_string()
    } else if msg.contains("dns") || msg.contains("resolve") || msg.contains("lookup") || msg.contains("no such host") {
        "DNS Fail".to_string()
    } else if message.len() > 20 {
        format!("{}..", &message[..17])
    } else if !message.is_empty() {
        message.to_string()
    } else {
        "Failed".to_string()
    }
}

