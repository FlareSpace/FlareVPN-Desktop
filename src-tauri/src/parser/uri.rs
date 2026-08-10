use serde_json::{json, Map, Value};
use url::Url;
use std::collections::HashMap;
use base64::{Engine as _, engine::general_purpose};

pub fn parse_single_uri_to_xray(uri_str: &str) -> Result<Value, String> {
    let clean_uri = uri_str.trim();
    if clean_uri.starts_with("vless://") {
        return parse_vless(clean_uri);
    } else if clean_uri.starts_with("vmess://") {
        return parse_vmess(clean_uri);
    } else if clean_uri.starts_with("trojan://") {
        return parse_trojan(clean_uri);
    } else if clean_uri.starts_with("ss://") || clean_uri.starts_with("shadowsocks://") {
        return parse_shadowsocks(clean_uri);
    } else if clean_uri.starts_with("hysteria://") || clean_uri.starts_with("hy://") {
        return parse_hysteria(clean_uri);
    } else if clean_uri.starts_with("hysteria2://") || clean_uri.starts_with("hy2://") {
        return parse_hysteria2(clean_uri);
    } else if clean_uri.starts_with("wireguard://") || clean_uri.starts_with("wg://") {
        return parse_wireguard(clean_uri);
    } else if clean_uri.starts_with("tuic://") {
        return parse_tuic(clean_uri);
    }

    Err("Unsupported protocol URI".to_string())
}

fn parse_query(query: Option<&str>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Some(q) = query {
        for pair in q.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                let decoded_v = url::form_urlencoded::parse(v.as_bytes()).map(|(k, _)| k.to_string()).collect::<Vec<_>>().join("");
                map.insert(k.to_string(), decoded_v);
            }
        }
    }
    map
}

fn build_stream_settings(host: &str, params: &HashMap<String, String>) -> Value {
    let mut stream = Map::new();
    let net = params.get("type").map(|s| s.as_str()).unwrap_or("tcp");
    stream.insert("network".to_string(), json!(net));
    
    let security = params.get("security").map(|s| s.as_str()).unwrap_or("none");
    if security != "none" && !security.is_empty() {
        stream.insert("security".to_string(), json!(security));
    }
    
    if security == "tls" {
        let mut tls_settings = Map::new();
        let sni = params.get("sni").or_else(|| params.get("peer")).map(|s| s.as_str()).unwrap_or("");
        if !sni.is_empty() { tls_settings.insert("serverName".to_string(), json!(sni)); }
        else { tls_settings.insert("serverName".to_string(), json!(host)); }
        
        if let Some(alpn) = params.get("alpn") {
            let alpn_arr: Vec<&str> = alpn.split(',').collect();
            tls_settings.insert("alpn".to_string(), json!(alpn_arr));
        }
        if let Some(fp) = params.get("fp") {
            tls_settings.insert("fingerprint".to_string(), json!(fp));
        }
        stream.insert("tlsSettings".to_string(), Value::Object(tls_settings));
    } else if security == "reality" {
        let mut reality_settings = Map::new();
        let sni = params.get("sni").or_else(|| params.get("peer")).map(|s| s.as_str()).unwrap_or("");
        if !sni.is_empty() { reality_settings.insert("serverName".to_string(), json!(sni)); }
        else { reality_settings.insert("serverName".to_string(), json!(host)); }
        
        if let Some(pbk) = params.get("pbk") { reality_settings.insert("publicKey".to_string(), json!(pbk)); }
        if let Some(sid) = params.get("sid") { reality_settings.insert("shortId".to_string(), json!(sid)); }
        if let Some(fp) = params.get("fp") { reality_settings.insert("fingerprint".to_string(), json!(fp)); }
        stream.insert("realitySettings".to_string(), Value::Object(reality_settings));
    }
    
    match net {
        "ws" => {
            let mut ws_settings = Map::new();
            if let Some(path) = params.get("path") { ws_settings.insert("path".to_string(), json!(path)); }
            if let Some(host_val) = params.get("host") {
                ws_settings.insert("headers".to_string(), json!({"Host": host_val}));
            }
            stream.insert("wsSettings".to_string(), Value::Object(ws_settings));
        }
        "grpc" => {
            let mut grpc_settings = Map::new();
            if let Some(svc) = params.get("serviceName") {
                grpc_settings.insert("serviceName".to_string(), json!(svc));
            }
            stream.insert("grpcSettings".to_string(), Value::Object(grpc_settings));
        }
        "xhttp" => {
            let mut xhttp_settings = Map::new();
            let path = params.get("path").map(|s| s.as_str()).unwrap_or("/");
            xhttp_settings.insert("path".to_string(), json!(path));
            if let Some(host_val) = params.get("host") {
                if !host_val.is_empty() {
                    xhttp_settings.insert("host".to_string(), json!(host_val));
                }
            }
            let mode_val = params.get("mode").map(|s| s.as_str()).unwrap_or("auto");
            xhttp_settings.insert("mode".to_string(), json!(mode_val));
            if let Some(extra) = params.get("extra") {
                if let Ok(extra_val) = serde_json::from_str::<Value>(extra) {
                    xhttp_settings.insert("extra".to_string(), extra_val);
                }
            }
            stream.insert("xhttpSettings".to_string(), Value::Object(xhttp_settings));
        }
        "httpupgrade" | "httpUpgrade" => {
            let mut hu_settings = Map::new();
            let path = params.get("path").map(|s| s.as_str()).unwrap_or("/");
            hu_settings.insert("path".to_string(), json!(path));
            if let Some(host_val) = params.get("host") {
                if !host_val.is_empty() {
                    hu_settings.insert("host".to_string(), json!(host_val));
                }
            }
            stream.insert("httpUpgradeSettings".to_string(), Value::Object(hu_settings));
        }
        "h2" | "http" => {
            let mut http_settings = Map::new();
            let path = params.get("path").map(|s| s.as_str()).unwrap_or("/");
            http_settings.insert("path".to_string(), json!(path));
            if let Some(host_val) = params.get("host") {
                if !host_val.is_empty() {
                    http_settings.insert("host".to_string(), json!(host_val));
                }
            }
            stream.insert("httpSettings".to_string(), Value::Object(http_settings));
        }
        "kcp" => {
            let mut kcp_settings = Map::new();
            if let Some(seed) = params.get("seed").or_else(|| params.get("kcpSeed")) {
                kcp_settings.insert("seed".to_string(), json!(seed));
            }
            let mtu = params.get("mtu").and_then(|m| m.parse::<i64>().ok()).unwrap_or(1350);
            kcp_settings.insert("mtu".to_string(), json!(mtu));
            let tti = params.get("tti").and_then(|t| t.parse::<i64>().ok()).unwrap_or(50);
            kcp_settings.insert("tti".to_string(), json!(tti));
            stream.insert("kcpSettings".to_string(), Value::Object(kcp_settings));
        }
        "quic" => {
            let mut quic_settings = Map::new();
            let sec = params.get("quicSecurity").or_else(|| params.get("security")).map(|s| s.as_str()).unwrap_or("none");
            quic_settings.insert("security".to_string(), json!(sec));
            if let Some(key) = params.get("key").or_else(|| params.get("quicKey")) {
                quic_settings.insert("key".to_string(), json!(key));
            }
            stream.insert("quicSettings".to_string(), Value::Object(quic_settings));
        }
        _ => {}
    }
    
    Value::Object(stream)
}

