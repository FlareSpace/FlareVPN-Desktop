export interface ProfileEntity {
  name: string;
  uri: string;
  configJson: string;
  serverDescription?: string;
  subscriptionId?: number | null;
  protocol?: string | null;
}

export interface SubscriptionEntity {
  name: string;
  url: string;
  upload: number;
  download: number;
  total: number;
  expire: number;
  description: string;
  supportUrl: string;
  webPageUrl: string;
  updateInterval: number;
  lastUpdated: number;
}

export type ParseResult = 
  | { type: 'SingleProfile'; profile: ProfileEntity }
  | { type: 'MultipleProfiles'; profiles: ProfileEntity[] }
  | { type: 'Subscription'; subscription: SubscriptionEntity; profiles: ProfileEntity[] }
  | { type: 'Error'; message: string };

export class ClipboardParser {
  private static singleSchemes = new Set([
    'vless', 'vmess', 'ss', 'trojan', 'shadowsocks', 'hysteria', 'hy', 'hysteria2', 'hy2', 'wireguard', 'wg'
  ]);

  static async parse(text: string): Promise<ParseResult> {
    const trimmed = text.trim();

    const multiLinks = this.extractSingleProxyLinks(trimmed);
    if (multiLinks.length > 1) {
      const profiles: ProfileEntity[] = [];
      for (const link of multiLinks) {
        try {
          profiles.push(this.buildProfileFromUri(link));
        } catch (e) {
          console.error(e);
        }
      }
      if (profiles.length > 0) {
        return { type: 'MultipleProfiles', profiles };
      }
      return { type: 'Error', message: 'Invalid format' };
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return this.parseFullJson(trimmed);
    }
    
    if (Array.from(this.singleSchemes).some(scheme => trimmed.toLowerCase().startsWith(`${scheme}://`))) {
      return this.parseSingleProxy(trimmed);
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return await this.parseSubscriptionUrl(trimmed);
    }

    return { type: 'Error', message: 'Invalid format' };
  }

