use base64::{Engine as _, engine::general_purpose};
use crate::db::{Profile, AppSettings};
use super::converter::convert_if_needed;
use super::uri::parse_single_uri_to_xray;
use super::outbound::convert_outbounds;
use serde_json::{json, Map, Value};

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct SubscriptionParseResult {
    pub name: String,
    pub profiles: Vec<Profile>,
    pub upload: i64,
    pub download: i64,
    pub total: i64,
    pub expire: i64,
    pub update_interval: i64,
    pub description: Option<String>,
    pub support_url: Option<String>,
    pub web_page_url: Option<String>,
}

pub async fn parse_clipboard_data(text: &str, settings: &AppSettings) -> Result<SubscriptionParseResult, String> {
    let trimmed = text.trim();
    

    let lines: Vec<&str> = trimmed.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    if lines.len() > 1 && lines.iter().all(|l| is_proxy_uri(l)) {
        return parse_multiple_uris(&lines).map(|profiles| SubscriptionParseResult {
            name: "Imported Profiles".to_string(),
            profiles,
            upload: -1,
            download: -1,
            total: -1,
            expire: -1,
            update_interval: 0,
            description: None,
            support_url: None,
            web_page_url: None,
        });
    }
    

    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        let is_doh_enabled = true;
        let config_json = convert_if_needed(trimmed, is_doh_enabled)?;
        let name = extract_name_from_json(trimmed);
        let protocol = extract_protocol_from_json(&config_json);
        
        let profile = Profile {
            id: None,
            name: name.clone(),
            uri: "internal://json".to_string(),
            config_json,
            server_description: "JSON Profile".to_string(),
            subscription_id: None,
            protocol,
        };
        return Ok(SubscriptionParseResult {
            name,
            profiles: vec![profile],
            upload: -1,
            download: -1,
            total: -1,
            expire: -1,
            update_interval: 0,
            description: None,
            support_url: None,
            web_page_url: None,
        });
    }
    

    if is_proxy_uri(trimmed) {
        let profile = build_profile_from_uri(trimmed, None)?;
        let name = profile.name.clone();
        return Ok(SubscriptionParseResult {
            name,
            profiles: vec![profile],
            upload: -1,
            download: -1,
            total: -1,
            expire: -1,
            update_interval: 0,
            description: None,
            support_url: None,
            web_page_url: None,
        });
    }
    

    let robust_decoded = decode_base64_robust(trimmed);
    if robust_decoded != trimmed {
        let lines: Vec<&str> = robust_decoded.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        if lines.iter().all(|l| is_proxy_uri(l)) {
            return parse_multiple_uris(&lines).map(|profiles| SubscriptionParseResult {
                name: "Imported Profiles".to_string(),
                profiles,
                upload: -1,
                download: -1,
                total: -1,
                expire: -1,
                update_interval: 0,
                description: None,
                support_url: None,
                web_page_url: None,
            });
        }
    }
    

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return fetch_subscription(trimmed, settings).await;
    }
    
    Err("Invalid format".to_string())
}

fn is_proxy_uri(s: &str) -> bool {
    let s_lower = s.to_lowercase();
    s_lower.starts_with("vless://") || 
    s_lower.starts_with("vmess://") || 
    s_lower.starts_with("trojan://") || 
    s_lower.starts_with("ss://") || 
    s_lower.starts_with("shadowsocks://") ||
    s_lower.starts_with("hysteria://") ||
    s_lower.starts_with("hy://") ||
    s_lower.starts_with("hysteria2://") ||
    s_lower.starts_with("hy2://") ||
    s_lower.starts_with("wireguard://") ||
    s_lower.starts_with("wg://") ||
    s_lower.starts_with("tuic://")
}

