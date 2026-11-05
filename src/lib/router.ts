import { useEffect, useState } from 'react';
import { isISODate } from './dates';
import type { ISODate } from './types';

export type Route = { name: 'calendar' } | { name: 'day'; date: ISODate } | { name: 'analysis' } | { name: 'data' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const day = h.match(/^\/dzien\/(\d{4}-\d{2}-\d{2})$/);
  if (day && isISODate(day[1])) return { name: 'day', date: day[1] };
  if (h === '/analiza') return { name: 'analysis' };
  if (h === '/dane') return { name: 'data' };
  return { name: 'calendar' };
}

export const hrefFor = {
  calendar: () => '#/',
  day: (date: ISODate) => `#/dzien/${date}`,
  analysis: () => '#/analiza',
  data: () => '#/dane',
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
}

export function navigate(hash: string, replace = false): void {
  if (window.location.hash === hash || (hash === '#/' && window.location.hash === '')) return;
  if (replace) window.history.replaceState({ inApp: true }, '', hash);
  else window.history.pushState({ inApp: true }, '', hash);
  window.scrollTo(0, 0);
  notify();
}

/** Wraca do poprzedniego ekranu aplikacji albo (gdy wejście było z linku) do kalendarza. */
export function goBack(fallback = '#/'): void {
  const state = window.history.state as { inApp?: boolean } | null;
  if (state?.inApp && window.history.length > 1) window.history.back();
  else navigate(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const l = () => setRoute(parseHash(window.location.hash));
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return route;
}
