import { useEffect, useRef } from 'react';

interface FireworkCanvasProps {
  status: string;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 255, g: 255, b: 255};
}

function rgbaStr(r: number, g: number, b: number, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hexToRgbaStr(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  return rgbaStr(rgb.r, rgb.g, rgb.b, alpha);
}

export default function FireworkCanvas({ status }: FireworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetActive = (status === 'connecting' || status === 'connected') ? 1 : 0;
    let targetConnected = status === 'connected' ? 1 : 0;

    let currentActive = targetActive;
    let currentConnected = targetConnected;

    const totalRays = 42;
    const rayProperties: any[] = [];
    for (let i = 0; i < totalRays; i++) {
      const baseAngle = (i / totalRays) * 2 * Math.PI;
      const seed1 = ((i * 97 + 31) % 100) / 100;
      const seed2 = ((i * 43 + 17) % 100) / 100;
      const seed3 = ((i * 71 + 53) % 100) / 100;
      
      let type = 2;
      if (i % 6 === 0) type = 0;
      else if (i % 3 === 0) type = 1;
      
      let baseLengthFactor = 0.2 + seed1 * 0.15;
      if (type === 0) baseLengthFactor = 0.75 + seed1 * 0.15;
      else if (type === 1) baseLengthFactor = 0.45 + seed1 * 0.15;
      
      let targetThickness = 1.2 + seed2 * 0.8;
      if (type === 0) targetThickness = 3.5 + seed2 * 1.0;
      else if (type === 1) targetThickness = 2.0 + seed2 * 1.0;
      
      let activeColor = '#D500F9';
      if (type === 0) activeColor = seed3 > 0.4 ? '#FFFFFF' : '#FF1493';
      else if (type === 1) activeColor = seed3 > 0.6 ? '#E040FB' : (seed3 > 0.3 ? '#FF007F' : '#FFFFFF');
      else activeColor = seed3 > 0.5 ? '#FF69B4' : '#D500F9';

      const hasSpark = type === 0 || (type === 1 && seed1 > 0.4);
      const offAlpha = 0.4 + seed2 * 0.3;

      rayProperties.push({
        baseAngle, seed1, seed2, seed3, type, baseLengthFactor, targetThickness, activeColor, hasSpark, offAlpha
      });
    }

    const offColorHex = '#4A4A4A';
    const offDotColorHex = '#5A5A5A';

    let lastFrameTime = performance.now();
    let timeSpeed = 1;
    let breathAlpha = 1;

    const render = (now: number) => {
      let delta = (now - lastFrameTime) / 1000;
      if (delta > 0.1) delta = 0.016;
      lastFrameTime = now;

      const isConnected = status === 'connected';
      let targetTimeSpeed = 1;
      let targetBreathAlpha = 1;
      if (isConnected) {
        const cycle = now % 7000;
        if (cycle < 4000) {
            targetTimeSpeed = 1;
            targetBreathAlpha = 1;
        } else {
            targetTimeSpeed = 0.05;
            targetBreathAlpha = 0.7;
        }
      }

      timeSpeed += (targetTimeSpeed - timeSpeed) * 0.05;
      breathAlpha += (targetBreathAlpha - breathAlpha) * 0.05;
      
      timeRef.current += delta * timeSpeed;
      const t = timeRef.current;

      currentActive += (targetActive - currentActive) * 0.08;
      currentConnected += (targetConnected - currentConnected) * 0.05;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = width / 2.3;
      const dpToPx = 1.5;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';


      if (currentActive > 0.01) {
        const vignetteGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 1.05);
        vignetteGrad.addColorStop(0, 'rgba(26, 0, 51, 0.85)');
        vignetteGrad.addColorStop(0.5, 'rgba(13, 0, 26, 0.95)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = currentActive;
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }


      if (currentActive > 0.01) {
        const ambientGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.85);
        ambientGrad.addColorStop(0, hexToRgbaStr('#FF007F', 0.4 * currentActive));
        ambientGrad.addColorStop(0.5, hexToRgbaStr('#7B1FA2', 0.15 * currentActive));
        ambientGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ambientGrad;
        ctx.fillRect(0, 0, width, height);

        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.5);
        coreGrad.addColorStop(0, hexToRgbaStr('#FF1493', 0.9 * currentActive));
        coreGrad.addColorStop(0.5, hexToRgbaStr('#D500F9', 0.4 * currentActive));
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, 0, width, height);

        const whiteGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.25);
        whiteGrad.addColorStop(0, `rgba(255, 255, 255, ${currentActive})`);
        whiteGrad.addColorStop(0.3, `rgba(255, 255, 255, ${0.8 * currentActive})`);
        whiteGrad.addColorStop(0.7, hexToRgbaStr('#FFB6C1', 0.2 * currentActive));
        whiteGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = whiteGrad;
        ctx.fillRect(0, 0, width, height);
      }


      if (currentActive < 0.99) {
        const iconAlpha = 1 - currentActive;
        const iconRadius = maxRadius * 0.22;
        const strokeWidth = 3 * dpToPx;

        ctx.strokeStyle = hexToRgbaStr(offColorHex, iconAlpha);
        ctx.lineWidth = strokeWidth;

        ctx.beginPath();
        ctx.arc(centerX, centerY, iconRadius, -Math.PI / 3, 4 * Math.PI / 3, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - iconRadius * 0.2);
        ctx.lineTo(centerX, centerY - iconRadius * 1.2);
        ctx.stroke();
      }


      for (let i = 0; i < totalRays; i++) {
        const prop = rayProperties[i];
        const pulsePhase = Math.sin(t * (2.5 + prop.seed1) + i * 0.5);
        const targetLength = maxRadius * prop.baseLengthFactor * (0.95 + 0.05 * pulsePhase);
        
        const angleOffset = (prop.seed1 - 0.5) * 0.12;
        const rotation = t * 0.025;
        
        const ringRadius = maxRadius * 0.45;
        const staticInner = ringRadius;
        const staticLength = ringRadius + (2.5 * dpToPx);

        const currentAngle = prop.baseAngle + (angleOffset * currentConnected) + rotation;
        const computedLength = staticLength + (targetLength - staticLength) * currentConnected;
        
        const targetInner = maxRadius * (0.02 + 0.05 * prop.seed2);
        const currentInner = staticInner + (targetInner - staticInner) * currentConnected;
        
        const startX = centerX + Math.cos(currentAngle) * currentInner;
        const startY = centerY + Math.sin(currentAngle) * currentInner;
        const endX = centerX + Math.cos(currentAngle) * computedLength;
        const endY = centerY + Math.sin(currentAngle) * computedLength;

        const onAlpha = 0.85 + 0.15 * Math.sin(t * 4 + i * 2);
        const currentAlpha = (prop.offAlpha + (onAlpha - prop.offAlpha) * currentActive) * breathAlpha;
        const thickness = (1.5 + (prop.targetThickness - 1.5) * currentConnected) * dpToPx;

        ctx.lineWidth = thickness;

        const isHaloTarget = (prop.activeColor === '#FFFFFF' || prop.activeColor === '#FF1493') && currentActive > 0;
        if (isHaloTarget) {
          const haloColor = prop.activeColor === '#FFFFFF' ? '#FF007F' : '#9C27B0';
          ctx.strokeStyle = hexToRgbaStr(haloColor, currentAlpha * 0.5 * currentActive);
          ctx.lineWidth = thickness * 2.2;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.lineWidth = thickness;
        }

        if (currentActive < 1) {
          const alphaOff = currentAlpha * (1 - currentActive);
          if (alphaOff > 0.01) {
            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, hexToRgbaStr(offColorHex, alphaOff));
            grad.addColorStop(0.9, hexToRgbaStr(offColorHex, alphaOff * 0.9));
            grad.addColorStop(1, hexToRgbaStr(offColorHex, alphaOff * 0.05));
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
        }

        if (currentActive > 0) {
          const alphaOn = currentAlpha * currentActive;
          if (alphaOn > 0.01) {
            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, hexToRgbaStr(prop.activeColor, alphaOn));
            grad.addColorStop(0.9, hexToRgbaStr(prop.activeColor, alphaOn * 0.9));
            grad.addColorStop(1, hexToRgbaStr(prop.activeColor, alphaOn * 0.05));
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
        }

        if (prop.hasSpark && currentConnected > 0.1) {
          const gap = (3 + prop.seed3 * 4) * dpToPx * currentConnected;
          const sparkDist = computedLength + gap;
          const sparkX = centerX + Math.cos(currentAngle) * sparkDist;
          const sparkY = centerY + Math.sin(currentAngle) * sparkDist;
          const sparkRadius = thickness * 0.7 * (0.5 + 0.5 * currentActive);
          const sparkAlpha = currentAlpha * (0.7 + 0.3 * Math.sin(t * 5 + i)) * currentConnected;

          if (sparkAlpha > 0) {
            if (currentActive > 0) {
              const alphaGlow = sparkAlpha * 0.65 * currentActive;
              if (alphaGlow > 0.01) {
                const glowRadius = sparkRadius * 3.5;
                const glowColor = prop.activeColor === '#FFFFFF' ? '#FF007F' : prop.activeColor;
                const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, glowRadius);
                sparkGrad.addColorStop(0, hexToRgbaStr(glowColor, alphaGlow));
                sparkGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sparkGrad;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, glowRadius, 0, 2 * Math.PI);
                ctx.fill();
              }
            }

            const c1 = hexToRgb(offDotColorHex);
            const c2 = hexToRgb(prop.activeColor);
            const r = Math.round(c1.r + (c2.r - c1.r) * currentActive);
            const g = Math.round(c1.g + (c2.g - c1.g) * currentActive);
            const b = Math.round(c1.b + (c2.b - c1.b) * currentActive);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${sparkAlpha})`;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, sparkRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [status]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        height: '400px',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
