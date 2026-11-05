import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { sanitizeCustomSymptom, sanitizeEntry } from './backup';
import { sanitizeCycleSettings } from './cycles';
import type { AppMeta, DayEntry } from './types';

/**
 * Dane zapisywane są podwójnie, w dwóch niezależnych magazynach przeglądarki:
 *  1. IndexedDB (główny, duża pojemność),
 *  2. localStorage (kopia lustrzana, prosty i bardzo stabilny mechanizm).
 * Przy starcie oba źródła są scalane (wygrywa nowsza wersja wpisu) i wzajemnie
 * uzupełniane. Aplikacja nigdy sama nie usuwa danych.
 */

const DB_NAME = 'reportpmdd';
const DB_VERSION = 1;
const LS_ENTRY = 'rp1.entry.';
const LS_META = 'rp1.meta';

interface Schema extends DBSchema {
  entries: { key: string; value: DayEntry };
  meta: { key: string; value: StoredMeta };
}

interface StoredMeta extends AppMeta {
  updatedAt: string;
}

export interface StorageHealth {
  indexedDb: boolean;
  mirror: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  lastError: string | null;
}

export const DEFAULT_META: AppMeta = { customSymptoms: [] };

function lsAvailable(): boolean {
  try {
    const k = 'rp1.__test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export class Store {
  private db: IDBPDatabase<Schema> | null = null;
  health: StorageHealth = { indexedDb: false, mirror: false, persisted: null, usageBytes: null, quotaBytes: null, lastError: null };

  async init(): Promise<{ entries: DayEntry[]; meta: AppMeta }> {
    this.health.mirror = typeof localStorage !== 'undefined' && lsAvailable();
    try {
      this.db = await openDB<Schema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'date' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        },
        blocked: () => {
          this.health.lastError = 'Baza danych jest otwarta w innej karcie.';
        },
      });
      this.health.indexedDb = true;
    } catch (err) {
      this.db = null;
      this.health.indexedDb = false;
      this.health.lastError = `IndexedDB niedostępne: ${String(err)}`;
    }

    const fromDb = await this.readDbEntries();
    const fromMirror = this.readMirrorEntries();
    const merged = new Map<string, DayEntry>();
    for (const e of [...fromDb, ...fromMirror]) {
      const prev = merged.get(e.date);
      if (!prev || e.updatedAt > prev.updatedAt) merged.set(e.date, e);
    }

    // Samonaprawa: uzupełnij magazyn, któremu czegoś brakuje lub który ma starszą wersję.
    const dbMap = new Map(fromDb.map((e) => [e.date, e]));
    const mirrorMap = new Map(fromMirror.map((e) => [e.date, e]));
    const fixDb: DayEntry[] = [];
    for (const e of merged.values()) {
      if (dbMap.get(e.date)?.updatedAt !== e.updatedAt) fixDb.push(e);
      if (mirrorMap.get(e.date)?.updatedAt !== e.updatedAt) this.writeMirror(e);
    }
    if (fixDb.length && this.db) {
      try {
        const tx = this.db.transaction('entries', 'readwrite');
        await Promise.all([...fixDb.map((e) => tx.store.put(e)), tx.done]);
      } catch (err) {
        this.health.lastError = `Nie udało się uzupełnić IndexedDB: ${String(err)}`;
      }
    }

    const meta = await this.readMeta();
    await this.refreshHealth();
    return { entries: [...merged.values()], meta };
  }

  private async readDbEntries(): Promise<DayEntry[]> {
    if (!this.db) return [];
    try {
      const raw = await this.db.getAll('entries');
      return raw.map((r) => sanitizeEntry(r)).filter((e): e is DayEntry => e !== null);
    } catch (err) {
      this.health.lastError = `Odczyt IndexedDB nie powiódł się: ${String(err)}`;
      return [];
    }
  }

  private readMirrorEntries(): DayEntry[] {
    if (!this.health.mirror) return [];
    const out: DayEntry[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LS_ENTRY)) continue;
        try {
          const e = sanitizeEntry(JSON.parse(localStorage.getItem(k) ?? 'null'));
          if (e) out.push(e);
        } catch {
          /* uszkodzony pojedynczy wpis: pomijamy, IndexedDB ma swoją kopię */
        }
      }
    } catch (err) {
      this.health.lastError = `Odczyt kopii lustrzanej nie powiódł się: ${String(err)}`;
    }
    return out;
  }

  private writeMirror(e: DayEntry): void {
    if (!this.health.mirror) return;
    try {
      localStorage.setItem(LS_ENTRY + e.date, JSON.stringify(e));
    } catch (err) {
      this.health.lastError = `Kopia lustrzana: ${String(err)}`;
    }
  }

  private async readMeta(): Promise<AppMeta> {
    const candidates: StoredMeta[] = [];
    if (this.db) {
      try {
        const m = await this.db.get('meta', 'app');
        if (m) candidates.push(m);
      } catch {
        /* ignorujemy, sprawdzamy kopię */
      }
    }
    if (this.health.mirror) {
      try {
        const raw = localStorage.getItem(LS_META);
        if (raw) candidates.push(JSON.parse(raw) as StoredMeta);
      } catch {
        /* ignorujemy */
      }
    }
    const best = candidates.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))[0];
    if (!best) return { ...DEFAULT_META };
    return {
      lastBackupAt: typeof best.lastBackupAt === 'string' ? best.lastBackupAt : undefined,
      onboardingDone: best.onboardingDone === true,
      installHintDismissed: best.installHintDismissed === true,
      customSymptoms: Array.isArray(best.customSymptoms)
        ? best.customSymptoms.map(sanitizeCustomSymptom).filter((c): c is NonNullable<typeof c> => c !== null)
        : [],
      cycleSettings: sanitizeCycleSettings(best.cycleSettings),
    };
  }

  async saveEntry(e: DayEntry): Promise<void> {
    // Najpierw synchroniczny zapis lustrzany: zadziała nawet, gdy aplikacja zaraz zostanie zamknięta.
    this.writeMirror(e);
    if (!this.db) return;
    try {
      await this.db.put('entries', e);
    } catch (err) {
      this.health.lastError = `Zapis IndexedDB nie powiódł się: ${String(err)}`;
      throw err;
    }
  }

  async saveEntries(es: DayEntry[]): Promise<void> {
    es.forEach((e) => this.writeMirror(e));
    if (!this.db) return;
    const tx = this.db.transaction('entries', 'readwrite');
    await Promise.all([...es.map((e) => tx.store.put(e)), tx.done]);
  }

  async deleteEntry(date: string): Promise<void> {
    if (this.health.mirror) {
      try {
        localStorage.removeItem(LS_ENTRY + date);
      } catch {
        /* ignorujemy */
      }
    }
    if (this.db) await this.db.delete('entries', date);
  }

  async saveMeta(meta: AppMeta): Promise<void> {
    const stored: StoredMeta = { ...meta, updatedAt: new Date().toISOString() };
    if (this.health.mirror) {
      try {
        localStorage.setItem(LS_META, JSON.stringify(stored));
      } catch (err) {
        this.health.lastError = `Kopia lustrzana: ${String(err)}`;
      }
    }
    if (this.db) await this.db.put('meta', stored, 'app');
  }

  /** Usuwa wszystkie dane (tylko na wyraźne żądanie użytkowniczki). */
  async clearAll(): Promise<void> {
    if (this.health.mirror) {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rp1.')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    }
    if (this.db) {
      await this.db.clear('entries');
      await this.db.clear('meta');
    }
  }

  async requestPersistence(): Promise<boolean | null> {
    try {
      if (!navigator.storage?.persist) return null;
      if (await navigator.storage.persisted()) {
        this.health.persisted = true;
        return true;
      }
      const granted = await navigator.storage.persist();
      this.health.persisted = granted;
      return granted;
    } catch {
      return null;
    }
  }

  async refreshHealth(): Promise<StorageHealth> {
    try {
      if (navigator.storage?.persisted) this.health.persisted = await navigator.storage.persisted();
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        this.health.usageBytes = est.usage ?? null;
        this.health.quotaBytes = est.quota ?? null;
      }
    } catch {
      /* API niedostępne w tej przeglądarce */
    }
    return { ...this.health };
  }
}
