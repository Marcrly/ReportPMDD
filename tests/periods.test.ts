import { describe, expect, it } from 'vitest';
import {
  activePeriod,
  hasDataBesidesFlow,
  planEndPeriod,
  planExtendPeriod,
  planFlowChange,
  startsNewPeriod,
  type FlowChange,
} from '../src/lib/periods';
import { analyzeCycles } from '../src/lib/cycles';
import { sanitizeEntry } from '../src/lib/backup';
import { hasAnyAnswer } from '../src/lib/analysis';
import type { DayEntry, Flow } from '../src/lib/types';

const T = '2026-01-01T00:00:00.000Z';
const entry = (date: string, patch: Partial<DayEntry> = {}): DayEntry => ({ date, ratings: {}, events: {}, createdAt: T, updatedAt: T, ...patch });

/** Stosuje zmiany do mapy wpisów (tak jak robi to aplikacja). */
function apply(map: Map<string, DayEntry>, changes: FlowChange[]): Map<string, DayEntry> {
  const out = new Map(map);
  for (const c of changes) {
    const cur = out.get(c.date) ?? entry(c.date);
    const next: DayEntry = { ...cur, flow: c.flow };
    if (c.flow === undefined) delete next.flow;
    if (c.periodAuto) next.periodAuto = true;
    else delete next.periodAuto;
    out.set(c.date, next);
  }
  return out;
}
const flows = (m: Map<string, DayEntry>) =>
  [...m.values()]
    .filter((e) => e.flow)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => `${e.date.slice(5)}:${e.flow}${e.periodAuto ? '*' : ''}`);

describe('automatyczne zaznaczanie okresu', () => {
  it('pierwszy dzień okresu zaznacza standardową liczbę dni', () => {
    const m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'medium', 5));
    expect(flows(m)).toEqual(['03-10:medium', '03-11:period*', '03-12:period*', '03-13:period*', '03-14:period*']);
  });

  it('nie nadpisuje dni z już opisanym krwawieniem', () => {
    const start = new Map([['2026-03-12', entry('2026-03-12', { flow: 'none' as Flow })]]);
    const m = apply(start, planFlowChange(start, '2026-03-10', 'period', 5));
    expect(flows(m)).toEqual(['03-10:period', '03-11:period*', '03-12:none']);
  });

  it('dzień w trakcie okresu nie dopisuje kolejnych dni', () => {
    let m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'period', 3));
    expect(startsNewPeriod(m, '2026-03-13')).toBe(false);
    m = apply(m, planFlowChange(m, '2026-03-13', 'light', 3)); // przedłużenie o dzień
    expect(flows(m)).toEqual(['03-10:period', '03-11:period*', '03-12:period*', '03-13:light']);
  });

  it('"Brak" w trakcie okresu kończy go i usuwa dalsze dni automatyczne', () => {
    let m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'medium', 5));
    m = apply(m, planFlowChange(m, '2026-03-12', 'none', 5));
    expect(flows(m)).toEqual(['03-10:medium', '03-11:period*', '03-12:none']);
  });

  it('odznaczenie pierwszego dnia cofa cały automatyczny okres', () => {
    let m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'period', 5));
    m = apply(m, planFlowChange(m, '2026-03-10', undefined, 5));
    expect(flows(m)).toEqual([]);
  });

  it('potwierdzenie ilości krwawienia zdejmuje znacznik "auto"', () => {
    let m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'period', 4));
    m = apply(m, planFlowChange(m, '2026-03-11', 'heavy', 4));
    expect(flows(m)).toEqual(['03-10:period', '03-11:heavy', '03-12:period*', '03-13:period*']);
  });

  it('skrócenie i przedłużenie okresu', () => {
    let m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'period', 5));
    const p = activePeriod(m.values(), '2026-03-11')!;
    expect(p).toMatchObject({ start: '2026-03-10', end: '2026-03-14', length: 5, day: 2, autoDays: 4 });
    m = apply(m, planEndPeriod(m, p, '2026-03-12'));
    expect(flows(m)).toEqual(['03-10:period', '03-11:period*', '03-12:period*']);
    const p2 = activePeriod(m.values(), '2026-03-13')!; // skończył się wczoraj: można jeszcze przedłużyć
    expect(p2).toMatchObject({ end: '2026-03-12', length: 3, day: 4 });
    m = apply(m, planExtendPeriod(p2));
    expect(flows(m).at(-1)).toBe('03-13:period*');
    expect(activePeriod(m.values(), '2026-03-20')).toBeNull();
  });

  it('dni zaznaczone automatycznie liczą się do cyklu, ale nie jako wpis', () => {
    const m = apply(new Map(), planFlowChange(new Map(), '2026-03-10', 'period', 5));
    const info = analyzeCycles(m.values(), '2026-03-30');
    expect(info.periods[0]).toEqual({ start: '2026-03-10', end: '2026-03-14', length: 5 });
    expect(hasAnyAnswer(m.get('2026-03-12'))).toBe(false);
    expect(hasAnyAnswer(m.get('2026-03-10'))).toBe(true);
    expect(hasDataBesidesFlow(m.get('2026-03-12'))).toBe(false);
  });

  it('kopia zapasowa zachowuje dni okresu i znacznik auto', () => {
    const e = sanitizeEntry({ date: '2026-03-11', ratings: {}, events: {}, flow: 'period', periodAuto: true });
    expect(e).toMatchObject({ flow: 'period', periodAuto: true });
    const wrong = sanitizeEntry({ date: '2026-03-11', ratings: {}, events: {}, flow: 'medium', periodAuto: true });
    expect(wrong?.periodAuto).toBeUndefined();
  });
});
