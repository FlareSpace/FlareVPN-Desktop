import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, AppNotification } from '../store/useAppStore';
import './NotificationContainer.css';

const NotificationItem = ({ 
  notification, 
  stackIndex, 
  isStacked, 
  showBadge, 
  badgeCount 
}: { 
  notification: AppNotification; 
  stackIndex: number; 
  isStacked: boolean; 
  showBadge: boolean; 
  badgeCount: number; 
}) => {
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
    <div 
      className={`notification-item stack-index-${stackIndex} ${isFading ? 'fading-out' : 'fading-in'}`}
    >
      <div className="notification-content">
        <div 
          className="notification-dot" 
          style={{ backgroundColor: getDotColor() }}
        />
        <span className="notification-text">{notification.message}</span>
        {showBadge && isStacked && badgeCount > 1 && (
          <div className="notification-stack-badge">
            +{badgeCount - 1}
          </div>
        )}
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
  const { t } = useTranslation();
  const notifications = useAppStore((state) => state.notifications);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (notifications.length <= 1) {
      setIsExpanded(false);
      return;
    }

    if (isExpanded) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, notifications.length]);

  if (notifications.length === 0) return null;

  const isStacked = notifications.length > 1 && !isExpanded;

  const handleContainerClick = () => {
    if (notifications.length > 1) {
      setIsExpanded((prev) => !prev);
    }
  };


  const reversedNotifications = [...notifications].reverse();

  return (
    <div 
      className={`notification-container ${isStacked ? 'is-stacked' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      onClick={handleContainerClick}
      title={isStacked ? t('notifications.clickToExpand') : isExpanded ? t('notifications.clickToCollapse') : undefined}
    >
      {reversedNotifications.map((notif, index) => (
        <NotificationItem 
          key={notif.id} 
          notification={notif} 
          stackIndex={index}
          isStacked={isStacked}
          showBadge={index === 0}
          badgeCount={notifications.length}
        />
      ))}
    </div>
  );
}
