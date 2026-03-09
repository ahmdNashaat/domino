import { RefObject, useEffect, useState } from 'react';

export function useAutoFitScale(
  containerRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
  itemWidth: number,
  itemHeight: number,
  gap: number
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount === 0) {
      setScale(1);
      return;
    }

    const calculate = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;

      const cols = Math.ceil(Math.sqrt(itemCount));
      const rows = Math.ceil(itemCount / cols);

      const neededW = cols * (itemWidth + gap);
      const neededH = rows * (itemHeight + gap);

      const scaleX = w / neededW;
      const scaleY = h / neededH;
      const s = Math.min(scaleX, scaleY, 1);
      setScale(Math.max(0.35, s));
    };

    calculate();

    const observer = new ResizeObserver(calculate);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, itemCount, itemWidth, itemHeight, gap]);

  return scale;
}
