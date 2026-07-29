import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import './LanguageTab.css';

export default function LanguageTab() {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const language = useAppStore(state => state.language);
  const setLanguage = useAppStore(state => state.setLanguage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCurrentLanguageLabel = () => {
    switch (language) {
      case 'ru': return t('languageTab.russian');
      case 'en': return t('languageTab.english');
      case 'auto': return t('languageTab.auto');
      default: return t('languageTab.auto');
    }
  };

  return (
    <div className="language-tab">
      <div className="tab-header">
        <h1>{t('languageTab.title')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div 
            className="language-row" 
            ref={menuRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="language-row-label">{t('languageTab.selectLanguage')}</span>
            <div className="language-row-value">
              {getCurrentLanguageLabel()}
              <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
            </div>
            
            {isMenuOpen && (
              <div className="language-context-menu">
                <div 
                  className={`language-context-menu-item ${language === 'auto' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setLanguage('auto'); setIsMenuOpen(false); }}
                >
                  {t('languageTab.auto')}
                </div>
                <div 
                  className={`language-context-menu-item ${language === 'ru' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setLanguage('ru'); setIsMenuOpen(false); }}
                >
                  {t('languageTab.russian')}
                </div>
                <div 
                  className={`language-context-menu-item ${language === 'en' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setLanguage('en'); setIsMenuOpen(false); }}
                >
                  {t('languageTab.english')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
