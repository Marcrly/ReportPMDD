import { addDays, dayIndex, fromDayIndex } from './dates';
import { NEW_PERIOD_GAP } from './cycles';
import { isBleeding } from './questionnaire';
import type { DayEntry, Flow, ISODate } from './types';

/**
 * Automatyczne zaznaczanie okresu.
 * Zaznaczenie pierwszego dnia okresu zaznacza też kolejne dni według standardowej
 * długości okresu (z ustawień). Takie dni mają flagę `periodAuto` i krwawienie "period"
 * (dzień okresu bez podanej ilości). Okres można skrócić albo przedłużyć.
 */

export interface FlowChange {
  date: ISODate;
  flow: Flow | undefined;
  /** true = dzień zaznaczony automatycznie */
  periodAuto: boolean;
}

type Entries = Map<ISODate, DayEntry>;

const bleedingOn = (entries: Entries, d: ISODate) => isBleeding(entries.get(d)?.flow);

/** Dzień otwiera nowy okres, gdy w poprzednich 9 dniach nie było krwawienia. */
export function startsNewPeriod(entries: Entries, date: ISODate): boolean {
  for (let i = 1; i < NEW_PERIOD_GAP; i++) if (bleedingOn(entries, addDays(date, -i))) return false;
  return true;
}

/**
 * Zmiany potrzebne, gdy w danym dniu zmienia się krwawienie:
 *  - zaznaczenie pierwszego dnia okresu dopisuje kolejne dni (aż do standardowej długości),
 *    ale tylko te, w których krwawienie nie jest jeszcze w ogóle opisane,
 *  - odznaczenie dnia okresu albo wybór "Brak" kończy okres: usuwa następne dni zaznaczone automatycznie.
 */
export function planFlowChange(entries: Entries, date: ISODate, flow: Flow | undefined, periodLength: number): FlowChange[] {
  const was = bleedingOn(entries, date);
  const now = isBleeding(flow);
  const changes: FlowChange[] = [{ date, flow, periodAuto: false }];

  if (now && !was && startsNewPeriod(entries, date)) {
    const following = Array.from({ length: Math.max(0, periodLength - 1) }, (_, i) => addDays(date, i + 1));
    // Jeśli dalsze dni już są zaznaczone jako okres, to poprawka istniejącego okresu: nic nie dopisujemy.
    if (!following.some((d) => bleedingOn(entries, d))) {
      for (const d of following) {
        if (entries.get(d)?.flow !== undefined) break; // dzień z opisanym krwawieniem (np. "Brak") przerywa dopisywanie
        changes.push({ date: d, flow: 'period', periodAuto: true });
      }
    }
  }

  if (was && !now) {
    for (let d = addDays(date, 1); ; d = addDays(d, 1)) {
      const e = entries.get(d);
      if (e?.periodAuto && isBleeding(e.flow)) changes.push({ date: d, flow: undefined, periodAuto: false });
      else break;
    }
  }
  return changes;
}

export interface ActivePeriod {
  start: ISODate;
  /** ostatni zaznaczony dzień (może być w przyszłości) */
  end: ISODate;
  length: number;
  /** który dzień okresu jest dziś (może być większy od length, gdy okres skończył się wczoraj) */
  day: number;
  /** ile dni zaznaczono automatycznie */
  autoDays: number;
}

/** Okres, który trwa dziś albo skończył się wczoraj (z dniami zaznaczonymi z wyprzedzeniem). */
export function activePeriod(entries: Iterable<DayEntry>, today: ISODate): ActivePeriod | null {
  const list = [...entries].filter((e) => isBleeding(e.flow)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const t = dayIndex(today);
  let cluster: DayEntry[] = [];
  const clusters: DayEntry[][] = [];
  for (const e of list) {
    const last = cluster[cluster.length - 1];
    if (last && dayIndex(e.date) - dayIndex(last.date) < NEW_PERIOD_GAP) cluster.push(e);
    else {
      if (cluster.length) clusters.push(cluster);
      cluster = [e];
    }
  }
  if (cluster.length) clusters.push(cluster);
  for (const c of clusters) {
    const s = dayIndex(c[0].date);
    const en = dayIndex(c[c.length - 1].date);
    if (s <= t && en >= t - 1) {
      return {
        start: c[0].date,
        end: c[c.length - 1].date,
        length: en - s + 1,
        day: t - s + 1,
        autoDays: c.filter((e) => e.periodAuto).length,
      };
    }
  }
  return null;
}

/** Okres skończył się w dniu `lastDay`: usuwa zaznaczenia krwawienia po nim (w obrębie tego okresu). */
export function planEndPeriod(entries: Entries, period: { start: ISODate; end: ISODate }, lastDay: ISODate): FlowChange[] {
  const out: FlowChange[] = [];
  for (let i = dayIndex(lastDay) + 1; i <= dayIndex(period.end); i++) {
    const d = fromDayIndex(i);
    if (bleedingOn(entries, d)) out.push({ date: d, flow: undefined, periodAuto: false });
  }
  return out;
}

/** Przedłuża okres o jeden dzień. */
export function planExtendPeriod(period: { end: ISODate }): FlowChange[] {
  return [{ date: addDays(period.end, 1), flow: 'period', periodAuto: true }];
}

/** Czy wpis zawiera coś poza informacją o krwawieniu (żeby nie usuwać dni z innymi odpowiedziami). */
export function hasDataBesidesFlow(e: DayEntry | undefined): boolean {
  if (!e) return false;
  return (
    Object.keys(e.ratings).length > 0 ||
    Object.keys(e.events).length > 0 ||
    e.sleepQuality !== undefined ||
    e.sleepHours !== undefined ||
    e.activity !== undefined ||
    Boolean(e.note?.trim())
  );
}
