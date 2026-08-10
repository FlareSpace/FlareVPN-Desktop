import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { ChevronRight, Check, Search, RefreshCw, Loader2, AppWindow, ArrowLeft, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import './BasicSettingsTab.css';
import { InfoFilled, CloseFilled } from './icons';

interface ProcessItem {
  name: string;
  path?: string;
}

export default function BasicSettingsTab() {
  const { t } = useTranslation();
  const settings = useAppStore(state => state.settings);
  const updateSetting = useAppStore(state => state.updateSetting);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'apps' | 'domains'>('apps');
  const [localApps, setLocalApps] = useState<string[]>(settings.split_tunneling_apps || []);
  const [localDomains, setLocalDomains] = useState<string[]>(settings.split_tunneling_domains || []);
  const [localAppsMode, setLocalAppsMode] = useState<'blacklist' | 'whitelist'>(
    (settings.split_tunneling_apps_mode as 'blacklist' | 'whitelist') ||
    (settings.split_tunneling_mode as 'blacklist' | 'whitelist') ||
    'whitelist'
  );
  const [localDomainsMode, setLocalDomainsMode] = useState<'blacklist' | 'whitelist'>(
    (settings.split_tunneling_domains_mode as 'blacklist' | 'whitelist') ||
    (settings.split_tunneling_mode as 'blacklist' | 'whitelist') ||
    'whitelist'
  );
  const [inputValue, setInputValue] = useState('');


  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [runningProcesses, setRunningProcesses] = useState<ProcessItem[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
  const [processSearch, setProcessSearch] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const [isSplitModeMenuOpen, setIsSplitModeMenuOpen] = useState(false);
  const splitModeMenuRef = useRef<HTMLDivElement>(null);

  const fetchRunningProcesses = useCallback(async () => {
    setIsLoadingProcesses(true);
    try {
      const processes = await invoke<ProcessItem[]>('get_active_processes');
      setRunningProcesses(processes || []);
    } catch (err) {
      console.error('Failed to fetch running processes:', err);
    } finally {
      setIsLoadingProcesses(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (splitModeMenuRef.current && !splitModeMenuRef.current.contains(event.target as Node)) {
        setIsSplitModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isModalOpen]);

  const handleOpenModal = () => {
    const apps = settings.split_tunneling_apps || [];
    setLocalApps(apps);
    setLocalDomains(settings.split_tunneling_domains || []);
    setLocalAppsMode(
      (settings.split_tunneling_apps_mode as 'blacklist' | 'whitelist') ||
      (settings.split_tunneling_mode as 'blacklist' | 'whitelist') ||
      'whitelist'
    );
    setLocalDomainsMode(
      (settings.split_tunneling_domains_mode as 'blacklist' | 'whitelist') ||
      (settings.split_tunneling_mode as 'blacklist' | 'whitelist') ||
      'whitelist'
    );
    setInputValue('');
    setIsPickerOpen(false);
    setShowManualInput(false);
    setProcessSearch('');
    setIsModalOpen(true);
  };

  const handleOpenPicker = () => {
    setIsPickerOpen(true);
    setProcessSearch('');
    fetchRunningProcesses();
  };

  const handleSaveModal = () => {
    updateSetting('split_tunneling_apps', localApps);
    updateSetting('split_tunneling_domains', localDomains);
    updateSetting('split_tunneling_apps_mode', localAppsMode);
    updateSetting('split_tunneling_domains_mode', localDomainsMode);
    updateSetting('split_tunneling_mode', localAppsMode);
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
    const trimmed = inputValue.trim().toLowerCase().replace(/^(\*\.|\.)/, '');
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

  const filteredProcesses = runningProcesses.filter(proc =>
    proc.name.toLowerCase().includes(processSearch.toLowerCase()) ||
    (proc.path && proc.path.toLowerCase().includes(processSearch.toLowerCase()))
  );

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

            <div className={`card-collapsible ${settings.split_tunneling_enabled ? 'expanded' : ''}`}>
              <div className="card-collapsible-inner">
                <div className="split-tunneling-expanded">
                  <p className="split-tunneling-desc">
                    {t('basicTab.splitTunnelingDesc')}
                  </p>
                  <button className="change-btn" onClick={handleOpenModal}>
                    {t('basicTab.change')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('basicTab.proxyPort')}</h2>
          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('basicTab.proxyPort')}</span>
                <span className="setting-desc">
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
                className="port-input"
              />
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div 
          className="modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-content blurred-modal">
            <div className="modal-header">
              <h2>
                {isPickerOpen 
                  ? t('basicTab.selectProcess') 
                  : (activeTab === 'apps' ? t('basicTab.apps') : t('basicTab.domains'))
                }
              </h2>
              {!isPickerOpen && (
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
              )}
            </div>

            <div className="modal-body">
              {activeTab === 'apps' && (
                <>
                  {isPickerOpen ? (
                    <div className="process-picker-container">
                      <div className="picker-search-bar">
                        <button className="picker-back-btn" onClick={() => setIsPickerOpen(false)}>
                          <ArrowLeft size={16} />
                        </button>
                        <div className="search-input-wrapper">
                          <Search size={15} className="search-icon" />
                          <input
                            type="text"
                            placeholder={t('basicTab.searchProcessPlaceholder')}
                            value={processSearch}
                            onChange={(e) => setProcessSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <button 
                          className="refresh-btn" 
                          onClick={fetchRunningProcesses} 
                          title={t('basicTab.refreshProcesses')}
                          disabled={isLoadingProcesses}
                        >
                          <RefreshCw size={15} className={isLoadingProcesses ? 'spinning' : ''} />
                        </button>
                      </div>

                      <div className="process-list">
                        {isLoadingProcesses ? (
                          <div className="process-loading">
                            <Loader2 className="spinning" size={24} />
                            <span>{t('basicTab.loadingProcesses')}</span>
                          </div>
                        ) : filteredProcesses.length === 0 ? (
                          <div className="process-empty">
                            <span>{t('basicTab.noProcessesFound')}</span>
                          </div>
                        ) : (
                          filteredProcesses.map((proc) => {
                            const isAdded = localApps.some(a => a.toLowerCase() === proc.name.toLowerCase());
                            return (
                              <div
                                key={proc.name}
                                className={`process-row ${isAdded ? 'added' : ''}`}
                                onClick={() => {
                                  if (isAdded) {
                                    handleRemoveApp(proc.name);
                                  } else {
                                    setLocalApps([...localApps, proc.name]);
                                  }
                                }}
                              >
                                <div className="process-info">
                                  <AppWindow size={16} className="process-icon" />
                                  <span className="process-name">{proc.name}</span>
                                </div>
                                {isAdded ? (
                                  <span className="process-added-tag">
                                    <Check size={14} /> {t('basicTab.alreadyAdded')}
                                  </span>
                                ) : (
                                  <button className="process-add-action">
                                    <Plus size={16} />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="picker-footer">
                        {!showManualInput ? (
                          <button className="manual-toggle-btn" onClick={() => setShowManualInput(true)}>
                            {t('basicTab.addManual')}
                          </button>
                        ) : (
                          <div className="apps-input-wrapper manual-input-wrapper">
                            <input 
                              type="text" 
                              placeholder={t('basicTab.addAppPlaceholder')}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              autoFocus
                            />
                            <button onClick={() => { handleAddApp(); setInputValue(''); }} className="add-app-btn">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="apps-list-container">
                      <div className="apps-header-action">
                        <button className="open-picker-btn" onClick={handleOpenPicker}>
                          <Plus size={18} />
                          <span>{t('basicTab.selectFromRunning')}</span>
                        </button>
                      </div>

                      <div className="apps-list">
                        {localApps.map((app, index) => (
                          <div key={index} className="app-item">
                            <div className="app-item-info">
                              <AppWindow size={16} className="app-item-icon" />
                              <span>{app}</span>
                            </div>
                            <button onClick={() => handleRemoveApp(app)}>
                              <CloseFilled size={16} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="manual-input-footer">
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
                      </div>
                    </div>
                  )}
                </>
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
                  {t(activeTab === 'apps' ? 'basicTab.appsMode' : 'basicTab.domainsMode')} 
                  <InfoFilled size={14} className="info-icon" />
                </span>
                <div className="custom-dropdown-container" ref={splitModeMenuRef}>
                  {(() => {
                    const currentMode = activeTab === 'apps' ? localAppsMode : localDomainsMode;
                    const setMode = (mode: 'whitelist' | 'blacklist') => {
                      if (activeTab === 'apps') {
                        setLocalAppsMode(mode);
                      } else {
                        setLocalDomainsMode(mode);
                      }
                      setIsSplitModeMenuOpen(false);
                    };

                    return (
                      <>
                        <button
                          type="button"
                          className="custom-dropdown-trigger"
                          onClick={() => setIsSplitModeMenuOpen(!isSplitModeMenuOpen)}
                        >
                          <span>{currentMode === 'whitelist' ? t('basicTab.whitelist') : t('basicTab.blacklist')}</span>
                          <ChevronRight className={`dropdown-arrow ${isSplitModeMenuOpen ? 'open' : ''}`} size={16} />
                        </button>

                        {isSplitModeMenuOpen && (
                          <div className="mode-context-menu">
                            <div
                              className={`mode-context-menu-item ${currentMode === 'whitelist' ? 'active' : ''}`}
                              onClick={() => setMode('whitelist')}
                            >
                              <span>{t('basicTab.whitelist')}</span>
                              {currentMode === 'whitelist' && <Check size={16} />}
                            </div>
                            <div
                              className={`mode-context-menu-item ${currentMode === 'blacklist' ? 'active' : ''}`}
                              onClick={() => setMode('blacklist')}
                            >
                              <span>{t('basicTab.blacklist')}</span>
                              {currentMode === 'blacklist' && <Check size={16} />}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
        </div>,
        document.body
      )}
    </div>
  );
}

