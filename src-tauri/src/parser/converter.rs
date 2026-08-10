use serde_json::{json, Map, Value};
use std::collections::{HashSet, HashMap};

use crate::parser::outbound::{
    convert_outbounds,
    ensure_outbound,
    find_primary_proxy_tag
};
use crate::parser::inbound::create_tun_inbound;
use crate::parser::dns::migrate_dns_server_object;

pub fn convert_if_needed(json_str: &str, is_doh_enabled: bool) -> Result<String, String> {
    let trimmed = json_str.trim();
    if let Ok(mut v) = serde_json::from_str::<Value>(trimmed) {
        if is_sing_box_format(&v) {

            return Ok(serde_json::to_string_pretty(&v).unwrap());
        } else if is_v2ray_format(&v) {
            return convert_v2ray_to_singbox(&mut v, is_doh_enabled);
        } else {
            return Ok(trimmed.to_string());
        }
    }
    Ok(trimmed.to_string())
}

fn is_sing_box_format(v: &Value) -> bool {
    if let Some(outbounds) = v.get("outbounds").and_then(|o| o.as_array()) {
        if let Some(first) = outbounds.first() {
            if first.get("type").is_some() {
                return true;
            }
        }
    }
    v.get("route").is_some() && v.get("routing").is_none()
}

fn is_v2ray_format(v: &Value) -> bool {
    if let Some(outbounds) = v.get("outbounds").and_then(|o| o.as_array()) {
        if let Some(first) = outbounds.first() {
            if first.get("protocol").is_some() {
                return true;
            }
        }
    }
    v.get("routing").is_some() || v.get("outbounds").is_some()
}

