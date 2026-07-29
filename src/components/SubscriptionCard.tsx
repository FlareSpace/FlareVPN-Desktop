import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, RefreshCw, Gauge, MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore, Subscription, Profile } from '../store/useAppStore';
import { formatTraffic, getProtocolDisplay, formatUpdateInterval, formatDate } from '../utils/parser';
import './SubscriptionCard.css';

interface Props {
  subscription: Subscription;
  isExpanded: boolean;
  onToggle: () => void;
}

const ProfileItem = React.memo(({ profile }: { profile: Profile }) => {
  const selectedProfileId = useAppStore(state => state.selectedProfileId);
  const setSelectedProfileId = useAppStore(state => state.setSelectedProfileId);
  const chainProfileIds = useAppStore(state => state.chainProfileIds);
  const toggleChainProfileId = useAppStore(state => state.toggleChainProfileId);
  const pingDisplayStyle = useAppStore(state => state.pingDisplayStyle);
  const pingRes = useAppStore(state => 
    state.pingedProfileIds.has(profile.id) ? state.pingResults[profile.id] : undefined
  );
  const { t } = useTranslation();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const chainIndex = chainProfileIds.indexOf(profile.id);
  const inChain = chainIndex !== -1;



  const protocolDisplay = useMemo(() => getProtocolDisplay(profile), [profile]);

  useEffect(() => {
    const handleCloseOtherMenus = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail !== profile.id) {
        setContextMenu(null);
      }
    };
    window.addEventListener('close-profile-context-menus', handleCloseOtherMenus);
    return () => {
      window.removeEventListener('close-profile-context-menus', handleCloseOtherMenus);
    };
  }, [profile.id]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleScroll = () => setContextMenu(null);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('close-profile-context-menus', { detail: profile.id }));
    const posX = Math.min(e.clientX, window.innerWidth - 140);
    const posY = Math.min(e.clientY, window.innerHeight - 60);
    setContextMenu({ x: posX, y: posY });
  };

  return (
    <>
      <div 
        className={`profile-item ${selectedProfileId === profile.id ? 'active' : ''}`} 
        onClick={() => setSelectedProfileId(profile.id)}
        onContextMenu={handleContextMenu}
      >
        {inChain && (
          <div className="profile-chain-badge" title={`Chain step ${chainIndex + 1}`}>
            {chainIndex + 1}
          </div>
        )}
        <div className="profile-item-main">
          <span className="profile-name">{profile.name}</span>
          <span className="profile-desc">{protocolDisplay}</span>
        </div>
        {pingRes && (
          <div className="profile-ping-result">
            {pingRes.status === 'loading' ? (
              <div className="ping-skeleton"></div>
            ) : (
              <div className={`ping-latency ${
                pingRes.latency && pingRes.latency <= 300 ? 'good' :
                pingRes.latency && pingRes.latency <= 800 ? 'fair' : 'poor'
              }`}>
                {(pingDisplayStyle === 'icon' || pingDisplayStyle === 'both') && (
                  <div className="ping-dot" />
                )}
                {(pingDisplayStyle === 'time' || pingDisplayStyle === 'both') && (
                  <span>{pingRes.error || `${pingRes.latency} ms`}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div 
          className="profile-context-menu" 
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className={`context-menu-item ${inChain ? 'active-chain' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              toggleChainProfileId(profile.id);
            }}
          >
            <span>{t('subscriptionCard.chain')}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default function SubscriptionCard({ subscription, isExpanded, onToggle }: Props) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  
  const startPing = useAppStore(state => state.startPing);
  const updateSubscription = useAppStore(state => state.updateSubscription);
  const removeSubscription = useAppStore(state => state.removeSubscription);
  const addNotification = useAppStore(state => state.addNotification);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);
  const trafficInfo = formatTraffic(subscription.upload ?? -1, subscription.download ?? -1, subscription.total ?? -1);
  const used = (subscription.upload ?? 0) + (subscription.download ?? 0);
  const progress = (subscription.total && subscription.total > 0) ? (used / subscription.total) * 100 : 0;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const handleSpeedTest = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      onToggle();
    }
    startPing(subscription.profiles.map(p => p.id));
  };

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await updateSubscription(subscription.id);
      addNotification('success', t('subscriptionCard.updateSuccess', { name: subscription.name }), 3);
    } catch (error) {
      addNotification('error', t('subscriptionCard.updateError', { name: subscription.name }), 5);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="sub-card-container">
      <div className={`sub-card-main ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
        <div className="sub-card-main-content">
          <div className="sub-card-left">
            <ChevronRight 
              className={`expand-arrow ${isExpanded ? 'expanded' : ''}`} 
              size={18} 
            />
            <div className="sub-info-col">
              <span className="sub-name">{subscription.name}</span>
              <div className="progress-container">
                <div className={`progress-bar-bg ${(!subscription.total || subscription.total <= 0) ? 'unlimited' : ''}`}>
                  <div className="progress-bar-fill" style={{ width: `${clampedProgress}%` }}></div>
                  <span className="traffic-text">{trafficInfo}</span>
                </div>
              </div>
              {(subscription.expire || subscription.updateInterval) && (
                <div className="sub-meta-col">
                  {subscription.expire !== undefined && subscription.expire > 0 && (
                    <span className="meta-text">{t('subscriptionCard.expires', { date: formatDate(subscription.expire * 1000) })}</span>
                  )}
                  {subscription.updateInterval !== undefined && subscription.updateInterval > 0 && (
                    <span className="meta-text">{t('subscriptionCard.update', { interval: formatUpdateInterval(subscription.updateInterval) })}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="sub-card-right" onClick={e => e.stopPropagation()}>
            <button className="action-btn" title="Refresh" onClick={handleUpdate} disabled={isUpdating}>
              <RefreshCw size={14} className={isUpdating ? 'spin' : ''} />
            </button>
            <button className="action-btn" title="Speed Test" onClick={handleSpeedTest}>
              <Gauge size={14} />
            </button>
            <div className="more-menu-container" ref={menuRef}>
              <button className="action-btn" title="More" onClick={() => setMenuOpen(!menuOpen)}>
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div className="sub-context-menu">
                  <div className="context-menu-item" onClick={async (e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    try {
                      await removeSubscription(subscription.id);
                      addNotification('success', t('subscriptionCard.deleteSuccess', { name: subscription.name }), 3);
                    } catch (error) {
                      addNotification('error', t('subscriptionCard.deleteError', { name: subscription.name }), 3);
                    }
                  }}>
                    <span>{t('subscriptionCard.delete')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {subscription.description && (
          <div className="sub-card-description">
            {subscription.description}
          </div>
        )}
      </div>

      <div 
        className={`profiles-list-wrapper ${isExpanded ? 'expanded' : ''}`}
        style={{
          maxHeight: isExpanded ? `${subscription.profiles.length * 60 + 50}px` : '0px'
        }}
      >
        <div className="profiles-list-inner">
          <div className="profiles-list">
            {subscription.profiles.map(profile => (
              <ProfileItem key={profile.id} profile={profile} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
