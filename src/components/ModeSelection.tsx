import { useAppStore } from '../store/useAppStore';
import './ModeSelection.css';

export default function ModeSelection() {
  const vpnMode = useAppStore(state => state.vpnMode);
  const setVpnMode = useAppStore(state => state.setVpnMode);

  return (
    <div className="mode-selection-container">
      <div className="mode-selection-capsule">
        <div 
          className="mode-selection-slider" 
          style={{ transform: `translateX(${vpnMode === 'TUN' ? '0' : '100%'})` }}
        />
        <button 
          className={`mode-btn ${vpnMode === 'TUN' ? 'active' : ''}`}
          onClick={() => setVpnMode('TUN')}
        >
          TUN
        </button>
        <button 
          className={`mode-btn ${vpnMode === 'Proxy' ? 'active' : ''}`}
          onClick={() => setVpnMode('Proxy')}
        >
          Proxy
        </button>
      </div>
    </div>
  );
}
