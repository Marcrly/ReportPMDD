import { describe, expect, it } from 'vitest';
import { addDays, dayIndex, diffDays, excelSerial, fromDayIndex, isISODate, logicalToday, plural, weekdayMondayFirst } from '../src/lib/dates';
import { analyzeCycles, isOvulationDay, isPredictedPeriodDay, positionOf } from '../src/lib/cycles';
import { aggregateItems, compareOnset, compareOnsets, dayLevel, pmddScore, windowsFor } from '../src/lib/analysis';
import { DRSP, DRSP_CORE_IDS, PMS, allSymptoms } from '../src/lib/questionnaire';
import type { DayEntry, Flow, Rating } from '../src/lib/types';

const NOW = '2026-01-01T20:00:00.000Z';
function entry(date: string, patch: Partial<DayEntry> = {}): DayEntry {
  return { date, ratings: {}, events: {}, createdAt: NOW, updatedAt: NOW, ...patch };
}
function allRated(date: string, value: Rating, flow?: Flow): DayEntry {
  const ratings: Record<string, Rating> = {};
  for (const s of DRSP) ratings[s.id] = value;
  return entry(date, { ratings, flow });
}

describe('daty', () => {
  it('liczy dni bez problemów ze zmianą czasu', () => {
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2); // zmiana czasu w nocy 28/29 marca
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(fromDayIndex(dayIndex('2024-02-29'))).toBe('2024-02-29');
  });
  it('waliduje daty', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-11-05')).toBe(true);
    expect(isISODate('5.11.2026')).toBe(false);
  });
  it('do 4:00 rano liczy poprzedni dzień', () => {
    expect(logicalToday(new Date(2026, 10, 6, 1, 30))).toBe('2026-11-05');
    expect(logicalToday(new Date(2026, 10, 6, 4, 0))).toBe('2026-11-06');
  });
  it('numer seryjny Excela', () => {
    expect(excelSerial('1900-03-01')).toBe(61);
    expect(excelSerial('2026-11-05')).toBe(46331);
  });
  it('poniedziałek jako pierwszy dzień tygodnia', () => {
    expect(weekdayMondayFirst('2026-11-02')).toBe(0); // poniedziałek
    expect(weekdayMondayFirst('2026-11-08')).toBe(6); // niedziela
  });
  it('odmienia liczebniki', () => {
    expect(plural(1, ['wpis', 'wpisy', 'wpisów'])).toBe('wpis');
    expect(plural(3, ['wpis', 'wpisy', 'wpisów'])).toBe('wpisy');
    expect(plural(12, ['wpis', 'wpisy', 'wpisów'])).toBe('wpisów');
    expect(plural(22, ['wpis', 'wpisy', 'wpisów'])).toBe('wpisy');
  });
});

