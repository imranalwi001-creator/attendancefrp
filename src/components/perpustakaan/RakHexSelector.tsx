import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface RakHexSelectorProps {
  value: string;
  onChange: (rak: string) => void;
  readOnly?: boolean;
}

const HEX_CLIP =
  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

const HEX_W = 96;
const HEX_H = 84;

const COL_STEP = HEX_W * 0.75 + 5;
const ROW_STEP = HEX_H * 0.5 + 5;

const ITEMS: { kode: string; col: number; row: number }[] = [
  { kode: 'BE-8', col: 2, row: 0 },
  { kode: 'BE-6', col: 1, row: 1 },
  { kode: 'BE-7', col: 3, row: 1 },
  { kode: 'BE-4', col: 0, row: 2 },
  { kode: 'BE-3', col: 2, row: 2 },
  { kode: 'BE-5', col: 4, row: 2 },
  { kode: 'BE-1', col: 1, row: 3 },
  { kode: 'BE-2', col: 3, row: 3 },
];

export function RakHexSelector({ value, onChange, readOnly }: RakHexSelectorProps) {
  const cols = 5;
  const rows = 4;
  const containerW = COL_STEP * (cols - 1) + HEX_W;
  const containerH = ROW_STEP * (rows - 1) + HEX_H;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const next = Math.min(1, w / containerW);
      setScale(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerW]);

  return (
    <div ref={wrapperRef} className="w-full py-2">
      <div
        className="relative mx-auto"
        style={{
          width: containerW * scale,
          height: containerH * scale,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: containerW,
            height: containerH,
            transform: `scale(${scale})`,
          }}
        >
          {ITEMS.map(({ kode, col, row }) => {
            const active = value === kode;
            return (
              <button
                key={kode}
                type="button"
                onClick={() => !readOnly && onChange(active ? '' : kode)}
                aria-pressed={active}
                disabled={readOnly}
                tabIndex={readOnly ? -1 : 0}
                className={cn(
                  'absolute transition-transform',
                  readOnly
                    ? 'cursor-default pointer-events-none'
                    : 'hover:scale-105 active:scale-95',
                )}
                style={{
                  left: col * COL_STEP,
                  top: row * ROW_STEP,
                  width: HEX_W,
                  height: HEX_H,
                }}
              >
                <span
                  className={cn(
                    'absolute inset-0 transition-colors',
                    active ? 'bg-primary' : 'bg-muted-foreground/30',
                  )}
                  style={{ clipPath: HEX_CLIP }}
                />
                <span
                  className={cn(
                    'absolute inset-[2px] transition-colors',
                    active ? 'bg-primary' : 'bg-muted',
                  )}
                  style={{ clipPath: HEX_CLIP }}
                />
                <span
                  className={cn(
                    'relative z-10 flex h-full w-full items-center justify-center text-sm font-semibold transition-colors',
                    active ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {kode}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