fn parse_vless(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("vless"));
    ob.insert("tag".to_string(), json!("proxy"));
    
    if let Some(pe) = params.get("packetEncoding").or_else(|| params.get("packet_encoding")) {
        ob.insert("packet_encoding".to_string(), json!(pe));
    }
    
    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(443);
    let uuid = parsed.username();
    
    let flow = params.get("flow").unwrap_or(&"".to_string()).clone();
    let flow_val = if flow != "null" && !flow.is_empty() { flow } else { "".to_string() };
    
    ob.insert("settings".to_string(), json!({
        "vnext": [{
            "address": host,
            "port": port,
            "users": [{
                "id": uuid,
                "flow": flow_val,
                "encryption": "none"
            }]
        }]
    }));
    
    ob.insert("streamSettings".to_string(), build_stream_settings(host, &params));
    
    Ok(Value::Object(ob))
}

fn parse_vmess(uri_str: &str) -> Result<Value, String> {
    let b64 = uri_str.trim_start_matches("vmess://").trim();
    let decoded = general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string())?;
    let json_str = String::from_utf8(decoded).map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    
    let add = json.get("add").and_then(|a| a.as_str()).unwrap_or("");
    let port = json.get("port").and_then(|p| p.as_u64()).or_else(|| json.get("port").and_then(|p| p.as_str().and_then(|s| s.parse().ok()))).unwrap_or(443);
    let id = json.get("id").and_then(|i| i.as_str()).unwrap_or("");
    let aid = json.get("aid").and_then(|a| a.as_u64()).or_else(|| json.get("aid").and_then(|a| a.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0);
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("vmess"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("settings".to_string(), json!({
        "vnext": [{
            "address": add,
            "port": port,
            "users": [{
                "id": id,
                "alterId": aid,
                "security": "auto"
            }]
        }]
    }));
    
    let mut params = HashMap::new();
    params.insert("security".to_string(), json.get("tls").and_then(|v| v.as_str()).unwrap_or("none").to_string());
    params.insert("type".to_string(), json.get("net").and_then(|v| v.as_str()).unwrap_or("tcp").to_string());
    if let Some(path) = json.get("path").and_then(|v| v.as_str()) { params.insert("path".to_string(), path.to_string()); }
    if let Some(host) = json.get("host").and_then(|v| v.as_str()) { params.insert("host".to_string(), host.to_string()); }
    if let Some(sni) = json.get("sni").and_then(|v| v.as_str()) { params.insert("sni".to_string(), sni.to_string()); }
    
    ob.insert("streamSettings".to_string(), build_stream_settings(add, &params));
    
    Ok(Value::Object(ob))
}

fn parse_trojan(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());
    
    let pw = parsed.username();
    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(443);
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("trojan"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("settings".to_string(), json!({
        "servers": [{
            "address": host,
            "port": port,
            "password": pw
        }]
    }));
    
    let mut stream_params = params.clone();
    if !stream_params.contains_key("security") {
        stream_params.insert("security".to_string(), "tls".to_string());
    }
    ob.insert("streamSettings".to_string(), build_stream_settings(host, &stream_params));
    
    Ok(Value::Object(ob))
}

fn parse_shadowsocks(uri_str: &str) -> Result<Value, String> {
    let clean = uri_str.trim();
    let scheme_prefix = if clean.to_lowercase().starts_with("shadowsocks://") { "shadowsocks://" } else { "ss://" };
    
    let main_part = &clean[scheme_prefix.len()..];
    let main_part = main_part.split('#').next().unwrap_or(main_part);
    let url_part = main_part.split('?').next().unwrap_or(main_part);
    
    let mut decoded_main = String::new();
    let normalized_b64 = url_part.replace("-", "+").replace("_", "/");
    let padded = match normalized_b64.len() % 4 {
        2 => format!("{}==", normalized_b64),
        3 => format!("{}=", normalized_b64),
        _ => normalized_b64.clone()
    };
    if let Ok(bytes) = general_purpose::STANDARD.decode(&padded) {
        if let Ok(s) = String::from_utf8(bytes) {
            decoded_main = s;
        }
    }
    
    let mut method = String::new();
    let mut password = String::new();
    let mut host = String::new();
    let mut port = 8388;
    
    if decoded_main.contains('@') && decoded_main.contains(':') {
        if let Some((method_pw, host_pt)) = decoded_main.rsplit_once('@') {
            if let Some((m, pw)) = method_pw.split_once(':') {
                method = m.to_string();
                password = pw.to_string();
            }
            if let Some((h, pt)) = host_pt.rsplit_once(':') {
                host = h.to_string();
                port = pt.parse().unwrap_or(8388);
            } else {
                host = host_pt.to_string();
            }
        }
    } else {
        if let Some((authority, host_pt)) = url_part.rsplit_once('@') {
            let mut decoded_auth = authority.to_string();
            if !authority.contains(':') {
                let norm = authority.replace("-", "+").replace("_", "/");
                let pad = match norm.len() % 4 {
                    2 => format!("{}==", norm),
                    3 => format!("{}=", norm),
                    _ => norm.clone()
                };
                if let Ok(bytes) = general_purpose::STANDARD.decode(&pad) {
                    if let Ok(s) = String::from_utf8(bytes) {
                        decoded_auth = s;
                    }
                }
            }
            if let Some((m, pw)) = decoded_auth.split_once(':') {
                method = m.to_string();
                password = pw.to_string();
            }
            if let Some((h, pt)) = host_pt.rsplit_once(':') {
                host = h.to_string();
                port = pt.parse().unwrap_or(8388);
            } else {
                host = host_pt.to_string();
            }
        }
    }
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("shadowsocks"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("settings".to_string(), json!({
        "servers": [{
            "address": host,
            "port": port,
            "method": method,
            "password": password
        }]
    }));
    Ok(Value::Object(ob))
}

fn parse_hysteria(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());
    
    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(443);
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("hysteria"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("server".to_string(), json!(host));
    ob.insert("server_port".to_string(), json!(port));
    
    if let Some(auth) = params.get("auth") { ob.insert("auth_str".to_string(), json!(auth)); }
    if let Some(up) = params.get("upmbps") { ob.insert("up_mbps".to_string(), json!(up.parse::<i32>().unwrap_or(0))); }
    if let Some(down) = params.get("downmbps") { ob.insert("down_mbps".to_string(), json!(down.parse::<i32>().unwrap_or(0))); }
    if let Some(sni) = params.get("peer").or_else(|| params.get("sni")) { ob.insert("server_name".to_string(), json!(sni)); }
    if let Some(alpn) = params.get("alpn") { ob.insert("alpn".to_string(), json!(alpn)); }
    
    Ok(Value::Object(ob))
}

fn parse_hysteria2(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());
    
    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(443);
    let pw = parsed.username();
    
    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("hysteria2"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("server".to_string(), json!(host));
    ob.insert("server_port".to_string(), json!(port));
    ob.insert("password".to_string(), json!(pw));
    
    if let Some(sni) = params.get("sni").or_else(|| params.get("peer")) { ob.insert("server_name".to_string(), json!(sni)); }
    
    Ok(Value::Object(ob))
}

fn parse_tuic(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());

    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(8443);
    let uuid = parsed.username().to_string();
    let password = parsed.password().unwrap_or(params.get("password").map(|s| s.as_str()).unwrap_or("")).to_string();

    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("tuic"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("server".to_string(), json!(host));
    ob.insert("server_port".to_string(), json!(port));
    ob.insert("uuid".to_string(), json!(uuid));
    ob.insert("password".to_string(), json!(password));

    if let Some(cc) = params.get("congestion_control").or_else(|| params.get("congestion-control")) {
        ob.insert("congestion_control".to_string(), json!(cc));
    }
    if let Some(urm) = params.get("udp_relay_mode").or_else(|| params.get("udp-relay-mode")) {
        ob.insert("udp_relay_mode".to_string(), json!(urm));
    }

    let mut stream_params = params.clone();
    if !stream_params.contains_key("security") {
        stream_params.insert("security".to_string(), "tls".to_string());
    }
    ob.insert("streamSettings".to_string(), build_stream_settings(host, &stream_params));

    Ok(Value::Object(ob))
}

fn parse_wireguard(uri_str: &str) -> Result<Value, String> {
    let parsed = Url::parse(uri_str).map_err(|e| e.to_string())?;
    let params = parse_query(parsed.query());

    let private_key = url::form_urlencoded::parse(parsed.username().as_bytes()).map(|(k, _)| k.to_string()).collect::<Vec<_>>().join("");
    let host = parsed.host_str().unwrap_or("");
    let port = parsed.port().unwrap_or(51820);

    let public_key = params.get("publickey")
        .or_else(|| params.get("public-key"))
        .or_else(|| params.get("peer_public_key"))
        .or_else(|| params.get("peer-public-key"))
        .cloned()
        .unwrap_or_default();

    let local_address = params.get("address")
        .or_else(|| params.get("local_address"))
        .or_else(|| params.get("local-address"))
        .cloned()
        .unwrap_or_else(|| "10.7.0.2/32".to_string());

    let mut ob = Map::new();
    ob.insert("protocol".to_string(), json!("wireguard"));
    ob.insert("tag".to_string(), json!("proxy"));
    ob.insert("server".to_string(), json!(host));
    ob.insert("server_port".to_string(), json!(port));
    ob.insert("private_key".to_string(), json!(private_key));
    ob.insert("public_key".to_string(), json!(public_key));
    ob.insert("local_address".to_string(), json!(local_address));

    if let Some(psk) = params.get("presharedkey").or_else(|| params.get("pre_shared_key")) {
        ob.insert("pre_shared_key".to_string(), json!(psk));
    }
    if let Some(mtu) = params.get("mtu").and_then(|m| m.parse::<i64>().ok()) {
        ob.insert("mtu".to_string(), json!(mtu));
    }

    Ok(Value::Object(ob))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::protocol::convert_vless;

    #[test]
    fn test_parse_vless_xhttp() {
        let uri = "vless://11111111-1111-1111-1111-111111111111@example.com:443?type=xhttp&security=tls&path=%2Ftestpath&host=example.com&mode=auto#XHTTP-Test";
        let xray_ob = parse_single_uri_to_xray(uri).expect("Should parse vless xhttp uri");
        
        let stream_settings = xray_ob.get("streamSettings").expect("Should have streamSettings");
        assert_eq!(stream_settings.get("network").and_then(|n| n.as_str()), Some("xhttp"));
        
        let xhttp_settings = stream_settings.get("xhttpSettings").expect("Should have xhttpSettings");
        assert_eq!(xhttp_settings.get("path").and_then(|p| p.as_str()), Some("/testpath"));
        assert_eq!(xhttp_settings.get("host").and_then(|h| h.as_str()), Some("example.com"));

        let mut sb_ob = serde_json::Map::new();
        convert_vless(&xray_ob, &mut sb_ob);

        let transport = sb_ob.get("transport").expect("Should have transport in sing-box outbound");
        assert_eq!(transport.get("type").and_then(|t| t.as_str()), Some("xhttp"));
        assert_eq!(transport.get("mode").and_then(|m| m.as_str()), Some("auto"));
        assert_eq!(transport.get("path").and_then(|p| p.as_str()), Some("/testpath"));
        assert_eq!(transport.get("host").and_then(|h| h.as_str()), Some("example.com"));
    }
}
