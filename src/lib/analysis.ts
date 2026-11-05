import { addDays, diffDays, fromDayIndex, dayIndex } from './dates';
import { DOMAINS, DRSP_CORE_IDS } from './questionnaire';
import { mean, positionOf, type CycleInfo } from './cycles';
import type { DayEntry, DomainId, Flow, ISODate, Symptom } from './types';

export interface AnalysisOptions {
  /** Pomijaj oceny objawów, przy których zaznaczono "zdarzenie powiązane". */
  excludeEvents: boolean;
}

export type EntryMap = Map<ISODate, DayEntry>;

export function ratingOf(e: DayEntry | undefined, id: string, opts: AnalysisOptions): number | undefined {
  if (!e) return undefined;
  const r = e.ratings[id];
  if (r === undefined) return undefined;
  if (opts.excludeEvents && Object.prototype.hasOwnProperty.call(e.events, id)) return undefined;
  return r;
}

export function meanScore(e: DayEntry | undefined, ids: string[], opts: AnalysisOptions): number | null {
  if (!e) return null;
  const vals: number[] = [];
  for (const id of ids) {
    const r = ratingOf(e, id, opts);
    if (r !== undefined) vals.push(r);
  }
  return vals.length ? mean(vals) : null;
}

/** Średnie nasilenie PMDD w danym dniu: średnia z DRSP 1-21 (bez pytań o wpływ na życie). */
export const pmddScore = (e: DayEntry | undefined, opts: AnalysisOptions) => meanScore(e, DRSP_CORE_IDS, opts);

/** Poziom 1-6 do kolorowania kalendarza. */
export function dayLevel(e: DayEntry | undefined): number | null {
  const s = pmddScore(e, { excludeEvents: false });
  if (s === null) return null;
  return Math.min(6, Math.max(1, Math.round(s)));
}

export function hasAnyAnswer(e: DayEntry | undefined): boolean {
  if (!e) return false;
  return (
    Object.keys(e.ratings).length > 0 ||
    e.sleepQuality !== undefined ||
    e.sleepHours !== undefined ||
    e.activity !== undefined ||
    e.flow !== undefined ||
    Boolean(e.note?.trim())
  );
}

export const hasRatings = (e: DayEntry | undefined) => Boolean(e && Object.keys(e.ratings).length > 0);

// ---------------------------------------------------------------------------
// Porównanie "tydzień przed okresem" vs "tydzień po okresie"
// Kryteria inspirowane metodą C-PASS (Eisenlohr-Moul i in., 2017):
//  - dzień 1 = pierwszy dzień krwawienia,
//  - tydzień przed: dni -7 do -1, tydzień po: dni 4 do 10,
//  - wzrost średniej o co najmniej 30% zakresu skali (tu: pełnej skali 1-6),
//  - co najmniej 2 dni z oceną 4 lub wyższą przed okresem,
//  - po okresie żadnego dnia powyżej 3.
// To uproszczenie do samoobserwacji, a nie narzędzie diagnostyczne.
// ---------------------------------------------------------------------------

export const PRE_OFFSETS = { from: -7, to: -1 } as const;
export const POST_CYCLE_DAYS = { from: 4, to: 10 } as const;
export const MIN_DAYS_PER_WINDOW = 4;
export const ELEVATION_PCT = 30;
const SCALE_RANGE = 5; // 6 - 1

export interface ItemComparison {
  id: string;
  preMean: number | null;
  postMean: number | null;
  preN: number;
  postN: number;
  preHighDays: number;
  postMax: number | null;
  pct: number | null;
  enough: boolean;
  elevated: boolean;
  severe: boolean;
  clears: boolean;
  meets: boolean;
}

export interface OnsetComparison {
  onset: ISODate;
  pre: [ISODate, ISODate];
  post: [ISODate, ISODate];
  items: Record<string, ItemComparison>;
  domainsMet: DomainId[];
  coreDomainsMet: DomainId[];
  domainsEvaluated: number;
  impairmentMet: boolean;
  impairmentEvaluated: boolean;
}

export function windowsFor(onset: ISODate): { pre: [ISODate, ISODate]; post: [ISODate, ISODate] } {
  return {
    pre: [addDays(onset, PRE_OFFSETS.from), addDays(onset, PRE_OFFSETS.to)],
    post: [addDays(onset, POST_CYCLE_DAYS.from - 1), addDays(onset, POST_CYCLE_DAYS.to - 1)],
  };
}

function datesBetween(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let i = dayIndex(a); i <= dayIndex(b); i++) out.push(fromDayIndex(i));
  return out;
}

