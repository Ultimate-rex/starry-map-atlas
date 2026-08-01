import { useEffect, useRef, useState } from "react";

/** Animate a number from 0 to `value` whenever `value` or `runKey` changes. */
export function useCountUp(value: number, duration = 1200, runKey?: unknown) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, runKey]);

  return display;
}
