import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { ChevronRight, Check } from 'lucide-react';
import './AdvancedSettingsTab.css';

export default function AdvancedSettingsTab() {
  const { t } = useTranslation();
  const settings = useAppStore(state => state.settings);
  const updateSetting = useAppStore(state => state.updateSetting);


  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  const getNetworkStackDescription = (stack: string) => {
    switch (stack) {
      case 'system':
        return t('advancedTab.networkStackDescSystem');
      case 'gvisor':
        return t('advancedTab.networkStackDescGvisor');
      case 'mixed':
      default:
        return t('advancedTab.networkStackDescMixed');
    }
  };

  return (
    <div className="advanced-tab" ref={dropdownRef}>
      <div className="tab-header">
        <h1>{t('sidebar.advanced')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.fragmentationTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.fragmentation')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.fragmentation_enabled || false}
                  onChange={(e) => updateSetting('fragmentation_enabled', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {settings.fragmentation_enabled && (
              <div className="card-expanded-content">
                <div className="setting-divider"></div>
                
                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.fallback')}</span>
                  <div className="custom-dropdown-container">
                    <button
                      type="button"
                      className="dropdown-trigger-btn"
                      onClick={() => toggleDropdown('fragmentation_fallback')}
                    >
                      <span>
                        {settings.fragmentation_fallback === 'enabled'
                          ? t('advancedTab.fallbackEnable')
                          : t('advancedTab.fallbackDisable')}
                      </span>
                      <ChevronRight className={`dropdown-arrow ${openDropdown === 'fragmentation_fallback' ? 'open' : ''}`} size={16} />
                    </button>

                    {openDropdown === 'fragmentation_fallback' && (
                      <div className="context-menu">
                        <div
                          className={`context-menu-item ${settings.fragmentation_fallback === 'enabled' ? 'active' : ''}`}
                          onClick={() => {
                            updateSetting('fragmentation_fallback', 'enabled');
                            setOpenDropdown(null);
                          }}
                        >
                          <span>{t('advancedTab.fallbackEnable')}</span>
                          {settings.fragmentation_fallback === 'enabled' && <Check size={16} />}
                        </div>
                        <div
                          className={`context-menu-item ${settings.fragmentation_fallback === 'disabled' ? 'active' : ''}`}
                          onClick={() => {
                            updateSetting('fragmentation_fallback', 'disabled');
                            setOpenDropdown(null);
                          }}
                        >
                          <span>{t('advancedTab.fallbackDisable')}</span>
                          {settings.fragmentation_fallback === 'disabled' && <Check size={16} />}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.timeout')}</span>
                  <input
                    type="number"
                    className="number-input-styled"
                    value={settings.fragmentation_timeout ?? 300}
                    onChange={(e) => updateSetting('fragmentation_timeout', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>
          <p className="section-description">{t('advancedTab.fragmentationDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.muxTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.mux')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.mux_enabled || false}
                  onChange={(e) => updateSetting('mux_enabled', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {settings.mux_enabled && (
              <div className="card-expanded-content">
                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.method')}</span>
                  <div className="custom-dropdown-container">
                    <button
                      type="button"
                      className="dropdown-trigger-btn"
                      onClick={() => toggleDropdown('mux_protocol')}
                    >
                      <span>{settings.mux_protocol || 'h2mux'}</span>
                      <ChevronRight className={`dropdown-arrow ${openDropdown === 'mux_protocol' ? 'open' : ''}`} size={16} />
                    </button>

                    {openDropdown === 'mux_protocol' && (
                      <div className="context-menu">
                        {['h2mux', 'smux', 'yamux'].map((proto) => (
                          <div
                            key={proto}
                            className={`context-menu-item ${settings.mux_protocol === proto ? 'active' : ''}`}
                            onClick={() => {
                              updateSetting('mux_protocol', proto);
                              setOpenDropdown(null);
                            }}
                          >
                            <span>{proto}</span>
                            {settings.mux_protocol === proto && <Check size={16} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.concurrency')}</span>
                  <input
                    type="number"
                    className="number-input-styled"
                    min={1}
                    max={128}
                    value={settings.mux_concurrency ?? 4}
                    onChange={(e) => updateSetting('mux_concurrency', parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.addPadding')}</span>
                  <div className="custom-dropdown-container">
                    <button
                      type="button"
                      className="dropdown-trigger-btn"
                      onClick={() => toggleDropdown('mux_padding')}
                    >
                      <span>{settings.mux_padding ? t('advancedTab.yes') : t('advancedTab.no')}</span>
                      <ChevronRight className={`dropdown-arrow ${openDropdown === 'mux_padding' ? 'open' : ''}`} size={16} />
                    </button>

                    {openDropdown === 'mux_padding' && (
                      <div className="context-menu">
                        <div
                          className={`context-menu-item ${settings.mux_padding ? 'active' : ''}`}
                          onClick={() => {
                            updateSetting('mux_padding', true);
                            setOpenDropdown(null);
                          }}
                        >
                          <span>{t('advancedTab.yes')}</span>
                          {settings.mux_padding && <Check size={16} />}
                        </div>
                        <div
                          className={`context-menu-item ${!settings.mux_padding ? 'active' : ''}`}
                          onClick={() => {
                            updateSetting('mux_padding', false);
                            setOpenDropdown(null);
                          }}
                        >
                          <span>{t('advancedTab.no')}</span>
                          {!settings.mux_padding && <Check size={16} />}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="section-description">{t('advancedTab.muxDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.tlsSpoofTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.tlsSpoof')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.tls_spoof_enabled || false}
                  onChange={(e) => updateSetting('tls_spoof_enabled', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {settings.tls_spoof_enabled && (
              <div className="card-expanded-content">
                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.domain')}</span>
                  <input
                    type="text"
                    className="text-input-styled"
                    value={settings.tls_spoof_domain || ''}
                    onChange={(e) => updateSetting('tls_spoof_domain', e.target.value)}
                    placeholder="google.com"
                  />
                </div>

                <div className="setting-divider"></div>

                <div className="setting-row">
                  <span className="setting-label-sub">{t('advancedTab.method')}</span>
                  <div className="custom-dropdown-container">
                    <button
                      type="button"
                      className="dropdown-trigger-btn"
                      onClick={() => toggleDropdown('tls_spoof_method')}
                    >
                      <span>{settings.tls_spoof_method || 'wrong-ack'}</span>
                      <ChevronRight className={`dropdown-arrow ${openDropdown === 'tls_spoof_method' ? 'open' : ''}`} size={16} />
                    </button>

                    {openDropdown === 'tls_spoof_method' && (
                      <div className="context-menu">
                        {['wrong-ack', 'wrong-md5', 'wrong-timestamp'].map((method) => (
                          <div
                            key={method}
                            className={`context-menu-item ${settings.tls_spoof_method === method ? 'active' : ''}`}
                            onClick={() => {
                              updateSetting('tls_spoof_method', method);
                              setOpenDropdown(null);
                            }}
                          >
                            <span>{method}</span>
                            {settings.tls_spoof_method === method && <Check size={16} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="section-description">{t('advancedTab.tlsSpoofDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.fingerprintTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.tlsFingerprint')}</span>
              <div className="custom-dropdown-container">
                <button
                  type="button"
                  className="dropdown-trigger-btn"
                  onClick={() => toggleDropdown('tls_fingerprint')}
                >
                  <span className="capitalize">{settings.tls_fingerprint || 'auto'}</span>
                  <ChevronRight className={`dropdown-arrow ${openDropdown === 'tls_fingerprint' ? 'open' : ''}`} size={16} />
                </button>

                {openDropdown === 'tls_fingerprint' && (
                  <div className="context-menu">
                    {['auto', 'chrome', 'firefox', 'safari', 'edge', 'ios', 'android', 'randomized'].map((fp) => (
                      <div
                        key={fp}
                        className={`context-menu-item ${settings.tls_fingerprint === fp ? 'active' : ''}`}
                        onClick={() => {
                          updateSetting('tls_fingerprint', fp);
                          setOpenDropdown(null);
                        }}
                      >
                        <span className="capitalize">{fp === 'auto' ? 'Auto' : fp}</span>
                        {settings.tls_fingerprint === fp && <Check size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="section-description">{t('advancedTab.fingerprintDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.remoteDnsTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.remoteDns')}</span>
              <div className="custom-dropdown-container">
                <button
                  type="button"
                  className="dropdown-trigger-btn"
                  onClick={() => toggleDropdown('remote_dns')}
                >
                  <span>
                    {settings.remote_dns === 'auto'
                      ? (t('advancedTab.auto') || 'Авто')
                      : settings.remote_dns}
                  </span>
                  <ChevronRight className={`dropdown-arrow ${openDropdown === 'remote_dns' ? 'open' : ''}`} size={16} />
                </button>

                {openDropdown === 'remote_dns' && (
                  <div className="context-menu">
                    {[
                      { id: 'auto', name: t('advancedTab.auto') || 'Авто' },
                      { id: 'cloudflare', name: 'Cloudflare (1.1.1.1)' },
                      { id: 'google', name: 'Google (8.8.8.8)' },
                      { id: 'adguard', name: 'AdGuard' },
                      { id: 'quad9', name: 'Quad9' },
                    ].map((dns) => (
                      <div
                        key={dns.id}
                        className={`context-menu-item ${settings.remote_dns === dns.id ? 'active' : ''}`}
                        onClick={() => {
                          updateSetting('remote_dns', dns.id);
                          setOpenDropdown(null);
                        }}
                      >
                        <span>{dns.name}</span>
                        {settings.remote_dns === dns.id && <Check size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.useDoh')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.remote_dns_doh ?? true}
                  onChange={(e) => updateSetting('remote_dns_doh', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.remoteDnsStrictlyTun')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.remote_dns_strictly_tun || false}
                  onChange={(e) => updateSetting('remote_dns_strictly_tun', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.fakeIpTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.enableFakeIp')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.fake_ip_enabled || false}
                  onChange={(e) => updateSetting('fake_ip_enabled', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
          <p className="section-description">{t('advancedTab.fakeIpDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.chainManagementTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.resetChainOnDisconnect')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.reset_chain_on_disconnect || false}
                  onChange={(e) => updateSetting('reset_chain_on_disconnect', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
          <p className="section-description">{t('advancedTab.chainManagementDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.mtuTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <div className="mtu-label-wrapper">
                <span className="setting-label">{t('advancedTab.mtu')}</span>
                <button
                  type="button"
                  className={`mtu-badge ${settings.mtu_auto ? 'active' : ''}`}
                  onClick={() => updateSetting('mtu_auto', !settings.mtu_auto)}
                >
                  {t('advancedTab.auto')}
                </button>
              </div>
              <input
                type="number"
                className="number-input-styled mtu-input"
                value={settings.mtu_value ?? 1500}
                onChange={(e) => updateSetting('mtu_value', parseInt(e.target.value) || 1500)}
              />
            </div>
          </div>
          <p className="section-description">{t('advancedTab.mtuDesc')}</p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('advancedTab.networkStackTitle')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('advancedTab.use')}</span>
              <div className="custom-dropdown-container">
                <button
                  type="button"
                  className="dropdown-trigger-btn"
                  onClick={() => toggleDropdown('network_stack')}
                >
                  <span>{settings.network_stack || 'mixed'}</span>
                  <ChevronRight className={`dropdown-arrow ${openDropdown === 'network_stack' ? 'open' : ''}`} size={16} />
                </button>

                {openDropdown === 'network_stack' && (
                  <div className="context-menu">
                    {['mixed', 'system', 'gvisor'].map((stack) => (
                      <div
                        key={stack}
                        className={`context-menu-item ${settings.network_stack === stack ? 'active' : ''}`}
                        onClick={() => {
                          updateSetting('network_stack', stack);
                          setOpenDropdown(null);
                        }}
                      >
                        <span>{stack}</span>
                        {settings.network_stack === stack && <Check size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="section-description">{getNetworkStackDescription(settings.network_stack || 'mixed')}</p>
        </div>
      </div>
    </div>
  );
}
