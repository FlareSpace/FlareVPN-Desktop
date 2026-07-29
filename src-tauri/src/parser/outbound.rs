use serde_json::{json, Map, Value};
use crate::parser::protocol::{
    convert_vless, convert_vmess, convert_trojan, convert_shadowsocks,
    convert_hysteria, convert_hysteria2, convert_socks, convert_http
};

pub fn convert_outbounds_public(xray_outbounds: &[Value]) -> Vec<Value> {
    convert_outbounds(xray_outbounds)
}

pub fn convert_outbounds(xray_outbounds: &[Value]) -> Vec<Value> {
    let mut sb_outbounds = Vec::new();
    let mut extra_outbounds = Vec::new();
    
    for xray_ob in xray_outbounds {
        let protocol = xray_ob.get("protocol").and_then(|p| p.as_str()).unwrap_or("").to_lowercase();
        let tag_fallback = format!("outbound-{}", sb_outbounds.len());
        let raw_tag = xray_ob.get("tag").and_then(|t| t.as_str()).unwrap_or(&tag_fallback);
        
        let tag = if raw_tag.eq_ignore_ascii_case("direct") {
            "direct"
        } else if raw_tag.eq_ignore_ascii_case("block") {
            "block"
        } else if raw_tag.eq_ignore_ascii_case("dns") {
            "dns"
        } else {
            raw_tag
        };
        
        let mut sb_ob = Map::new();
        sb_ob.insert("tag".to_string(), json!(tag));
        
        match protocol.as_str() {
            "vless" => convert_vless(xray_ob, &mut sb_ob),
            "vmess" => convert_vmess(xray_ob, &mut sb_ob),
            "trojan" => convert_trojan(xray_ob, &mut sb_ob),
            "shadowsocks" => convert_shadowsocks(xray_ob, &mut sb_ob, &mut extra_outbounds),
            "hysteria" | "hy" => {
                let settings = xray_ob.get("settings");
                let stream_settings = xray_ob.get("streamSettings");
                let hysteria_settings = stream_settings.and_then(|ss| ss.get("hysteriaSettings"));
                
                let is_version_2 = settings.and_then(|s| s.get("version")).and_then(|v| v.as_i64()).unwrap_or(1) == 2
                    || hysteria_settings.and_then(|s| s.get("version")).and_then(|v| v.as_i64()).unwrap_or(1) == 2;
                
                if is_version_2 {
                    convert_hysteria2(xray_ob, &mut sb_ob);
                } else {
                    convert_hysteria(xray_ob, &mut sb_ob);
                }
            },
            "hysteria2" | "hy2" => convert_hysteria2(xray_ob, &mut sb_ob),
            "freedom" => { sb_ob.insert("type".to_string(), json!("direct")); },
            "blackhole" => { sb_ob.insert("type".to_string(), json!("block")); },
            "socks" => convert_socks(xray_ob, &mut sb_ob),
            "http" => convert_http(xray_ob, &mut sb_ob),
            _ => continue,
        }
        
        if let Some(mux) = xray_ob.get("mux") {
            let flow = sb_ob.get("flow").and_then(|f| f.as_str()).unwrap_or("");
            let has_reality = sb_ob.get("tls").and_then(|t| t.get("reality")).is_some();
            let type_str = sb_ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
            
            let mux_enabled = mux.get("enabled").and_then(|e| e.as_bool()).unwrap_or(false);
            
            if mux_enabled && !flow.contains("vision") && !has_reality && type_str != "hysteria" && type_str != "hysteria2" {
                let mut mux_obj = Map::new();
                mux_obj.insert("enabled".to_string(), json!(true));
                mux_obj.insert("protocol".to_string(), json!("smux"));
                let conc = mux.get("concurrency").and_then(|c| c.as_i64()).unwrap_or(8);
                mux_obj.insert("max_connections".to_string(), json!(if conc <= 0 { 8 } else { conc }));
                mux_obj.insert("min_streams".to_string(), json!(4));
                mux_obj.insert("max_streams".to_string(), json!(64));
                sb_ob.insert("multiplex".to_string(), json!(mux_obj));
            }
        }
        
        if let Some(sockopt) = xray_ob.get("streamSettings").and_then(|s| s.get("sockopt")) {
            if let Some(proxy_tag) = sockopt.get("dialerProxy").and_then(|p| p.as_str()) {
                if !proxy_tag.is_empty() {
                    let norm_proxy_tag = if proxy_tag.eq_ignore_ascii_case("direct") {
                        "direct"
                    } else if proxy_tag.eq_ignore_ascii_case("block") {
                        "block"
                    } else if proxy_tag.eq_ignore_ascii_case("dns") {
                        "dns"
                    } else {
                        proxy_tag
                    };
                    sb_ob.insert("detour".to_string(), json!(norm_proxy_tag));
                }
            }
        }
        
        sb_outbounds.push(Value::Object(sb_ob));
    }
    
    sb_outbounds.extend(extra_outbounds);
    
    for ob_val in &mut sb_outbounds {
        if let Value::Object(ob) = ob_val {
            let server = ob.get("server").and_then(|s| s.as_str()).unwrap_or("");
            if !server.is_empty() && !is_ip_address(server) {
                ob.insert("domain_resolver".to_string(), json!("dns-direct"));
            }
        }
    }
    
    sb_outbounds
}

fn is_ip_address(host: &str) -> bool {
    if host.is_empty() {
        return false;
    }
    if host.contains(':') {
        return true;
    }
    let parts: Vec<&str> = host.split('.').collect();
    parts.len() == 4 && parts.iter().all(|p| p.parse::<u8>().is_ok())
}

pub fn has_outbound(obs: &[Value], type_str: &str) -> bool {
    obs.iter().any(|ob| ob.get("type").and_then(|t| t.as_str()).unwrap_or("") == type_str)
}

pub fn ensure_outbound(obs: &mut Vec<Value>, tag: &str) {
    if obs.iter().any(|ob| ob.get("tag").and_then(|t| t.as_str()).unwrap_or("") == tag) {
        return;
    }
    let type_str = if tag == "block" { "block" } else { "direct" };
    obs.push(json!({
        "type": type_str,
        "tag": tag
    }));
}

pub fn find_primary_proxy_tag(outbounds: &[Value]) -> String {
    let general_tags = ["proxy", "auto", "default", "main", "select", "selector", "urltest"];
    
    for ob in outbounds {
        let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if type_str == "urltest" || type_str == "selector" {
            if let Some(tag) = ob.get("tag").and_then(|t| t.as_str()) {
                if !tag.is_empty() && general_tags.iter().any(|g| g.eq_ignore_ascii_case(tag)) {
                    return tag.to_string();
                }
            }
        }
    }
    
    for ob in outbounds {
        if let Some(tag) = ob.get("tag").and_then(|t| t.as_str()) {
            if tag.eq_ignore_ascii_case("proxy") {
                return tag.to_string();
            }
        }
    }
    
    for ob in outbounds {
        let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if type_str == "urltest" || type_str == "selector" {
            if let Some(tag) = ob.get("tag").and_then(|t| t.as_str()) {
                if !tag.is_empty() {
                    return tag.to_string();
                }
            }
        }
    }
    
    for ob in outbounds {
        let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let tag = ob.get("tag").and_then(|t| t.as_str()).unwrap_or("");
        if !tag.is_empty() && type_str != "direct" && type_str != "block" && type_str != "dns" && type_str != "dns-out" {
            return tag.to_string();
        }
    }
    
    "proxy".to_string()
}
