import { isISODate } from './dates';
import { sanitizeCycleSettings } from './cycles';
import type { CustomSymptom, CycleSettings, DayEntry, Flow, Intensity, Rating, SectionId, SleepQuality } from './types';

export const BACKUP_FORMAT = 1;
export const APP_ID = 'ReportPMDD';

export interface BackupFile {
  app: typeof APP_ID;
  format: number;
  exportedAt: string;
  entries: DayEntry[];
  customSymptoms: CustomSymptom[];
  cycleSettings?: CycleSettings;
}

export function createBackup(entries: DayEntry[], customSymptoms: CustomSymptom[], cycleSettings?: CycleSettings, now = new Date()): string {
  const data: BackupFile = {
    app: APP_ID,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    entries: [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)),
    customSymptoms,
    cycleSettings,
  };
  return JSON.stringify(data, null, 1);
}

export class BackupError extends Error {}

const FLOWS: Flow[] = ['none', 'spotting', 'light', 'medium', 'heavy'];
const INTENSITIES: Intensity[] = ['light', 'moderate', 'vigorous'];
const SECTIONS: SectionId[] = ['pmdd', 'pms'];
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_TEXT = 5000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : undefined);
const isoTime = (v: unknown, fallback: string) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback);

/** Sprawdza i czyści pojedynczy wpis. Zwraca null, jeśli wpis jest bezużyteczny. */
export function sanitizeEntry(raw: unknown, fallbackTime = new Date(0).toISOString()): DayEntry | null {
  if (!isObj(raw) || !isISODate(raw.date)) return null;
  const ratings: Record<string, Rating> = {};
  if (isObj(raw.ratings)) {
    for (const [k, v] of Object.entries(raw.ratings)) {
      if (ID_RE.test(k) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 6) ratings[k] = v as Rating;
    }
  }
  const events: Record<string, string> = {};
  if (isObj(raw.events)) {
    for (const [k, v] of Object.entries(raw.events)) {
      if (ID_RE.test(k) && typeof v === 'string') events[k] = v.slice(0, MAX_TEXT);
    }
  }
  const e: DayEntry = {
    date: raw.date,
    ratings,
    events,
    createdAt: isoTime(raw.createdAt, fallbackTime),
    updatedAt: isoTime(raw.updatedAt, fallbackTime),
  };
  if (Number.isInteger(raw.sleepQuality) && (raw.sleepQuality as number) >= 1 && (raw.sleepQuality as number) <= 5) {
    e.sleepQuality = raw.sleepQuality as SleepQuality;
  }
  if (typeof raw.sleepHours === 'number' && raw.sleepHours >= 0 && raw.sleepHours <= 24) e.sleepHours = Math.round(raw.sleepHours * 2) / 2;
  if (typeof raw.activity === 'boolean') e.activity = raw.activity;
  if (typeof raw.activityMinutes === 'number' && raw.activityMinutes >= 0 && raw.activityMinutes <= 1440) {
    e.activityMinutes = Math.round(raw.activityMinutes);
  }
  if (INTENSITIES.includes(raw.activityIntensity as Intensity)) e.activityIntensity = raw.activityIntensity as Intensity;
  if (FLOWS.includes(raw.flow as Flow)) e.flow = raw.flow as Flow;
  const note = text(raw.note);
  if (note) e.note = note;
  return e;
}

export function sanitizeCustomSymptom(raw: unknown): CustomSymptom | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id) || !raw.id.startsWith('c_')) return null;
  const label = text(raw.label)?.trim().slice(0, 120);
  if (!label || !SECTIONS.includes(raw.section as SectionId)) return null;
  return {
    id: raw.id,
    label,
    section: raw.section as SectionId,
    archived: raw.archived === true ? true : undefined,
    createdAt: isoTime(raw.createdAt, new Date(0).toISOString()),
  };
}

export function parseBackup(json: string): {
  entries: DayEntry[];
  customSymptoms: CustomSymptom[];
  cycleSettings?: CycleSettings;
  exportedAt?: string;
} {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupError('To nie jest poprawny plik kopii zapasowej (nie da się go odczytać).');
  }
  if (!isObj(data) || data.app !== APP_ID || !Array.isArray(data.entries)) {
    throw new BackupError('Ten plik nie pochodzi z aplikacji ReportPMDD.');
  }
  if (typeof data.format === 'number' && data.format > BACKUP_FORMAT) {
    throw new BackupError('Kopia pochodzi z nowszej wersji aplikacji. Odśwież aplikację i spróbuj ponownie.');
  }
  const entries = data.entries.map((e) => sanitizeEntry(e)).filter((e): e is DayEntry => e !== null);
  const customSymptoms = Array.isArray(data.customSymptoms)
    ? data.customSymptoms.map(sanitizeCustomSymptom).filter((c): c is CustomSymptom => c !== null)
    : [];
  return {
    entries,
    customSymptoms,
    cycleSettings: sanitizeCycleSettings(data.cycleSettings),
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : undefined,
  };
}

export interface MergeResult {
  toWrite: DayEntry[];
  added: number;
  updated: number;
  unchanged: number;
}

/** Scala wpisy dzień po dniu: wygrywa wersja zmieniona później. Nic nie jest usuwane. */
export function mergeEntries(current: Map<string, DayEntry>, incoming: DayEntry[]): MergeResult {
  const toWrite: DayEntry[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const seen = new Map<string, DayEntry>();
  for (const e of incoming) {
    const prev = seen.get(e.date);
    if (!prev || e.updatedAt > prev.updatedAt) seen.set(e.date, e);
  }
  for (const e of seen.values()) {
    const cur = current.get(e.date);
    if (!cur) {
      toWrite.push(e);
      added++;
    } else if (e.updatedAt > cur.updatedAt) {
      toWrite.push(e);
      updated++;
    } else {
      unchanged++;
    }
  }
  return { toWrite, added, updated, unchanged };
}

export function mergeCustomSymptoms(current: CustomSymptom[], incoming: CustomSymptom[]): CustomSymptom[] {
  const ids = new Set(current.map((c) => c.id));
  return [...current, ...incoming.filter((c) => !ids.has(c.id))];
}
