import { compareOnset, meanScore, pmddScore } from './analysis';
import { analyzeCycles, isOvulationDay, positionOf, type CycleInfo } from './cycles';
import { excelSerial, formatNumeric, toISO } from './dates';
import { DOMAINS, DRSP_CORE_IDS, SCALE, allSymptoms, flowLabel, intensityLabel, sleepLabel } from './questionnaire';
import type { CustomSymptom, CycleSettings, DayEntry, ISODate, Symptom } from './types';
import { buildXlsx, type Cell, type Sheet, type StyleKey } from './xlsx';
import { isBleeding } from './questionnaire';

const sev = (r: number | undefined): StyleKey | undefined => (r ? (`sev${r}` as StyleKey) : undefined);
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

function symptomHeader(s: Symptom): string {
  if (s.drsp) return `${s.drsp}. ${s.short}`;
  return s.custom ? `${s.short} (własny)` : s.short;
}

/** Objawy do eksportu: wszystkie wbudowane + własne, także zarchiwizowane, jeśli mają dane. */
function exportSymptoms(entries: DayEntry[], custom: CustomSymptom[]): Symptom[] {
  const used = new Set<string>();
  for (const e of entries) for (const k of Object.keys(e.ratings)) used.add(k);
  return allSymptoms(custom, true).filter((s) => !s.custom || !custom.find((c) => c.id === s.id)?.archived || used.has(s.id));
}

export function phaseLabel(date: ISODate, entry: DayEntry | undefined, info: CycleInfo): string {
  const pos = positionOf(date, info);
  if (isBleeding(entry?.flow)) return 'okres';
  if (isOvulationDay(date, info)) return 'szacowana owulacja';
  if (pos.daysToNext !== null && pos.daysToNext >= -7) return 'tydzień przed okresem';
  if (pos.cycleDay !== null && pos.cycleDay >= 4 && pos.cycleDay <= 10) return 'tydzień po okresie';
  return '';
}

