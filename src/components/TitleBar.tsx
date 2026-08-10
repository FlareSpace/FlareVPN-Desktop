import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      appWindow.startDragging();
    }
  };

  const handleDoubleClick = () => {
    appWindow.toggleMaximize();
  };

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div
        className="titlebar-drag-region"
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        Flare VPN
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          onClick={() => appWindow.minimize()}
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          className="titlebar-btn"
          onClick={() => appWindow.toggleMaximize()}
          title="Maximize"
        >
          <Square size={14} />
        </button>
        <button
          className="titlebar-btn close"
          onClick={() => appWindow.close()}
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

