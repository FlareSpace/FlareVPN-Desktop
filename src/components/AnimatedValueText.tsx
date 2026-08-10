import { useState, useEffect, useRef } from 'react';
import './AnimatedValueText.css';

interface SingleDigitSlotProps {
  char: string;
  animateOnMount: boolean;
}

function SingleDigitSlot({ char, animateOnMount }: SingleDigitSlotProps) {
  const [items, setItems] = useState<{ id: number; text: string; animated: boolean }[]>(() => [
    { id: Date.now(), text: char, animated: animateOnMount }
  ]);
  const counterRef = useRef(0);

  useEffect(() => {
    setItems((prev) => {
      const lastItem = prev[prev.length - 1];
      if (lastItem && lastItem.text === char) {
        return prev;
      }
      counterRef.current += 1;
      const newId = Date.now() + counterRef.current;
      const newItem = { id: newId, text: char, animated: true };
      const base = prev.length > 0 ? [prev[prev.length - 1]] : [];
      return [...base, newItem];
    });
  }, [char]);

  return (
    <div className="digit-slot">
      <span className="digit-placeholder" aria-hidden="true">
        {char}
      </span>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const animationClass = isLast
          ? (item.animated ? 'slide-in' : '')
          : 'slide-out';

        return (
          <span
            key={item.id}
            className={`digit-text ${animationClass}`}
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

interface AnimatedValueTextProps {
  value: string | number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function AnimatedValueText({ value, prefix, suffix, className = '' }: AnimatedValueTextProps) {
  const isParentMountedRef = useRef(false);

  useEffect(() => {
    isParentMountedRef.current = true;
  }, []);

  const strValue = String(value);
  const chars = strValue.split('');
  const totalLength = chars.length;

  return (
    <div className={`animated-value-container ${className}`}>
      {prefix && <span className="animated-value-prefix">{prefix}</span>}
      <div className="animated-value-digits-wrapper">
        {chars.map((char, index) => {
          const posFromRight = totalLength - 1 - index;
          const slotKey = `pos-${posFromRight}`;
          return (
            <SingleDigitSlot
              key={slotKey}
              char={char}
              animateOnMount={isParentMountedRef.current}
            />
          );
        })}
      </div>
      {suffix && <span className="animated-value-suffix">{suffix}</span>}
    </div>
  );
}
