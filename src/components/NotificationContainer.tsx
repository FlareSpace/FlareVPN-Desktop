import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Layers } from 'lucide-react';
import { useAppStore, AppNotification } from '../store/useAppStore';
import './NotificationContainer.css';

interface NotificationItemProps {
  notification: AppNotification;
  stackIndex: number;
  isStacked: boolean;
  isExpanded: boolean;
  showBadge: boolean;
  badgeCount: number;
  isPaused: boolean;
}

const NotificationItem = ({
  notification,
  stackIndex,
  isStacked,
  isExpanded,
  showBadge,
  badgeCount,
  isPaused,
}: NotificationItemProps) => {
  const removeNotification = useAppStore((state) => state.removeNotification);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef<number>(notification.duration * 1000);

  useEffect(() => {
    remainingTimeRef.current = notification.duration * 1000;
    setProgress(100);
  }, [notification.createdAt, notification.count, notification.duration]);

  useEffect(() => {
    if (isPaused || notification.duration <= 0) return;

    const intervalMs = 30;
    const timer = setInterval(() => {
      remainingTimeRef.current -= intervalMs;
      const pct = Math.max(0, (remainingTimeRef.current / (notification.duration * 1000)) * 100);
      setProgress(pct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(timer);
        removeNotification(notification.id);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPaused, notification.id, notification.duration, notification.createdAt, notification.count, removeNotification]);

  const renderIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle2 className="notif-icon-success" size={18} />;
      case 'warning':
        return <AlertTriangle className="notif-icon-warning" size={18} />;
      case 'error':
        return <XCircle className="notif-icon-error" size={18} />;
      default:
        return <Info className="notif-icon-info" size={18} />;
    }
  };

  let yOffset = 0;
  let scale = 1;
  let opacity = 1;
  let zIndex = 50 - stackIndex;

  if (isStacked) {
    if (stackIndex === 0) {
      yOffset = 0;
      scale = 1;
      opacity = 1;
    } else if (stackIndex === 1) {
      yOffset = 8;
      scale = 0.95;
      opacity = 0.85;
    } else if (stackIndex === 2) {
      yOffset = 16;
      scale = 0.90;
      opacity = 0.65;
    } else {
      yOffset = 22;
      scale = 0.84;
      opacity = 0;
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -35, scale: 0.88, filter: 'blur(6px)' }}
      animate={{
        opacity,
        y: yOffset,
        scale,
        zIndex,
        filter: 'blur(0px)',
      }}
      exit={{
        opacity: 0,
        y: -25,
        scale: 0.85,
        filter: 'blur(6px)',
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 28,
        mass: 0.7,
      }}
      drag={isExpanded || !isStacked ? 'x' : 'y'}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.offset.y) > 40) {
          removeNotification(notification.id);
        }
      }}
      className={`notification-item notif-type-${notification.type} ${
        isStacked ? 'stacked-mode' : ''
      } ${isExpanded ? 'expanded-mode' : ''}`}
      style={{ zIndex }}
    >
      <div className="notification-content">
        <div className="notification-icon-wrapper">{renderIcon()}</div>

        <div className="notification-body">
          <span className="notification-text">{notification.message}</span>
          {(notification.count ?? 1) > 1 && (
            <span className="notification-repeat-badge">×{notification.count}</span>
          )}
        </div>

        {showBadge && isStacked && badgeCount > 1 && (
          <div className="notification-stack-badge" title="Уведомлений в стопке">
            <Layers size={11} style={{ marginRight: 4 }} />
            +{badgeCount - 1}
          </div>
        )}

        <button
          className="notification-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            removeNotification(notification.id);
          }}
          title="Закрыть"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {notification.duration > 0 && (
        <div className="notification-progress-track">
          <div
            className={`notification-progress-bar notif-bg-${notification.type}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default function NotificationContainer() {
  const { t } = useTranslation();
  const notifications = useAppStore((state) => state.notifications);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (notifications.length <= 1) {
      setIsExpanded(false);
    }
  }, [notifications.length]);

  const isStacked = notifications.length > 1 && !isExpanded;
  const reversedNotifications = [...notifications].reverse();

  const handleContainerClick = () => {
    if (notifications.length > 1) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div
      className={`notification-container ${isStacked ? 'is-stacked' : ''} ${
        isExpanded ? 'is-expanded' : ''
      } ${notifications.length === 0 ? 'is-empty' : ''}`}
      onClick={handleContainerClick}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      title={
        isStacked
          ? t('notifications.clickToExpand')
          : isExpanded
          ? t('notifications.clickToCollapse')
          : undefined
      }
    >
      <AnimatePresence>
        {reversedNotifications.map((notif, index) => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            stackIndex={index}
            isStacked={isStacked}
            isExpanded={isExpanded}
            showBadge={index === 0}
            badgeCount={notifications.length}
            isPaused={isPaused}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
