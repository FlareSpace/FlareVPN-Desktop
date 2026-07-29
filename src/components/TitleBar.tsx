import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleDragStart = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const pos = await appWindow.outerPosition();
    const scaleFactor = await appWindow.scaleFactor();
    const startX = e.screenX;
    const startY = e.screenY;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const onMouseMove = (moveE: MouseEvent) => {
      const dx = (moveE.screenX - startX) * scaleFactor;
      const dy = (moveE.screenY - startY) * scaleFactor;
      appWindow.setPosition(
        new PhysicalPosition(startPosX + dx, startPosY + dy)
      );
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="titlebar">
      <div
        className="titlebar-drag-region"
        onMouseDown={handleDragStart}
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