fn parse_multiple_uris(lines: &[&str]) -> Result<Vec<Profile>, String> {
    let mut profiles = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        if let Ok(profile) = build_profile_from_uri(line, Some("sub_1".to_string())) {
            let mut p = profile;
            if p.name.is_empty() || p.name == "URI Profile" {
                p.name = format!("Profile {}", i);
            }
            profiles.push(p);
        }
    }
    if profiles.is_empty() {
        Err("No valid profiles found".to_string())
    } else {
        Ok(profiles)
    }
}

fn build_profile_from_uri(uri: &str, subscription_id: Option<String>) -> Result<Profile, String> {
    let trimmed = uri.trim();
    if trimmed.starts_with("{") && trimmed.ends_with("}") {
        let config_json = crate::parser::converter::convert_if_needed(trimmed, true).unwrap_or(trimmed.to_string());
        let protocol = extract_protocol_from_json(&config_json);
        
        let mut name = "JSON Profile".to_string();
        if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
            if let Some(remarks) = v.get("remarks").and_then(|r| r.as_str()) {
                name = remarks.to_string();
            } else if let Some(tag) = v.get("tag").and_then(|t| t.as_str()) {
                name = tag.to_string();
            } else if let Some(outbounds) = v.get("outbounds").and_then(|o| o.as_array()) {
                if let Some(first) = outbounds.first() {
                    if let Some(tag) = first.get("tag").and_then(|t| t.as_str()) {
                        if tag != "proxy" && !tag.is_empty() {
                            name = tag.to_string();
                        } else if let Some(server) = first.get("server").and_then(|s| s.as_str()) {
                            name = server.to_string();
                        }
                    }
                }
            }
        }
        
        let mut server_description = "JSON".to_string();
        if let Some(desc) = parse_transport_and_security(&config_json) {
            server_description = desc;
        }

        return Ok(Profile {
            id: None,
            name,
            uri: "internal://json".to_string(),
            config_json,
            server_description,
            subscription_id,
            protocol,
        });
    }

    let xray_outbound = parse_single_uri_to_xray(uri)?;
    let name = extract_name_from_uri(uri);
    

    let xray_outbounds_arr = vec![xray_outbound];
    let sb_outbounds = convert_outbounds(&xray_outbounds_arr);
    
    let mut proxy_server = "".to_string();
    if let Some(first) = sb_outbounds.first() {
        if let Some(s) = first.get("server").and_then(|s| s.as_str()) {
            proxy_server = s.to_string();
        }
    }
    
    let config_json = build_minimal_sing_box_config(sb_outbounds, &proxy_server);
    let protocol = extract_protocol_from_json(&config_json);
    
    Ok(Profile {
        id: None,
        name,
        uri: uri.to_string(),
        config_json,
        server_description: "URI Profile".to_string(),
        subscription_id,
        protocol,
    })
}

fn build_minimal_sing_box_config(mut proxy_outbounds: Vec<Value>, proxy_server: &str) -> String {
    let mut sb = Map::new();
    
    sb.insert("log".to_string(), json!({
        "level": "info",
        "timestamp": true
    }));
    
    let mut proxy_domains = Vec::new();
    if !proxy_server.is_empty() && !proxy_server.chars().next().unwrap().is_ascii_digit() {
        proxy_domains.push(proxy_server.to_string());
    }
    
    let mut dns_rules = Vec::new();
    if !proxy_domains.is_empty() {
        dns_rules.push(json!({
            "domain": proxy_domains,
            "server": "dns-direct"
        }));
    }
    
    sb.insert("dns".to_string(), json!({
        "servers": [
            {
                "tag": "dns-remote",
                "type": "https",
                "server": "1.1.1.1",
                "path": "/dns-query",
                "domain_resolver": "dns-direct",
                "detour": "proxy"
            },
            {
                "tag": "dns-direct",
                "type": "udp",
                "server": "8.8.8.8"
            }
        ],
        "rules": dns_rules,
        "final": "dns-remote",
        "strategy": "prefer_ipv4",
        "independent_cache": true
    }));
    
    sb.insert("inbounds".to_string(), json!([{
        "type": "tun",
        "tag": "tun-in",
        "address": [
            "172.19.0.1/30"
        ],
        "mtu": 1500,
        "auto_route": true,
        "stack": "system"
    }]));
    
    proxy_outbounds.push(json!({"type": "direct", "tag": "direct"}));
    proxy_outbounds.push(json!({"type": "block", "tag": "block"}));
    sb.insert("outbounds".to_string(), json!(proxy_outbounds));
    
    let mut route_rules = Vec::new();
    route_rules.push(json!({"protocol": "dns", "action": "hijack-dns"}));
    route_rules.push(json!({"port": 53, "action": "hijack-dns"}));
    route_rules.push(json!({"action": "sniff"}));
    route_rules.push(json!({"protocol": ["bittorrent"], "outbound": "direct"}));
    route_rules.push(json!({"ip_is_private": true, "outbound": "direct"}));
    if !proxy_domains.is_empty() {
        route_rules.push(json!({"domain": proxy_domains, "outbound": "direct"}));
    }
    sb.insert("route".to_string(), json!({
        "auto_detect_interface": false,
        "default_domain_resolver": "dns-direct",
        "final": "proxy",
        "rules": route_rules
    }));
    
    serde_json::to_string_pretty(&sb).unwrap().replace("\\/", "/")
}

