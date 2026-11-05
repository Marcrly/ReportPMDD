import { addDays, dayIndex, diffDays, fromDayIndex } from './dates';
import { isBleeding } from './questionnaire';
import type { CycleSettings, DayEntry, ISODate } from './types';

export type { CycleMode, CycleSettings } from './types';

/** Ile dni bez krwawienia musi minąć, żeby kolejne krwawienie liczyć jako nowy okres. */
export const NEW_PERIOD_GAP = 10;
/** Długości cykli spoza tego zakresu traktujemy jako luki w danych i pomijamy w średniej. */
export const PLAUSIBLE_CYCLE = { min: 18, max: 60 };
/** Faza lutealna trwa średnio ok. 14 dni, stąd owulacja szacowana jest na 14 dni przed okresem. */
export const LUTEAL_DAYS = 14;
/** Podpowiedź długości cyklu i okresu liczona z tylu ostatnich cykli. */
export const STATS_CYCLES = 4;
/** Ile kolejnych okresów prognozujemy. */
const PREDICT_AHEAD = 3;

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = { mode: 'manual', cycleLength: 28, periodLength: 5 };
export const CYCLE_LIMITS = { cycle: { min: 20, max: 45 }, period: { min: 2, max: 10 } };

export function sanitizeCycleSettings(raw: unknown): CycleSettings | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : d);
  return {
    mode: r.mode === 'auto' ? 'auto' : 'manual',
    cycleLength: num(r.cycleLength, CYCLE_LIMITS.cycle.min, CYCLE_LIMITS.cycle.max, DEFAULT_CYCLE_SETTINGS.cycleLength),
    periodLength: num(r.periodLength, CYCLE_LIMITS.period.min, CYCLE_LIMITS.period.max, DEFAULT_CYCLE_SETTINGS.periodLength),
  };
}

export interface Period {
  start: ISODate;
  end: ISODate;
  length: number;
}

export interface Cycle {
  /** 1 = pierwszy cykl w danych */
  number: number;
  start: ISODate;
  /** ostatni dzień cyklu (dzień przed kolejnym okresem); dla bieżącego cyklu: null */
  end: ISODate | null;
  length: number | null;
  complete: boolean;
  /** szacowana owulacja (14 dni przed kolejnym okresem), tylko dla zakończonych cykli */
  ovulation: ISODate | null;
}

export interface CycleStats {
  /** długości ostatnich (maks. 4) pełnych cykli */
  cycleLengths: number[];
  /** długości ostatnich (maks. 4) zakończonych okresów */
  periodLengths: number[];
  avgCycle: number | null;
  avgPeriod: number | null;
  minCycle: number | null;
  maxCycle: number | null;
  /** początek najstarszego cyklu użytego do średniej */
  since: ISODate | null;
}

export interface PredictedPeriod {
  start: ISODate;
  end: ISODate;
}

export interface Prediction {
  cycleLength: number;
  periodLength: number;
  /** skąd wzięły się wartości: wpisane ręcznie czy wyliczone z danych */
  source: 'manual' | 'data';
  periods: PredictedPeriod[];
  /** szacowana owulacja w bieżącym cyklu (null, gdy okres się spóźnia) */
  currentOvulation: ISODate | null;
  /** przyszłe szacowane owulacje (bieżący i kolejne cykle) */
  ovulations: ISODate[];
  /** o ile dni okres spóźnia się względem prognozy (0 = nie spóźnia się) */
  lateBy: number;
}

export interface CycleInfo {
  starts: ISODate[];
  periods: Period[];
  cycles: Cycle[];
  stats: CycleStats;
  prediction: Prediction | null;
  /** wszystkie szacowane owulacje (z zakończonych cykli i z prognozy) */
  ovulationDays: Set<ISODate>;
}

