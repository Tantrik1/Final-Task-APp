import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, className = '', threshold = 80 }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const y = useMotionValue(0);

  const spinRotation = useTransform(y, [0, threshold], [0, 360]);
  const opacity = useTransform(y, [0, threshold * 0.4, threshold], [0, 0.6, 1]);
  const scale = useTransform(y, [0, threshold], [0.5, 1]);

  const isAtTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    // Check if the scrollable content is at the top
    return el.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;
    if (isAtTop()) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [isRefreshing, isAtTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    
    if (diff > 0 && isAtTop()) {
      // Apply resistance
      const dampened = Math.min(diff * 0.5, threshold * 1.5);
      y.set(dampened);
      if (dampened > 10) {
        e.preventDefault();
      }
    }
  }, [isRefreshing, isAtTop, y, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (y.get() >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      animate(y, threshold * 0.6, { type: 'spring', stiffness: 300, damping: 30 });
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [y, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className={`relative overflow-y-auto overflow-x-hidden ${className}`}>
      {/* Pull indicator */}
      <motion.div
        style={{ opacity, y: useTransform(y, v => v * 0.5 - 40) }}
        className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <motion.div
          style={{ scale }}
          className="h-10 w-10 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center shadow-lg"
        >
          <motion.div style={{ rotate: isRefreshing ? undefined : spinRotation }}>
            <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Content pushed down */}
      <motion.div style={{ y }} className="min-h-full">
        {children}
      </motion.div>
    </div>
  );
}
