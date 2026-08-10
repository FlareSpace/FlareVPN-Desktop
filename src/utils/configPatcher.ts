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

export interface ParsedDnsConfig {
  type: string;
  server: string;
  server_port?: number;
  path?: string;
}

export function parseCustomDnsAddress(rawInput: string, isDohEnabled: boolean = true): ParsedDnsConfig {
  let str = (rawInput || '').trim();

  if (!str) {
    if (isDohEnabled) {
      return { type: 'https', server: '1.1.1.1', path: '/dns-query' };
    }
    return { type: 'udp', server: '1.1.1.1' };
  }

  let lower = str.toLowerCase();


  if (lower.startsWith('doh://')) {
    str = 'https://' + str.substring(6);
    lower = str.toLowerCase();
  } else if (lower.startsWith('dot://')) {
    str = 'tls://' + str.substring(6);
    lower = str.toLowerCase();
  } else if (lower.startsWith('doq://')) {
    str = 'quic://' + str.substring(6);
    lower = str.toLowerCase();
  }


  if (lower.startsWith('https://')) {
    const withoutScheme = str.substring(8);
    return parseHttpsDns(withoutScheme);
  }

  if (lower.startsWith('h3://')) {
    const withoutScheme = str.substring(5);
    const parsed = parseHttpsDns(withoutScheme);
    parsed.type = 'h3';
    return parsed;
  }

  if (lower.startsWith('tls://')) {
    const withoutScheme = str.substring(6);
    return parseHostPortDns(withoutScheme, 'tls');
  }

  if (lower.startsWith('quic://')) {
    const withoutScheme = str.substring(7);
    return parseHostPortDns(withoutScheme, 'quic');
  }

  if (lower.startsWith('udp://')) {
    const withoutScheme = str.substring(6);
    return parseHostPortDns(withoutScheme, 'udp');
  }

  if (lower.startsWith('tcp://')) {
    const withoutScheme = str.substring(6);
    return parseHostPortDns(withoutScheme, 'tcp');
  }


  if (str.includes('/')) {
    return parseHttpsDns(str);
  }


  const hostPort = parseHostAndPort(str);


  if (hostPort.port === 853) {
    return { type: 'tls', server: hostPort.host, server_port: 853 };
  }


  if (hostPort.port === 443 && isDohEnabled) {
    return { type: 'https', server: hostPort.host, server_port: 443, path: '/dns-query' };
  }


  if (isDohEnabled) {
    const res: ParsedDnsConfig = { type: 'https', server: hostPort.host, path: '/dns-query' };
    if (hostPort.port) res.server_port = hostPort.port;
    return res;
  } else {
    const res: ParsedDnsConfig = { type: 'udp', server: hostPort.host };
    if (hostPort.port) res.server_port = hostPort.port;
    return res;
  }
}

function parseHttpsDns(inputWithoutScheme: string): ParsedDnsConfig {
  const slashIdx = inputWithoutScheme.indexOf('/');
  let hostPart = slashIdx !== -1 ? inputWithoutScheme.substring(0, slashIdx) : inputWithoutScheme;
  let rawPath = slashIdx !== -1 ? inputWithoutScheme.substring(slashIdx) : '/dns-query';

  if (!rawPath || rawPath === '/') {
    rawPath = '/dns-query';
  }

  const hostPort = parseHostAndPort(hostPart);
  const result: ParsedDnsConfig = {
    type: 'https',
    server: hostPort.host,
    path: rawPath
  };
  if (hostPort.port) {
    result.server_port = hostPort.port;
  }
  return result;
}

function parseHostPortDns(inputWithoutScheme: string, defaultType: string): ParsedDnsConfig {
  const cleanInput = inputWithoutScheme.replace(/\/+$/, '');
  const hostPort = parseHostAndPort(cleanInput);
  const result: ParsedDnsConfig = {
    type: defaultType,
    server: hostPort.host
  };
  if (hostPort.port) {
    result.server_port = hostPort.port;
  }
  return result;
}

function parseHostAndPort(input: string): { host: string; port?: number } {
  let str = input.trim();


  if (str.startsWith('[')) {
    const closeBracketIdx = str.indexOf(']');
    if (closeBracketIdx !== -1) {
      const ipv6Host = str.substring(1, closeBracketIdx);
      const remainder = str.substring(closeBracketIdx + 1);
      if (remainder.startsWith(':')) {
        const p = parseInt(remainder.substring(1), 10);
        if (!isNaN(p) && p > 0 && p <= 65535) {
          return { host: ipv6Host, port: p };
        }
      }
      return { host: ipv6Host };
    }
  }


  const colonCount = (str.match(/:/g) || []).length;
  if (colonCount === 1) {
    const lastColon = str.lastIndexOf(':');
    const host = str.substring(0, lastColon);
    const portStr = str.substring(lastColon + 1);
    const p = parseInt(portStr, 10);
    if (!isNaN(p) && p > 0 && p <= 65535) {
      return { host, port: p };
    }
  }

  return { host: str };
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

    const mode = settings.remote_dns || 'auto';
    const isDohEnabled = settings.remote_dns_doh ?? true;

    if (mode === 'custom') {
      const customAddr = settings.custom_remote_dns || '';
      applyDnsAddress(dnsRemoteServer, customAddr, isDohEnabled);
    } else if (mode === 'cloudflare_doh' || mode === 'cloudflare') {
      const addr = isDohEnabled ? 'https://1.1.1.1/dns-query' : '1.1.1.1';
      applyDnsAddress(dnsRemoteServer, addr, isDohEnabled);
    } else if (mode === 'adguard_doh' || mode === 'adguard') {
      const addr = isDohEnabled ? 'https://94.140.14.14/dns-query' : '94.140.14.14';
      applyDnsAddress(dnsRemoteServer, addr, isDohEnabled);
    } else if (mode === 'google_dot' || mode === 'google') {
      const addr = isDohEnabled ? 'https://dns.google/dns-query' : 'tls://dns.google';
      applyDnsAddress(dnsRemoteServer, addr, isDohEnabled);
    } else if (mode === 'quad9') {
      const quad9Url = isDohEnabled ? 'https://dns.quad9.net/dns-query' : '9.9.9.9';
      applyDnsAddress(dnsRemoteServer, quad9Url, isDohEnabled);
    } else if (mode !== 'auto' && (mode.includes('://') || mode.includes('.') || mode.includes(':'))) {
      applyDnsAddress(dnsRemoteServer, mode, isDohEnabled);
    } else {

      const autoUrl = isDohEnabled ? 'https://1.1.1.1/dns-query' : '1.1.1.1';
      applyDnsAddress(dnsRemoteServer, autoUrl, isDohEnabled);
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

function applyDnsAddress(serverObj: any, address: string, isDohEnabled: boolean = true) {
  delete serverObj.address;
  delete serverObj.server_port;
  delete serverObj.responses;
  delete serverObj.domain_resolver;
  delete serverObj.path;

  const parsed = parseCustomDnsAddress(address, isDohEnabled);
  serverObj.type = parsed.type;
  serverObj.server = parsed.server;
  if (parsed.server_port) {
    serverObj.server_port = parsed.server_port;
  }
  if (parsed.path) {
    serverObj.path = parsed.path;
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
