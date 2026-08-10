import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import i18n from '../i18n';
import { patchConfigWithAdvancedSettings, getPrimaryProxyTag } from '../utils/configPatcher';

export type VpnStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
export type NotificationType = 'success' | 'warning' | 'error';
export type TabType = 'home' | 'ping' | 'subscriptions' | 'personalization' | 'language' | 'basic' | 'advanced';
export type PingType = 'proxy' | 'tcp' | 'icmp';
export type PingDisplayStyle = 'time' | 'icon' | 'both';
export type PingResult = { status: 'loading' | 'done'; latency?: number; error?: string };
export type LanguageType = 'auto' | 'en' | 'ru';
export type ThemeStyle = 'auto' | 'light' | 'dark';

export interface Profile {
  id: string;
  name: string;
  uri?: string;
  protocol?: string;
  serverDescription?: string;
  config_json?: string;
}

export interface Subscription {
  id: string;
  urlOrBase64: string;
  name: string;
  profiles: Profile[];
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
  updateInterval?: number;
  description?: string;
  supportUrl?: string;
  webPageUrl?: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
}

export interface AppSettings {
  auto_update: boolean;
  update_interval: boolean;
  update_timeout: number;
  user_agent: string;
  send_hwid: boolean;
  send_os: boolean;
  send_model: boolean;
  anonymous_hwid: string;
  real_hwid: string;
  selected_profile_id?: string | null;
  auto_update_interval: number;
  split_tunneling_enabled: boolean;
  split_tunneling_mode: string;
  split_tunneling_apps_mode: string;
  split_tunneling_domains_mode: string;
  split_tunneling_apps: string[];
  split_tunneling_domains: string[];
  fragmentation_enabled: boolean;
  fragmentation_fallback: string;
  fragmentation_timeout: number;
  mux_enabled: boolean;
  mux_protocol: string;
  mux_concurrency: number;
  mux_padding: boolean;
  tls_spoof_enabled: boolean;
  tls_spoof_domain: string;
  tls_spoof_method: string;
  tls_fingerprint: string;
  remote_dns: string;
  custom_remote_dns: string;
  remote_dns_doh: boolean;
  remote_dns_strictly_tun: boolean;
  fake_ip_enabled: boolean;
  reset_chain_on_disconnect: boolean;
  mtu_auto: boolean;
  mtu_value: number;
  network_stack: string;
  proxy_port: number;
}

interface AppState {
  status: VpnStatus;
  subscriptions: Subscription[];
  notifications: AppNotification[];
  activeTab: TabType;
  selectedProfileId: string | null;
  chainProfileIds: string[];
  toggleChainProfileId: (id: string) => void;
  clearChain: () => void;
  
  pingType: PingType;
  pingTestUrl: string;
  pingDisplayStyle: PingDisplayStyle;
  pingTimeout: number;
  pingResults: Record<string, PingResult>;
  pingedProfileIds: Set<string>;
  
  settings: AppSettings;
  language: LanguageType;
  themeStyle: ThemeStyle;
  customColorEnabled: boolean;
  customAccentColor: string;
  vpnMode: 'TUN' | 'Proxy';
  tunEnabled: boolean;
  proxyEnabled: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  setLanguage: (lang: LanguageType) => void;
  setThemeStyle: (style: ThemeStyle) => void;
  setCustomColorEnabled: (enabled: boolean) => void;
  setCustomAccentColor: (color: string) => void;

