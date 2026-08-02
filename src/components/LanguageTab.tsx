import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check } from 'lucide-react';
import { useAppStore, LanguageType } from '../store/useAppStore';
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

  const languageOptions: { id: LanguageType; label: string }[] = [
    { id: 'auto', label: t('languageTab.auto') },
    { id: 'ru', label: t('languageTab.russian') },
    { id: 'en', label: t('languageTab.english') },
  ];


  return (
    <div className="language-tab">
      <div className="tab-header">
        <h1>{t('languageTab.title')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('languageTab.selectLanguage')}</span>
              <div className="custom-dropdown-container" ref={menuRef}>
                <button
                  type="button"
                  className="dropdown-trigger-btn"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <span>{getCurrentLanguageLabel()}</span>
                  <ChevronRight className={`dropdown-arrow ${isMenuOpen ? 'open' : ''}`} size={16} />
                </button>

                {isMenuOpen && (
                  <div className="context-menu">
                    {languageOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className={`context-menu-item ${language === opt.id ? 'active' : ''}`}
                        onClick={() => {
                          setLanguage(opt.id);
                          setIsMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {language === opt.id && <Check size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

