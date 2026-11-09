import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children: React.ReactElement;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  position = 'bottom',
  delay = 200,
  children,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 6;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
      case 'top':
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        break;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getTransform = () => {
    switch (position) {
      case 'bottom': return 'translateX(-50%)';
      case 'top': return 'translate(-50%, -100%)';
      case 'left': return 'translate(-100%, -50%)';
      case 'right': return 'translateY(-50%)';
      default: return 'translateX(-50%)';
    }
  };

  const child = React.cloneElement(children as React.ReactElement<any>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as any).ref;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') childRef.current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      if ((children as any).props?.onMouseEnter) (children as any).props.onMouseEnter(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      if ((children as any).props?.onMouseLeave) (children as any).props.onMouseLeave(e);
    },
    onMouseDown: (e: React.MouseEvent) => {
      handleMouseLeave();
      if ((children as any).props?.onMouseDown) (children as any).props.onMouseDown(e);
    }
  });

  return (
    <>
      {child}
      {isVisible && coords && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: getTransform(),
            zIndex: 99999,
            pointerEvents: 'none',
            background: 'var(--bg-popover)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 8px 22px var(--shadow-heavy)',
            borderRadius: 6,
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            animation: 'fadeInTooltip 0.12s ease-out'
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-main)' }}>
            {content}
          </span>
          {shortcut && (
            <span
              style={{
                fontSize: 9.5,
                color: 'var(--text-dim)',
                background: 'rgba(127, 127, 127, 0.12)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '1px 4px',
                fontFamily: 'monospace'
              }}
            >
              {shortcut}
            </span>
          )}
        </div>
      )}
    </>
  );
};