export function analyzeCycles(entries: Iterable<DayEntry>, today: ISODate, settings: CycleSettings = DEFAULT_CYCLE_SETTINGS): CycleInfo {
  const bleedDays = [...entries]
    .filter((e) => isBleeding(e.flow) && e.date <= today)
    .map((e) => dayIndex(e.date))
    .sort((a, b) => a - b);

  const periods: Period[] = [];
  let current: { start: number; end: number } | null = null;
  for (const d of bleedDays) {
    if (current && d - current.end < NEW_PERIOD_GAP) {
      current.end = d;
    } else {
      if (current) periods.push(toPeriod(current));
      current = { start: d, end: d };
    }
  }
  if (current) periods.push(toPeriod(current));

  const starts = periods.map((p) => p.start);
  const cycles: Cycle[] = starts.map((start, i) => {
    const next = starts[i + 1];
    if (next) {
      const length = diffDays(next, start);
      const plausible = length >= PLAUSIBLE_CYCLE.min && length <= PLAUSIBLE_CYCLE.max;
      return {
        number: i + 1,
        start,
        end: addDays(next, -1),
        length,
        complete: true,
        ovulation: plausible ? addDays(next, -LUTEAL_DAYS) : null,
      };
    }
    return { number: i + 1, start, end: null, length: null, complete: false, ovulation: null };
  });

  const stats = cycleStats(cycles, periods, today);

  let prediction: Prediction | null = null;
  const last = starts[starts.length - 1];
  if (last) {
    const useData = settings.mode === 'auto' && stats.avgCycle !== null;
    const cycleLength = clamp(Math.round(useData ? (stats.avgCycle as number) : settings.cycleLength), PLAUSIBLE_CYCLE.min, PLAUSIBLE_CYCLE.max);
    const periodLength = clamp(
      Math.round(settings.mode === 'auto' && stats.avgPeriod !== null ? stats.avgPeriod : settings.periodLength),
      1,
      CYCLE_LIMITS.period.max,
    );
    const firstNext = addDays(last, cycleLength);
    // Spóźnienie liczymy od dnia po prognozowanym początku (w dniu prognozy okres jest "spodziewany dziś").
    const lateBy = firstNext < today ? diffDays(today, firstNext) : 0;
    const periodsAhead: PredictedPeriod[] = [];
    const ovulations: ISODate[] = [];
    let currentOvulation: ISODate | null = null;
    if (lateBy === 0) {
      for (let k = 0; k < PREDICT_AHEAD; k++) {
        const s = addDays(firstNext, k * cycleLength);
        periodsAhead.push({ start: s, end: addDays(s, periodLength - 1) });
        ovulations.push(addDays(s, -LUTEAL_DAYS));
      }
      currentOvulation = ovulations[0] > last ? ovulations[0] : null;
    }
    prediction = {
      cycleLength,
      periodLength,
      source: useData ? 'data' : 'manual',
      periods: periodsAhead,
      currentOvulation,
      ovulations,
      lateBy,
    };
  }

  const ovulationDays = new Set<ISODate>();
  cycles.forEach((c) => c.ovulation && ovulationDays.add(c.ovulation));
  prediction?.ovulations.forEach((o) => ovulationDays.add(o));

  return { starts, periods, cycles, stats, prediction, ovulationDays };
}

/** Średnie z ostatnich 4 pełnych cykli i 4 zakończonych okresów. */
export function cycleStats(cycles: Cycle[], periods: Period[], today: ISODate, n = STATS_CYCLES): CycleStats {
  const usable = cycles
    .filter((c) => c.complete && c.length !== null && c.length >= PLAUSIBLE_CYCLE.min && c.length <= PLAUSIBLE_CYCLE.max)
    .slice(-n);
  const cycleLengths = usable.map((c) => c.length as number);
  // Okres liczymy jako zakończony, gdy od ostatniego dnia krwawienia minęły 2 dni.
  // Okresy z jednym zaznaczonym dniem pomijamy: zwykle to tylko zaznaczony początek.
  const periodLengths = periods
    .filter((p) => diffDays(today, p.end) >= 2 && p.length >= 2)
    .slice(-n)
    .map((p) => p.length);
  return {
    cycleLengths,
    periodLengths,
    avgCycle: cycleLengths.length ? round1(mean(cycleLengths)) : null,
    avgPeriod: periodLengths.length ? round1(mean(periodLengths)) : null,
    minCycle: cycleLengths.length ? Math.min(...cycleLengths) : null,
    maxCycle: cycleLengths.length ? Math.max(...cycleLengths) : null,
    since: usable[0]?.start ?? null,
  };
}

function toPeriod(p: { start: number; end: number }): Period {
  return { start: fromDayIndex(p.start), end: fromDayIndex(p.end), length: p.end - p.start + 1 };
}

export interface DayPosition {
  /** dzień cyklu (1 = pierwszy dzień okresu) */
  cycleDay: number | null;
  /** ile dni do następnego okresu, ujemnie (-1 = dzień przed okresem); tylko gdy kolejny okres jest znany */
  daysToNext: number | null;
  cycleNumber: number | null;
}

export function positionOf(date: ISODate, info: CycleInfo): DayPosition {
  const { starts } = info;
  let idx = -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (starts[i] <= date) {
      idx = i;
      break;
    }
  }
  const next = starts.find((s) => s > date) ?? null;
  return {
    cycleDay: idx >= 0 ? diffDays(date, starts[idx]) + 1 : null,
    daysToNext: next ? diffDays(date, next) : null,
    cycleNumber: idx >= 0 ? idx + 1 : null,
  };
}

/** Czy dzień należy do prognozowanego okresu (tylko przyszłe dni). */
export function isPredictedPeriodDay(date: ISODate, info: CycleInfo, today: ISODate): boolean {
  if (!info.prediction || date <= today) return false;
  return info.prediction.periods.some((p) => date >= p.start && date <= p.end);
}

export function isOvulationDay(date: ISODate, info: CycleInfo): boolean {
  return info.ovulationDays.has(date);
}

/** Dni do najbliższego prognozowanego okresu. */
export function daysUntilPredicted(info: CycleInfo, today: ISODate): number | null {
  const p = info.prediction?.periods[0];
  return p ? diffDays(p.start, today) : null;
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
