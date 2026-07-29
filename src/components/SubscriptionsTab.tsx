import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import './SubscriptionsTab.css';

export default function SubscriptionsTab() {
  const { t } = useTranslation();
  const settings = useAppStore(state => state.settings);
  const updateSetting = useAppStore(state => state.updateSetting);

  const [localTimeout, setLocalTimeout] = useState(settings.update_timeout);

  useEffect(() => {
    setLocalTimeout(settings.update_timeout);
  }, [settings.update_timeout]);

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTimeout(parseInt(e.target.value));
  };

  const handleTimeoutCommit = () => {
    updateSetting('update_timeout', localTimeout);
  };

  return (
    <div className="subscriptions-tab">
      <div className="tab-header">
        <h1>{t('subscriptionsTab.title')}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">{t('subscriptionsTab.autoUpdate')}</h2>
          <div className="settings-card toggle-group">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.updateInterval')}</span>
                <span className="setting-description">{t('subscriptionsTab.updateIntervalDesc')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.update_interval}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateSetting('update_interval', checked);
                    if (checked && settings.auto_update) {
                      updateSetting('auto_update', false);
                    }
                  }}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.forceAutoUpdate')}</span>
                <span className="setting-description">{t('subscriptionsTab.forceAutoUpdateDesc')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.auto_update}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateSetting('auto_update', checked);
                    if (checked && settings.update_interval) {
                      updateSetting('update_interval', false);
                    }
                  }}
                />
                <span className="slider round"></span>
              </label>
            </div>
            {settings.auto_update && (
              <div className="setting-row sub-setting">
                <div className="setting-info">
                  <span className="setting-label">{t('subscriptionsTab.updateIntervalSecs')}</span>
                </div>
                <input
                  type="number"
                  className="text-input"
                  style={{ width: '100px', textAlign: 'right' }}
                  min={60}
                  value={settings.auto_update_interval || 3600}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 60;
                    updateSetting('auto_update_interval', val < 60 ? 60 : val);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.timeout')}</span>
                <span className="setting-description">{t('subscriptionsTab.timeoutDesc')}</span>
              </div>
              <div className="slider-container">
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={localTimeout}
                  onChange={handleTimeoutChange}
                  onMouseUp={handleTimeoutCommit}
                  onTouchEnd={handleTimeoutCommit}
                  className="range-slider"
                  style={{ '--slider-value': `${((localTimeout - 1) / 24) * 100}%` } as React.CSSProperties}
                />
                <span className="slider-value">{t('pingTab.sec', { sec: localTimeout })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('subscriptionsTab.userAgent')}</h2>
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.userAgentLabel')}</span>
              </div>
              <input
                type="text"
                className="text-input"
                value={settings.user_agent}
                onChange={(e) => updateSetting('user_agent', e.target.value)}
                placeholder="Happ/3.21.1"
              />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">{t('subscriptionsTab.dataManagement')}</h2>
          <div className="settings-card toggle-group">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.sendHwid')}</span>
                <span className="setting-description">{t('subscriptionsTab.sendHwidDesc')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.send_hwid}
                  onChange={(e) => updateSetting('send_hwid', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.sendOs')}</span>
                <span className="setting-description">{t('subscriptionsTab.sendOsDesc')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.send_os}
                  onChange={(e) => updateSetting('send_os', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-divider"></div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">{t('subscriptionsTab.sendModel')}</span>
                <span className="setting-description">{t('subscriptionsTab.sendModelDesc')}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.send_model}
                  onChange={(e) => updateSetting('send_model', e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