export function compareItem(id: string, pre: ISODate[], post: ISODate[], byDate: EntryMap, opts: AnalysisOptions): ItemComparison {
  const preVals = pre.map((d) => ratingOf(byDate.get(d), id, opts)).filter((v): v is number => v !== undefined);
  const postVals = post.map((d) => ratingOf(byDate.get(d), id, opts)).filter((v): v is number => v !== undefined);
  const preMean = preVals.length ? mean(preVals) : null;
  const postMean = postVals.length ? mean(postVals) : null;
  const enough = preVals.length >= MIN_DAYS_PER_WINDOW && postVals.length >= MIN_DAYS_PER_WINDOW;
  const pct = preMean !== null && postMean !== null ? ((preMean - postMean) / SCALE_RANGE) * 100 : null;
  const preHighDays = preVals.filter((v) => v >= 4).length;
  const postMax = postVals.length ? Math.max(...postVals) : null;
  const elevated = enough && pct !== null && pct >= ELEVATION_PCT;
  const severe = enough && preHighDays >= 2;
  const clears = enough && postMax !== null && postMax <= 3;
  return {
    id,
    preMean,
    postMean,
    preN: preVals.length,
    postN: postVals.length,
    preHighDays,
    postMax,
    pct,
    enough,
    elevated,
    severe,
    clears,
    meets: elevated && severe && clears,
  };
}

/** Zwraca null, jeśli tydzień po okresie jeszcze się nie skończył. */
export function compareOnset(onset: ISODate, byDate: EntryMap, symptoms: Symptom[], opts: AnalysisOptions, today: ISODate): OnsetComparison | null {
  const { pre, post } = windowsFor(onset);
  if (post[1] > today) return null;
  const preDates = datesBetween(pre[0], pre[1]);
  const postDates = datesBetween(post[0], post[1]);
  const items: Record<string, ItemComparison> = {};
  for (const s of symptoms) items[s.id] = compareItem(s.id, preDates, postDates, byDate, opts);

  const domainsMet: DomainId[] = [];
  let domainsEvaluated = 0;
  for (const d of DOMAINS) {
    const its = symptoms.filter((s) => s.domain === d.id).map((s) => items[s.id]);
    if (its.some((i) => i.enough)) domainsEvaluated++;
    if (its.some((i) => i.meets)) domainsMet.push(d.id);
  }
  const coreDomainsMet = domainsMet.filter((id) => DOMAINS.find((d) => d.id === id)?.core);
  const imp = symptoms.filter((s) => s.impairment).map((s) => items[s.id]);
  return {
    onset,
    pre,
    post,
    items,
    domainsMet,
    coreDomainsMet,
    domainsEvaluated,
    impairmentMet: imp.some((i) => i.meets),
    impairmentEvaluated: imp.some((i) => i.enough),
  };
}

/** Porównania dla wszystkich okresów rozpoczętych w zakresie dat, które mają jakiekolwiek wystarczające dane. */
export function compareOnsets(
  info: CycleInfo,
  byDate: EntryMap,
  symptoms: Symptom[],
  opts: AnalysisOptions,
  today: ISODate,
  from?: ISODate,
): OnsetComparison[] {
  return info.starts
    .filter((s) => !from || s >= from)
    .map((s) => compareOnset(s, byDate, symptoms, opts, today))
    .filter((c): c is OnsetComparison => c !== null && Object.values(c.items).some((i) => i.enough));
}

export interface ItemAggregate {
  id: string;
  /** liczba cykli z wystarczającymi danymi dla tego objawu */
  n: number;
  /** w ilu z nich objaw był wyraźnie nasilony przed okresem */
  met: number;
  preMean: number | null;
  postMean: number | null;
  diff: number | null;
}