async fn fetch_subscription(url: &str, settings: &AppSettings) -> Result<SubscriptionParseResult, String> {
    
    let mut final_url = url.to_string();
    let hwid = if settings.send_hwid { &settings.real_hwid } else { &settings.anonymous_hwid };
    
    let base = if final_url.contains("#") { final_url.split('#').next().unwrap() } else { &final_url };
    let fragment = if final_url.contains("#") { format!("#{}", final_url.split('#').nth(1).unwrap()) } else { "".to_string() };
    
    if !base.contains("hwid=") {
        let separator = if base.contains("?") { "&" } else { "?" };
        final_url = format!("{}{}hwid={}{}", base, separator, hwid, fragment);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(settings.update_timeout as u64))
        .build()
        .map_err(|e| e.to_string())?;
        
    let os_val = if settings.send_os { "Windows" } else { "FlareVPN OS" };
    let model_val = if settings.send_model { "Windows PC" } else { "FlareVPN Client" };

    let res = client.get(&final_url)
        .header("User-Agent", &settings.user_agent)
        .header("x-hwid", hwid)
        .header("x-ver-os", os_val)
        .header("x-device-model", model_val)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP Error: {}", res.status()));
    }
    
    let mut default_name_from_url = false;
    let mut name = String::new();
    if let Ok(parsed_url) = url::Url::parse(url) {
        if let Some(host) = parsed_url.host_str() {
            name = host.to_string();
            default_name_from_url = true;
        }
    }
    
    let mut update_interval: i64 = 0;

    let headers = res.headers();
    

    let interval_headers = ["profile-update-interval", "subscription-update-interval", "update-interval", "interval-update"];
    for h in interval_headers.iter() {
        if let Some(val) = headers.get(*h) {
            if let Ok(v_str) = val.to_str() {
                update_interval = parse_interval_to_seconds(v_str);
                if update_interval > 0 { break; }
            }
        }
    }
    

    if let Some(val) = headers.get("profile-title") {
        if let Ok(v_str) = val.to_str() {
            name = decode_subscription_name(v_str);
            default_name_from_url = false;
        }
    } else if let Some(content_disp) = headers.get("content-disposition") {
        if let Ok(disp_str) = content_disp.to_str() {

            if let Some(idx) = disp_str.find("filename=") {
                let filename = &disp_str[idx + 9..];
                name = decode_subscription_name(&filename.replace("\"", "").replace("'", ""));
                default_name_from_url = false;
            } else if let Some(idx) = disp_str.find("filename*=") {
                if let Some(utf8_idx) = disp_str[idx..].find("''") {
                    name = decode_subscription_name(&disp_str[idx + utf8_idx + 2..]);
                    default_name_from_url = false;
                }
            }
        }
    }
    
    let mut upload: i64 = -1;
    let mut download: i64 = -1;
    let mut total: i64 = -1;
    let mut expire: i64 = -1;
    
    if let Some(user_info) = headers.get("subscription-userinfo") {
        if let Ok(info_str) = user_info.to_str() {
            for part in info_str.split(';') {
                let kv: Vec<&str> = part.split('=').map(|s| s.trim()).collect();
                if kv.len() == 2 {
                    if let Ok(val) = kv[1].parse::<i64>() {
                        match kv[0].to_lowercase().as_str() {
                            "upload" => upload = val,
                            "download" => download = val,
                            "total" => total = val,
                            "expire" => expire = val,
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    let mut announce_header = None;
    if let Some(announce_val) = headers.get("announce") {
        if let Ok(announce_str) = announce_val.to_str() {
            announce_header = Some(announce_str.to_string());
        }
    }

    let mut description_header = None;
    let desc_headers = ["profile-description", "profile-message", "description"];
    for h in desc_headers.iter() {
        if let Some(val) = headers.get(*h) {
            if let Ok(v_str) = val.to_str() {
                description_header = Some(v_str.to_string());
                break;
            }
        }
    }

    let mut support_url_header = None;
    if let Some(val) = headers.get("support-url") {
        if let Ok(v_str) = val.to_str() {
            support_url_header = Some(v_str.to_string());
        }
    }

    let mut web_page_url_header = None;
    if let Some(val) = headers.get("profile-web-page-url") {
        if let Ok(v_str) = val.to_str() {
            web_page_url_header = Some(v_str.to_string());
        }
    }

    let body = res.text().await.map_err(|e| e.to_string())?;

    let mut proxy_lines = Vec::new();
    let mut lines = Vec::new();


    let trimmed_body = body.trim();
    if trimmed_body.starts_with("[") {
        if let Ok(json_arr) = serde_json::from_str::<Value>(trimmed_body) {
            if let Some(arr) = json_arr.as_array() {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        if !s.trim().is_empty() {
                            proxy_lines.push(s.to_string());
                        }
                    } else if item.is_object() {
                        proxy_lines.push(item.to_string());
                    }
                }
            }
        }
    }

    if proxy_lines.is_empty() {

        let decoded_body = decode_base64_robust(&body);
        let trimmed_decoded = decoded_body.trim();
        

        if trimmed_decoded.starts_with("[") {
            if let Ok(json_arr) = serde_json::from_str::<Value>(trimmed_decoded) {
                if let Some(arr) = json_arr.as_array() {
                    for item in arr {
                        if let Some(s) = item.as_str() {
                            if !s.trim().is_empty() {
                                proxy_lines.push(s.to_string());
                            }
                        } else if item.is_object() {
                            proxy_lines.push(item.to_string());
                        }
                    }
                }
            }
        }
        
        if proxy_lines.is_empty() {
            let decoded_lines: Vec<&str> = trimmed_decoded.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
            lines = decoded_lines.iter().map(|s| s.to_string()).collect();
        }
    }

    let title_regex = regex::Regex::new(r"(?i)^(?:#|//|;)?\s*profile-title\s*[:=]\s*(.+)$").unwrap();
    let interval_regex = regex::Regex::new(r"(?i)^(?:#|//|;)?\s*(?:profile-update-interval|subscription-update-interval|update-interval|interval-update)\s*[:=]\s*(.+)$").unwrap();

    let mut body_title = String::new();
    let mut body_interval = 0;

    if proxy_lines.is_empty() {
        for line in &lines {
            if let Some(caps) = title_regex.captures(line) {
                if body_title.is_empty() {
                    body_title = caps.get(1).unwrap().as_str().trim().to_string();
                }
            } else if let Some(caps) = interval_regex.captures(line) {
                if body_interval == 0 {
                    body_interval = parse_interval_to_seconds(caps.get(1).unwrap().as_str().trim());
                }
            } else {
                proxy_lines.push(line.clone());
            }
        }
    }

    if !body_title.is_empty() {
        name = decode_subscription_name(&body_title);
    } else if name.is_empty() && default_name_from_url {

    }
    if update_interval == 0 && body_interval > 0 {
        update_interval = body_interval;
    }

    let proxy_lines_refs: Vec<&str> = proxy_lines.iter().map(|s| s.as_str()).collect();
    let profiles = parse_multiple_uris(&proxy_lines_refs)?;
    
    let name = decode_subscription_name(&name);


    let mut desc_parts = Vec::new();
    if let Some(announce_str) = announce_header {
        let decoded = decode_subscription_name(&announce_str);
        if !decoded.is_empty() {
            desc_parts.push(decoded);
        }
    }
    if let Some(desc_str) = description_header {
        let decoded = decode_subscription_name(&desc_str);
        if !decoded.is_empty() {
            desc_parts.push(decoded);
        }
    }

    let description = if desc_parts.is_empty() {
        None
    } else {
        Some(desc_parts.join("\n"))
    };

    let support_url = support_url_header.map(|s| decode_subscription_name(&s)).filter(|s| !s.is_empty());
    let web_page_url = web_page_url_header.map(|s| decode_subscription_name(&s)).filter(|s| !s.is_empty());

    Ok(SubscriptionParseResult {
        name,
        profiles,
        upload,
        download,
        total,
        expire,
        update_interval,
        description,
        support_url,
        web_page_url,
    })
}

fn decode_subscription_name(val: &str) -> String {
    let trimmed = val.trim();
    if trimmed.to_lowercase().starts_with("base64:") {
        let b64_part = &trimmed[7..];
        let decoded_str = decode_base64_robust(b64_part);
        if decoded_str != b64_part {
            return decoded_str.trim().to_string();
        }
    }
    
    if trimmed.contains('%') {
        let decoded = url::form_urlencoded::parse(trimmed.as_bytes())
            .map(|(k, _)| k.to_string())
            .collect::<Vec<String>>()
            .join("");
        if !decoded.is_empty() {
            return decoded.trim().to_string();
        }
    }
    
    trimmed.to_string()
}

fn parse_interval_to_seconds(s: &str) -> i64 {
    let s = s.trim();
    if let Ok(val) = s.parse::<f64>() {



        if val <= 240.0 {
            return (val * 3600.0) as i64;
        } else {

            return val as i64;
        }
    }

    let s_lower = s.to_lowercase();
    let num_str: String = s.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
    if let Ok(num) = num_str.parse::<f64>() {
        if s_lower.contains("h") || s_lower.contains("ч") {
            return (num * 3600.0) as i64;
        } else if s_lower.contains("m") || s_lower.contains("м") {
            return (num * 60.0) as i64;
        } else if s_lower.contains("s") || s_lower.contains("с") {
            return num as i64;
        } else if s_lower.contains("d") || s_lower.contains("д") {
            return (num * 86400.0) as i64;
        }
        return num as i64;
    }
    0
}

fn extract_name_from_json(json_str: &str) -> String {
    if let Ok(v) = serde_json::from_str::<Value>(json_str) {
        if let Some(remarks) = v.get("remarks").and_then(|r| r.as_str()) {
            return decode_subscription_name(remarks);
        }
    }
    "Custom Profile".to_string()
}

fn extract_name_from_uri(uri: &str) -> String {
    let parts: Vec<&str> = uri.split('#').collect();
    if parts.len() > 1 {
        let decoded = url::form_urlencoded::parse(parts[1].as_bytes()).map(|(k, _)| k.to_string()).collect::<Vec<String>>().join("");
        let name_str = if !decoded.is_empty() { decoded } else { parts[1].to_string() };
        return decode_subscription_name(&name_str);
    }
    "URI Profile".to_string()
}

fn extract_protocol_from_json(sb_json_str: &str) -> Option<String> {
    if let Ok(v) = serde_json::from_str::<Value>(sb_json_str) {
        if let Some(outbounds) = v.get("outbounds").and_then(|o| o.as_array()) {
            if let Some(first) = outbounds.first() {
                if let Some(t) = first.get("type").and_then(|t| t.as_str()) {
                    return Some(t.to_string());
                }
            }
        }
    }
    None
}

fn decode_base64_robust(text: &str) -> String {
    let clean_text: String = text.chars().filter(|c| {
        c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=' || *c == '-' || *c == '_'
    }).collect();

    let mut padded_text = clean_text.clone();
    let pad_len = padded_text.len() % 4;
    if pad_len > 0 {
        let padding_needed = 4 - pad_len;
        for _ in 0..padding_needed {
            padded_text.push('=');
        }
    }

    let try_decode = |s: &str| -> Option<String> {
        if let Ok(d) = general_purpose::STANDARD.decode(s) {
            if let Ok(s) = String::from_utf8(d) { return Some(s); }
        }
        if let Ok(d) = general_purpose::STANDARD_NO_PAD.decode(s) {
            if let Ok(s) = String::from_utf8(d) { return Some(s); }
        }
        if let Ok(d) = general_purpose::URL_SAFE.decode(s) {
            if let Ok(s) = String::from_utf8(d) { return Some(s); }
        }
        if let Ok(d) = general_purpose::URL_SAFE_NO_PAD.decode(s) {
            if let Ok(s) = String::from_utf8(d) { return Some(s); }
        }
        None
    };

    if let Some(s) = try_decode(&padded_text) {
        return s;
    }
    if let Some(s) = try_decode(&clean_text) {
        return s;
    }
    
    text.to_string()
}

fn parse_transport_and_security(config_json: &str) -> Option<String> {
    let v: Value = serde_json::from_str(config_json).ok()?;
    let outbounds = v.get("outbounds")?.as_array()?;
    let outbound = outbounds.first()?;

    let mut transport = String::new();
    let mut security = String::new();

    if let Some(trans_obj) = outbound.get("transport").and_then(|t| t.as_object()) {
        if let Some(t_type) = trans_obj.get("type").and_then(|t| t.as_str()) {
            transport = match t_type.to_lowercase().as_str() {
                "tcp" => "TCP",
                "raw" => "RAW",
                "ws" => "WS",
                "grpc" => "gRPC",
                "httpupgrade" => "HTTPUpgrade",
                "h2" => "H2",
                "http" => "HTTP",
                "xhttp" => "XHTTP",
                "quic" => "QUIC",
                "kcp" => "KCP",
                _ => t_type,
            }.to_string();
        }
    } else {
        let type_val = outbound.get("type").and_then(|t| t.as_str()).unwrap_or("").to_lowercase();
        if ["vless", "vmess", "trojan", "shadowsocks", "shadowtls", "socks", "http"].contains(&type_val.as_str()) {
            transport = "TCP".to_string();
        }
    }

    if let Some(tls_obj) = outbound.get("tls").and_then(|t| t.as_object()) {
        if tls_obj.get("enabled").and_then(|e| e.as_bool()).unwrap_or(false) {
            if let Some(reality_obj) = tls_obj.get("reality").and_then(|r| r.as_object()) {
                if reality_obj.get("enabled").and_then(|e| e.as_bool()).unwrap_or(false) {
                    security = "REALITY".to_string();
                } else {
                    security = "TLS".to_string();
                }
            } else {
                security = "TLS".to_string();
            }
        }
    } else {
        let sec_val = outbound.get("security").and_then(|s| s.as_str()).unwrap_or("").to_lowercase();
        if sec_val == "tls" {
            security = "TLS".to_string();
        } else if sec_val == "reality" {
            security = "REALITY".to_string();
        }
    }

    let mut parts = Vec::new();
    if !transport.is_empty() {
        parts.push(transport);
    }
    if !security.is_empty() {
        parts.push(security);
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" / "))
    }
}
