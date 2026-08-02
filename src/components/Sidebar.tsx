import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from 'react-i18next';
import { 
  HomeFilled, 
  WrenchFilled, 
  BoxFilled, 
  RoutingFilled, 
  SpeedometerFilled, 
  CloudFilled, 
  BrushFilled, 
  LanguageFilled, 
  AppsFilled 
} from './icons';
import { useAppStore } from '../store/useAppStore';
import './Sidebar.css';

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const { t } = useTranslation();

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  return (
    <div className={`sidebar ${expanded ? 'expanded' : ''}`}>
      <div className="sidebar-top">
        <button 
          className="hamburger-button" 
          onClick={() => setExpanded(!expanded)}
        >
          <Menu size={24} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="menu-group">
          <div 
            className={`menu-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <HomeFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.home')}</span>
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-header">{t('sidebar.vpnSettings')}</div>
          <div 
            className={`menu-item ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            <WrenchFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.basic')}</span>
          </div>
          <div 
            className={`menu-item ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            <BoxFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.advanced')}</span>
          </div>
          <div className="menu-item">
            <RoutingFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.routing')}</span>
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-header">{t('sidebar.appSettings')}</div>
          <div 
            className={`menu-item ${activeTab === 'ping' ? 'active' : ''}`}
            onClick={() => setActiveTab('ping')}
          >
            <SpeedometerFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.ping')}</span>
          </div>
          <div 
            className={`menu-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            <CloudFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.subscriptions')}</span>
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-header">{t('sidebar.appearance')}</div>
          <div 
            className={`menu-item ${activeTab === 'personalization' ? 'active' : ''}`}
            onClick={() => setActiveTab('personalization')}
          >
            <BrushFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.personalization')}</span>
          </div>
          <div 
            className={`menu-item ${activeTab === 'language' ? 'active' : ''}`}
            onClick={() => setActiveTab('language')}
          >
            <LanguageFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.language')}</span>
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-header">{t('sidebar.flareVpn')}</div>
          <div className="menu-item">
            <AppsFilled size={20} className="menu-icon" />
            <span className="menu-label">{t('sidebar.management')}</span>
          </div>
        </div>

        <div className="sidebar-version">
          {appVersion ? t('sidebar.appVersion', { version: appVersion }) : ''}
        </div>
      </div>
    </div>
  );
}