  private static extractSingleProxyLinks(text: string): string[] {
    return text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && Array.from(this.singleSchemes).some(scheme => line.toLowerCase().startsWith(`${scheme}://`)));
  }

  private static parseSingleProxy(uri: string): ParseResult {
    try {
      const profile = this.buildProfileFromUri(uri);
      return { type: 'SingleProfile', profile };
    } catch (e: any) {
      return { type: 'Error', message: `Parsing error: ${e.message}` };
    }
  }

  private static parseFullJson(text: string): ParseResult {
    try {
      const json = JSON.parse(text);
      const name = json.remarks || json.tag || 'Imported Profile';
      let protocol = null;
      if (json.outbounds && json.outbounds.length > 0) {
        protocol = json.outbounds[0].type;
      }
      return {
        type: 'SingleProfile',
        profile: {
          name,
          uri: 'internal://json',
          configJson: text,
          protocol
        }
      };
    } catch (e: any) {
      return { type: 'Error', message: `JSON error: ${e.message}` };
    }
  }

  private static async parseSubscriptionUrl(url: string): Promise<ParseResult> {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Happ/3.21.1' } });
      if (!res.ok) {
        return { type: 'Error', message: `HTTP ${res.status}` };
      }
      const body = await res.text();
      let decodedBody = body;
      try {
        decodedBody = atob(body.trim());
      } catch (e) {

      }
      const links = this.extractSingleProxyLinks(decodedBody);
      const profiles: ProfileEntity[] = [];
      for (const link of links) {
        try {
          profiles.push(this.buildProfileFromUri(link));
        } catch (e) {

        }
      }
      
      if (profiles.length === 0) return { type: 'Error', message: 'Empty subscription' };

      const sub: SubscriptionEntity = {
        name: new URL(url).host,
        url,
        upload: 0,
        download: 0,
        total: 0,
        expire: 0,
        description: '',
        supportUrl: '',
        webPageUrl: '',
        updateInterval: 86400,
        lastUpdated: Date.now()
      };

      return { type: 'Subscription', subscription: sub, profiles };
    } catch (e: any) {
      return { type: 'Error', message: `Subscription error: ${e.message}` };
    }
  }

  static buildProfileFromUri(uri: string): ProfileEntity {
    const trimmed = uri.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const json = JSON.parse(trimmed);
      return {
        name: json.remarks || json.tag || 'Imported JSON',
        uri: 'internal://json',
        configJson: trimmed,
        protocol: json.outbounds?.[0]?.type
      };
    }

    const url = new URL(trimmed);
    const scheme = url.protocol.replace(':', '').toLowerCase();
    const name = decodeURIComponent(url.hash.replace('#', '')) || url.host;
    
    let outbound: any = null;

    switch (scheme) {
      case 'vless':
        outbound = this.buildVlessOutbound(url);
        break;
      case 'vmess': {
        const b64 = trimmed.substring('vmess://'.length).trim();
        const decoded = JSON.parse(atob(b64));
        outbound = this.buildVmessOutbound(decoded);
        break;
      }
      case 'trojan':
        outbound = this.buildTrojanOutbound(url);
        break;
      case 'ss':
      case 'shadowsocks':
        outbound = this.buildShadowsocksOutbound(url);
        break;
      case 'hysteria':
      case 'hy':
      case 'hysteria2':
      case 'hy2':
        outbound = this.buildHysteria2Outbound(url);
        break;
      default:
        throw new Error(`Protocol ${scheme} not supported`);
    }

    const configJson = this.buildMinimalSingBoxConfig([outbound]);
    
    return {
      name,
      uri: trimmed,
      configJson,
      protocol: scheme
    };
  }

  private static buildVlessOutbound(url: URL): any {
    const params = new URLSearchParams(url.search);
    const tls = {
      enabled: params.get('security') === 'tls' || params.get('security') === 'reality',
      server_name: params.get('sni') || url.host,
      insecure: params.get('allowInsecure') === '1' || params.get('insecure') === '1',
      reality: params.get('security') === 'reality' ? {
        enabled: true,
        public_key: params.get('pbk') || '',
        short_id: params.get('sid') || ''
      } : undefined,
      utls: {
        enabled: true,
        fingerprint: params.get('fp') || 'chrome'
      }
    };

    const transportType = params.get('type') || 'tcp';
    let transport: any = undefined;
    if (transportType === 'ws') {
      transport = {
        type: 'ws',
        path: params.get('path') || '/',
        headers: { Host: params.get('host') || url.host }
      };
    } else if (transportType === 'grpc') {
      transport = {
        type: 'grpc',
        service_name: params.get('serviceName') || ''
      };
    }

    return {
      type: 'vless',
      tag: 'proxy',
      server: url.hostname,
      server_port: parseInt(url.port) || 443,
      uuid: url.username,
      flow: params.get('flow') || '',
      packet_encoding: params.get('packetEncoding') || 'xudp',
      tls: tls.enabled ? tls : undefined,
      transport
    };
  }

  private static buildVmessOutbound(json: any): any {
    const tls = {
      enabled: json.tls === 'tls',
      server_name: json.sni || json.add,
      insecure: false
    };

    let transport: any = undefined;
    if (json.net === 'ws') {
      transport = {
        type: 'ws',
        path: json.path || '/',
        headers: { Host: json.host || json.add }
      };
    } else if (json.net === 'grpc') {
      transport = {
        type: 'grpc',
        service_name: json.path || ''
      };
    }

    return {
      type: 'vmess',
      tag: 'proxy',
      server: json.add,
      server_port: parseInt(json.port) || 443,
      uuid: json.id,
      security: 'auto',
      packet_encoding: 'xudp',
      tls: tls.enabled ? tls : undefined,
      transport
    };
  }

  private static buildTrojanOutbound(url: URL): any {
    const params = new URLSearchParams(url.search);
    const tls = {
      enabled: params.get('security') === 'tls' || params.get('security') === 'reality',
      server_name: params.get('sni') || url.host,
      insecure: params.get('allowInsecure') === '1' || params.get('insecure') === '1',
      utls: {
        enabled: true,
        fingerprint: params.get('fp') || 'chrome'
      }
    };

    let transport: any = undefined;
    if (params.get('type') === 'ws') {
      transport = {
        type: 'ws',
        path: params.get('path') || '/',
        headers: { Host: params.get('host') || url.host }
      };
    } else if (params.get('type') === 'grpc') {
      transport = {
        type: 'grpc',
        service_name: params.get('serviceName') || ''
      };
    }

    return {
      type: 'trojan',
      tag: 'proxy',
      server: url.hostname,
      server_port: parseInt(url.port) || 443,
      password: url.username,
      tls: tls.enabled ? tls : undefined,
      transport
    };
  }

  private static buildShadowsocksOutbound(url: URL): any {

    let method = '';
    let password = '';
    try {
      const decodedInfo = atob(url.username);
      const parts = decodedInfo.split(':');
      method = parts[0];
      password = parts.slice(1).join(':');
    } catch {
      method = url.username.split(':')[0] || 'chacha20-ietf-poly1305';
      password = url.username.split(':').slice(1).join(':') || '';
    }

    return {
      type: 'shadowsocks',
      tag: 'proxy',
      server: url.hostname,
      server_port: parseInt(url.port) || 8388,
      method,
      password
    };
  }

  private static buildHysteria2Outbound(url: URL): any {
    const params = new URLSearchParams(url.search);
    return {
      type: 'hysteria2',
      tag: 'proxy',
      server: url.hostname,
      server_port: parseInt(url.port) || 443,
      password: url.username,
      up_mbps: parseInt(params.get('upmbps') || '100'),
      down_mbps: parseInt(params.get('downmbps') || '100'),
      tls: {
        enabled: true,
        server_name: params.get('sni') || url.hostname,
        insecure: params.get('insecure') === '1'
      }
    };
  }

  private static buildMinimalSingBoxConfig(outbounds: any[]): string {
    const primaryProxyTag = outbounds[0]?.tag || 'proxy';
    const sb = {
      log: { level: 'info', timestamp: true },
      dns: {
        servers: [
          { tag: 'dns-remote', type: 'https', server: '1.1.1.1', path: '/dns-query', detour: primaryProxyTag },
          { tag: 'dns-direct', type: 'udp', server: '8.8.8.8' }
        ],
        rules: [],
        final: 'dns-remote',
        strategy: 'prefer_ipv4'
      },
      experimental: {
        clash_api: {
          external_controller: "127.0.0.1:9090",
          external_ui: "dashboard",
          store_selected: true,
          store_fakeip: true,
          cache_file: "cache.db"
        }
      },
      inbounds: [
        {
          type: 'tun',
          tag: 'tun-in',
          address: ['172.19.0.1/30'],
          mtu: 1500,
          auto_route: true,
          strict_route: true,
          stack: 'mixed'
        }
      ],
      outbounds: [
        ...outbounds,
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' }
      ],
      route: {
        auto_detect_interface: false,
        default_domain_resolver: 'dns-direct',
        final: primaryProxyTag,
        rules: [
          { protocol: 'dns', action: 'hijack-dns' },
          { port: 53, action: 'hijack-dns' },
          { action: 'sniff' },
          { ip_is_private: true, outbound: 'direct' }
        ]
      }
    };
    return JSON.stringify(sb, null, 2);
  }
}

