import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './ResizeBorders.css';

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

export default function ResizeBorders() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const max = await appWindow.isMaximized();
        setIsMaximized(max);
      } catch (err) {
        console.error('Failed to check window maximized state:', err);
      }
    };

    checkMaximized();

    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(f => f && f());
    };
  }, [appWindow]);

  if (isMaximized) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    if (e.button === 0) {
      e.preventDefault();
      appWindow.startResizeDragging(direction);
    }
  };

  return (
    <>
      <div className="resize-border north" onMouseDown={(e) => handleMouseDown(e, 'North')} />
      <div className="resize-border south" onMouseDown={(e) => handleMouseDown(e, 'South')} />
      <div className="resize-border west" onMouseDown={(e) => handleMouseDown(e, 'West')} />
      <div className="resize-border east" onMouseDown={(e) => handleMouseDown(e, 'East')} />
      <div className="resize-border north-west" onMouseDown={(e) => handleMouseDown(e, 'NorthWest')} />
      <div className="resize-border north-east" onMouseDown={(e) => handleMouseDown(e, 'NorthEast')} />
      <div className="resize-border south-west" onMouseDown={(e) => handleMouseDown(e, 'SouthWest')} />
      <div className="resize-border south-east" onMouseDown={(e) => handleMouseDown(e, 'SouthEast')} />
    </>
  );
}
