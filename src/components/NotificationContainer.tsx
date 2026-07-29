import { useEffect, useState } from 'react';
import { useAppStore, AppNotification } from '../store/useAppStore';
import './NotificationContainer.css';

const NotificationItem = ({ notification }: { notification: AppNotification }) => {
  const removeNotification = useAppStore((state) => state.removeNotification);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, notification.duration * 1000);


    const removeTimer = setTimeout(() => {
      removeNotification(notification.id);
    }, notification.duration * 1000 + 300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [notification, removeNotification]);

  const getDotColor = () => {
    switch (notification.type) {
      case 'success':
        return 'var(--success)';
      case 'warning':
        return '#F59E0B';
      case 'error':
        return 'var(--danger)';
      default:
        return 'var(--accent-color)';
    }
  };

  return (
    <div className={`notification-item ${isFading ? 'fading-out' : 'fading-in'}`}>
      <div className="notification-content">
        <div 
          className="notification-dot" 
          style={{ backgroundColor: getDotColor() }}
        />
        <span className="notification-text">{notification.message}</span>
      </div>
      <div 
        className="notification-progress"
        style={{
          backgroundColor: getDotColor(),
          animationDuration: `${notification.duration}s`
        }}
      />
    </div>
  );
};

export default function NotificationContainer() {
  const notifications = useAppStore((state) => state.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notification={notif} />
      ))}
    </div>
  );
}