pub fn convert_v2ray_to_singbox(xray: &mut Value, is_doh_enabled: bool) -> Result<String, String> {
    let mut sb = Map::new();
    
    sb.insert("log".to_string(), json!({
        "level": "info",
        "timestamp": true
    }));
    
    let xray_outbounds = xray.get("outbounds").and_then(|o| o.as_array()).cloned().unwrap_or_default();
    let mut sb_outbounds = convert_outbounds(&xray_outbounds);
    
    ensure_outbound(&mut sb_outbounds, "direct");
    ensure_outbound(&mut sb_outbounds, "block");
    
    let mut proxy_domains_set = HashSet::new();
    proxy_domains_set.insert("raw.githubusercontent.com".to_string());
    
    for ob in &sb_outbounds {
        let type_str = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if type_str == "direct" || type_str == "block" { continue; }
        
        let server = ob.get("server").and_then(|s| s.as_str()).unwrap_or("");
        if !server.is_empty() {
            if !server.chars().next().unwrap().is_ascii_digit() {
                proxy_domains_set.insert(server.to_string());
            }
        }
    }
    
    let mut proxy_domains = Vec::new();
    for d in proxy_domains_set {
        proxy_domains.push(d);
    }
    
    let xray_routing = xray.get("routing");
    let xray_rules = xray_routing.and_then(|r| r.get("rules")).and_then(|r| r.as_array());
    let mut routing_rules_objects = Vec::new();
    let mut required_rule_sets = HashSet::new();
    let mut direct_rule_sets = HashSet::new();
    let mut direct_domains = Vec::new();
    
    let xray_balancers = xray_routing.and_then(|r| r.get("balancers")).and_then(|r| r.as_array());
    let mut balancer_tags = HashMap::new();
    let mut first_balancer_tag = String::new();
    
    if let Some(balancers) = xray_balancers {
        for b in balancers {
            let b_tag = b.get("tag").and_then(|t| t.as_str()).unwrap_or("");
            if b_tag.is_empty() { continue; }
            
            let mut matched_outbounds = HashSet::new();
            if let Some(selectors) = b.get("selector").and_then(|s| s.as_array()) {
                for sel_val in selectors {
                    let sel = sel_val.as_str().unwrap_or("");
                    if sel.is_empty() { continue; }
                    
                    for ob in &sb_outbounds {
                        let ob_tag = ob.get("tag").and_then(|t| t.as_str()).unwrap_or("");
                        if ob_tag.contains(sel) {
                            matched_outbounds.insert(ob_tag.to_string());
                        }
                    }
                }
            }
            
            if !matched_outbounds.is_empty() {
                let mut final_b_tag = b_tag.to_string();
                for ob in &sb_outbounds {
                    if ob.get("tag").and_then(|t| t.as_str()).unwrap_or("") == final_b_tag {
                        final_b_tag = format!("{}-urltest", b_tag);
                        break;
                    }
                }
                
                let mut urltest_ob = Map::new();
                urltest_ob.insert("type".to_string(), json!("urltest"));
                urltest_ob.insert("tag".to_string(), json!(final_b_tag));
                
                let mut out_arr = Vec::new();
                for mo in &matched_outbounds {
                    out_arr.push(json!(mo));
                }
                urltest_ob.insert("outbounds".to_string(), json!(out_arr));
                urltest_ob.insert("url".to_string(), json!("http://www.gstatic.com/generate_204"));
                urltest_ob.insert("interval".to_string(), json!("3m"));
                urltest_ob.insert("tolerance".to_string(), json!(50));
                
                sb_outbounds.push(Value::Object(urltest_ob));
                balancer_tags.insert(b_tag.to_string(), final_b_tag.clone());
                if first_balancer_tag.is_empty() {
                    first_balancer_tag = final_b_tag;
                }
            }
        }
    }
    
    if let Some(rules) = xray_rules {
        for x_rule in rules {
            let outbound_tag = x_rule.get("outboundTag").and_then(|o| o.as_str())
                .or_else(|| x_rule.get("outbound").and_then(|o| o.as_str()))
                .unwrap_or("");
            
            let balancer_tag = x_rule.get("balancerTag").and_then(|b| b.as_str()).unwrap_or("");
            
            let raw_actual_out_tag = if !balancer_tag.is_empty() && balancer_tags.contains_key(balancer_tag) {
                balancer_tags.get(balancer_tag).unwrap().as_str()
            } else if !balancer_tag.is_empty() {
                balancer_tag
            } else {
                outbound_tag
            };
            
            if raw_actual_out_tag.is_empty() { continue; }
            
            let actual_out_tag = if raw_actual_out_tag.eq_ignore_ascii_case("direct") {
                "direct"
            } else if raw_actual_out_tag.eq_ignore_ascii_case("block") {
                "block"
            } else if raw_actual_out_tag.eq_ignore_ascii_case("dns") {
                "dns"
            } else {
                raw_actual_out_tag
            };
            
            let mut sb_rule = Map::new();
            let mut has_content = false;
            
            if let Some(domains) = x_rule.get("domain").and_then(|d| d.as_array()) {
                if !domains.is_empty() {
                    let mut domain_suffixes = Vec::new();
                    let mut domain_exact = Vec::new();
                    let mut domain_regex = Vec::new();
                    let mut domain_keywords = Vec::new();
                    
                    for d_val in domains {
                        let d = d_val.as_str().unwrap_or("");
                        if d.starts_with("geosite:") {
                            let gs = &d[8..];
                            if gs == "category-ru" || gs == "ru" {
                                required_rule_sets.insert("geosite-ru".to_string());
                                routing_rules_objects.push(json!({
                                    "rule_set": "geosite-ru",
                                    "outbound": actual_out_tag
                                }));
                                if actual_out_tag == "direct" || actual_out_tag == "block" {
                                    direct_rule_sets.insert("geosite-ru".to_string());
                                }
                            }
                        } else if d.starts_with("domain:") {
                            let dom = &d[7..];
                            if !dom.is_empty() {
                                domain_suffixes.push(dom.to_string());
                                if actual_out_tag == "direct" || actual_out_tag == "block" {
                                    direct_domains.push(dom.to_string());
                                }
                            }
                        } else if d.starts_with("full:") {
                            let dom = &d[5..];
                            if !dom.is_empty() {
                                domain_exact.push(dom.to_string());
                            }
                        } else if d.starts_with("regexp:") {
                            let dom = &d[7..];
                            if !dom.is_empty() {
                                domain_regex.push(dom.to_string());
                            }
                        } else if d.starts_with("keyword:") {
                            let dom = &d[8..];
                            if !dom.is_empty() {
                                domain_keywords.push(dom.to_string());
                            }
                        } else if !d.is_empty() {
                            domain_suffixes.push(d.to_string());
                            if actual_out_tag == "direct" || actual_out_tag == "block" {
                                direct_domains.push(d.to_string());
                            }
                        }
                    }
                    
                    if !domain_suffixes.is_empty() { sb_rule.insert("domain_suffix".to_string(), json!(domain_suffixes)); has_content = true; }
                    if !domain_exact.is_empty() { sb_rule.insert("domain".to_string(), json!(domain_exact)); has_content = true; }
                    if !domain_regex.is_empty() { sb_rule.insert("domain_regex".to_string(), json!(domain_regex)); has_content = true; }
                    if !domain_keywords.is_empty() { sb_rule.insert("domain_keyword".to_string(), json!(domain_keywords)); has_content = true; }
                }
            }
            
            if let Some(ips) = x_rule.get("ip").and_then(|i| i.as_array()) {
                if !ips.is_empty() {
                    let mut raw_ips = Vec::new();
                    let mut has_private = false;
                    for ip_val in ips {
                        let ip = ip_val.as_str().unwrap_or("");
                        if ip == "geoip:private" {
                            has_private = true;
                        } else if ip.starts_with("geoip:") {
                            let gi = &ip[6..];
                            if gi == "ru" {
                                required_rule_sets.insert("geoip-ru".to_string());
                                routing_rules_objects.push(json!({
                                    "rule_set": "geoip-ru",
                                    "outbound": actual_out_tag
                                }));
                            }
                        } else if !ip.is_empty() {
                            raw_ips.push(ip.to_string());
                        }
                    }
                    if has_private { sb_rule.insert("ip_is_private".to_string(), json!(true)); has_content = true; }
                    if !raw_ips.is_empty() { sb_rule.insert("ip_cidr".to_string(), json!(raw_ips)); has_content = true; }
                }
            }
            
            let port = x_rule.get("port").and_then(|p| p.as_str()).unwrap_or("");
            if !port.is_empty() {
                let mut port_ints = Vec::new();
                let mut port_ranges = Vec::new();
                for p in port.split(',') {
                    let pt = p.trim();
                    if pt.is_empty() { continue; }
                    if pt.contains('-') {
                        port_ranges.push(pt.to_string());
                    } else if let Ok(pi) = pt.parse::<i32>() {
                        port_ints.push(pi);
                    }
                }
                if !port_ints.is_empty() { sb_rule.insert("port".to_string(), json!(port_ints)); has_content = true; }
                if !port_ranges.is_empty() { sb_rule.insert("port_range".to_string(), json!(port_ranges)); has_content = true; }
            }
            
            let network = x_rule.get("network").and_then(|n| n.as_str()).unwrap_or("");
            if !network.is_empty() {
                if network.contains(',') {
                    let nets: Vec<&str> = network.split(',').map(|n| n.trim()).collect();
                    sb_rule.insert("network".to_string(), json!(nets));
                } else {
                    sb_rule.insert("network".to_string(), json!(network.trim()));
                }
                has_content = true;
            }
            
            let protocol = x_rule.get("protocol").and_then(|p| p.as_str()).unwrap_or("");
            if !protocol.is_empty() {
                let p_trim = protocol.trim();
                if p_trim.starts_with('[') {
                    if let Ok(v) = serde_json::from_str::<Value>(p_trim) {
                        sb_rule.insert("protocol".to_string(), v);
                    } else {
                        let parts: Vec<&str> = protocol.split(',').map(|x| x.trim()).collect();
                        sb_rule.insert("protocol".to_string(), json!(parts));
                    }
                } else {
                    let parts: Vec<&str> = protocol.split(',').map(|x| x.trim()).collect();
                    sb_rule.insert("protocol".to_string(), json!(parts));
                }
                has_content = true;
            }
            
            if has_content {
                sb_rule.insert("outbound".to_string(), json!(actual_out_tag));
                routing_rules_objects.push(Value::Object(sb_rule));
            }
        }
    }
    
    let mut primary_dns = if is_doh_enabled { "https://1.1.1.1/dns-query".to_string() } else { "1.1.1.1".to_string() };
    let mut direct_dns = "8.8.8.8".to_string();
    let mut strategy = "prefer_ipv4".to_string();
    
    let xray_dns = xray.get("dns");
    if let Some(xdns) = xray_dns {
        strategy = match xdns.get("queryStrategy").and_then(|q| q.as_str()).unwrap_or("") {
            "UseIPv4" => "ipv4_only".to_string(),
            "UseIPv6" => "ipv6_only".to_string(),
            "UseIP" => "prefer_ipv4".to_string(),
            _ => "prefer_ipv4".to_string(),
        };
        
        if let Some(servers) = xdns.get("servers").and_then(|s| s.as_array()) {
            let extract_addr = |val: &Value| -> String {
                if let Some(obj) = val.as_object() {
                    obj.get("address").and_then(|a| a.as_str()).unwrap_or("").to_string()
                } else if let Some(s) = val.as_str() {
                    s.to_string()
                } else {
                    "".to_string()
                }
            };
            
            if !servers.is_empty() {
                let first = extract_addr(&servers[0]);
                if !first.is_empty() {
                    primary_dns = first.replace("+local://", "://");
                    if is_doh_enabled && !primary_dns.starts_with("https://") 
                        && !primary_dns.starts_with("tls://") 
                        && !primary_dns.starts_with("quic://")
                        && !primary_dns.starts_with("h3://")
                        && !primary_dns.starts_with("tcp://") 
                    {
                        primary_dns = format!("https://{}/dns-query", primary_dns);
                    }
                }
                
                for i in 1..servers.len() {
                    let addr = extract_addr(&servers[i]);
                    if !addr.is_empty() && !addr.starts_with("localhost") && !addr.replace("+local://", "://").starts_with("https://") {
                        direct_dns = addr.replace("+local://", "://");
                        break;
                    }
                }
            }
        }
    }
    
    let mut sb_dns_servers = Vec::new();
    
    let mut remote_dns = Map::new();
    remote_dns.insert("tag".to_string(), json!("dns-remote"));
    remote_dns.insert("address".to_string(), json!(primary_dns));
    remote_dns.insert("domain_resolver".to_string(), json!("dns-direct"));
    remote_dns.insert("detour".to_string(), json!(find_primary_proxy_tag(&sb_outbounds)));
    sb_dns_servers.push(migrate_dns_server_object(&mut remote_dns));
    
    let mut ddns = Map::new();
    ddns.insert("tag".to_string(), json!("dns-direct"));
    ddns.insert("address".to_string(), json!(direct_dns));
    ddns.insert("detour".to_string(), json!("direct"));
    sb_dns_servers.push(migrate_dns_server_object(&mut ddns));
    
    let mut sb_dns_rules = Vec::new();
    
    if let Some(servers) = xray_dns.and_then(|d| d.get("servers")).and_then(|s| s.as_array()) {
        for (i, s) in servers.iter().enumerate() {
            if let Some(obj) = s.as_object() {
                let addr = obj.get("address").and_then(|a| a.as_str()).unwrap_or("").replace("+local://", "://");
                let port = obj.get("port").and_then(|p| p.as_i64()).unwrap_or(53);
                let domains = obj.get("domains").and_then(|d| d.as_array());
                
                if let Some(doms) = domains {
                    if !doms.is_empty() {
                        let tag = format!("dns-custom-{}", i);
                        let mut cust_dns = Map::new();
                        cust_dns.insert("tag".to_string(), json!(tag));
                        cust_dns.insert("address".to_string(), json!(addr));
                        if port != 53 && port > 0 {
                            cust_dns.insert("port".to_string(), json!(port));
                        }
                        cust_dns.insert("detour".to_string(), json!("direct"));
                        sb_dns_servers.push(migrate_dns_server_object(&mut cust_dns));
                        
                        let mut dns_rule = Map::new();
                        dns_rule.insert("server".to_string(), json!(tag));
                        
                        let mut dns_domain_exact = Vec::new();
                        let mut dns_domain_suffixes = Vec::new();
                        let mut dns_rule_sets = Vec::new();
                        
                        for d_val in doms {
                            let d = d_val.as_str().unwrap_or("");
                            if d.starts_with("geosite:") {
                                let gs = &d[8..];
                                if gs == "category-ru" || gs == "ru" {
                                    required_rule_sets.insert("geosite-ru".to_string());
                                    dns_rule_sets.push("geosite-ru".to_string());
                                }
                            } else if d.starts_with("domain:") {
                                let dom = &d[7..];
                                if !dom.is_empty() { dns_domain_suffixes.push(dom.to_string()); }
                            } else if d.starts_with("full:") {
                                let dom = &d[5..];
                                if !dom.is_empty() { dns_domain_exact.push(dom.to_string()); }
                            } else if !d.is_empty() {
                                dns_domain_suffixes.push(d.to_string());
                            }
                        }
                        
                        if !dns_domain_exact.is_empty() { dns_rule.insert("domain".to_string(), json!(dns_domain_exact)); }
                        if !dns_domain_suffixes.is_empty() { dns_rule.insert("domain_suffix".to_string(), json!(dns_domain_suffixes)); }
                        if !dns_rule_sets.is_empty() { dns_rule.insert("rule_set".to_string(), json!(dns_rule_sets)); }
                        
                        if !dns_domain_exact.is_empty() || !dns_domain_suffixes.is_empty() || !dns_rule_sets.is_empty() {
                            sb_dns_rules.push(Value::Object(dns_rule));
                        }
                    }
                }
            }
        }
    }
    
    let mut dns_direct_domains = Vec::new();
    for pd in &proxy_domains { dns_direct_domains.push(pd.clone()); }
    for dd in &direct_domains { dns_direct_domains.push(dd.clone()); }
    
    if !dns_direct_domains.is_empty() {
        sb_dns_rules.push(json!({
            "domain_suffix": dns_direct_domains,
            "server": "dns-direct"
        }));
    }
    
    for rs in &direct_rule_sets {
        sb_dns_rules.push(json!({
            "rule_set": rs,
            "server": "dns-direct"
        }));
    }
    
    sb.insert("dns".to_string(), json!({
        "servers": sb_dns_servers,
        "rules": sb_dns_rules,
        "final": "dns-remote",
        "strategy": strategy,
        "independent_cache": true
    }));
    
    let mut sb_inbounds = Vec::new();
    sb_inbounds.push(create_tun_inbound(xray));
    sb.insert("inbounds".to_string(), json!(sb_inbounds));
    
    sb.insert("outbounds".to_string(), json!(sb_outbounds));
    
    let mut sb_route = Map::new();
    sb_route.insert("auto_detect_interface".to_string(), json!(false));
    let primary_proxy_tag = find_primary_proxy_tag(&sb_outbounds);
    sb_route.insert("final".to_string(), json!(primary_proxy_tag.clone()));
    
    let mut sb_rules = Vec::new();
    sb_rules.push(json!({"protocol": "dns", "action": "hijack-dns"}));
    sb_rules.push(json!({"port": 53, "action": "hijack-dns"}));
    sb_rules.push(json!({"action": "sniff"}));
    
    for rule in routing_rules_objects {
        sb_rules.push(rule);
    }
    
    if !proxy_domains.is_empty() {
        sb_rules.push(json!({
            "domain": proxy_domains,
            "outbound": "direct"
        }));
    }
    
    let mut sb_rule_sets = Vec::new();
    for rs in &required_rule_sets {
        sb_rule_sets.push(json!({
            "tag": rs,
            "type": "local",
            "format": "binary",
            "path": format!("{}.srs", rs)
        }));
    }
    
    sb_route.insert("rules".to_string(), json!(sb_rules));
    if !sb_rule_sets.is_empty() {
        sb_route.insert("rule_set".to_string(), json!(sb_rule_sets));
    }
    
    sb.insert("route".to_string(), Value::Object(sb_route));
    
    if let Some(dns_obj) = sb.get_mut("dns").and_then(|d| d.as_object_mut()) {
        if let Some(servers_obj) = dns_obj.get_mut("servers").and_then(|s| s.as_array_mut()) {
            for server in servers_obj {
                if let Some(s_obj) = server.as_object_mut() {
                    if s_obj.get("tag").and_then(|t| t.as_str()).unwrap_or("") == "dns-remote" {
                        s_obj.insert("detour".to_string(), json!(primary_proxy_tag));
                    }
                }
            }
        }
    }
    
    let json_output = serde_json::to_string_pretty(&sb).unwrap().replace("\\/", "/");
    Ok(json_output)
}