export function buildWorkbook(
  entriesIn: DayEntry[],
  custom: CustomSymptom[],
  today: ISODate,
  settings?: CycleSettings,
  now = new Date(),
): Uint8Array {
  // Dni zaznaczone z wyprzedzeniem (przyszłe dni okresu) nie trafiają do arkusza.
  const cutoff = toISO(now);
  const entries = entriesIn.filter((e) => e.date <= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const info = analyzeCycles(entries, today, settings);
  const symptoms = exportSymptoms(entries, custom);
  const pmsIds = symptoms.filter((s) => s.section === 'pms').map((s) => s.id);
  const byId = new Map(symptoms.map((s) => [s.id, s]));
  const opts = { excludeEvents: false };

  // ---------------- Arkusz 1: Dziennik ----------------
  const baseHeaders = [
    'Data',
    'Dzień cyklu',
    'Dni do okresu',
    'Faza cyklu',
    'Krwawienie',
    'Jakość snu (1-5)',
    'Jakość snu (opis)',
    'Sen (godz.)',
    'Aktywność fizyczna',
    'Aktywność (min)',
    'Intensywność',
  ];
  const tailHeaders = ['Średnia PMDD (DRSP 1-21)', 'Średnia PMS', 'Oceny ponad skalę', 'Zdarzenia powiązane', 'Notatka dnia'];
  const header: Cell[] = [
    ...baseHeaders.map((h) => ({ v: h, s: 'header' as StyleKey })),
    ...symptoms.map((s) => ({ v: symptomHeader(s), s: (s.section === 'pmdd' ? 'headerPmdd' : 'headerPms') as StyleKey })),
    ...tailHeaders.map((h) => ({ v: h, s: 'header' as StyleKey })),
  ];
  const journalRows: Cell[][] = [header];
  for (const e of entries) {
    const pos = positionOf(e.date, info);
    const ratings = symptoms.map((s) => {
      const r = e.ratings[s.id];
      return { v: r ?? null, s: sev(r) } as Cell;
    });
    const offScale = Object.values(e.ratings).filter((r) => r === 6).length;
    const evCount = Object.keys(e.events).length;
    journalRows.push([
      { v: excelSerial(e.date), s: 'date' },
      { v: pos.cycleDay, s: 'center' },
      { v: pos.daysToNext, s: 'center' },
      { v: phaseLabel(e.date, e, info) },
      { v: e.flow ? flowLabel(e.flow, e.periodAuto) : null },
      { v: e.sleepQuality ?? null, s: 'center' },
      { v: e.sleepQuality ? sleepLabel(e.sleepQuality) : null },
      { v: e.sleepHours ?? null, s: 'decimal' },
      { v: e.activity === undefined ? null : e.activity ? 'tak' : 'nie' },
      { v: e.activity ? (e.activityMinutes ?? null) : null, s: 'center' },
      { v: e.activity && e.activityIntensity ? intensityLabel(e.activityIntensity) : null },
      ...ratings,
      { v: r1(pmddScore(e, opts)), s: 'decimal' },
      { v: r1(meanScore(e, pmsIds, opts)), s: 'decimal' },
      { v: offScale || null, s: 'center' },
      { v: evCount || null, s: 'center' },
      { v: e.note?.trim() || null, s: 'wrap' },
    ]);
  }
  const journal: Sheet = {
    name: 'Dziennik',
    rows: journalRows,
    widths: [11, 7, 7, 14, 11, 8, 12, 7, 10, 9, 12, ...symptoms.map(() => 9), 10, 9, 9, 10, 50],
    freeze: { rows: 1, cols: 1 },
    autoFilter: true,
    headerHeight: 78,
  };

  // ---------------- Arkusz 2: Zdarzenia powiązane ----------------
  const eventsRows: Cell[][] = [
    ['Data', 'Dzień cyklu', 'Sekcja', 'Objaw', 'Ocena', 'Opis zdarzenia'].map((h) => ({ v: h, s: 'header' as StyleKey })),
  ];
  for (const e of entries) {
    for (const [id, note] of Object.entries(e.events)) {
      const s = byId.get(id);
      const r = e.ratings[id];
      eventsRows.push([
        { v: excelSerial(e.date), s: 'date' },
        { v: positionOf(e.date, info).cycleDay, s: 'center' },
        { v: s?.section === 'pms' ? 'PMS' : 'PMDD' },
        { v: s ? s.label : id, s: 'wrap' },
        { v: r ?? null, s: sev(r) },
        { v: note.trim() || '(bez opisu)', s: 'wrap' },
      ]);
    }
  }
  const eventsSheet: Sheet = {
    name: 'Zdarzenia powiązane',
    rows: eventsRows,
    widths: [11, 7, 8, 44, 7, 60],
    freeze: { rows: 1, cols: 0 },
    autoFilter: true,
    headerHeight: 32,
  };

  // ---------------- Arkusz 3: Cykle ----------------
  const cycleRows: Cell[][] = [
    [
      'Nr okresu',
      'Pierwszy dzień okresu',
      'Długość okresu (dni)',
      'Długość cyklu od tego okresu (dni)',
      'Szacowana owulacja w tym cyklu',
      'Średnia PMDD: 7 dni przed tym okresem',
      'Średnia PMDD: dni 4 do 10 od początku okresu',
      'Różnica (przed minus po)',
      'Obszary objawów wyraźnie nasilone przed okresem (z 11)',
      'W tym obszary nastroju (z 4)',
      'Wpływ na codzienność nasilony przed okresem',
      'Nasilone obszary',
    ].map((h) => ({ v: h, s: 'header' as StyleKey })),
  ];
  info.cycles.forEach((c, i) => {
    const comp = compareOnset(c.start, byDate, symptoms, opts, today);
    const evaluated = comp !== null && comp.domainsEvaluated > 0;
    const preMean = comp ? meanOfDates(comp.pre, byDate) : null;
    const postMean = comp ? meanOfDates(comp.post, byDate) : null;
    const period = info.periods[i];
    const status = comp === null ? 'tydzień po okresie jeszcze trwa' : 'za mało danych';
    cycleRows.push([
      { v: c.number, s: 'center' },
      { v: excelSerial(c.start), s: 'date' },
      { v: period?.length ?? null, s: 'center' },
      { v: c.length ?? 'trwa', s: 'center' },
      c.ovulation
        ? { v: excelSerial(c.ovulation), s: 'date' }
        : { v: !c.complete && info.prediction?.currentOvulation ? `prognoza: ${formatNumeric(info.prediction.currentOvulation)}` : null },
      { v: r1(preMean), s: 'decimal' },
      { v: r1(postMean), s: 'decimal' },
      { v: preMean !== null && postMean !== null ? r1(preMean - postMean) : null, s: 'decimal' },
      { v: evaluated ? comp.domainsMet.length : status, s: 'center' },
      { v: evaluated ? comp.coreDomainsMet.length : null, s: 'center' },
      { v: evaluated ? (comp.impairmentEvaluated ? (comp.impairmentMet ? 'tak' : 'nie') : 'za mało danych') : null },
      { v: evaluated ? comp.domainsMet.map((d) => DOMAINS.find((x) => x.id === d)?.label).join('; ') || 'brak' : null, s: 'wrap' },
    ]);
  });
  const cyclesSheet: Sheet = {
    name: 'Cykle',
    rows: cycleRows,
    widths: [6, 12, 10, 10, 14, 16, 16, 9, 18, 12, 16, 50],
    freeze: { rows: 1, cols: 0 },
    headerHeight: 62,
  };

  // ---------------- Arkusz 4: Legenda ----------------
  const legend: Cell[][] = [
    [{ v: 'ReportPMDD: legenda i źródła', s: 'title' }],
    [{ v: `Wygenerowano: ${formatNumeric(today)}. Dni z wpisem: ${entries.length}.`, s: 'muted' }],
    [],
    [{ v: 'Skala ocen (zgodna z kwestionariuszem DRSP)', s: 'bold' }],
    ...SCALE.map((s) => [{ v: s.value, s: sev(s.value) }, { v: s.label }, { v: s.hint, s: 'muted' }] as Cell[]),
    [],
    [{ v: 'Jak czytać', s: 'bold' }],
    [{ v: 'Dzień 1 cyklu to pierwszy dzień krwawienia (lekkiego, średniego lub obfitego; plamienie się nie liczy).', s: 'wrap' }],
    [
      {
        v: '"Okres" w kolumnie Krwawienie to dzień okresu bez podanej ilości krwawienia. "Okres (auto)" to dzień zaznaczony automatycznie według standardowej długości okresu.',
        s: 'wrap',
      },
    ],
    [
      {
        v: 'Owulacja jest szacowana kalendarzowo: 14 dni przed kolejnym okresem. To przybliżenie, które nie nadaje się do planowania antykoncepcji.',
        s: 'wrap',
      },
    ],
    [
      {
        v: '"Dni do okresu" = -1 oznacza dzień przed kolejnym okresem. Tydzień przed okresem to dni -7 do -1, tydzień po okresie to dni 4 do 10 cyklu.',
        s: 'wrap',
      },
    ],
    [{ v: 'Średnia PMDD to średnia z pozycji 1-21 kwestionariusza DRSP (bez pytań 22-24 o wpływ na codzienność).', s: 'wrap' }],
    [
      {
        v: 'Obszar objawów uznany za wyraźnie nasilony przed okresem, gdy: średnia z tygodnia przed jest wyższa o co najmniej 30% zakresu skali niż w tygodniu po, co najmniej 2 dni przed okresem mają ocenę 4 lub wyższą, a w tygodniu po żaden dzień nie przekracza 3. Wymagane minimum 4 dni wpisów w każdym tygodniu. To uproszczenie inspirowane metodą C-PASS, a nie diagnoza.',
        s: 'wrap',
      },
    ],
    [{ v: '"Zdarzenie powiązane" oznacza, że objaw mógł mieć przyczynę w wydarzeniu z życia, a nie w cyklu.', s: 'wrap' }],
    [],
    [{ v: 'Źródła', s: 'bold' }],
    [
      {
        v: "Endicott J., Nee J., Harrison W. Daily Record of Severity of Problems (DRSP): reliability and validity. Archives of Women's Mental Health, 2006; 9(1): 41-49.",
        s: 'wrap',
      },
    ],
    [
      {
        v: 'Eisenlohr-Moul T.A. i in. Toward the Reliable Diagnosis of DSM-5 Premenstrual Dysphoric Disorder: The Carolina Premenstrual Assessment Scoring System (C-PASS). American Journal of Psychiatry, 2017; 174(1): 51-59.',
        s: 'wrap',
      },
    ],
    [{ v: 'Tłumaczenie pozycji DRSP na język polski jest robocze (przygotowane na potrzeby tej aplikacji).', s: 'muted' }],
    [],
    [{ v: 'Pytania w dzienniku', s: 'bold' }],
    [
      { v: 'Nr', s: 'header' },
      { v: 'Sekcja', s: 'header' },
      { v: 'Krótka nazwa', s: 'header' },
      { v: 'Pełne pytanie', s: 'header' },
    ],
    ...symptoms.map(
      (s) =>
        [
          { v: s.drsp ?? '', s: 'center' },
          { v: s.section === 'pmdd' ? (s.custom ? 'PMDD (własny)' : 'PMDD (DRSP)') : s.custom ? 'PMS (własny)' : 'PMS' },
          { v: s.short },
          { v: s.label, s: 'wrap' },
        ] as Cell[],
    ),
  ];
  const legendSheet: Sheet = { name: 'Legenda', rows: legend, widths: [12, 16, 26, 90] };

  return buildXlsx([journal, eventsSheet, cyclesSheet, legendSheet], { title: 'ReportPMDD: dziennik objawów', createdAt: now });
}

function meanOfDates(range: [ISODate, ISODate], byDate: Map<ISODate, DayEntry>): number | null {
  const vals: number[] = [];
  for (const e of byDate.values()) {
    if (e.date >= range[0] && e.date <= range[1]) {
      const s = meanScore(e, DRSP_CORE_IDS, { excludeEvents: false });
      if (s !== null) vals.push(s);
    }
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
