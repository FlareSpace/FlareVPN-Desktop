import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { ChevronRight, Check } from 'lucide-react';
import './BasicSettingsTab.css';
import { InfoFilled, CloseFilled } from './icons';

export default function BasicSettingsTab() {
  const { t } = useTranslation();
  const settings = useAppStore(state => state.settings);
  const updateSetting = useAppStore(state => state.updateSetting);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'apps' | 'domains'>('apps');
  const [localApps, setLocalApps] = useState<string[]>(settings.split_tunneling_apps || []);
  const [localDomains, setLocalDomains] = useState<string[]>(settings.split_tunneling_domains || []);
  const [localMode, setLocalMode] = useState<'blacklist' | 'whitelist'>(
    (settings.split_tunneling_mode as 'blacklist' | 'whitelist') || 'whitelist'
  );
  const [inputValue, setInputValue] = useState('');


  const [isSplitModeMenuOpen, setIsSplitModeMenuOpen] = useState(false);
  const splitModeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (splitModeMenuRef.current && !splitModeMenuRef.current.contains(event.target as Node)) {
        setIsSplitModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenModal = () => {
    setLocalApps(settings.split_tunneling_apps || []);
    setLocalDomains(settings.split_tunneling_domains || []);
    setLocalMode((settings.split_tunneling_mode as 'blacklist' | 'whitelist') || 'whitelist');
    setInputValue('');
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    updateSetting('split_tunneling_apps', localApps);
    updateSetting('split_tunneling_domains', localDomains);
    updateSetting('split_tunneling_mode', localMode);
    setIsModalOpen(false);
  };

  const handleAddApp = () => {
    if (inputValue.trim() && !localApps.includes(inputValue.trim())) {
      setLocalApps([...localApps, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemoveApp = (app: string) => {
    setLocalApps(localApps.filter(a => a !== app));
  };

  const handleAddDomain = () => {
    const trimmed = inputValue.trim().toLowerCase().replace(/^\./, '');
    if (trimmed && !localDomains.includes(trimmed)) {
      setLocalDomains([...localDomains, trimmed]);
      setInputValue('');
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setLocalDomains(localDomains.filter(d => d !== domain));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (activeTab === 'apps') {
        handleAddApp();
      } else {
        handleAddDomain();
      }
    }
  };

  return (
    <div className="basic-tab">
      <div className="tab-header">
        <h1>{t('sidebar.basic')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">{t('basicTab.splitTunneling')}</h2>
          <div className="settings-card split-tunneling-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('basicTab.splitTunneling')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.split_tunneling_enabled || false}
                  onChange={(e) => updateSetting('split_tunneling_enabled', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {settings.split_tunneling_enabled && (
              <div className="split-tunneling-expanded">
                <p className="split-tunneling-desc">
                  {t('basicTab.splitTunnelingDesc')}
                </p>
                <button className="change-btn" onClick={handleOpenModal}>
                  {t('basicTab.change')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('basicTab.proxyPort')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('basicTab.proxyPort')}</span>
                <span className="setting-desc" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', display: 'block' }}>
                  {t('basicTab.proxyPortDesc')}
                </span>
              </div>
              <input
                type="number"
                value={settings.proxy_port || 2080}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0 && val < 65536) {
                    updateSetting('proxy_port', val);
                  }
                }}
                min={1024}
                max={65535}
                style={{
                  width: '90px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-content blurred-modal">
            <div className="modal-header">
              <h2>{activeTab === 'apps' ? t('basicTab.apps') : t('basicTab.domains')}</h2>
              <div className="modal-tabs">
                <button 
                  className={`modal-tab ${activeTab === 'apps' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('apps'); setInputValue(''); }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H10V10H4V4Z" fill="currentColor" />
                    <path d="M14 4H20V10H14V4Z" fill="currentColor" />
                    <path d="M4 14H10V20H4V14Z" fill="currentColor" />
                    <path d="M14 14H20V20H14V14Z" fill="currentColor" />
                  </svg>
                </button>
                <button 
                  className={`modal-tab ${activeTab === 'domains' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('domains'); setInputValue(''); }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.06 19.43 4 16.05 4 12C4 11.68 4.03 11.36 4.08 11.05L7 14V15C7 16.1 7.9 17 9 17V19.54L11 19.93ZM19.64 15.04C18.67 15.65 17.52 16 16.29 16C14.47 16 13 14.53 13 12.71C13 11.64 13.51 10.66 14.34 10.05C15.17 9.44 16.29 9.17 17.38 9.42C18.42 9.66 19.26 10.4 19.64 11.41C19.87 12.01 20 12.65 20 13.31C20 13.91 19.88 14.5 19.64 15.04Z" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="modal-body">
              {activeTab === 'apps' && (
                <div className="apps-list-container">
                  <div className="apps-input-wrapper">
                    <input 
                      type="text" 
                      placeholder={t('basicTab.addAppPlaceholder')}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button onClick={handleAddApp} className="add-app-btn">+</button>
                  </div>
                  <div className="apps-list">
                    {localApps.map((app, index) => (
                      <div key={index} className="app-item">
                        <span>{app}</span>
                        <button onClick={() => handleRemoveApp(app)}><CloseFilled size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'domains' && (
                <div className="apps-list-container">
                  <div className="apps-input-wrapper">
                    <input 
                      type="text" 
                      placeholder="e.g. google.com"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button onClick={handleAddDomain} className="add-app-btn">+</button>
                  </div>
                  <div className="apps-list">
                    {localDomains.map((domain, index) => (
                      <div key={index} className="app-item">
                        <span>{domain}</span>
                        <button onClick={() => handleRemoveDomain(domain)}><CloseFilled size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-controls">
              <div className="control-row">
                <span className="control-label">
                  {t('basicTab.mode')} 
                  <InfoFilled size={14} className="info-icon" />
                </span>
                <div className="custom-dropdown-container" ref={splitModeMenuRef}>
                  <button
                    type="button"
                    className="custom-dropdown-trigger"
                    onClick={() => setIsSplitModeMenuOpen(!isSplitModeMenuOpen)}
                  >
                    <span>{localMode === 'whitelist' ? t('basicTab.whitelist') : t('basicTab.blacklist')}</span>
                    <ChevronRight className={`dropdown-arrow ${isSplitModeMenuOpen ? 'open' : ''}`} size={16} />
                  </button>

                  {isSplitModeMenuOpen && (
                    <div className="mode-context-menu">
                      <div
                        className={`mode-context-menu-item ${localMode === 'whitelist' ? 'active' : ''}`}
                        onClick={() => { setLocalMode('whitelist'); setIsSplitModeMenuOpen(false); }}
                      >
                        <span>{t('basicTab.whitelist')}</span>
                        {localMode === 'whitelist' && <Check size={16} />}
                      </div>
                      <div
                        className={`mode-context-menu-item ${localMode === 'blacklist' ? 'active' : ''}`}
                        onClick={() => { setLocalMode('blacklist'); setIsSplitModeMenuOpen(false); }}
                      >
                        <span>{t('basicTab.blacklist')}</span>
                        {localMode === 'blacklist' && <Check size={16} />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                {t('basicTab.cancel')}
              </button>
              <button className="save-btn" onClick={handleSaveModal}>
                {t('basicTab.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