describe('kwestionariusz', () => {
  it('ma 24 pozycje DRSP i 21 objawów do średniej', () => {
    expect(DRSP).toHaveLength(24);
    expect(DRSP_CORE_IDS).toHaveLength(21);
    expect(DRSP.map((s) => s.drsp)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
  it('identyfikatory są unikalne', () => {
    const ids = allSymptoms([{ id: 'c_x', label: 'Migrena', section: 'pms', createdAt: NOW }]).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(DRSP.length + PMS.length + 1);
  });
});

describe('cykle', () => {
  const entries = [
    entry('2026-01-01', { flow: 'medium' }),
    entry('2026-01-02', { flow: 'heavy' }),
    // 3 stycznia brak wpisu: luka nie dzieli okresu
    entry('2026-01-04', { flow: 'light' }),
    entry('2026-01-05', { flow: 'spotting' }),
    entry('2026-01-14', { flow: 'spotting' }), // plamienie w środku cyklu nie jest okresem
    entry('2026-01-29', { flow: 'medium' }),
    entry('2026-01-30', { flow: 'medium' }),
    entry('2026-02-27', { flow: 'light' }),
  ];
  const manual = { mode: 'manual' as const, cycleLength: 30, periodLength: 4 };
  const auto = { ...manual, mode: 'auto' as const };
  const info = analyzeCycles(entries, '2026-03-05', manual);

  it('wykrywa początki okresów', () => {
    expect(info.starts).toEqual(['2026-01-01', '2026-01-29', '2026-02-27']);
    expect(info.periods[0]).toEqual({ start: '2026-01-01', end: '2026-01-04', length: 4 });
  });
  it('liczy statystyki z ostatnich cykli (podpowiedź)', () => {
    expect(info.cycles.map((c) => c.length)).toEqual([28, 29, null]);
    expect(info.stats.avgCycle).toBe(28.5);
    expect(info.stats.cycleLengths).toEqual([28, 29]);
    // okres z 1 zaznaczonym dniem (27.02) nie liczy się do średniej długości okresu
    expect(info.stats.periodLengths).toEqual([4, 2]);
    expect(info.stats.avgPeriod).toBe(3);
  });
  it('tryb ręczny: prognoza z wpisanych wartości', () => {
    expect(info.prediction?.source).toBe('manual');
    expect(info.prediction?.periods[0]).toEqual({ start: '2026-03-29', end: '2026-04-01' }); // 27.02 + 30 dni, okres 4 dni
    expect(info.prediction?.periods).toHaveLength(3);
  });
  it('tryb automatyczny: prognoza ze średniej z danych', () => {
    const a = analyzeCycles(entries, '2026-03-05', auto);
    expect(a.prediction?.source).toBe('data');
    expect(a.prediction?.periods[0].start).toBe('2026-03-28'); // 27.02 + round(28.5) = 29 dni
    const noData = analyzeCycles([entry('2026-02-27', { flow: 'light' })], '2026-03-05', auto);
    expect(noData.prediction?.source).toBe('manual');
  });
  it('szacuje owulację 14 dni przed okresem', () => {
    expect(info.cycles[0].ovulation).toBe('2026-01-15'); // 29.01 - 14
    expect(info.prediction?.currentOvulation).toBe('2026-03-15'); // 29.03 - 14
    expect(isOvulationDay('2026-03-15', info)).toBe(true);
    expect(isOvulationDay('2026-04-14', info)).toBe(true); // kolejny cykl: 28.04 - 14
  });
  it('okres spóźniony: brak prognozowanych dni, licznik spóźnienia', () => {
    const late = analyzeCycles(entries, '2026-04-02', manual);
    expect(late.prediction?.lateBy).toBe(4); // prognoza na 29.03, dziś 2.04
    const dueToday = analyzeCycles(entries, '2026-03-29', manual);
    expect(dueToday.prediction?.lateBy).toBe(0);
    expect(dueToday.prediction?.periods[0].start).toBe('2026-03-29');
    expect(late.prediction?.periods).toHaveLength(0);
    expect(late.prediction?.currentOvulation).toBeNull();
  });
  it('pozycja dnia w cyklu', () => {
    expect(positionOf('2026-01-10', info)).toEqual({ cycleDay: 10, daysToNext: -19, cycleNumber: 1 });
    expect(positionOf('2025-12-30', info).cycleDay).toBeNull();
    expect(positionOf('2026-03-01', info).daysToNext).toBeNull();
  });
  it('prognozowane dni okresu tylko w przyszłości', () => {
    expect(isPredictedPeriodDay('2026-03-29', info, '2026-03-05')).toBe(true);
    expect(isPredictedPeriodDay('2026-03-04', info, '2026-03-05')).toBe(false);
  });
});

describe('analiza przed/po okresie', () => {
  // Syntetyczny cykl: okres 1 lutego. Przed okresem objawy 5, po okresie 1.
  const byDate = new Map<string, DayEntry>();
  for (let i = -7; i <= -1; i++) byDate.set(addDays('2026-02-01', i), allRated(addDays('2026-02-01', i), 5));
  for (let i = 0; i < 3; i++) byDate.set(addDays('2026-02-01', i), allRated(addDays('2026-02-01', i), 2, 'medium'));
  for (let i = 3; i <= 9; i++) byDate.set(addDays('2026-02-01', i), allRated(addDays('2026-02-01', i), 1));
  const symptoms = DRSP;

  it('okna: dni -7..-1 i 4..10', () => {
    expect(windowsFor('2026-02-01')).toEqual({ pre: ['2026-01-25', '2026-01-31'], post: ['2026-02-04', '2026-02-10'] });
  });

  it('nie ocenia, zanim minie tydzień po okresie', () => {
    expect(compareOnset('2026-02-01', byDate, symptoms, { excludeEvents: false }, '2026-02-09')).toBeNull();
  });

  it('wykrywa wyraźny wzrost przed okresem', () => {
    const c = compareOnset('2026-02-01', byDate, symptoms, { excludeEvents: false }, '2026-02-20')!;
    expect(c.items.drsp1.meets).toBe(true);
    expect(c.items.drsp1.pct).toBeCloseTo(80);
    expect(c.domainsMet).toHaveLength(11);
    expect(c.coreDomainsMet).toHaveLength(4);
    expect(c.impairmentMet).toBe(true);
  });

  it('wymaga co najmniej 4 dni danych w każdym tygodniu', () => {
    const sparse = new Map(byDate);
    for (let i = 3; i <= 6; i++) sparse.delete(addDays('2026-02-01', i)); // zostają 3 dni po okresie
    const c = compareOnset('2026-02-01', sparse, symptoms, { excludeEvents: false }, '2026-02-20')!;
    expect(c.items.drsp1.enough).toBe(false);
    expect(c.items.drsp1.meets).toBe(false);
  });

  it('nie zalicza, gdy po okresie objaw nadal jest silny', () => {
    const notClear = new Map(byDate);
    const d = addDays('2026-02-01', 5);
    notClear.set(d, { ...allRated(d, 1), ratings: { ...allRated(d, 1).ratings, drsp7: 4 } });
    const c = compareOnset('2026-02-01', notClear, symptoms, { excludeEvents: false }, '2026-02-20')!;
    expect(c.items.drsp7.elevated).toBe(true);
    expect(c.items.drsp7.clears).toBe(false);
    expect(c.items.drsp7.meets).toBe(false);
  });

  it('opcjonalnie pomija oceny ze zdarzeniem powiązanym', () => {
    const withEvents = new Map(byDate);
    for (let i = -7; i <= -1; i++) {
      const d = addDays('2026-02-01', i);
      const e = withEvents.get(d)!;
      withEvents.set(d, { ...e, events: { drsp8: 'Kłótnia w pracy' } });
    }
    const keep = compareOnset('2026-02-01', withEvents, symptoms, { excludeEvents: false }, '2026-02-20')!;
    const skip = compareOnset('2026-02-01', withEvents, symptoms, { excludeEvents: true }, '2026-02-20')!;
    expect(keep.items.drsp8.meets).toBe(true);
    expect(skip.items.drsp8.preN).toBe(0);
    expect(skip.items.drsp8.meets).toBe(false);
  });

  it('agreguje wiele cykli', () => {
    const info = analyzeCycles(byDate.values(), '2026-02-20');
    const comps = compareOnsets(info, byDate, symptoms, { excludeEvents: false }, '2026-02-20');
    const agg = aggregateItems(comps, symptoms);
    const a1 = agg.find((a) => a.id === 'drsp1')!;
    expect(comps).toHaveLength(1);
    expect(a1).toMatchObject({ n: 1, met: 1, preMean: 5, postMean: 1, diff: 4 });
  });

  it('poziom dnia w kalendarzu', () => {
    expect(dayLevel(allRated('2026-02-01', 4))).toBe(4);
    expect(dayLevel(entry('2026-02-01'))).toBeNull();
    expect(pmddScore(entry('2026-02-01', { ratings: { drsp1: 6, drsp2: 1 } }), { excludeEvents: false })).toBe(3.5);
  });
});
