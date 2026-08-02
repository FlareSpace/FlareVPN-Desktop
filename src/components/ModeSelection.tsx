import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import './ModeSelection.css';

export default function ModeSelection() {
  const { t } = useTranslation();
  const status = useAppStore(state => state.status);
  const selectedProfileId = useAppStore(state => state.selectedProfileId);
  const subscriptions = useAppStore(state => state.subscriptions);
  const startPing = useAppStore(state => state.startPing);
  const pingResults = useAppStore(state => state.pingResults);
  const pingedProfileIds = useAppStore(state => state.pingedProfileIds);

  const [testResult, setTestResult] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeProfile = subscriptions
    .flatMap(s => s.profiles)
    .find(p => p.id === selectedProfileId);

  useEffect(() => {
    if (!activeProfile) return;

    if (pingedProfileIds.has(activeProfile.id)) {
      const res = pingResults[activeProfile.id];
      if (res) {
        if (res.status === 'loading') {
          setTestResult('...');
        } else if (res.status === 'done') {
          const displayText = res.error ? res.error : (res.latency !== undefined ? `${res.latency} ms` : 'N/A');
          setTestResult(displayText);

          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setTestResult(null);
          }, 8000);
        }
      }
    }
  }, [pingResults, pingedProfileIds, activeProfile?.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Show during connecting and connected states
  if ((status !== 'connected' && status !== 'connecting') || !activeProfile) {
    return null;
  }

  const handleTestPing = () => {
    if (!activeProfile || status !== 'connected') return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    startPing([activeProfile.id]);
  };

  return (
    <div className="active-profile-test-container">
      <div className="active-profile-name">
        {activeProfile.name}
      </div>
      <button 
        className="test-ping-btn" 
        onClick={handleTestPing}
        disabled={status !== 'connected'}
      >
        {testResult !== null ? testResult : t('home.testPing')}
      </button>
    </div>
  );
}