export function formatTraffic(upload: number, download: number, total: number): string {
  if (upload === -1 || download === -1 || total === -1) {
    return "none / ∞";
  }
  const used = upload + download;
  if (total === Number.MAX_SAFE_INTEGER || total <= 0) return `${formatBytes(used)} / ∞`;
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

export function formatDate(timestampMs: number): string {
  if (timestampMs <= 0) return "Never";
  return new Date(timestampMs).toLocaleString();
}

export function formatUpdateInterval(ms: number): string {
  if (ms <= 0) return "Never";
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} h`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} m`;
}

export function formatProfileName(name: string): string {


  return name.replace(/^([\[\s\-_]*)([A-Z]{2})\b/, (_, prefix, codeMatch) => {

    const code = codeMatch === 'UK' ? 'GB' : codeMatch;
    const codePoints = code
      .split('')
      .map((char: string) => 127397 + char.charCodeAt(0));
    return prefix + String.fromCodePoint(...codePoints);
  });
}

export function getProtocolDisplay(profile: { protocol?: string | null, uri?: string | null, config_json?: string | null }): string {
  const p = profile.protocol || 'Unknown';
  let base = p.toUpperCase();
  if (p.toLowerCase().includes('vless')) base = 'VLESS';
  else if (p.toLowerCase().includes('vmess')) base = 'VMess';
  else if (p.toLowerCase().includes('trojan')) base = 'Trojan';
  else if (p.toLowerCase().includes('shadowsocks') || p.toLowerCase() === 'ss') base = 'Shadowsocks';
  else if (p.toLowerCase().includes('hysteria') || p.toLowerCase().includes('hy2')) base = 'Hysteria 2';

  let transport = '';
  let security = '';
  let isJson = false;

  try {
    if (profile.config_json && (!profile.uri || profile.uri === 'internal://json')) {
      isJson = true;
      const parsed = JSON.parse(profile.config_json);
      let outbound = parsed;
      if (parsed.outbounds && Array.isArray(parsed.outbounds) && parsed.outbounds.length > 0) {
        outbound = parsed.outbounds[0];
      }

      if (outbound) {
        transport = outbound.transport?.type?.toUpperCase() || 'TCP';
        if (transport === 'GRPC') transport = 'gRPC';
        else if (transport === 'HTTPUPGRADE') transport = 'HTTPUpgrade';

        if (outbound.tls?.enabled) {
          if (outbound.tls.reality?.enabled) {
            security = 'REALITY';
          } else {
            security = 'TLS';
          }
        }
      }
    } else if (profile.uri) {
      if (base === 'VMess') {
        const decoded = JSON.parse(atob(profile.uri.substring(8)));
        transport = decoded.net?.toUpperCase() || '';
        if (transport === 'GRPC') transport = 'gRPC';
        security = decoded.tls === 'tls' ? 'TLS' : '';
      } else {
        const url = new URL(profile.uri);
        const params = new URLSearchParams(url.search);
        
        transport = params.get('type')?.toUpperCase() || '';
        if (transport === 'GRPC') transport = 'gRPC';
        else if (transport === 'HTTPUPGRADE') transport = 'HTTPUpgrade';
        
        security = params.get('security')?.toUpperCase() || '';
      }
    }
    
    if (base === 'Hysteria 2') security = 'TLS';
    
    const parts = [base];
    if (transport) parts.push(transport);
    if (security) parts.push(security);
    
    let display = parts.join(' / ');
    if (isJson) display += ' | JSON';
    return display;
  } catch {
    return base + (isJson ? ' | JSON' : '');
  }
}
