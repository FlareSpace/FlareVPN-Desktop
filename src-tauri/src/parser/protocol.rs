use serde_json::{json, Map, Value};
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};

pub fn convert_vless(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("vless"));
    
    let vnext = xray_ob.get("settings").and_then(|s| s.get("vnext")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let vnext = match vnext {
        Some(v) => v,
        None => return,
    };
    
    let user = vnext.get("users").and_then(|u| u.as_array()).and_then(|arr| arr.get(0));
    let user = match user {
        Some(u) => u,
        None => return,
    };
    
    if let Some(addr) = vnext.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = vnext.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    if let Some(id) = user.get("id") {
        sb_ob.insert("uuid".to_string(), id.clone());
    }
    
    let mut flow = user.get("flow").and_then(|f| f.as_str()).unwrap_or("").to_string();
    if flow == "null" {
        flow = "".to_string();
    }
    
    let mut pe = xray_ob.get("packet_encoding").and_then(|pe| pe.as_str()).unwrap_or("xudp").to_string();
    
    if flow == "xtls-rprx-vision-udp443" {
        flow = "xtls-rprx-vision".to_string();
        pe = "xudp".to_string();
    }
    
    if !pe.is_empty() && pe != "xudp" && pe != "packetaddr" {
        pe = "xudp".to_string();
    }
    
    sb_ob.insert("flow".to_string(), json!(flow));
    sb_ob.insert("packet_encoding".to_string(), json!(pe));
    
    if let Some(stream_settings) = xray_ob.get("streamSettings") {
        convert_stream_settings(stream_settings, sb_ob);
    }
}

pub fn convert_vmess(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("vmess"));
    
    let vnext = xray_ob.get("settings").and_then(|s| s.get("vnext")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let vnext = match vnext {
        Some(v) => v,
        None => return,
    };
    
    let user = vnext.get("users").and_then(|u| u.as_array()).and_then(|arr| arr.get(0));
    let user = match user {
        Some(u) => u,
        None => return,
    };
    
    if let Some(addr) = vnext.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = vnext.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    if let Some(id) = user.get("id") {
        sb_ob.insert("uuid".to_string(), id.clone());
    }
    
    let security = user.get("security").and_then(|s| s.as_str()).unwrap_or("auto");
    sb_ob.insert("security".to_string(), json!(security));
    sb_ob.insert("packet_encoding".to_string(), json!("xudp"));
    
    if let Some(stream_settings) = xray_ob.get("streamSettings") {
        convert_stream_settings(stream_settings, sb_ob);
    }
}

pub fn convert_trojan(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("trojan"));
    
    let server = xray_ob.get("settings").and_then(|s| s.get("servers")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let server = match server {
        Some(s) => s,
        None => return,
    };
    
    if let Some(addr) = server.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = server.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    if let Some(pass) = server.get("password") {
        sb_ob.insert("password".to_string(), pass.clone());
    }
    
    if let Some(stream_settings) = xray_ob.get("streamSettings") {
        convert_stream_settings(stream_settings, sb_ob);
    }
}

