import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import TitleBar from './components/TitleBar';
import ResizeBorders from './components/ResizeBorders';
import Sidebar from './components/Sidebar';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import MainToggle from './components/MainToggle';
import ClipboardButton from './components/ClipboardButton';
import NotificationContainer from './components/NotificationContainer';
import SubscriptionCard from './components/SubscriptionCard';
import PingTab from './components/PingTab';
import SubscriptionsTab from './components/SubscriptionsTab';
import LanguageTab from './components/LanguageTab';
import BasicSettingsTab from './components/BasicSettingsTab';
import AdvancedSettingsTab from './components/AdvancedSettingsTab';
import PersonalizationTab from './components/PersonalizationTab';
import ModeSelection from './components/ModeSelection';
import TopModeMenu from './components/TopModeMenu';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/useAppStore';
import { useAutoUpdater } from './utils/useAutoUpdater';
import './App.css';
import './i18n';

function App() {
  const { i18n, t } = useTranslation();


  useEffect(() => {
    const isLinux = navigator.userAgent.includes('Linux') || navigator.platform.includes('Linux');
    if (isLinux) {
      document.documentElement.setAttribute('data-platform', 'linux');
    }
  }, []);
  const language = useAppStore(state => state.language);
  const subscriptions = useAppStore(state => state.subscriptions);
  const activeTab = useAppStore(state => state.activeTab);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const loadSettings = useAppStore(state => state.loadSettings);
  const toggleVpn = useAppStore(state => state.toggleVpn);
  const setStatus = useAppStore(state => state.setStatus);


  const themeStyle = useAppStore(state => state.themeStyle);
  const customColorEnabled = useAppStore(state => state.customColorEnabled);
  const customAccentColor = useAppStore(state => state.customAccentColor);

  useAutoUpdater();

  useEffect(() => {
    const applyTheme = () => {
      let resolvedTheme = themeStyle;
      if (themeStyle === 'auto') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', resolvedTheme);

      if (customColorEnabled && customAccentColor) {
        document.documentElement.style.setProperty('--accent-color', customAccentColor);
        document.documentElement.style.setProperty('--accent-hover', customAccentColor);
      } else {
        document.documentElement.style.removeProperty('--accent-color');
        document.documentElement.style.removeProperty('--accent-hover');
      }
    };

    applyTheme();

    if (themeStyle === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeStyle, customColorEnabled, customAccentColor]);

  const TAB_ORDER = ['home', 'ping', 'subscriptions', 'personalization', 'language', 'basic', 'advanced'];

  const [currentTab, setCurrentTab] = useState(activeTab);
  const [prevTab, setPrevTab] = useState(activeTab);

  if (activeTab !== currentTab) {
    setPrevTab(currentTab);
    setCurrentTab(activeTab);
  }

  const getTabClass = (tabName: string) => {
    if (activeTab === tabName) return 'active';
    if (prevTab === tabName) {
      const activeIdx = TAB_ORDER.indexOf(activeTab);
      const prevIdx = TAB_ORDER.indexOf(prevTab);
      return prevIdx < activeIdx ? 'slide-up' : 'slide-down';
    }
    const activeIdx = TAB_ORDER.indexOf(activeTab);
    const thisIdx = TAB_ORDER.indexOf(tabName);
    return `hidden-tab ${thisIdx < activeIdx ? 'slide-up' : 'slide-down'}`;
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        const nextLang = i18n.language === 'en' ? 'ru' : 'en';
        useAppStore.getState().setLanguage(nextLang);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [i18n]);

  useEffect(() => {
    if (language === 'auto') {
      const sysLang = navigator.language.toLowerCase();
      if (sysLang.startsWith('ru')) {
        i18n.changeLanguage('ru');
      } else {
        i18n.changeLanguage('en');
      }
    } else {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  useEffect(() => {
    const unlistenToggle = listen('toggle-connect', () => {
      toggleVpn();
    });

    const unlistenStarted = listen('tunnel-started', () => {
      setStatus('connected');
    });

    const unlistenStop = listen('tunnel-stopped', async (event: any) => {
      const isRunning = await invoke<boolean>('is_tunnel_running');
      if (!isRunning) {
        setStatus('disconnected');
        const store = useAppStore.getState();
        if (store.settings.reset_chain_on_disconnect) {
          store.clearChain();
        }
        if (event.payload !== 0 && event.payload !== null) {
          store.addNotification('error', t('notifications.tunnelStoppedUnexpectedly', { code: event.payload }));
        }
      }
    });

    const unlistenError = listen('tunnel-error', (event: any) => {
      setStatus('disconnected');
      const store = useAppStore.getState();
      if (store.settings.reset_chain_on_disconnect) {
        store.clearChain();
      }
      store.addNotification('error', t('notifications.tunnelError', { error: event.payload }));
    });

    return () => {
      unlistenToggle.then(f => f());
      unlistenStarted.then(f => f());
      unlistenStop.then(f => f());
      unlistenError.then(f => f());
    };
  }, [toggleVpn, setStatus, t]);

  useEffect(() => {
    setExpandedIds(prev => prev.filter(id => subscriptions.some(sub => sub.id === id)));
  }, [subscriptions]);

  useEffect(() => {

    invoke<boolean>('is_tunnel_running').then(isRunning => {
      if (isRunning) {
        setStatus('connected');
      }
    }).catch(console.error);
  }, [setStatus]);

  return (
    <div className="app-container">
      <ResizeBorders />
      <TitleBar />
      <NotificationContainer />
      <div className="main-layout">
        <Sidebar />
        <div className="main-view">
          <div className={`tab-container ${getTabClass('home')}`}>
            <div className="subscriptions-section">
              {expandedIds.length > 0 && (
                <div className="subscriptions-section-header">
                  <button 
                    className="collapse-all-btn"
                    onClick={() => setExpandedIds([])}
                  >
                    <span>{t('home.collapseAll')}</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              <div className={`subscriptions-panel ${expandedIds.length > 0 ? 'expanded-mode has-header' : ''}`}>
                {subscriptions.length === 0 ? (
                  <div className="empty-subscriptions">
                    <span>{t('home.noProfiles')}</span>
                  </div>
                ) : (
                  subscriptions.map(sub => (
                    <SubscriptionCard 
                      key={sub.id} 
                      subscription={sub} 
                      isExpanded={expandedIds.includes(sub.id)}
                      onToggle={() => {
                        setExpandedIds(prev => 
                          prev.includes(sub.id) 
                            ? prev.filter(id => id !== sub.id)
                            : [...prev, sub.id]
                        );
                      }}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="connection-panel">
              <div className="connection-panel-top">
                <TopModeMenu />
              </div>
              <MainToggle />
              <ModeSelection />
            </div>
            <ClipboardButton visible={expandedIds.length === 0} />
          </div>
          
          <div className={`tab-container ${getTabClass('ping')}`}>
            <PingTab />
          </div>

          <div className={`tab-container ${getTabClass('basic')}`}>
            <BasicSettingsTab />
          </div>

          <div className={`tab-container ${getTabClass('advanced')}`}>
            <AdvancedSettingsTab />
          </div>

          <div className={`tab-container ${getTabClass('subscriptions')}`}>
            <SubscriptionsTab />
          </div>

          <div className={`tab-container ${getTabClass('personalization')}`}>
            <PersonalizationTab />
          </div>

          <div className={`tab-container ${getTabClass('language')}`}>
            <LanguageTab />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
