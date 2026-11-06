import type { CustomSymptom, DomainId, Rating, SectionId, SleepQuality, Flow, Intensity, Symptom } from './types';

/**
 * Sekcja PMDD: pełny kwestionariusz DRSP (Daily Record of Severity of Problems,
 * Endicott, Nee, Harrison 2006). 21 objawów + 3 pytania o wpływ na funkcjonowanie.
 * Tłumaczenie robocze na polski, w pierwszej osobie, do wypełniania wieczorem.
 */
export const DRSP: Symptom[] = [
  // Nastrój i emocje
  {
    id: 'drsp1',
    drsp: 1,
    domain: 'depressed',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Czułam się przygnębiona, smutna, „na dnie”',
    short: 'Przygnębienie, smutek',
  },
  { id: 'drsp2', drsp: 2, domain: 'depressed', section: 'pmdd', group: 'Nastrój i emocje', label: 'Czułam beznadzieję', short: 'Beznadzieja' },
  {
    id: 'drsp3',
    drsp: 3,
    domain: 'depressed',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Czułam się bezwartościowa lub winna',
    short: 'Bezwartościowość, wina',
  },
  {
    id: 'drsp4',
    drsp: 4,
    domain: 'anxiety',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Czułam niepokój, napięcie, byłam „nakręcona” albo „na krawędzi”',
    short: 'Niepokój, napięcie',
  },
  {
    id: 'drsp5',
    drsp: 5,
    domain: 'lability',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Miałam wahania nastroju (np. nagły smutek lub płaczliwość)',
    short: 'Wahania nastroju',
  },
  {
    id: 'drsp6',
    drsp: 6,
    domain: 'lability',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Byłam bardziej wrażliwa na odrzucenie, łatwiej było mnie zranić',
    short: 'Czułość na odrzucenie',
  },
  {
    id: 'drsp7',
    drsp: 7,
    domain: 'anger',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Czułam złość lub rozdrażnienie',
    short: 'Złość, rozdrażnienie',
  },
  {
    id: 'drsp8',
    drsp: 8,
    domain: 'anger',
    section: 'pmdd',
    group: 'Nastrój i emocje',
    label: 'Miałam konflikty lub problemy z ludźmi',
    short: 'Konflikty z ludźmi',
  },
  // Zainteresowania, skupienie, energia
  {
    id: 'drsp9',
    drsp: 9,
    domain: 'interest',
    section: 'pmdd',
    group: 'Zainteresowania, skupienie, energia',
    label: 'Miałam mniej zainteresowania zwykłymi zajęciami (praca, nauka, znajomi, hobby)',
    short: 'Mniej zainteresowania',
  },
  {
    id: 'drsp10',
    drsp: 10,
    domain: 'concentration',
    section: 'pmdd',
    group: 'Zainteresowania, skupienie, energia',
    label: 'Miałam trudności z koncentracją',
    short: 'Kłopot z koncentracją',
  },
  {
    id: 'drsp11',
    drsp: 11,
    domain: 'fatigue',
    section: 'pmdd',
    group: 'Zainteresowania, skupienie, energia',
    label: 'Czułam ospałość, zmęczenie lub brak energii',
    short: 'Zmęczenie, brak sił',
  },
  // Apetyt i sen
  {
    id: 'drsp12',
    drsp: 12,
    domain: 'appetite',
    section: 'pmdd',
    group: 'Apetyt i sen',
    label: 'Miałam większy apetyt lub jadłam za dużo',
    short: 'Większy apetyt',
  },
  {
    id: 'drsp13',
    drsp: 13,
    domain: 'appetite',
    section: 'pmdd',
    group: 'Apetyt i sen',
    label: 'Miałam ochotę na konkretne jedzenie',
    short: 'Zachcianki',
  },
  {
    id: 'drsp14',
    drsp: 14,
    domain: 'sleep',
    section: 'pmdd',
    group: 'Apetyt i sen',
    label: 'Spałam więcej, ucinałam drzemki, trudno mi było wstać o zaplanowanej porze',
    short: 'Więcej snu, senność',
  },
  {
    id: 'drsp15',
    drsp: 15,
    domain: 'sleep',
    section: 'pmdd',
    group: 'Apetyt i sen',
    label: 'Miałam problem z zaśnięciem lub przespaniem nocy',
    short: 'Problem z zasypianiem',
  },
  // Poczucie kontroli
  {
    id: 'drsp16',
    drsp: 16,
    domain: 'overwhelmed',
    section: 'pmdd',
    group: 'Poczucie kontroli',
    label: 'Czułam się przytłoczona albo że nie daję rady',
    short: 'Przytłoczenie',
  },
  {
    id: 'drsp17',
    drsp: 17,
    domain: 'overwhelmed',
    section: 'pmdd',
    group: 'Poczucie kontroli',
    label: 'Czułam, że tracę kontrolę',
    short: 'Utrata kontroli',
  },
  // Ciało
  { id: 'drsp18', drsp: 18, domain: 'physical', section: 'pmdd', group: 'Ciało', label: 'Miałam tkliwe, bolesne piersi', short: 'Tkliwość piersi' },
  {
    id: 'drsp19',
    drsp: 19,
    domain: 'physical',
    section: 'pmdd',
    group: 'Ciało',
    label: 'Miałam obrzmiałe piersi, czułam się wzdęta lub przytyłam',
    short: 'Obrzęk piersi, wzdęcia',
  },
  { id: 'drsp20', drsp: 20, domain: 'physical', section: 'pmdd', group: 'Ciało', label: 'Bolała mnie głowa', short: 'Ból głowy' },
  {
    id: 'drsp21',
    drsp: 21,
    domain: 'physical',
    section: 'pmdd',
    group: 'Ciało',
    label: 'Bolały mnie stawy lub mięśnie',
    short: 'Ból stawów, mięśni',
  },
  // Wpływ na codzienność
  {
    id: 'drsp22',
    drsp: 22,
    impairment: true,
    section: 'pmdd',
    group: 'Wpływ na codzienność',
    label: 'Przez co najmniej jeden z tych objawów byłam mniej wydajna w pracy, nauce, domu lub codziennych obowiązkach',
    short: 'Mniejsza wydajność',
  },
  {
    id: 'drsp23',
    drsp: 23,
    impairment: true,
    section: 'pmdd',
    group: 'Wpływ na codzienność',
    label: 'Przez co najmniej jeden z tych objawów unikałam hobby lub spotkań towarzyskich albo robiłam to mniej',
    short: 'Mniej hobby, spotkań',
  },
  {
    id: 'drsp24',
    drsp: 24,
    impairment: true,
    section: 'pmdd',
    group: 'Wpływ na codzienność',
    label: 'Co najmniej jeden z tych objawów utrudniał moje relacje z innymi',
    short: 'Gorsze relacje',
  },
];

