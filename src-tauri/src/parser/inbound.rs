use serde_json::{json, Map, Value};

pub fn create_tun_inbound(xray: &Value) -> Value {
    let mut mtu = 1500;
    let mut stack = "mixed".to_string();
    let mut ipv4_addr = "172.19.0.1/30".to_string();
    let mut ipv6_addr = String::new();

    if let Some(inbounds) = xray.get("inbounds").and_then(|i| i.as_array()) {
        for inb in inbounds {
            let inb_type = inb.get("type").and_then(|t| t.as_str())
                .or_else(|| inb.get("protocol").and_then(|p| p.as_str()))
                .unwrap_or("");
                
            if inb_type == "tun" {
                if let Some(src_mtu) = inb.get("mtu").and_then(|m| m.as_i64()) {
                    if src_mtu > 0 {
                        mtu = src_mtu;
                    }
                }
                
                if let Some(src_stack) = inb.get("stack").and_then(|s| s.as_str()) {
                    if !src_stack.is_empty() {
                        stack = src_stack.to_string();
                    }
                }
                
                if let Some(addr_field) = inb.get("address") {
                    if let Some(arr) = addr_field.as_array() {
                        if arr.len() >= 2 {
                            if let Some(a0) = arr[0].as_str() {
                                if !a0.is_empty() { ipv4_addr = a0.to_string(); }
                            }
                            if let Some(a1) = arr[1].as_str() {
                                if !a1.is_empty() { ipv6_addr = a1.to_string(); }
                            }
                        } else if arr.len() == 1 {
                            if let Some(a0) = arr[0].as_str() {
                                if !a0.is_empty() { ipv4_addr = a0.to_string(); }
                            }
                        }
                    } else if let Some(s) = addr_field.as_str() {
                        if !s.is_empty() {
                            ipv4_addr = s.to_string();
                        }
                    }
                }
            }
        }
    }
    
    let mut tun_inbound = Map::new();
    tun_inbound.insert("type".to_string(), json!("tun"));
    tun_inbound.insert("tag".to_string(), json!("tun-in"));
    
    let mut addresses = vec![json!(ipv4_addr)];
    if !ipv6_addr.is_empty() {
        addresses.push(json!(ipv6_addr));
    }
    tun_inbound.insert("address".to_string(), json!(addresses));
    tun_inbound.insert("mtu".to_string(), json!(mtu));
    tun_inbound.insert("auto_route".to_string(), json!(true));
    tun_inbound.insert("strict_route".to_string(), json!(true));
    tun_inbound.insert("stack".to_string(), json!(stack));
    
    Value::Object(tun_inbound)
}