export function aggregateItems(comparisons: OnsetComparison[], symptoms: Symptom[]): ItemAggregate[] {
  return symptoms.map((s) => {
    const its = comparisons.map((c) => c.items[s.id]).filter((i) => i && i.enough);
    const pres = its.map((i) => i.preMean as number);
    const posts = its.map((i) => i.postMean as number);
    const preMean = pres.length ? mean(pres) : null;
    const postMean = posts.length ? mean(posts) : null;
    return {
      id: s.id,
      n: its.length,
      met: its.filter((i) => i.meets).length,
      preMean,
      postMean,
      diff: preMean !== null && postMean !== null ? preMean - postMean : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Szereg czasowy do wykresów
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  date: ISODate;
  pmdd: number | null;
  pms: number | null;
  sleepHours: number | null;
  flow: Flow | undefined;
  cycleDay: number | null;
  hasEntry: boolean;
}

export function dailySeries(byDate: EntryMap, from: ISODate, to: ISODate, pmsIds: string[], opts: AnalysisOptions, info: CycleInfo): SeriesPoint[] {
  return datesBetween(from, to).map((date) => {
    const e = byDate.get(date);
    return {
      date,
      pmdd: pmddScore(e, opts),
      pms: meanScore(e, pmsIds, opts),
      sleepHours: e?.sleepHours ?? null,
      flow: e?.flow,
      cycleDay: positionOf(date, info).cycleDay,
      hasEntry: hasAnyAnswer(e),
    };
  });
}

// ---------------------------------------------------------------------------
// Sen i aktywność
// ---------------------------------------------------------------------------

export interface PhaseStats {
  days: number;
  sleepHours: number | null;
  sleepQuality: number | null;
  activeShare: number | null;
  pmdd: number | null;
}

export function phaseStats(dates: ISODate[], byDate: EntryMap, opts: AnalysisOptions): PhaseStats {
  const es = dates.map((d) => byDate.get(d)).filter((e): e is DayEntry => Boolean(e && hasAnyAnswer(e)));
  const sh = es.map((e) => e.sleepHours).filter((v): v is number => typeof v === 'number');
  const sq = es.map((e) => e.sleepQuality).filter((v): v is NonNullable<typeof v> => typeof v === 'number');
  const act = es.map((e) => e.activity).filter((v): v is boolean => typeof v === 'boolean');
  const pm = es.map((e) => pmddScore(e, opts)).filter((v): v is number => v !== null);
  return {
    days: es.length,
    sleepHours: sh.length ? mean(sh) : null,
    sleepQuality: sq.length ? mean(sq) : null,
    activeShare: act.length ? act.filter(Boolean).length / act.length : null,
    pmdd: pm.length ? mean(pm) : null,
  };
}

export function phaseDates(comparisons: OnsetComparison[]): { pre: ISODate[]; post: ISODate[] } {
  const pre = new Set<ISODate>();
  const post = new Set<ISODate>();
  for (const c of comparisons) {
    datesBetween(c.pre[0], c.pre[1]).forEach((d) => pre.add(d));
    datesBetween(c.post[0], c.post[1]).forEach((d) => post.add(d));
  }
  return { pre: [...pre], post: [...post] };
}

export interface GroupMean {
  label: string;
  n: number;
  pmdd: number | null;
}

/** Średnie nasilenie PMDD w zależności od snu i aktywności (opis, nie dowód przyczyny). */
export function lifestyleBreakdown(dates: ISODate[], byDate: EntryMap, opts: AnalysisOptions): { sleep: GroupMean[]; activity: GroupMean[] } {
  const groups = {
    short: [] as number[],
    mid: [] as number[],
    long: [] as number[],
    active: [] as number[],
    inactive: [] as number[],
  };
  for (const d of dates) {
    const e = byDate.get(d);
    const s = pmddScore(e, opts);
    if (!e || s === null) continue;
    if (typeof e.sleepHours === 'number') {
      if (e.sleepHours < 6) groups.short.push(s);
      else if (e.sleepHours < 7) groups.mid.push(s);
      else groups.long.push(s);
    }
    if (e.activity === true) groups.active.push(s);
    if (e.activity === false) groups.inactive.push(s);
  }
  const g = (label: string, xs: number[]): GroupMean => ({ label, n: xs.length, pmdd: xs.length ? mean(xs) : null });
  return {
    sleep: [g('Poniżej 6 h snu', groups.short), g('6 do 7 h snu', groups.mid), g('7 h snu i więcej', groups.long)],
    activity: [g('Dni z aktywnością', groups.active), g('Dni bez aktywności', groups.inactive)],
  };
}

// ---------------------------------------------------------------------------
// Zdarzenia powiązane
// ---------------------------------------------------------------------------

export interface EventItem {
  date: ISODate;
  symptomId: string;
  rating: number | undefined;
  note: string;
}

export function listEvents(entries: Iterable<DayEntry>, from?: ISODate): EventItem[] {
  const out: EventItem[] = [];
  for (const e of entries) {
    if (from && e.date < from) continue;
    for (const [id, note] of Object.entries(e.events)) {
      out.push({ date: e.date, symptomId: id, rating: e.ratings[id], note });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.symptomId.localeCompare(b.symptomId) : a.date < b.date ? 1 : -1));
}

export function rangeStart(range: RangeKey, today: ISODate, firstDate: ISODate | null): ISODate {
  const days = RANGE_DAYS[range];
  if (days === null) return firstDate && firstDate < today ? firstDate : today;
  return addDays(today, -(days - 1));
}

export type RangeKey = '1m' | '3m' | '6m' | 'all';
export const RANGE_DAYS: Record<RangeKey, number | null> = { '1m': 30, '3m': 91, '6m': 182, all: null };
export const RANGE_LABEL: Record<RangeKey, string> = { '1m': '30 dni', '3m': '3 mies.', '6m': '6 mies.', all: 'Wszystko' };

export const daysBetweenInclusive = (a: ISODate, b: ISODate) => diffDays(b, a) + 1;