/**
 * Sekcja PMS: częste objawy zespołu napięcia przedmiesiączkowego i okresu,
 * których nie ma w DRSP (żeby nic się nie dublowało).
 */
export const PMS: Symptom[] = [
  { id: 'pms_cramps', section: 'pms', group: 'Ból i brzuch', label: 'Miałam skurcze lub ból podbrzusza', short: 'Skurcze, ból podbrzusza' },
  { id: 'pms_back', section: 'pms', group: 'Ból i brzuch', label: 'Bolały mnie plecy lub krzyż', short: 'Ból pleców, krzyża' },
  { id: 'pms_nausea', section: 'pms', group: 'Ból i brzuch', label: 'Miałam nudności', short: 'Nudności' },
  { id: 'pms_bowel', section: 'pms', group: 'Ból i brzuch', label: 'Miałam zaparcia lub biegunkę', short: 'Zaparcia, biegunka' },
  { id: 'pms_skin', section: 'pms', group: 'Skóra i samopoczucie', label: 'Miałam wypryski lub gorszy stan skóry', short: 'Wypryski, skóra' },
  { id: 'pms_swelling', section: 'pms', group: 'Skóra i samopoczucie', label: 'Miałam obrzęki dłoni, stóp lub twarzy', short: 'Obrzęki' },
  { id: 'pms_dizzy', section: 'pms', group: 'Skóra i samopoczucie', label: 'Miałam zawroty głowy lub czułam się osłabiona', short: 'Zawroty głowy' },
  { id: 'pms_clumsy', section: 'pms', group: 'Skóra i samopoczucie', label: 'Byłam bardziej niezdarna niż zwykle', short: 'Niezdarność' },
  {
    id: 'pms_sensory',
    section: 'pms',
    group: 'Skóra i samopoczucie',
    label: 'Hałas, światło lub zapachy drażniły mnie bardziej niż zwykle',
    short: 'Wrażliwość na bodźce',
  },
  { id: 'pms_libido', section: 'pms', group: 'Skóra i samopoczucie', label: 'Miałam mniejszą ochotę na seks', short: 'Obniżone libido' },
];

export const CUSTOM_GROUP = 'Moje objawy';

export function customToSymptom(c: CustomSymptom): Symptom {
  return { id: c.id, section: c.section, group: CUSTOM_GROUP, label: c.label, short: c.label, custom: true };
}

/** Wszystkie objawy w kolejności formularza: PMDD (DRSP + własne), potem PMS (+ własne). */
export function allSymptoms(custom: CustomSymptom[], includeArchived = false): Symptom[] {
  const active = custom.filter((c) => includeArchived || !c.archived);
  const pmddCustom = active.filter((c) => c.section === 'pmdd').map(customToSymptom);
  const pmsCustom = active.filter((c) => c.section === 'pms').map(customToSymptom);
  return [...DRSP, ...pmddCustom, ...PMS, ...pmsCustom];
}

