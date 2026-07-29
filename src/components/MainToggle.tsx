import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { useState, useEffect } from 'react';
import './MainToggle.css';

function AnimatedStatusText({ status }: { status: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([{ id: Date.now(), text: t(`status.${status}`) }]);

  useEffect(() => {
    setItems((prev) => {
      const newText = t(`status.${status}`);
      if (prev[prev.length - 1].text === newText) return prev;
      return [...prev, { id: Date.now(), text: newText }];
    });
  }, [status, t]);

  return (
    <div className="status-text-container">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span 
            key={item.id} 
            className={`status-text ${isLast ? 'slide-in' : 'slide-out'}`}
            onAnimationEnd={() => {
              if (!isLast) {
                setItems((current) => current.filter((i) => i.id !== item.id));
              }
            }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}

export default function MainToggle() {
  const { t } = useTranslation();
  const status = useAppStore((state) => state.status);
  const toggleVpn = useAppStore((state) => state.toggleVpn);

  return (
    <div className="main-toggle-container">
      <div className={`status-indicator ${status}`}>
        <span className={`status-dot ${status}`}></span>
        <AnimatedStatusText status={status} />
      </div>
      
      <div className="toggle-switch" onClick={toggleVpn} aria-label={t(`status.${status}`)}>
        <div className={`toggle-track ${status}`}>
          <div className={`toggle-thumb ${status}`} />
        </div>
      </div>
    </div>
  );
}
