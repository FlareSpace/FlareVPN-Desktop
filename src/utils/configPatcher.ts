import { AppSettings } from '../store/useAppStore';

export function patchConfigWithAdvancedSettings(rawConfig: any, settings: AppSettings): any {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return rawConfig;
  }

  const config = JSON.parse(JSON.stringify(rawConfig));


  sanitizeOutboundTags(config);


  if (Array.isArray(config.inbounds)) {
    const mtuValue = settings.mtu_value || 1500;
    const stackValue = settings.network_stack || 'mixed';
    for (const inb of config.inbounds) {
      if (inb && inb.type === 'tun') {
        inb.mtu = mtuValue;
        inb.stack = stackValue;
      }
    }
  }


  if (settings.tls_spoof_enabled && settings.tls_spoof_domain?.trim()) {
    const domain = settings.tls_spoof_domain.trim();
    const method = settings.tls_spoof_method?.trim() || 'wrong-ack';

    if (!config.route) config.route = {};
    if (!Array.isArray(config.route.rules)) config.route.rules = [];

    const spoofRule: any = {
      action: 'route-options',
      tls_spoof: domain,
      protocol: ['tls'],
    };
    if (method) {
      spoofRule.tls_spoof_method = method;
    }

    config.route.rules.unshift(spoofRule);
  }


  if (settings.tls_fingerprint && settings.tls_fingerprint !== 'auto') {
    if (Array.isArray(config.outbounds)) {
      for (const ob of config.outbounds) {
        if (!ob || typeof ob !== 'object') continue;
        const type = ob.type;
        if (type === 'hysteria' || type === 'hysteria2' || type === 'tuic') continue;

        if (ob.tls) {
          if (!ob.tls.utls) {
            ob.tls.utls = { enabled: true };
          } else {
            ob.tls.utls.enabled = true;
          }
          ob.tls.utls.fingerprint = settings.tls_fingerprint;
        }
      }
    }
  }


  patchRemoteDns(config, settings);


  if (settings.fake_ip_enabled) {
    if (!config.dns) config.dns = {};
    config.dns.reverse_mapping = true;

    if (!Array.isArray(config.dns.servers)) config.dns.servers = [];
    const hasFakeIpServer = config.dns.servers.some((s: any) => s && s.tag === 'dns-fakeip');
    if (!hasFakeIpServer) {
      config.dns.servers.push({
        type: 'fakeip',
        tag: 'dns-fakeip',
        inet4_range: '198.18.0.0/15',
        inet6_range: 'fc00::/18',
      });
    }

    if (!Array.isArray(config.dns.rules)) config.dns.rules = [];
    const hasFakeIpRule = config.dns.rules.some((r: any) => r && r.server === 'dns-fakeip');
    if (!hasFakeIpRule) {
      config.dns.rules.push({
        query_type: ['A', 'AAAA'],
        server: 'dns-fakeip',
      });
    }
  }


  if (Array.isArray(config.outbounds)) {
    for (const ob of config.outbounds) {
      if (!ob || typeof ob !== 'object') continue;
      const type = ob.type;
      if (type !== 'urltest' && type !== 'selector' && type !== 'direct' && type !== 'block' && type !== 'dns') {
        if (!ob.connect_timeout) {
          ob.connect_timeout = '5s';
        }
      }
    }
  }


  if (settings.fragmentation_enabled && Array.isArray(config.outbounds)) {
    const timeoutMs = settings.fragmentation_timeout || 300;
    for (const ob of config.outbounds) {
      if (!ob || typeof ob !== 'object') continue;
      if (ob.tls) {
        ob.tls.fragment = true;
        ob.tls.record_fragment = true;
        if (settings.fragmentation_fallback !== 'disabled') {
          ob.tls.fragment_fallback_delay = `${timeoutMs}ms`;
        }
      }
    }
  }


  if (settings.mux_enabled && Array.isArray(config.outbounds)) {
    const maxStreams = settings.mux_concurrency || 4;
    const protocol = settings.mux_protocol || 'h2mux';
    const padding = settings.mux_padding ?? false;

    for (const ob of config.outbounds) {
      if (!ob || typeof ob !== 'object') continue;
      const type = ob.type;
      if (
        type === 'direct' ||
        type === 'block' ||
        type === 'dns' ||
        type === 'urltest' ||
        type === 'selector' ||
        type === 'hysteria' ||
        type === 'hysteria2'
      ) {
        continue;
      }

      const flow = ob.flow || '';
      const hasReality = !!(ob.tls && ob.tls.reality);
      if (flow.includes('vision') || hasReality) {
        continue;
      }

      ob.multiplex = {
        enabled: true,
        protocol: protocol,
        max_connections: 4,
        min_streams: 4,
        max_streams: maxStreams,
        padding: padding,
      };
    }
  }


  if (!config.route) config.route = {};
  config.route.final = getPrimaryProxyTag(config);

  return config;
}