export function sectionSymptoms(section: SectionId, custom: CustomSymptom[], includeArchived = false): Symptom[] {
  return allSymptoms(custom, includeArchived).filter((s) => s.section === section);
}

/** DRSP 1-21: pozycje liczone do średniej nasilenia PMDD. */
export const DRSP_CORE = DRSP.filter((s) => !s.impairment);
export const DRSP_CORE_IDS = DRSP_CORE.map((s) => s.id);
export const DRSP_IMPAIRMENT = DRSP.filter((s) => s.impairment);
export const PMS_IDS = PMS.map((s) => s.id);

/** Obszary objawów DSM-5 (kolejność jak w kryteriach). Pierwsze cztery to objawy nastroju (kryterium B). */
export const DOMAINS: { id: DomainId; label: string; core: boolean }[] = [
  { id: 'lability', label: 'Chwiejność emocjonalna', core: true },
  { id: 'anger', label: 'Złość, drażliwość', core: true },
  { id: 'depressed', label: 'Obniżony nastrój', core: true },
  { id: 'anxiety', label: 'Niepokój, napięcie', core: true },
  { id: 'interest', label: 'Mniej zainteresowania', core: false },
  { id: 'concentration', label: 'Koncentracja', core: false },
  { id: 'fatigue', label: 'Zmęczenie', core: false },
  { id: 'appetite', label: 'Apetyt', core: false },
  { id: 'sleep', label: 'Sen', core: false },
  { id: 'overwhelmed', label: 'Przytłoczenie, kontrola', core: false },
  { id: 'physical', label: 'Objawy fizyczne', core: false },
];

/** Skala zgodna z DRSP: 1-5 plus 6 = "ponad skalę". */
export const SCALE: { value: Rating; label: string; hint: string }[] = [
  { value: 1, label: 'Wcale', hint: 'nie czułam' },
  { value: 2, label: 'Minimalnie', hint: 'ledwo odczuwalne' },
  { value: 3, label: 'Łagodnie', hint: 'odczuwalne' },
  { value: 4, label: 'Umiarkowanie', hint: 'wyraźne' },
  { value: 5, label: 'Silnie', hint: 'mocno odczuwalne' },
  { value: 6, label: 'Ponad skalę', hint: 'nie do opisania' },
];

export const ratingLabel = (r: number) => SCALE.find((s) => s.value === r)?.label ?? '';

export const SLEEP_QUALITY: { value: SleepQuality; label: string }[] = [
  { value: 1, label: 'Bardzo źle' },
  { value: 2, label: 'Źle' },
  { value: 3, label: 'Średnio' },
  { value: 4, label: 'Dobrze' },
  { value: 5, label: 'Bardzo dobrze' },
];

export const FLOW: { value: Flow; label: string }[] = [
  { value: 'none', label: 'Brak' },
  { value: 'spotting', label: 'Plamienie' },
  { value: 'light', label: 'Lekkie' },
  { value: 'medium', label: 'Średnie' },
  { value: 'heavy', label: 'Obfite' },
];

export const INTENSITY: { value: Intensity; label: string; hint: string }[] = [
  { value: 'light', label: 'Lekka', hint: 'spacer, joga' },
  { value: 'moderate', label: 'Umiarkowana', hint: 'szybki marsz, rower' },
  { value: 'vigorous', label: 'Intensywna', hint: 'bieg, trening' },
];

/** Nazwa krwawienia do tabel i eksportu, np. "Średnie", "Okres", "Okres (auto)". */
export const flowLabel = (f?: Flow, auto?: boolean) =>
  f === 'period' ? (auto ? 'Okres (auto)' : 'Okres') : (FLOW.find((x) => x.value === f)?.label ?? '');

/** Opis krwawienia w zdaniu, np. "średnie krwawienie", "dzień okresu". */
export function flowText(f?: Flow): string {
  if (!f || f === 'none') return '';
  if (f === 'period') return 'dzień okresu';
  if (f === 'spotting') return 'plamienie';
  return `${flowLabel(f).toLowerCase()} krwawienie`;
}
export const sleepLabel = (q?: number) => SLEEP_QUALITY.find((x) => x.value === q)?.label ?? '';
export const intensityLabel = (i?: Intensity) => INTENSITY.find((x) => x.value === i)?.label ?? '';

/** Krwawienie liczone jako miesiączka (plamienie nie rozpoczyna okresu, zgodnie z konwencją DRSP/C-PASS). */
export const isBleeding = (f?: Flow) => f === 'light' || f === 'medium' || f === 'heavy' || f === 'period';
