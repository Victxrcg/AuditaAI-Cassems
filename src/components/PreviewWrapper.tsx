import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PreviewWrapperProps {
  children: React.ReactNode;
  position: { x: number; y: number };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

export const PreviewWrapper: React.FC<PreviewWrapperProps> = ({
  children,
  position,
  onMouseEnter,
  onMouseLeave,
  className
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = position.x;
      let y = position.y;
      
      // Ajustar posição se sair da tela
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10;
      }
      
      // Garantir que não saia da tela
      x = Math.max(10, x);
      y = Math.max(10, y);
      
      wrapperRef.current.style.left = `${x}px`;
      wrapperRef.current.style.top = `${y}px`;
    }
  }, [position]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "fixed z-[9999] pointer-events-auto",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};

export default PreviewWrapper;
