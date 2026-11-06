/** Ocena objawu: 1-5 to skala, 6 to "ponad skalę" (odpowiada 6 = "extreme" w DRSP). */
export type Rating = 1 | 2 | 3 | 4 | 5 | 6;

/** 'period' = dzień okresu bez podanej ilości krwawienia (np. zaznaczony w kalendarzu albo automatycznie). */
export type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy' | 'period';
export type Intensity = 'light' | 'moderate' | 'vigorous';
export type SleepQuality = 1 | 2 | 3 | 4 | 5;
export type SectionId = 'pmdd' | 'pms';

/** Data kalendarzowa w formacie RRRR-MM-DD (czas lokalny). */
export type ISODate = string;

export interface DayEntry {
  date: ISODate;
  sleepQuality?: SleepQuality;
  sleepHours?: number;
  /** undefined = brak odpowiedzi, true/false = była / nie było aktywności */
  activity?: boolean;
  activityMinutes?: number;
  activityIntensity?: Intensity;
  flow?: Flow;
  /** true = dzień okresu zaznaczony automatycznie według standardowej długości okresu */
  periodAuto?: boolean;
  /** id objawu -> ocena */
  ratings: Record<string, Rating>;
  /** id objawu -> opis zdarzenia. Obecność klucza = zaznaczone "zdarzenie powiązane". */
  events: Record<string, string>;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Symptom {
  id: string;
  section: SectionId;
  group: string;
  /** Pełne pytanie wyświetlane w formularzu. */
  label: string;
  /** Krótka nazwa do wykresów i eksportu. */
  short: string;
  /** Numer pozycji w kwestionariuszu DRSP (1-24). */
  drsp?: number;
  /** Obszar objawów DSM-5 (tylko DRSP 1-21). */
  domain?: DomainId;
  /** DRSP 22-24: wpływ objawów na funkcjonowanie. */
  impairment?: boolean;
  custom?: boolean;
}

export type DomainId =
  'depressed' | 'anxiety' | 'lability' | 'anger' | 'interest' | 'concentration' | 'fatigue' | 'appetite' | 'sleep' | 'overwhelmed' | 'physical';

export interface CustomSymptom {
  id: string;
  label: string;
  section: SectionId;
  archived?: boolean;
  createdAt: string;
}

export type CycleMode = 'manual' | 'auto';

export interface CycleSettings {
  /** manual = wpisane wartości, auto = średnia z ostatnich 4 cykli (gdy są dane) */
  mode: CycleMode;
  cycleLength: number;
  periodLength: number;
}

export interface AppMeta {
  lastBackupAt?: string;
  onboardingDone?: boolean;
  installHintDismissed?: boolean;
  customSymptoms: CustomSymptom[];
  cycleSettings?: CycleSettings;
}