  setStatus: (status: VpnStatus) => void;
  addSubscription: (sub: Subscription) => void;
  appendProfilesToSubscription: (id: string, profiles: Profile[]) => void;
  toggleVpn: () => void;
  reconnectVpn: () => Promise<void>;
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: string) => void;
  setActiveTab: (tab: TabType) => void;
  setSelectedProfileId: (id: string | null) => void;
  
  
  setPingType: (type: PingType) => void;
  setPingTestUrl: (url: string) => void;
  setPingDisplayStyle: (style: PingDisplayStyle) => void;
  setPingTimeout: (timeout: number) => void;
  setVpnMode: (mode: 'TUN' | 'Proxy') => void;
  setTunEnabled: (enabled: boolean) => void;
  setProxyEnabled: (enabled: boolean) => void;
  startPing: (profileIds: string[]) => void;
  updateSubscription: (id: string) => Promise<void>;
  updateSubscriptionDetails: (id: string, name: string, urlOrBase64: string) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  updateProfileConfigJson: (profileId: string, newConfigJson: string) => void;
  updateProfileDetails: (profileId: string, updatedFields: Partial<Profile>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      subscriptions: [],
      notifications: [],
      activeTab: 'home',
      selectedProfileId: null,
      chainProfileIds: [],
      
      
      pingType: 'proxy',
      pingTestUrl: 'https://www.google.com/generate_204',
      pingDisplayStyle: 'time',
      pingTimeout: 10,
      pingResults: {},
      pingedProfileIds: new Set<string>(),
      vpnMode: 'TUN',
      tunEnabled: true,
      proxyEnabled: false,
      language: 'auto',
      themeStyle: 'auto',
      customColorEnabled: false,
      customAccentColor: '#5B8CFF',
      setThemeStyle: (style: ThemeStyle) => set({ themeStyle: style }),
      setCustomColorEnabled: (enabled: boolean) => set({ customColorEnabled: enabled }),
      setCustomAccentColor: (color: string) => set({ customAccentColor: color }),
      
      settings: {
        auto_update: false,
        update_interval: true,
        update_timeout: 10,
        user_agent: 'Happ/3.21.1',
        send_hwid: false,
        send_os: false,
        send_model: false,
        anonymous_hwid: '',
        real_hwid: '',
        selected_profile_id: null,
        auto_update_interval: 3600,
        split_tunneling_enabled: false,
        split_tunneling_mode: 'whitelist',
        split_tunneling_apps_mode: 'whitelist',
        split_tunneling_domains_mode: 'whitelist',
        split_tunneling_apps: [],
        split_tunneling_domains: [],
        fragmentation_enabled: false,
        fragmentation_fallback: 'enabled',
        fragmentation_timeout: 300,
        mux_enabled: false,
        mux_protocol: 'h2mux',
        mux_concurrency: 4,
        mux_padding: false,
        tls_spoof_enabled: false,
        tls_spoof_domain: 'google.com',
        tls_spoof_method: 'wrong-ack',
        tls_fingerprint: 'auto',
        remote_dns: 'auto',
        custom_remote_dns: '',
        remote_dns_doh: true,
        remote_dns_strictly_tun: false,
        fake_ip_enabled: false,
        reset_chain_on_disconnect: false,
        mtu_auto: true,
        mtu_value: 1500,
        network_stack: 'mixed',
        proxy_port: 2080,
      },

      setStatus: (status) => set({ status }),
      addSubscription: (sub) => set((state) => ({ 
        subscriptions: [...state.subscriptions, sub] 
      })),
      appendProfilesToSubscription: (id, profiles) => set((state) => ({
        subscriptions: state.subscriptions.map(s => {
          if (s.id === id) {
            return { ...s, profiles: [...s.profiles, ...profiles] };
          }
          return s;
        })
      })),
      updateProfileConfigJson: (profileId, newConfigJson) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) => ({
            ...sub,
            profiles: sub.profiles.map((p) => {
              if (p.id === profileId) {
                const updated = { ...p, config_json: newConfigJson };
                try {
                  const parsed = JSON.parse(newConfigJson);
                  if (parsed.remarks) updated.name = parsed.remarks;
                  else if (parsed.tag) updated.name = parsed.tag;
                  if (parsed.outbounds && parsed.outbounds[0]?.type) {
                    updated.protocol = parsed.outbounds[0].type;
                  }
                } catch (e) {

                }
                return updated;
              }
              return p;
            }),
          })),
        }));

        const state = get();
        const isActiveProfile = state.selectedProfileId === profileId || state.chainProfileIds.includes(profileId);
        const isConnected = state.status === 'connected' || state.status === 'connecting';
        if (isActiveProfile && isConnected) {
          get().reconnectVpn();
        }
      },
      updateProfileDetails: (profileId, updatedFields) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) => ({
            ...sub,
            profiles: sub.profiles.map((p) => {
              if (p.id === profileId) {
                return { ...p, ...updatedFields };
              }
              return p;
            }),
          })),
        }));
      },
      setSelectedProfileId: (id) => {
        const state = get();
        if (state.selectedProfileId === id) return;


        const wasConnected = state.status === 'connected' || state.status === 'connecting';

        let nextChain = state.chainProfileIds;
        if (id && nextChain.includes(id)) {
          nextChain = nextChain.filter(cid => cid !== id);
        }

        set({ selectedProfileId: id, chainProfileIds: nextChain });
        get().updateSetting('selected_profile_id', id);

        if (wasConnected) {
          get().reconnectVpn();
        }
      },
      toggleChainProfileId: (id: string) => {
        const state = get();
        if (id === state.selectedProfileId) return;

        let newChain: string[];
        if (state.chainProfileIds.includes(id)) {
          newChain = state.chainProfileIds.filter(cid => cid !== id);
        } else {
          newChain = [...state.chainProfileIds, id];
        }

        set({ chainProfileIds: newChain });

        if (state.status === 'connected' || state.status === 'connecting') {
          get().reconnectVpn();
        }
      },
      clearChain: () => {
        set({ chainProfileIds: [] });
      },
      toggleVpn: async () => {
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (!isTauri) {
          get().addNotification('error', i18n.t('notifications.backendNotRunning'));
          return;
        }

        const state = get();
        const current = state.status;
        if (current === 'disconnected') {
          if (!state.tunEnabled && !state.proxyEnabled) {
            get().addNotification('error', i18n.t('notifications.selectModeFirst'));
            return;
          }
          const mainProfile = state.subscriptions.flatMap(s => s.profiles).find(p => p.id === state.selectedProfileId);
          if (!mainProfile) {
            get().addNotification('error', i18n.t('notifications.selectProfileFirst'));
            return;
          }
          set({ status: 'connecting' });
          try {
            const allProfiles = state.subscriptions.flatMap(s => s.profiles);
            const chainProfiles = state.chainProfileIds
              .map(id => allProfiles.find(p => p.id === id))
              .filter((p): p is Profile => p !== undefined && p.id !== mainProfile.id);

            const allChainNodes = [mainProfile, ...chainProfiles];

            const getPrimaryTag = (cfg: any) => {
              if (Array.isArray(cfg.outbounds)) {
                const generalTags = ["proxy", "auto", "default", "main", "select", "selector", "urltest"];
                for (const ob of cfg.outbounds) {
                  if ((ob.type === 'urltest' || ob.type === 'selector') && ob.tag && generalTags.includes(ob.tag.toLowerCase())) {
                    return ob.tag;
                  }
                }
                for (const ob of cfg.outbounds) {
                  if (ob.tag && ob.tag.toLowerCase() === 'proxy') return ob.tag;
                }
                for (const ob of cfg.outbounds) {
                  if (ob.type !== 'direct' && ob.type !== 'block' && ob.type !== 'dns') {
                    return ob.tag || 'proxy';
                  }
                }
              }
              return 'proxy';
            };

            const combinedOutbounds: any[] = [
              { type: 'direct', tag: 'direct' },
              { type: 'block', tag: 'block' }
            ];

            const proxyServerDomains: string[] = [];
            let prevPrimaryTag: string | null = null;
            let primaryProxyTag = '';

            for (let nodeIdx = 0; nodeIdx < allChainNodes.length; nodeIdx++) {
              const node = allChainNodes[nodeIdx];
              const rawConfig = node.config_json || "{}";
              const parsedNodeConfig = JSON.parse(rawConfig);
              const origPrimaryTag = getPrimaryTag(parsedNodeConfig);
              const tagPrefix = `chain_node_${nodeIdx}_`;

              if (Array.isArray(parsedNodeConfig.outbounds)) {
                for (const rawOb of parsedNodeConfig.outbounds) {
                  if (!rawOb || typeof rawOb !== 'object') continue;
                  if (rawOb.type === 'direct' || rawOb.type === 'block' || rawOb.type === 'dns') continue;

                  const ob = JSON.parse(JSON.stringify(rawOb));
                  const oldTag = ob.tag || 'proxy';
                  const newTag = `${tagPrefix}${oldTag}`;
                  ob.tag = newTag;


                  if (Array.isArray(ob.outbounds)) {
                    ob.outbounds = ob.outbounds.map((t: string) => `${tagPrefix}${t}`);
                  }


                  if (nodeIdx > 0 && oldTag === origPrimaryTag) {
                    ob.detour = prevPrimaryTag;
                  }

                  if (ob.server && typeof ob.server === 'string') {
                    const s = ob.server.trim();
                    if (s && !s.match(/^[0-9.]+$|^\[[0-9a-fA-F:]+\]$/)) {
                      proxyServerDomains.push(s);
                    }
                  }

                  combinedOutbounds.push(ob);
                }
              }

              prevPrimaryTag = `${tagPrefix}${origPrimaryTag}`;
              if (nodeIdx === allChainNodes.length - 1) {
                primaryProxyTag = prevPrimaryTag;
              }
            }

            let parsedConfig = JSON.parse(mainProfile.config_json || "{}");
            if (parsedConfig.dns && parsedConfig.dns.independent_cache !== undefined) {
              delete parsedConfig.dns.independent_cache;
            }
            parsedConfig.outbounds = combinedOutbounds;
            primaryProxyTag = getPrimaryProxyTag(parsedConfig);

            if (!parsedConfig.route) parsedConfig.route = { rules: [] };
            parsedConfig.route.final = primaryProxyTag;

            const inbounds: any[] = [];
            if (state.proxyEnabled) {
              inbounds.push({
                type: 'mixed',
                tag: 'mixed-in',
                listen: '127.0.0.1',
                listen_port: state.settings.proxy_port || 2080
              });
            }
            if (state.tunEnabled) {
              inbounds.push({
                type: 'tun',
                tag: 'tun-in',
                interface_name: 'FlareVPN-TUN',
                address: ['198.18.0.1/30'],
                mtu: state.settings.mtu_value || 1500,
                auto_route: true,
                strict_route: true,
                stack: state.settings.network_stack || 'mixed',
                route_exclude_address: [
                  "192.168.0.0/16",
                  "10.0.0.0/8",
                  "172.16.0.0/12"
                ]
              });
            }
            parsedConfig.inbounds = inbounds;

            if (!parsedConfig.route) parsedConfig.route = { rules: [] };
            if (!Array.isArray(parsedConfig.route.rules)) parsedConfig.route.rules = [];
            const initialProfileRules = [...parsedConfig.route.rules];

            const systemServiceRules: any[] = [];
            if (state.tunEnabled) {
              parsedConfig.route.auto_detect_interface = true;
              parsedConfig.route.default_domain_resolver = "dns-direct";

              systemServiceRules.push({
                protocol: "dns",
                action: "hijack-dns"
              });
              systemServiceRules.push({
                action: "sniff"
              });
              systemServiceRules.push({
                ip_is_private: true,
                outbound: "direct"
              });
              if (proxyServerDomains.length > 0) {
                systemServiceRules.push({
                  domain: proxyServerDomains,
                  domain_suffix: proxyServerDomains,
                  outbound: "direct"
                });
              }
            }

            const splitRouteRules: any[] = [];
            const splitDnsRules: any[] = [];
            let isWhitelistActive = false;

            if (state.settings.split_tunneling_enabled && state.tunEnabled) {
              const apps = state.settings.split_tunneling_apps || [];
              const rawDomains = state.settings.split_tunneling_domains || [];

              const appsMode = state.settings.split_tunneling_apps_mode || state.settings.split_tunneling_mode || 'whitelist';
              const domainsMode = state.settings.split_tunneling_domains_mode || state.settings.split_tunneling_mode || 'whitelist';

              if (appsMode === 'whitelist' || domainsMode === 'whitelist') {
                isWhitelistActive = true;
              }

              const processNames = new Set<string>();
              const processPaths = new Set<string>();

              for (const item of apps) {
                const trimmed = item.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
                  processPaths.add(trimmed);
                } else {
                  const baseName = trimmed.replace(/\.exe$/i, '');
                  processNames.add(baseName);
                  processNames.add(`${baseName}.exe`);
                  processNames.add(baseName.toLowerCase());
                  processNames.add(`${baseName.toLowerCase()}.exe`);
                }
              }

              const domainSuffixes: string[] = [];
              const ipCidrs: string[] = [];

              for (const raw of rawDomains) {
                const trimmed = raw.trim().toLowerCase().replace(/^(\*\.|\.)/, '');
                if (!trimmed) continue;

                const isIpOrCidr = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?:\/[0-9]{1,2})?$/.test(trimmed) ||
                                   /^[0-9a-fA-F:]+(?:\/[0-9]{1,2})?$/.test(trimmed);

                if (isIpOrCidr) {
                  if (!trimmed.includes('/')) {
                    ipCidrs.push(trimmed.includes(':') ? `${trimmed}/128` : `${trimmed}/32`);
                  } else {
                    ipCidrs.push(trimmed);
                  }
                } else {
                  domainSuffixes.push(trimmed);
                }
              }

              const hasProcessRules = processNames.size > 0 || processPaths.size > 0;
              const hasDomainRules = domainSuffixes.length > 0;
              const hasIpRules = ipCidrs.length > 0;

              if (hasProcessRules) {
                const appOutbound = (appsMode === 'whitelist') ? primaryProxyTag : 'direct';
                const appRule: any = { outbound: appOutbound };
                if (processNames.size > 0) appRule.process_name = Array.from(processNames);
                if (processPaths.size > 0) appRule.process_path = Array.from(processPaths);
                splitRouteRules.push(appRule);
              }

              if (hasDomainRules) {
                const domainOutbound = (domainsMode === 'whitelist') ? primaryProxyTag : 'direct';
                splitRouteRules.push({
                  domain_suffix: domainSuffixes,
                  outbound: domainOutbound
                });

                if (domainsMode === 'whitelist') {
                  splitDnsRules.push({
                    domain_suffix: domainSuffixes,
                    server: 'dns-remote'
                  });
                } else {
                  splitDnsRules.push({
                    domain_suffix: domainSuffixes,
                    server: 'dns-direct'
                  });
                }
              }

              if (hasIpRules) {
                const ipOutbound = (domainsMode === 'whitelist') ? primaryProxyTag : 'direct';
                splitRouteRules.push({
                  ip_cidr: ipCidrs,
                  outbound: ipOutbound
                });
              }
            }

            if (isWhitelistActive) {
              parsedConfig.route.rules = [...systemServiceRules, ...splitRouteRules];
              parsedConfig.route.final = 'direct';
            } else {
              parsedConfig.route.rules = [...systemServiceRules, ...splitRouteRules, ...initialProfileRules];
              parsedConfig.route.final = primaryProxyTag;
            }

            if (state.tunEnabled) {
              if (!parsedConfig.dns) parsedConfig.dns = { servers: [], rules: [] };
              if (!Array.isArray(parsedConfig.dns.servers)) parsedConfig.dns.servers = [];
              if (!Array.isArray(parsedConfig.dns.rules)) parsedConfig.dns.rules = [];

              const hasDnsDirect = parsedConfig.dns.servers.some((s: any) => s && s.tag === 'dns-direct');
              if (!hasDnsDirect) {
                parsedConfig.dns.servers.push({
                  tag: "dns-direct",
                  type: "local",
                  detour: "direct"
                });
              }

              const existingDnsRemote = parsedConfig.dns.servers.find((s: any) => s && s.tag === 'dns-remote');
              if (existingDnsRemote) {
                existingDnsRemote.detour = primaryProxyTag;
                existingDnsRemote.domain_resolver = "dns-direct";
              } else {
                parsedConfig.dns.servers.push({
                  tag: "dns-remote",
                  type: "https",
                  server: "1.1.1.1",
                  path: "/dns-query",
                  detour: primaryProxyTag,
                  domain_resolver: "dns-direct"
                });
              }

              const serviceDnsRules: any[] = [];
              if (proxyServerDomains.length > 0) {
                serviceDnsRules.push({
                  domain: proxyServerDomains,
                  domain_suffix: proxyServerDomains,
                  server: "dns-direct"
                });
              }
              serviceDnsRules.push({
                domain_suffix: [".lan", ".local"],
                server: "dns-direct"
              });

              if (isWhitelistActive) {
                parsedConfig.dns.rules = [...serviceDnsRules, ...splitDnsRules];
                parsedConfig.dns.final = "dns-direct";
              } else {
                const initialDnsRules = parsedConfig.dns.rules || [];
                parsedConfig.dns.rules = [...serviceDnsRules, ...splitDnsRules, ...initialDnsRules];
                parsedConfig.dns.final = "dns-remote";
              }
            }

            parsedConfig = patchConfigWithAdvancedSettings(parsedConfig, state.settings);

            const cleanConfigJson = JSON.stringify(parsedConfig);
            await invoke('start_tunnel', { configJson: cleanConfigJson });

            const timeoutId = setTimeout(async () => {
              if (get().status === 'connecting') {
                try { await invoke('stop_tunnel'); } catch {}
                set({ status: 'disconnected' });
                get().addNotification('error', i18n.t('notifications.connectionTimeout'));
              }
            }, 8000);

            const unsub = useAppStore.subscribe((state) => {
              if (state.status !== 'connecting') {
                clearTimeout(timeoutId);
                unsub();
              }
            });
          } catch (e: any) {
            set({ status: 'disconnected' });
            if (e === 'admin_required') {
              get().addNotification('error', i18n.t('notifications.adminRequired'));
            } else {
              get().addNotification('error', i18n.t('notifications.connectionFailed', { error: String(e) }));
            }
          }
        } else if (current === 'connected') {
          set({ status: 'disconnecting' });
          try {
            await invoke('stop_tunnel');
          } catch (e) {}
          set({ status: 'disconnected' });
          if (get().settings.reset_chain_on_disconnect) {
            get().clearChain();
          }
        }
      },
      reconnectVpn: async () => {
        const state = get();
        if (state.status === 'connected' || state.status === 'connecting') {
          set({ status: 'disconnecting' });
          try {
            await invoke('stop_tunnel');
          } catch (e) {}
          set({ status: 'disconnected' });
          
          await new Promise(resolve => setTimeout(resolve, 500));
          await get().toggleVpn();
        }
      },
      addNotification: (type, message, duration = 5) => {
        const id = crypto.randomUUID();
        set((state) => ({
          notifications: [...state.notifications, { id, type, message, duration }].slice(-3)
        }));
      },
      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }));
      },
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setPingType: (type) => set({ pingType: type }),
      setPingTestUrl: (url) => set({ pingTestUrl: url }),
      setPingDisplayStyle: (style) => set({ pingDisplayStyle: style }),
      setPingTimeout: (timeout) => set({ pingTimeout: timeout }),
      setVpnMode: (mode) => {
        const state = get();
        if (state.vpnMode === mode) return;

        const wasConnected = state.status === 'connected' || state.status === 'connecting';
        const tun = mode === 'TUN';
        const proxy = mode === 'Proxy';

        set({ vpnMode: mode, tunEnabled: tun, proxyEnabled: proxy });

        if (wasConnected) {
          get().reconnectVpn();
        }
      },
      setTunEnabled: (enabled: boolean) => {
        const state = get();
        if (state.tunEnabled === enabled) return;
        const wasConnected = state.status === 'connected' || state.status === 'connecting';
        set({ tunEnabled: enabled });
        if (wasConnected) {
          get().reconnectVpn();
        }
      },
      setProxyEnabled: (enabled: boolean) => {
        const state = get();
        if (state.proxyEnabled === enabled) return;
        const wasConnected = state.status === 'connected' || state.status === 'connecting';
        set({ proxyEnabled: enabled });
        if (wasConnected) {
          get().reconnectVpn();
        }
      },
      setLanguage: (lang) => set({ language: lang }),
      loadSettings: async () => {
        try {
          const settings: AppSettings = await invoke('get_app_settings');
          set({ settings });
          if (settings.selected_profile_id) {
            set({ selectedProfileId: settings.selected_profile_id });
          } else {
            const currentSelected = get().selectedProfileId;
            if (currentSelected) {
              get().updateSetting('selected_profile_id', currentSelected);
            }
          }
        } catch (e) {
          console.error("Failed to load settings:", e);
        }
      },
      updateSetting: async (key, value) => {


        let newSettings!: AppSettings;
        set((state) => {
          newSettings = { ...state.settings, [key]: value };
          return { settings: newSettings };
        });
        
        try {
          await invoke('update_app_settings', { settings: newSettings });
        } catch (e) {
          console.error("Failed to save setting:", e);
        }
      },
      updateSubscription: async (id: string) => {
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (!isTauri) {
          throw new Error(i18n.t('notifications.backendNotRunning'));
        }
        
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) {
          throw new Error(i18n.t('notifications.subscriptionNotFound'));
        }
        if (!sub.urlOrBase64.startsWith('http')) {
          throw new Error(i18n.t('notifications.onlyHttpSubscriptions'));
        }
        
        try {
          const res: any = await invoke('parse_clipboard', { text: sub.urlOrBase64 });
          set((s) => ({
            subscriptions: s.subscriptions.map(existing => {
              if (existing.id === id) {
                return {
                  ...existing,
                  profiles: (() => {
                    const existingProfilesPool = [...existing.profiles];
                    return res.profiles.map((p: any) => {
                      const existingIndex = existingProfilesPool.findIndex(ep => {
                        if (ep.uri === 'internal://json' && p.uri === 'internal://json') {
                          return ep.name === p.name;
                        }
                        return (ep.uri && p.uri && ep.uri === p.uri) || 
                               (!ep.uri && !p.uri && ep.name === p.name && ep.serverDescription === p.server_description);
                      });
                      
                      let existingProfile = undefined;
                      if (existingIndex !== -1) {
                        existingProfile = existingProfilesPool[existingIndex];
                        existingProfilesPool.splice(existingIndex, 1);
                      }
                      
                      return {
                        ...p, 
                        subscription_id: id, 
                        id: existingProfile?.id || p.id || crypto.randomUUID() 
                      };
                    });
                  })(),
                  upload: res.upload,
                  download: res.download,
                  total: res.total,
                  expire: res.expire,
                  updateInterval: res.update_interval ? res.update_interval * 1000 : 0,
                  name: (res.name && res.name !== 'Imported Profiles' && res.name !== 'URI Profile') ? res.name : existing.name,
                  description: res.description || '',
                  supportUrl: res.support_url || '',
                  webPageUrl: res.web_page_url || '',
                };
              }
              return existing;
            })
          }));
        } catch (error) {
          throw error;
        }
      },
      updateSubscriptionDetails: async (id: string, name: string, urlOrBase64: string) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return;

        const trimmedName = name.trim() || sub.name;
        const trimmedUrl = urlOrBase64.trim() || sub.urlOrBase64;

        const nameChanged = sub.name !== trimmedName;
        const urlChanged = sub.urlOrBase64 !== trimmedUrl;

        if (!nameChanged && !urlChanged) return;

        set((s) => ({
          subscriptions: s.subscriptions.map(existing => {
            if (existing.id === id) {
              return {
                ...existing,
                name: trimmedName,
                urlOrBase64: trimmedUrl,
              };
            }
            return existing;
          })
        }));

        if (urlChanged && trimmedUrl.startsWith('http')) {
          try {
            await get().updateSubscription(id);
          } catch (e) {
            console.warn("Updated subscription URL, but auto-refresh encountered issue:", e);
          }
        }
      },
      removeSubscription: async (id: string) => {
        try {
          await invoke('delete_subscription_profiles', { subscriptionId: id });
          set((state) => ({
            subscriptions: state.subscriptions.filter(s => s.id !== id)
          }));
        } catch (e) {
          console.error("Failed to remove subscription:", e);
          throw e;
        }
      },
      startPing: async (profileIds) => {
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (!isTauri) {
            get().addNotification('error', i18n.t('notifications.backendNotRunning'));
            return;
        }

        const state = get();
        
        set((s) => {
          const newSet = new Set(s.pingedProfileIds);
          profileIds.forEach(id => newSet.add(id));
          const newResults: Record<string, PingResult> = { ...s.pingResults };
          profileIds.forEach(id => {
            newResults[id] = { status: 'loading' };
          });
          return { pingResults: newResults, pingedProfileIds: newSet };
        });

        const allProfiles = state.subscriptions.flatMap(s => s.profiles);
        const profilesToPing = profileIds
            .map(id => allProfiles.find(p => p.id === id))
            .filter((p): p is Profile => p !== undefined);
            
        const backendProfiles = profilesToPing.map(p => ({
            id: p.id,
            name: p.name,
            uri: p.uri || "",
            config_json: p.config_json || "{}",
            server_description: p.serverDescription || "",
            subscription_id: null,
            protocol: p.protocol || null
        }));


        const pendingUpdates: Record<string, PingResult> = {};
        let batchTimer: any = null;

        const flushUpdates = () => {
            if (batchTimer) {
                clearTimeout(batchTimer);
                batchTimer = null;
            }
            const keys = Object.keys(pendingUpdates);
            if (keys.length === 0) return;

            const updatesToApply: Record<string, PingResult> = {};
            for (const key of keys) {
                updatesToApply[key] = pendingUpdates[key];
                delete pendingUpdates[key];
            }

            set((s) => ({
                pingResults: {
                    ...s.pingResults,
                    ...updatesToApply,
                }
            }));
        };

        const queueUpdate = (strId: string, result: PingResult) => {
            pendingUpdates[strId] = result;
            if (!batchTimer) {
                batchTimer = setTimeout(flushUpdates, 100);
            }
        };

        try {
            if (state.pingType === 'proxy') {
                const unlisten = await listen('ping_result', (event: any) => {
                    const res = event.payload;
                    const strId = res.profile_id?.toString();
                    if (strId) {
                        queueUpdate(strId, {
                            status: 'done',
                            latency: res.latency_ms > 0 ? res.latency_ms : undefined,
                            error: (res.latency_ms <= 0 || res.error) ? (res.error || 'Error') : undefined
                        });
                    }
                });

                try {
                    await invoke('ping_profiles_proxy', {
                        profiles: backendProfiles,
                        testUrl: state.pingTestUrl,
                        timeoutMs: state.pingTimeout * 1000
                    });
                } finally {
                    unlisten();
                    flushUpdates();
                }
                
                set((s) => {
                    const newResults = { ...s.pingResults };
                    profileIds.forEach(id => {
                        if (newResults[id]?.status === 'loading') {
                            newResults[id] = { status: 'done', error: 'Error' };
                        }
                    });
                    return { pingResults: newResults };
                });
            } else {

                const CONCURRENCY_LIMIT = 15;
                let currentIndex = 0;

                const runWorker = async () => {
                    while (currentIndex < backendProfiles.length) {
                        const bp = backendProfiles[currentIndex++];
                        if (!bp) break;
                        const strId = bp.id.toString();
                        try {
                            const res: any = await invoke('ping_profile_direct', {
                                profile: bp,
                                method: state.pingType,
                                timeoutMs: state.pingTimeout * 1000
                            });
                            queueUpdate(strId, {
                                status: 'done',
                                latency: res.latency_ms > 0 ? res.latency_ms : undefined,
                                error: (res.latency_ms <= 0 || res.error) ? (res.error || 'Error') : undefined
                            });
                        } catch (e) {
                            queueUpdate(strId, { status: 'done', error: 'Error' });
                        }
                    }
                };

                const workers = Array.from(
                    { length: Math.min(CONCURRENCY_LIMIT, backendProfiles.length) },
                    () => runWorker()
                );
                await Promise.all(workers);
                flushUpdates();

                set((s) => {
                    const newResults = { ...s.pingResults };
                    profileIds.forEach(id => {
                        if (newResults[id]?.status === 'loading') {
                            newResults[id] = { status: 'done', error: 'Error' };
                        }
                    });
                    return { pingResults: newResults };
                });
            }
        } catch (e) {
            console.error("Ping failed:", e);
            flushUpdates();
            set((s) => {
                const newResults = { ...s.pingResults };
                profileIds.forEach(id => {
                    newResults[id] = { status: 'done', error: 'Error' };
                });
                return { pingResults: newResults };
            });
        }
      }
    }),
    {
      name: 'flarevpn-storage',
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        selectedProfileId: state.selectedProfileId,
        chainProfileIds: state.chainProfileIds,
        pingType: state.pingType,
        pingTestUrl: state.pingTestUrl,
        pingDisplayStyle: state.pingDisplayStyle,
        pingTimeout: state.pingTimeout,
        language: state.language,
        themeStyle: state.themeStyle,
        customColorEnabled: state.customColorEnabled,
        customAccentColor: state.customAccentColor,
        settings: state.settings,
        tunEnabled: state.tunEnabled,
        proxyEnabled: state.proxyEnabled,
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        tunEnabled: persistedState?.tunEnabled !== undefined 
          ? Boolean(persistedState.tunEnabled) 
          : (persistedState?.vpnMode === 'Proxy' ? false : true),
        proxyEnabled: persistedState?.proxyEnabled !== undefined 
          ? Boolean(persistedState.proxyEnabled) 
          : (persistedState?.vpnMode === 'Proxy' ? true : false),
      }),
    }
  )
);
