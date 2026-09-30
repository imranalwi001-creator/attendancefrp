import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  storageKey?: string;
}

export function useDraggable({ initialPosition, storageKey }: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position | null>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return initialPosition ?? null;
  });

  const isDragging = useRef(false);
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  const elementStart = useRef<Position>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasMoved = useRef(false);

  const clamp = useCallback((pos: Position): Position => {
    if (!elementRef.current) return pos;
    const rect = elementRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore if clicking buttons/inputs inside
    if ((e.target as HTMLElement).closest('button, input, a')) return;

    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };

    const el = elementRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      elementStart.current = { x: rect.left, y: rect.top };
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (!hasMoved.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    hasMoved.current = true;

    const newPos = clamp({
      x: elementStart.current.x + dx,
      y: elementStart.current.y + dy,
    });
    setPosition(newPos);
  }, [clamp]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (hasMoved.current && position && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch {}
    }
  }, [position, storageKey]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      if (position) setPosition(clamp(position));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, clamp]);

  return {
    position,
    elementRef,
    isDragging: isDragging.current,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
