import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check } from 'lucide-react';
import { useAppStore, ThemeStyle } from '../store/useAppStore';
import './PersonalizationTab.css';

export const COLOR_PALETTE = [
  { id: 'default', hex: '#5B8CFF', name: 'Blue' },
  { id: 'green', hex: '#34C759', name: 'Green' },
  { id: 'purple', hex: '#9B59B6', name: 'Purple' },
  { id: 'red', hex: '#FF453A', name: 'Red' },
  { id: 'pink', hex: '#FF375F', name: 'Pink' },
  { id: 'orange', hex: '#FF9F0A', name: 'Orange' },
  { id: 'indigo', hex: '#5E5CE6', name: 'Indigo' },
  { id: 'cyan', hex: '#64D2FF', name: 'Cyan' },
  { id: 'amber', hex: '#FFD60A', name: 'Amber' },
  { id: 'violet', hex: '#BF5AF2', name: 'Violet' },
  { id: 'teal', hex: '#30B0C7', name: 'Teal' },
  { id: 'lime', hex: '#C6FF34', name: 'Lime' },
  { id: 'candy_blue', hex: '#B2D5E5', name: 'Candy Blue' },
  { id: 'sunset', hex: '#FF5E62', name: 'Sunset' },
  { id: 'lavender', hex: '#D1B3FF', name: 'Lavender' },
];

export default function PersonalizationTab() {
  const { t } = useTranslation();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const themeStyle = useAppStore(state => state.themeStyle);
  const setThemeStyle = useAppStore(state => state.setThemeStyle);
  const customColorEnabled = useAppStore(state => state.customColorEnabled);
  const setCustomColorEnabled = useAppStore(state => state.setCustomColorEnabled);
  const customAccentColor = useAppStore(state => state.customAccentColor);
  const setCustomAccentColor = useAppStore(state => state.setCustomAccentColor);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeStyleLabel = () => {
    switch (themeStyle) {
      case 'auto': return t('personalizationTab.themeAuto');
      case 'light': return t('personalizationTab.themeLight');
      case 'dark': return t('personalizationTab.themeDark');
      default: return t('personalizationTab.themeAuto');
    }
  };

  const themeOptions: { id: ThemeStyle; label: string }[] = [
    { id: 'auto', label: t('personalizationTab.themeAuto') },
    { id: 'light', label: t('personalizationTab.themeLight') },
    { id: 'dark', label: t('personalizationTab.themeDark') },
  ];

  return (
    <div className="personalization-tab">
      <div className="tab-header">
        <h1>{t('personalizationTab.title')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-title">{t('personalizationTab.themeSection')}</div>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-label">{t('personalizationTab.style')}</span>
              <div className="custom-dropdown-container" ref={themeMenuRef}>
                <button
                  type="button"
                  className="dropdown-trigger-btn"
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                >
                  <span>{getThemeStyleLabel()}</span>
                  <ChevronRight className={`dropdown-arrow ${isThemeMenuOpen ? 'open' : ''}`} size={16} />
                </button>

                {isThemeMenuOpen && (
                  <div className="context-menu">
                    {themeOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className={`context-menu-item ${themeStyle === opt.id ? 'active' : ''}`}
                        onClick={() => {
                          setThemeStyle(opt.id);
                          setIsThemeMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {themeStyle === opt.id && <Check size={16} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <span className="setting-label">{t('personalizationTab.customColor')}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={customColorEnabled}
                  onChange={(e) => setCustomColorEnabled(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {customColorEnabled && (
              <div className="color-picker-row">
                <div className="color-picker-list">
                  {COLOR_PALETTE.map((color) => {
                    const isSelected = (customAccentColor || '#5B8CFF').toLowerCase() === color.hex.toLowerCase();
                    return (
                      <button
                        key={color.id}
                        type="button"
                        className={`color-item ${isSelected ? 'selected' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setCustomAccentColor(color.hex)}
                        title={color.name}
                      >
                        {isSelected && <Check size={14} className="color-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

