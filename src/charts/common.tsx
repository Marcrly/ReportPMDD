import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Kolory wykresów (zsynchronizowane z tokens.css). */
export const C = {
  surface: '#fbf8f2',
  grid: '#e7dfd1',
  axis: '#cfc4b1',
  ink: '#263228',
  ink2: '#4f5a4c',
  ink3: '#626b5b',
  pmdd: '#465c3f',
  pms: '#738b67',
  post: '#738b67',
  pre: '#344632',
  link: '#afc1a0',
  period: '#a9604f',
  periodLight: '#dda89d',
  ovulation: '#9a6b12',
  preWindow: 'rgba(221, 168, 157, 0.16)',
  postWindow: 'rgba(143, 166, 130, 0.12)',
};

export const SEV = ['#f0f3ea', '#dce5d2', '#bccbaf', '#8fa682', '#5b7351', '#6f2b3e'];
export const sevColor = (v: number) => SEV[Math.min(6, Math.max(1, Math.round(v))) - 1];
export const sevInk = (v: number) => (v >= 5 ? '#ffffff' : C.ink);

export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0].contentRect.width);
      setW((prev) => (prev === width ? prev : width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export const fmt1 = (v: number | null | undefined) => (v === null || v === undefined ? '-' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));
export const fmtSigned = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '-'
    : `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(Math.round(v * 10) / 10)
        .toFixed(1)
        .replace('.', ',')}`;

export function TableToggle({
  on,
  onToggle,
  labelOn = 'Pokaż wykres',
  labelOff = 'Pokaż jako tabelę',
}: {
  on: boolean;
  onToggle: () => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button type="button" className="btn btn--ghost btn--small" aria-pressed={on} onClick={onToggle}>
      {on ? labelOn : labelOff}
    </button>
  );
}
