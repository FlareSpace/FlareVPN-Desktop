import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import './TopModeMenu.css';

export default function TopModeMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tunEnabled = useAppStore(state => state.tunEnabled);
  const proxyEnabled = useAppStore(state => state.proxyEnabled);
  const setTunEnabled = useAppStore(state => state.setTunEnabled);
  const setProxyEnabled = useAppStore(state => state.setProxyEnabled);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getButtonText = () => {
    if (tunEnabled && proxyEnabled) return t('mode.mixed');
    if (proxyEnabled) return t('mode.proxy');
    if (tunEnabled) return 'TUN';
    return t('mode.none');
  };

  return (
    <div className="top-mode-menu-container" ref={menuRef}>
      <button
        className={`top-mode-trigger-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{getButtonText()}</span>
        <ChevronDown size={14} className={`arrow-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="top-mode-dropdown">
          <div className="top-mode-header-label">
            Режим
          </div>

          <div
            className={`top-mode-item ${proxyEnabled ? 'selected' : ''}`}
            onClick={() => setProxyEnabled(!proxyEnabled)}
          >
            <span>{t('mode.proxy')}</span>
            {proxyEnabled && <Check size={16} className="check-icon" />}
          </div>

          <div
            className={`top-mode-item ${tunEnabled ? 'selected' : ''}`}
            onClick={() => setTunEnabled(!tunEnabled)}
          >
            <span>TUN</span>
            {tunEnabled && <Check size={16} className="check-icon" />}
          </div>
        </div>
      )}
    </div>
  );
}