export function getPrimaryProxyTag(config: any): string {
  if (Array.isArray(config.outbounds)) {
    const generalTags = ["proxy", "auto", "default", "main", "select", "selector", "urltest"];
    for (const ob of config.outbounds) {
      if ((ob.type === 'urltest' || ob.type === 'selector') && ob.tag && generalTags.includes(String(ob.tag).toLowerCase())) {
        return ob.tag;
      }
    }
    for (const ob of config.outbounds) {
      if ((ob.type === 'urltest' || ob.type === 'selector') && ob.tag) {
        return ob.tag;
      }
    }
    for (const ob of config.outbounds) {
      if (ob.tag && String(ob.tag).toLowerCase() === 'proxy') return ob.tag;
    }
    for (const ob of config.outbounds) {
      if (ob.type !== 'direct' && ob.type !== 'block' && ob.type !== 'dns' && ob.tag) {
        return ob.tag;
      }
    }
    for (const ob of config.outbounds) {
      if (ob.tag) return ob.tag;
    }
  }
  return 'direct';
}

function patchRemoteDns(config: any, settings: AppSettings) {
  if (!config.dns || !Array.isArray(config.dns.servers)) return;

  const primaryProxyTag = getPrimaryProxyTag(config);

  const isStrictlyTun = settings.remote_dns_strictly_tun ?? false;
  const dnsRemoteServer = config.dns.servers.find((s: any) => s && s.tag === 'dns-remote');
  if (dnsRemoteServer) {
    dnsRemoteServer.detour = primaryProxyTag;
    dnsRemoteServer.domain_resolver = 'dns-direct';
    if (config.route) {
      config.route.default_domain_resolver = 'dns-direct';
    }

    let dnsUrl = '';
    const mode = settings.remote_dns || 'auto';

    if (mode === 'cloudflare_doh' || mode === 'cloudflare') {
      dnsUrl = 'https://1.1.1.1/dns-query';
    } else if (mode === 'adguard_doh' || mode === 'adguard') {
      dnsUrl = 'https://94.140.14.14/dns-query';
    } else if (mode === 'google_dot' || mode === 'google') {
      dnsUrl = 'tls://dns.google';
    } else if (mode === 'quad9') {
      dnsUrl = (settings.remote_dns_doh ?? true) ? 'https://dns.quad9.net/dns-query' : '9.9.9.9';
    } else if (mode === 'custom') {
      dnsUrl = settings.remote_dns;
    }

    if (dnsUrl && dnsUrl.trim().length > 0) {
      applyDnsAddress(dnsRemoteServer, dnsUrl.trim());
    } else {

      const isDohEnabled = settings.remote_dns_doh ?? true;
      const currentType = dnsRemoteServer.type || '';
      const currentServer = dnsRemoteServer.server || '1.1.1.1';

      if (isDohEnabled) {
        if (currentType === 'udp' || currentType === 'tcp' || !currentType) {
          applyDnsAddress(dnsRemoteServer, `https://${currentServer}/dns-query`);
        }
      } else {
        if (currentType !== 'udp') {
          dnsRemoteServer.type = 'udp';
          delete dnsRemoteServer.path;
        }
      }
    }
  }

  if (isStrictlyTun) {
    config.dns.final = 'dns-remote';
  }


  if (Array.isArray(config.dns.rules)) {
    for (const rule of config.dns.rules) {
      if (rule && rule.outbound === 'any' && rule.server === 'dns-direct') {
        rule.outbound = ['direct'];
      }
    }
  }
}

function applyDnsAddress(serverObj: any, address: string) {
  delete serverObj.address;
  delete serverObj.server_port;
  delete serverObj.responses;
  delete serverObj.domain_resolver;

  if (address.startsWith('https://')) {
    serverObj.type = 'https';
    const urlWithoutScheme = address.substring(8);
    const slashIdx = urlWithoutScheme.indexOf('/');
    const host = slashIdx !== -1 ? urlWithoutScheme.substring(0, slashIdx) : urlWithoutScheme;
    const path = slashIdx !== -1 ? urlWithoutScheme.substring(slashIdx) : '/dns-query';
    serverObj.server = host;
    serverObj.path = path;
  } else if (address.startsWith('tls://')) {
    serverObj.type = 'tls';
    serverObj.server = address.substring(6);
    delete serverObj.path;
  } else if (address.startsWith('udp://')) {
    serverObj.type = 'udp';
    serverObj.server = address.substring(6);
    delete serverObj.path;
  } else {
    serverObj.type = 'udp';
    serverObj.server = address;
    delete serverObj.path;
  }
}

function sanitizeOutboundTags(config: any) {
  if (!config || !Array.isArray(config.outbounds)) return;
  const seenTags = new Set<string>();

  for (const outbound of config.outbounds) {
    if (!outbound || !outbound.tag) continue;
    const tag = outbound.tag;

    if (seenTags.has(tag)) {
      let counter = 1;
      let newTag = `${tag}_${counter}`;
      while (seenTags.has(newTag)) {
        counter++;
        newTag = `${tag}_${counter}`;
      }
      outbound.tag = newTag;
      seenTags.add(newTag);
    } else {
      seenTags.add(tag);
    }
  }
}
