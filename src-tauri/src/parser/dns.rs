use serde_json::{json, Map, Value};
use crate::parser::outbound::find_primary_proxy_tag;

pub fn fix_dns_remote_detour(obj: &mut Map<String, Value>) {
    let outbounds = match obj.get("outbounds").and_then(|o| o.as_array()) {
        Some(o) => o.clone(),
        None => return,
    };
    
    let has_proxy_outbound = outbounds.iter().any(|ob| ob.get("tag").and_then(|t| t.as_str()).unwrap_or("") == "proxy");
    if has_proxy_outbound {
        return;
    }
    
    let real_proxy_tag = find_primary_proxy_tag(&outbounds);
    if real_proxy_tag == "proxy" {
        return;
    }
    
    let dns = match obj.get_mut("dns").and_then(|d| d.as_object_mut()) {
        Some(d) => d,
        None => return,
    };
    
    if let Some(servers) = dns.get_mut("servers").and_then(|s| s.as_array_mut()) {
        for server in servers {
            if let Some(s) = server.as_object_mut() {
                if s.get("detour").and_then(|d| d.as_str()).unwrap_or("") == "proxy" {
                    s.insert("detour".to_string(), json!(real_proxy_tag));
                }
            }
        }
    }
}

pub fn parse_dns_address(address: &str) -> Map<String, Value> {
    let mut result = Map::new();
    let clean_addr = address.trim();
    
    let lower_addr = clean_addr.to_lowercase();
    if lower_addr.starts_with("https://") {
        result.insert("type".to_string(), json!("https"));
        let url = &clean_addr[8..];
        let slash_idx = url.find('/');
        let host_port = if let Some(idx) = slash_idx { &url[..idx] } else { url };
        let path = if let Some(idx) = slash_idx { &url[idx..] } else { "/dns-query" };
        
        parse_host_port(host_port, &mut result);
        result.insert("path".to_string(), json!(path));
    } else if lower_addr.starts_with("tls://") {
        result.insert("type".to_string(), json!("tls"));
        parse_host_port(&clean_addr[6..], &mut result);
    } else if lower_addr.starts_with("tcp://") {
        result.insert("type".to_string(), json!("tcp"));
        parse_host_port(&clean_addr[6..], &mut result);
    } else if lower_addr.starts_with("quic://") {
        result.insert("type".to_string(), json!("quic"));
        parse_host_port(&clean_addr[7..], &mut result);
    } else if lower_addr.starts_with("h3://") {
        result.insert("type".to_string(), json!("h3"));
        let url = &clean_addr[5..];
        let slash_idx = url.find('/');
        let host_port = if let Some(idx) = slash_idx { &url[..idx] } else { url };
        let path = if let Some(idx) = slash_idx { &url[idx..] } else { "/dns-query" };
        
        parse_host_port(host_port, &mut result);
        result.insert("path".to_string(), json!(path));
    } else if lower_addr.starts_with("rcode://") {
        result.insert("address".to_string(), json!(clean_addr));
    } else if lower_addr == "local" {
        result.insert("type".to_string(), json!("local"));
    } else {
        result.insert("type".to_string(), json!("udp"));
        parse_host_port(clean_addr, &mut result);
    }
    
    result
}

fn parse_host_port(host_port: &str, result: &mut Map<String, Value>) {
    let colon_idx = host_port.rfind(':');
    let ipv6_bracket = host_port.starts_with('[') && host_port.contains(']');
    
    let host = if ipv6_bracket {
        let end_bracket = host_port.find(']').unwrap();
        &host_port[1..end_bracket]
    } else if let Some(idx) = colon_idx {
        if host_port[idx + 1..].find(':').is_none() {
            &host_port[..idx]
        } else {
            host_port
        }
    } else {
        host_port
    };
    
    let port = if ipv6_bracket {
        let end_bracket = host_port.find(']').unwrap();
        let after = &host_port[end_bracket + 1..];
        if after.starts_with(':') {
            after[1..].parse::<i64>().ok()
        } else {
            None
        }
    } else if let Some(idx) = colon_idx {
        let bracket_idx = host_port.find('[');
        if bracket_idx.is_none() || idx > bracket_idx.unwrap() {
            host_port[idx + 1..].parse::<i64>().ok()
        } else {
            None
        }
    } else {
        None
    };
    
    result.insert("server".to_string(), json!(host));
    if let Some(p) = port {
        result.insert("server_port".to_string(), json!(p));
    }
}

fn is_ip_address(host: &str) -> bool {
    if host.is_empty() { return false; }
    if host.contains(':') { return true; }
    let parts: Vec<&str> = host.split('.').collect();
    parts.len() == 4 && parts.iter().all(|p| p.parse::<u8>().is_ok())
}

pub fn migrate_dns_server_object(server_obj: &mut Map<String, Value>) -> Value {
    if let Some(port) = server_obj.remove("port") {
        server_obj.insert("server_port".to_string(), port);
    }
    if let Some(ar) = server_obj.remove("address_resolver") {
        server_obj.insert("domain_resolver".to_string(), ar);
    }
    
    if server_obj.get("detour").and_then(|d| d.as_str()).unwrap_or("") == "direct" {
        server_obj.remove("detour");
    }
    
    let address = server_obj.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string();
    if address.to_lowercase().starts_with("rcode://") {
        return Value::Object(server_obj.clone());
    }
    
    if server_obj.contains_key("type") && server_obj.contains_key("server") {
        server_obj.remove("address");
        return Value::Object(server_obj.clone());
    }
    
    if address.is_empty() {
        return Value::Object(server_obj.clone());
    }
    
    let parsed = parse_dns_address(&address);
    for (k, v) in parsed {
        if !server_obj.contains_key(&k) {
            server_obj.insert(k, v);
        }
    }
    server_obj.remove("address");
    
    let parsed_server = server_obj.get("server").and_then(|s| s.as_str()).unwrap_or("").to_string();
    if parsed_server.eq_ignore_ascii_case("localhost") {
        server_obj.insert("server".to_string(), json!("127.0.0.1"));
    } else if !parsed_server.is_empty() && !is_ip_address(&parsed_server) && !server_obj.contains_key("domain_resolver") {
        let tag = server_obj.get("tag").and_then(|t| t.as_str()).unwrap_or("");
        if tag != "dns-direct" {
            server_obj.insert("domain_resolver".to_string(), json!("dns-direct"));
        }
    }
    
    Value::Object(server_obj.clone())
}

pub fn migrate_dns_server(server: &Value) -> Option<Value> {
    match server {
        Value::Object(obj) => {
            let mut o = obj.clone();
            Some(migrate_dns_server_object(&mut o))
        },
        Value::String(s) => {
            if s.to_lowercase().starts_with("rcode://") {
                Some(json!({ "address": s }))
            } else {
                Some(Value::Object(parse_dns_address(s)))
            }
        },
        _ => None
    }
}