pub fn convert_shadowsocks(xray_ob: &Value, sb_ob: &mut Map<String, Value>, extra_outbounds: &mut Vec<Value>) {
    sb_ob.insert("type".to_string(), json!("shadowsocks"));
    
    let server = xray_ob.get("settings").and_then(|s| s.get("servers")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let server = match server {
        Some(s) => s,
        None => return,
    };
    
    if let Some(addr) = server.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = server.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    if let Some(method) = server.get("method") {
        sb_ob.insert("method".to_string(), method.clone());
    }
    if let Some(pass) = server.get("password") {
        sb_ob.insert("password".to_string(), pass.clone());
    }

    if let Some(plugin) = xray_ob.get("plugin").and_then(|p| p.as_str()) {
        if plugin == "shadowtls" {
            let raw_opts = xray_ob.get("plugin_opts").and_then(|o| o.as_str()).unwrap_or("");
            let mut opts_map = std::collections::HashMap::new();
            for opt in raw_opts.split(';') {
                let parts: Vec<&str> = opt.splitn(2, '=').collect();
                if parts.len() == 2 {
                    opts_map.insert(parts[0].trim().to_lowercase(), parts[1].trim().to_string());
                } else {
                    opts_map.insert(opt.trim().to_lowercase(), "true".to_string());
                }
            }
            
            let tag = sb_ob.get("tag").and_then(|t| t.as_str()).unwrap_or("proxy").to_string();
            let tls_tag = format!("{}-tls", tag);
            
            let mut shadow_tls_ob = Map::new();
            shadow_tls_ob.insert("type".to_string(), json!("shadowtls"));
            shadow_tls_ob.insert("tag".to_string(), json!(tls_tag));
            if let Some(addr) = server.get("address") {
                shadow_tls_ob.insert("server".to_string(), addr.clone());
            }
            if let Some(port) = server.get("port") {
                shadow_tls_ob.insert("server_port".to_string(), port.clone());
            }
            
            let version = opts_map.get("version").and_then(|v| v.parse::<i32>().ok()).unwrap_or(3);
            shadow_tls_ob.insert("version".to_string(), json!(version));
            
            if let Some(password) = opts_map.get("password") {
                if !password.is_empty() {
                    shadow_tls_ob.insert("password".to_string(), json!(password));
                }
            }
            
            let addr_str = server.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
            let sni_val = opts_map.get("host").or(opts_map.get("sni")).unwrap_or(&addr_str).to_string();
            
            shadow_tls_ob.insert("tls".to_string(), json!({
                "enabled": true,
                "server_name": sanitize_sni(&sni_val)
            }));
            
            extra_outbounds.push(Value::Object(shadow_tls_ob));
            sb_ob.insert("detour".to_string(), json!(tls_tag));
            return;
        } else {
            sb_ob.insert("plugin".to_string(), json!(plugin));
            let raw_opts = xray_ob.get("plugin_opts").and_then(|o| o.as_str()).unwrap_or("");
            let sanitized_opts = if raw_opts.contains("sni=") {
                raw_opts.split(';').map(|opt| {
                    if opt.starts_with("sni=") {
                        let val = &opt[4..];
                        format!("sni={}", sanitize_sni(val))
                    } else {
                        opt.to_string()
                    }
                }).collect::<Vec<_>>().join(";")
            } else {
                raw_opts.to_string()
            };
            sb_ob.insert("plugin_opts".to_string(), json!(sanitized_opts));
            return;
        }
    }

    if let Some(stream) = xray_ob.get("streamSettings") {
        let network = stream.get("network").and_then(|n| n.as_str()).unwrap_or("tcp");
        let security = stream.get("security").and_then(|s| s.as_str()).unwrap_or("none");
        
        if network == "ws" || security == "tls" {
            sb_ob.insert("plugin".to_string(), json!("v2ray-plugin"));
            let mut opts = Vec::new();
            opts.push("mode=websocket".to_string());
            
            let ws_settings = stream.get("wsSettings");
            let path = ws_settings.and_then(|w| w.get("path")).and_then(|p| p.as_str()).unwrap_or("/");
            opts.push(format!("path={}", path));
            
            let tls_settings = if security == "tls" { stream.get("tlsSettings") } else { None };
            if let Some(ts) = tls_settings {
                opts.push("tls".to_string());
                let server_name = ts.get("serverName").and_then(|s| s.as_str()).unwrap_or("");
                if !server_name.is_empty() {
                    opts.push(format!("sni={}", sanitize_sni(server_name)));
                }
                let host = ws_settings.and_then(|w| w.get("headers")).and_then(|h| h.get("Host")).and_then(|h| h.as_str()).unwrap_or("");
                if !host.is_empty() {
                    opts.push(format!("host={}", host));
                }
                
                let allow_insecure = ts.get("allowInsecure").and_then(|a| a.as_bool())
                    .or(ts.get("insecure").and_then(|a| a.as_bool()))
                    .or(ts.get("skipCertVerify").and_then(|a| a.as_bool()))
                    .unwrap_or(false);
                
                if allow_insecure {
                    opts.push("skipCertVerify".to_string());
                    opts.push("skip-cert-verify".to_string());
                }
            } else {
                let host = ws_settings.and_then(|w| w.get("headers")).and_then(|h| h.get("Host")).and_then(|h| h.as_str()).unwrap_or("");
                if !host.is_empty() {
                    opts.push(format!("host={}", host));
                }
            }
            sb_ob.insert("plugin_opts".to_string(), json!(opts.join(";")));
        }
    }
}

pub fn convert_socks(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("socks"));
    
    let server = xray_ob.get("settings").and_then(|s| s.get("servers")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let server = match server {
        Some(s) => s,
        None => return,
    };
    
    if let Some(addr) = server.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = server.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    
    let user_obj = server.get("users").and_then(|u| u.as_array()).and_then(|arr| arr.get(0));
    if let Some(uo) = user_obj {
        let user = uo.get("user").and_then(|u| u.as_str()).unwrap_or("");
        let pass = uo.get("pass").and_then(|p| p.as_str()).unwrap_or("");
        if !user.is_empty() {
            sb_ob.insert("username".to_string(), json!(user));
        }
        if !pass.is_empty() {
            sb_ob.insert("password".to_string(), json!(pass));
        }
    }
}

pub fn convert_http(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("http"));
    
    let server = xray_ob.get("settings").and_then(|s| s.get("servers")).and_then(|v| v.as_array()).and_then(|arr| arr.get(0));
    let server = match server {
        Some(s) => s,
        None => return,
    };
    
    if let Some(addr) = server.get("address") {
        sb_ob.insert("server".to_string(), addr.clone());
    }
    if let Some(port) = server.get("port") {
        sb_ob.insert("server_port".to_string(), port.clone());
    }
    
    let user_obj = server.get("user").and_then(|u| u.as_array()).and_then(|arr| arr.get(0));
    if let Some(uo) = user_obj {
        let user = uo.get("user").and_then(|u| u.as_str()).unwrap_or("");
        let pass = uo.get("pass").and_then(|p| p.as_str()).unwrap_or("");
        if !user.is_empty() {
            sb_ob.insert("username".to_string(), json!(user));
        }
        if !pass.is_empty() {
            sb_ob.insert("password".to_string(), json!(pass));
        }
    }
}

