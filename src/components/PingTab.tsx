import { useState, useRef, useEffect } from 'react';
import { Link, Zap, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore, PingDisplayStyle } from '../store/useAppStore';
import { CloudFilled } from './icons';
import './PingTab.css';

export default function PingTab() {
  const { t } = useTranslation();
  const pingType = useAppStore(state => state.pingType);
  const setPingType = useAppStore(state => state.setPingType);
  const pingTestUrl = useAppStore(state => state.pingTestUrl);
  const setPingTestUrl = useAppStore(state => state.setPingTestUrl);
  const pingDisplayStyle = useAppStore(state => state.pingDisplayStyle);
  const setPingDisplayStyle = useAppStore(state => state.setPingDisplayStyle);
  const pingTimeout = useAppStore(state => state.pingTimeout);
  const setPingTimeout = useAppStore(state => state.setPingTimeout);

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const styleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(event.target as Node)) {
        setIsStyleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStyleDisplay = (style: PingDisplayStyle) => {
    switch(style) {
      case 'time': return t('pingTab.styleTime');
      case 'icon': return t('pingTab.styleIcon');
      case 'both': return t('pingTab.styleBoth');
    }
  };

  const getPingTypeDescription = () => {
    switch(pingType) {
      case 'proxy': return t('pingTab.proxyDesc');
      case 'tcp': return t('pingTab.tcpDesc');
      case 'icmp': return t('pingTab.icmpDesc');
    }
  };

  return (
    <div className="ping-tab">
      <div className="ping-header">
        <h1 className="ping-header-title">{t('pingTab.title')}</h1>
      </div>
      
      <div className="ping-content">
        <div className="ping-section">
          <span className="ping-section-title">{t('pingTab.pingType')}</span>
          
          <div className="ping-type-layout">
            <div 
              className={`ping-type-card ${pingType === 'proxy' ? 'active' : ''}`}
              onClick={() => setPingType('proxy')}
            >
              <CloudFilled size={24} className="ping-card-icon" />
              <span>via proxy</span>
              {pingType === 'proxy' && <Check size={16} className="active-icon check-icon" />}
            </div>
            
            <div className="ping-type-row">
              <div 
                className={`ping-type-card ${pingType === 'tcp' ? 'active' : ''}`}
                onClick={() => setPingType('tcp')}
              >
                <Link size={24} className="ping-card-icon" />
                <span>TCP</span>
                {pingType === 'tcp' && <Check size={16} className="active-icon check-icon" />}
              </div>
              <div 
                className={`ping-type-card ${pingType === 'icmp' ? 'active' : ''}`}
                onClick={() => setPingType('icmp')}
              >
                <Zap size={24} className="ping-card-icon" />
                <span>ICMP</span>
                {pingType === 'icmp' && <Check size={16} className="active-icon check-icon" />}
              </div>
            </div>
          </div>
          
          <div className="ping-description">
            {getPingTypeDescription()}
          </div>
        </div>

        <div className="ping-section">
          <span className="ping-section-title">{t('pingTab.testUrl')}</span>
          <input 
            type="text" 
            className="ping-input" 
            value={pingTestUrl}
            onChange={(e) => setPingTestUrl(e.target.value)}
            placeholder="https://www.google.com/generate_204"
          />
          <div className="ping-description">
            {t('pingTab.testUrlDesc')}
          </div>
        </div>

        <div className="ping-section">
          <span className="ping-section-title">{t('pingTab.display')}</span>
          <div 
            className="ping-row" 
            ref={styleMenuRef}
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
          >
            <span className="ping-row-label">{t('pingTab.style')}</span>
            <div className="ping-row-value">
              {getStyleDisplay(pingDisplayStyle)}
              <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
            </div>
            
            {isStyleMenuOpen && (
              <div className="context-menu-dropdown">
                <div 
                  className={`context-menu-item ${pingDisplayStyle === 'time' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setPingDisplayStyle('time'); setIsStyleMenuOpen(false); }}
                >
                  {t('pingTab.styleTime')}
                </div>
                <div 
                  className={`context-menu-item ${pingDisplayStyle === 'icon' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setPingDisplayStyle('icon'); setIsStyleMenuOpen(false); }}
                >
                  {t('pingTab.styleIcon')}
                </div>
                <div 
                  className={`context-menu-item ${pingDisplayStyle === 'both' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setPingDisplayStyle('both'); setIsStyleMenuOpen(false); }}
                >
                  {t('pingTab.styleBoth')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ping-section">
          <span className="ping-section-title">{t('pingTab.timeout')}</span>
          <div className="ping-slider-container">
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={pingTimeout}
              className="beautiful-slider"
              onChange={(e) => setPingTimeout(parseInt(e.target.value))}
              style={{ '--slider-value': `${((pingTimeout - 1) / 19) * 100}%` } as React.CSSProperties}
            />
            <span className="ping-slider-value">{t('pingTab.sec', { sec: pingTimeout })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
