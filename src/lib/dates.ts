import type { ISODate } from './types';

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokalna data (bez strefy czasowej) jako RRRR-MM-DD. */
export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Numer dnia liczony od 1970-01-01. Operuje na UTC, więc zmiana czasu (DST) niczego nie psuje. */
export function dayIndex(s: ISODate): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayIndex(i: number): ISODate {
  const t = new Date(i * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  return fromDayIndex(dayIndex(s) + n);
}

/** a - b w dniach */
export function diffDays(a: ISODate, b: ISODate): number {
  return dayIndex(a) - dayIndex(b);
}

/** Lokalna północ danego dnia (do formatowania przez Intl). */
export function toLocalDate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * "Dzisiaj" z punktu widzenia dziennika. Wpisy robione są wieczorem,
 * więc do 4:00 rano nadal liczy się poprzedni dzień.
 */
export const DAY_BOUNDARY_HOUR = 4;
export function logicalToday(now: Date = new Date()): ISODate {
  const shifted = new Date(now.getTime());
  if (shifted.getHours() < DAY_BOUNDARY_HOUR) shifted.setDate(shifted.getDate() - 1);
  return toISO(shifted);
}

export function calendarToday(now: Date = new Date()): ISODate {
  return toISO(now);
}

const fmtLong = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDayMonth = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });
const fmtDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtWeekdayDayMonth = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' });
const fmtNumeric = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Środa, 5 listopada 2026" */
export const formatLong = (s: ISODate) => cap(fmtLong.format(toLocalDate(s)));
/** "5 listopada 2026" */
export const formatDate = (s: ISODate) => fmtDate.format(toLocalDate(s));
/** "5 listopada" */
export const formatDayMonth = (s: ISODate) => fmtDayMonth.format(toLocalDate(s));
/** "środa, 5 listopada" */
export const formatWeekdayDayMonth = (s: ISODate) => fmtWeekdayDayMonth.format(toLocalDate(s));
/** "5 lis" */
export const formatShort = (s: ISODate) => fmtShort.format(toLocalDate(s)).replace('.', '');
/** "05.11.2026" */
export const formatNumeric = (s: ISODate) => fmtNumeric.format(toLocalDate(s));
/** "Listopad 2026" (mianownik, bez "r.") */
export function formatMonthYear(year: number, month0: number): string {
  // Intl w części przeglądarek zwraca dopełniacz ("listopada 2026"), więc nazwy są tu na sztywno.
  return `${MONTHS[month0]} ${year}`;
}
export const formatDateTime = (iso: string) => fmtDateTime.format(new Date(iso));

export const MONTHS = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/** Dni tygodnia liczone od poniedziałku: 0 = poniedziałek ... 6 = niedziela. */
export function weekdayMondayFirst(s: ISODate): number {
  const d = new Date(dayIndex(s) * DAY_MS).getUTCDay(); // 0 = niedziela
  return (d + 6) % 7;
}

/** Liczba Excela (dni od 1899-12-30). */
export function excelSerial(s: ISODate): number {
  return dayIndex(s) + 25569;
}

/** Odmiana "dzień": 1 dzień, 2 dni, 5 dni. */
export function plDays(n: number): string {
  return Math.abs(n) === 1 ? 'dzień' : 'dni';
}

/** Ogólna odmiana liczebników: plural(5, ['wpis', 'wpisy', 'wpisów']) */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return forms[1];
  return forms[2];
}
