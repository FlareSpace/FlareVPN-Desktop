import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, Subscription } from '../store/useAppStore';

export function useAutoUpdater() {
  const { t } = useTranslation();
  const nextUpdateTimes = useRef<Record<string, number>>({});

  useEffect(() => {

    const timer = setInterval(async () => {
      const state = useAppStore.getState();
      const currentSettings = state.settings;
      const currentSubs = state.subscriptions;
      const now = Date.now();
      
      let toUpdate: Subscription[] = [];
      
      if (currentSettings.auto_update) {

        const intervalMs = (currentSettings.auto_update_interval || 3600) * 1000;
        const nextGlobal = nextUpdateTimes.current['__global'] || (now + intervalMs);
        if (now >= nextGlobal) {
          toUpdate = [...currentSubs];
          nextUpdateTimes.current['__global'] = now + intervalMs;
        } else if (!nextUpdateTimes.current['__global']) {
          nextUpdateTimes.current['__global'] = now + intervalMs;
        }
      } else if (currentSettings.update_interval) {

        for (const sub of currentSubs) {
          if (sub.updateInterval && sub.updateInterval > 0) {
            const nextTime = nextUpdateTimes.current[sub.id] || (now + sub.updateInterval);
            if (now >= nextTime) {
              toUpdate.push(sub);
              nextUpdateTimes.current[sub.id] = now + sub.updateInterval;
            } else if (!nextUpdateTimes.current[sub.id]) {
              nextUpdateTimes.current[sub.id] = now + sub.updateInterval;
            }
          }
        }
      }

      if (toUpdate.length > 0) {
        let successCount = 0;
        for (const sub of toUpdate) {
          try {
            await state.updateSubscription(sub.id);
            successCount++;
          } catch(e) {
            console.error(`Auto-update failed for ${sub.name}:`, e);
          }
        }
        
        if (successCount > 0) {
          state.addNotification('success', t('subscriptionsTab.autoUpdateSuccess', { count: successCount }));
        }
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [t]);
}