pub fn convert_hysteria(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("hysteria"));
    
    let settings = xray_ob.get("settings");
    let mut host = "".to_string();
    let mut port = 0;
    let mut password = "".to_string();
    
    if let Some(s) = settings {
        if let Some(servers) = s.get("servers").and_then(|srvs| srvs.as_array()) {
            if let Some(server) = servers.get(0) {
                host = server.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
                port = server.get("port").and_then(|p| p.as_i64()).unwrap_or(0);
                password = server.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
            }
        }
        
        if host.is_empty() {
            host = s.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
        }
        if port == 0 {
            port = s.get("port").and_then(|p| p.as_i64()).unwrap_or(0);
        }
        if password.is_empty() {
            password = s.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
        }
    }
    
    let stream_settings = xray_ob.get("streamSettings");
    let hysteria_settings = stream_settings.and_then(|ss| ss.get("hysteriaSettings"));
    
    if password.is_empty() {
        if let Some(hs) = hysteria_settings {
            password = hs.get("auth").and_then(|a| a.as_str()).unwrap_or("").to_string();
            if password.is_empty() {
                password = hs.get("auth_str").and_then(|a| a.as_str()).unwrap_or("").to_string();
            }
        }
    }
    
    if !host.is_empty() {
        sb_ob.insert("server".to_string(), json!(host));
    }
    if port > 0 {
        sb_ob.insert("server_port".to_string(), json!(port));
    }
    if !password.is_empty() {
        sb_ob.insert("auth_str".to_string(), json!(password));
    }
    
    let mut up_mbps = 0;
    let mut down_mbps = 0;
    let mut obfs = "".to_string();
    
    if let Some(s) = settings {
        up_mbps = s.get("up_mbps").and_then(|u| u.as_i64()).unwrap_or(0);
        if up_mbps == 0 {
            up_mbps = s.get("up").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        down_mbps = s.get("down_mbps").and_then(|d| d.as_i64()).unwrap_or(0);
        if down_mbps == 0 {
            down_mbps = s.get("down").and_then(|d| d.as_i64()).unwrap_or(0);
        }
        obfs = s.get("obfs").and_then(|o| o.as_str()).unwrap_or("").to_string();
    }
    
    if let Some(hs) = hysteria_settings {
        if up_mbps == 0 {
            up_mbps = hs.get("up_mbps").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        if up_mbps == 0 {
            up_mbps = hs.get("up").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        if down_mbps == 0 {
            down_mbps = hs.get("down_mbps").and_then(|d| d.as_i64()).unwrap_or(0);
        }
        if down_mbps == 0 {
            down_mbps = hs.get("down").and_then(|d| d.as_i64()).unwrap_or(0);
        }
        if obfs.is_empty() {
            obfs = hs.get("obfs").and_then(|o| o.as_str()).unwrap_or("").to_string();
        }
    }
    
    if up_mbps <= 0 { up_mbps = 100; }
    if down_mbps <= 0 { down_mbps = 100; }
    
    sb_ob.insert("up_mbps".to_string(), json!(up_mbps));
    sb_ob.insert("down_mbps".to_string(), json!(down_mbps));
    if !obfs.is_empty() {
        sb_ob.insert("obfs".to_string(), json!(obfs));
    }
    
    if let Some(stream_settings) = stream_settings {
        convert_stream_settings(stream_settings, sb_ob);
    }
    
    let tls_exists = sb_ob.contains_key("tls");
    if !tls_exists {
        let mut tls = Map::new();
        tls.insert("enabled".to_string(), json!(true));
        if !host.is_empty() {
            tls.insert("server_name".to_string(), json!(host));
        }
        sb_ob.insert("tls".to_string(), json!(tls));
    } else {
        if let Some(Value::Object(tls)) = sb_ob.get_mut("tls") {
            if !tls.contains_key("enabled") {
                tls.insert("enabled".to_string(), json!(true));
            }
            if !tls.contains_key("server_name") && !host.is_empty() {
                tls.insert("server_name".to_string(), json!(host));
            }
        }
    }
}

pub fn convert_hysteria2(xray_ob: &Value, sb_ob: &mut Map<String, Value>) {
    sb_ob.insert("type".to_string(), json!("hysteria2"));
    
    let settings = xray_ob.get("settings");
    let mut host = "".to_string();
    let mut port = 0;
    let mut password = "".to_string();
    
    if let Some(s) = settings {
        if let Some(servers) = s.get("servers").and_then(|srvs| srvs.as_array()) {
            if let Some(server) = servers.get(0) {
                host = server.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
                port = server.get("port").and_then(|p| p.as_i64()).unwrap_or(0);
                password = server.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
            }
        }
        
        if host.is_empty() {
            host = s.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
        }
        if port == 0 {
            port = s.get("port").and_then(|p| p.as_i64()).unwrap_or(0);
        }
        if password.is_empty() {
            password = s.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
        }
    }
    
    let stream_settings = xray_ob.get("streamSettings");
    let hysteria_settings = stream_settings.and_then(|ss| ss.get("hysteriaSettings"));
    
    if password.is_empty() {
        if let Some(hs) = hysteria_settings {
            password = hs.get("auth").and_then(|a| a.as_str()).unwrap_or("").to_string();
            if password.is_empty() {
                password = hs.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
            }
        }
    }
    
    if !host.is_empty() {
        sb_ob.insert("server".to_string(), json!(host));
    }
    if port > 0 {
        sb_ob.insert("server_port".to_string(), json!(port));
    }
    if !password.is_empty() {
        sb_ob.insert("password".to_string(), json!(password));
    }
    
    if let Some(mport) = settings.and_then(|s| s.get("mport")).and_then(|m| m.as_str()) {
        let trimmed = mport.trim();
        if !trimmed.is_empty() {
            let re = regex::Regex::new(r"[\s-]+").unwrap();
            let mut ports_array = Vec::new();
            for part in trimmed.split(',') {
                let part = part.trim();
                if !part.is_empty() {
                    ports_array.push(re.replace_all(part, ":").to_string());
                }
            }
            if !ports_array.is_empty() {
                sb_ob.insert("server_ports".to_string(), json!(ports_array));
            }
        }
    }
    
    if let Some(hop_interval_raw) = settings.and_then(|s| s.get("hop_interval")).and_then(|h| h.as_str()) {
        let trimmed = hop_interval_raw.trim();
        if !trimmed.is_empty() {
            let is_digit = trimmed.chars().all(|c| c.is_ascii_digit());
            let hop_interval = if is_digit { format!("{}s", trimmed) } else { trimmed.to_string() };
            sb_ob.insert("hop_interval".to_string(), json!(hop_interval));
        }
    }
    
    let mut up_mbps = 0;
    let mut down_mbps = 0;
    
    if let Some(s) = settings {
        up_mbps = s.get("up_mbps").and_then(|u| u.as_i64()).unwrap_or(0);
        if up_mbps == 0 {
            up_mbps = s.get("up").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        down_mbps = s.get("down_mbps").and_then(|d| d.as_i64()).unwrap_or(0);
        if down_mbps == 0 {
            down_mbps = s.get("down").and_then(|d| d.as_i64()).unwrap_or(0);
        }
    }
    
    if let Some(hs) = hysteria_settings {
        if up_mbps == 0 {
            up_mbps = hs.get("up_mbps").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        if up_mbps == 0 {
            up_mbps = hs.get("up").and_then(|u| u.as_i64()).unwrap_or(0);
        }
        if down_mbps == 0 {
            down_mbps = hs.get("down_mbps").and_then(|d| d.as_i64()).unwrap_or(0);
        }
        if down_mbps == 0 {
            down_mbps = hs.get("down").and_then(|d| d.as_i64()).unwrap_or(0);
        }
    }
    
    if up_mbps > 0 {
        sb_ob.insert("up_mbps".to_string(), json!(up_mbps));
    }
    if down_mbps > 0 {
        sb_ob.insert("down_mbps".to_string(), json!(down_mbps));
    }
    
    let obfs = settings.and_then(|s| s.get("obfs")).or_else(|| hysteria_settings.and_then(|hs| hs.get("obfs")));
    if let Some(o) = obfs {
        if let Some(obfs_type) = o.get("type").and_then(|t| t.as_str()) {
            if !obfs_type.is_empty() {
                let mut obfs_obj = Map::new();
                obfs_obj.insert("type".to_string(), json!(obfs_type));
                if let Some(password) = o.get("password").and_then(|p| p.as_str()) {
                    if !password.is_empty() {
                        obfs_obj.insert("password".to_string(), json!(password));
                    }
                }
                sb_ob.insert("obfs".to_string(), json!(obfs_obj));
            }
        }
    }
    
    if let Some(stream_settings) = stream_settings {
        convert_stream_settings(stream_settings, sb_ob);
    }
    
    let tls_exists = sb_ob.contains_key("tls");
    if !tls_exists {
        let mut tls = Map::new();
        tls.insert("enabled".to_string(), json!(true));
        if !host.is_empty() {
            tls.insert("server_name".to_string(), json!(host));
        }
        sb_ob.insert("tls".to_string(), json!(tls));
    } else {
        if let Some(Value::Object(tls)) = sb_ob.get_mut("tls") {
            if !tls.contains_key("enabled") {
                tls.insert("enabled".to_string(), json!(true));
            }
            if !tls.contains_key("server_name") && !host.is_empty() {
                tls.insert("server_name".to_string(), json!(host));
            }
        }
    }
}

fn convert_stream_settings(stream: &Value, sb_ob: &mut Map<String, Value>) {
    let security = stream.get("security").and_then(|s| s.as_str()).unwrap_or("none");
    let network = stream.get("network").and_then(|n| n.as_str()).unwrap_or("tcp");
    
    if security == "tls" || security == "reality" {
        let mut tls = Map::new();
        tls.insert("enabled".to_string(), json!(true));
        
        let settings = if security == "tls" {
            stream.get("tlsSettings")
        } else {
            stream.get("realitySettings")
        };
        
        if let Some(s) = settings {
            if let Some(sni) = s.get("serverName").and_then(|sn| sn.as_str()) {
                if !sni.is_empty() {
                    tls.insert("server_name".to_string(), json!(sanitize_sni(sni)));
                }
            }
            
            let insecure = s.get("allowInsecure").and_then(|a| a.as_bool())
                .or_else(|| s.get("insecure").and_then(|i| i.as_bool()))
                .or_else(|| s.get("skipCertVerify").and_then(|sv| sv.as_bool()))
                .unwrap_or(false);
            
            if insecure {
                tls.insert("insecure".to_string(), json!(true));
            }
            
            if let Some(pin) = s.get("pin").and_then(|p| p.as_str()) {
                if !pin.is_empty() {
                    let clean_pin = pin.chars().filter(|c| !c.is_whitespace()).collect::<String>();
                    let clean_pin = clean_pin.split("sha256/").last().unwrap_or(&clean_pin);
                    let clean_pin = clean_pin.split("SHA256:").last().unwrap_or(clean_pin);
                    
                    let is_hex = clean_pin.len() == 64 && clean_pin.chars().all(|c| c.is_ascii_hexdigit());
                    let final_pin = if is_hex {
                        match hex::decode(clean_pin) {
                            Ok(bytes) => STANDARD_NO_PAD.encode(&bytes),
                            Err(_) => clean_pin.to_string()
                        }
                    } else {
                        clean_pin.to_string()
                    };
                    

                    let mut final_pin_padded = final_pin.clone();
                    if let Ok(b) = STANDARD_NO_PAD.decode(&final_pin) {
                        final_pin_padded = base64::engine::general_purpose::STANDARD.encode(&b);
                    }
                    
                    tls.insert("certificate_public_key_sha256".to_string(), json!([final_pin_padded]));
                }
            }
            
            let mut alpn_arr = Vec::new();
            if let Some(alpn_raw) = s.get("alpn") {
                if let Some(arr) = alpn_raw.as_array() {
                    for v in arr {
                        if let Some(val) = v.as_str() {
                            if !val.is_empty() {
                                alpn_arr.push(val.to_string());
                            }
                        }
                    }
                } else if let Some(s_str) = alpn_raw.as_str() {
                    for part in s_str.split(',') {
                        let trimmed = part.trim();
                        if !trimmed.is_empty() {
                            alpn_arr.push(trimmed.to_string());
                        }
                    }
                }
            }
            if !alpn_arr.is_empty() {
                tls.insert("alpn".to_string(), json!(alpn_arr));
            }
            
            let proto_type = sb_ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if proto_type != "hysteria" && proto_type != "hysteria2" {
                let fp = s.get("fingerprint").and_then(|f| f.as_str()).unwrap_or("chrome");
                let fp = if fp == "random" { "chrome" } else { fp };
                tls.insert("utls".to_string(), json!({
                    "enabled": true,
                    "fingerprint": fp
                }));
            }
            
            if security == "reality" {
                let mut reality_obj = Map::new();
                reality_obj.insert("enabled".to_string(), json!(true));
                if let Some(pk) = s.get("publicKey").and_then(|p| p.as_str()) {
                    reality_obj.insert("public_key".to_string(), json!(pk));
                }
                let short_id = s.get("shortId").and_then(|sid| sid.as_str()).unwrap_or("");
                reality_obj.insert("short_id".to_string(), json!(short_id));
                tls.insert("reality".to_string(), json!(reality_obj));
            }
        }
        sb_ob.insert("tls".to_string(), json!(tls));
    }
    
    match network {
        "ws" => {
            if let Some(ws) = stream.get("wsSettings") {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("ws"));
                let path = ws.get("path").and_then(|p| p.as_str()).unwrap_or("/");
                trans.insert("path".to_string(), json!(path));
                if let Some(headers) = ws.get("headers") {
                    trans.insert("headers".to_string(), headers.clone());
                }
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "kcp" => {
            if let Some(kcp) = stream.get("kcpSettings") {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("kcp"));
                if let Some(seed) = kcp.get("seed").and_then(|s| s.as_str()) {
                    if !seed.is_empty() {
                        trans.insert("seed".to_string(), json!(seed));
                    }
                }
                if let Some(mtu) = kcp.get("mtu").and_then(|m| m.as_i64()) {
                    if mtu > 0 {
                        trans.insert("mtu".to_string(), json!(mtu));
                    }
                }
                if let Some(tti) = kcp.get("tti").and_then(|t| t.as_i64()) {
                    if tti > 0 {
                        trans.insert("tti".to_string(), json!(tti));
                    }
                }
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "quic" => {
            if let Some(quic) = stream.get("quicSettings") {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("quic"));
                if let Some(key) = quic.get("key").and_then(|k| k.as_str()) {
                    if !key.is_empty() {
                        trans.insert("key".to_string(), json!(key));
                    }
                }
                let sec = quic.get("security").and_then(|s| s.as_str()).unwrap_or("none");
                trans.insert("security".to_string(), json!(sec));
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "grpc" => {
            if let Some(grpc) = stream.get("grpcSettings") {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("grpc"));
                let sn = grpc.get("serviceName").and_then(|s| s.as_str()).unwrap_or("");
                trans.insert("service_name".to_string(), json!(sn));
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "xhttp" => {
            let settings = stream.get("xhttpSettings").or_else(|| stream.get("xhttp_settings"));
            if let Some(settings) = settings {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("xhttp"));
                let mode = settings.get("mode").and_then(|m| m.as_str()).unwrap_or("auto");
                trans.insert("mode".to_string(), json!(mode));
                let path = settings.get("path").and_then(|p| p.as_str()).unwrap_or("/");
                trans.insert("path".to_string(), json!(path));
                
                if let Some(headers) = settings.get("headers") {
                    trans.insert("headers".to_string(), headers.clone());
                }
                if let Some(extra) = settings.get("extra").and_then(|e| e.as_object()) {
                    for (k, v) in extra {
                        trans.insert(k.clone(), v.clone());
                    }
                }
                
                if let Some(host) = settings.get("host") {
                    if let Some(arr) = host.as_array() {
                        if !arr.is_empty() {
                            trans.insert("host".to_string(), arr[0].clone());
                        }
                    } else if let Some(s) = host.as_str() {
                        if !s.is_empty() {
                            trans.insert("host".to_string(), json!(s));
                        }
                    }
                }

                if let Some(Value::Object(ref mut hdrs)) = trans.get_mut("headers") {
                    let mut found_host = None;
                    if let Some(h) = hdrs.remove("Host").or_else(|| hdrs.remove("host")) {
                        if let Some(h_str) = h.as_str() {
                            if !h_str.is_empty() {
                                found_host = Some(h_str.to_string());
                            }
                        }
                    }
                    if !trans.contains_key("host") {
                        if let Some(fh) = found_host {
                            trans.insert("host".to_string(), json!(fh));
                        }
                    }
                }

                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "httpUpgrade" | "httpupgrade" => {
            let settings = stream.get("httpUpgradeSettings").or_else(|| stream.get("httpupgradeSettings"));
            if let Some(s) = settings {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("httpupgrade"));
                let path = s.get("path").and_then(|p| p.as_str()).unwrap_or("/");
                trans.insert("path".to_string(), json!(path));
                let host = s.get("host").and_then(|h| h.as_str()).unwrap_or("");
                trans.insert("host".to_string(), json!(host));
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        "h2" | "http" => {
            if let Some(s) = stream.get("httpSettings") {
                let mut trans = Map::new();
                trans.insert("type".to_string(), json!("http"));
                let path = s.get("path").and_then(|p| p.as_str()).unwrap_or("/");
                trans.insert("path".to_string(), json!(path));
                let host = s.get("host").and_then(|h| h.as_str()).unwrap_or("");
                trans.insert("host".to_string(), json!([host]));
                sb_ob.insert("transport".to_string(), json!(trans));
            }
        },
        _ => {}
    }
}

fn sanitize_sni(sni: &str) -> String {
    if sni.trim().is_empty() {
        return "".to_string();
    }
    let mut clean = sni.trim();
    if let Some(idx) = clean.find("://") {
        clean = &clean[idx + 3..];
    }
    if let Some(idx) = clean.find('/') {
        clean = &clean[..idx];
    }
    if let Some(idx) = clean.find(':') {
        clean = &clean[..idx];
    }
    clean.to_string()
}
