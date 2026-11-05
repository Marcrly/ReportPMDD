import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyzeCycles, DEFAULT_CYCLE_SETTINGS, type CycleInfo } from '../lib/cycles';
import { logicalToday } from '../lib/dates';
import { mergeCustomSymptoms, mergeEntries, type MergeResult } from '../lib/backup';
import { DEFAULT_META, Store, type StorageHealth } from '../lib/storage';
import type { AppMeta, CustomSymptom, CycleSettings, DayEntry, ISODate } from '../lib/types';

export type SaveState = 'idle' | 'pending' | 'saved' | 'error';

interface AppContextValue {
  ready: boolean;
  entries: Map<ISODate, DayEntry>;
  meta: AppMeta;
  cycleSettings: CycleSettings;
  info: CycleInfo;
  today: ISODate;
  health: StorageHealth;
  saveState: SaveState;
  getEntry: (date: ISODate) => DayEntry | undefined;
  updateEntry: (date: ISODate, change: (e: DayEntry) => DayEntry) => void;
  deleteEntry: (date: ISODate) => Promise<void>;
  updateMeta: (change: Partial<AppMeta>) => Promise<void>;
  importData: (entries: DayEntry[], custom: CustomSymptom[], settings?: CycleSettings) => Promise<MergeResult>;
  clearAll: () => Promise<void>;
  flush: () => Promise<void>;
  refreshHealth: () => Promise<void>;
}

const Ctx = createContext<AppContextValue | null>(null);
const SAVE_DELAY = 350;

export function emptyEntry(date: ISODate): DayEntry {
  const now = new Date().toISOString();
  return { date, ratings: {}, events: {}, createdAt: now, updatedAt: now };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Store>(new Store());
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Map<ISODate, DayEntry>>(new Map());
  const [meta, setMeta] = useState<AppMeta>(DEFAULT_META);
  const [health, setHealth] = useState<StorageHealth>(storeRef.current.health);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [today, setToday] = useState<ISODate>(() => logicalToday());

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const pending = useRef(new Map<ISODate, ReturnType<typeof setTimeout>>());
  const persistAsked = useRef(false);

  useEffect(() => {
    let alive = true;
    storeRef.current.init().then(async ({ entries: list, meta: m }) => {
      if (!alive) return;
      setEntries(new Map(list.map((e) => [e.date, e])));
      setMeta(m);
      setReady(true);
      if (list.length) {
        persistAsked.current = true;
        await storeRef.current.requestPersistence();
      }
      setHealth(await storeRef.current.refreshHealth());
    });
    return () => {
      alive = false;
    };
  }, []);

  // "Dzisiaj" aktualizuje się, gdy aplikacja wraca z tła (np. następnego dnia).
  useEffect(() => {
    const tick = () => setToday(logicalToday());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const persist = useCallback(async (date: ISODate) => {
    pending.current.delete(date);
    const e = entriesRef.current.get(date);
    if (!e) return;
    try {
      await storeRef.current.saveEntry(e);
      if (pending.current.size === 0) setSaveState('saved');
      // O trwałe przechowywanie prosimy raz na sesję (Firefox pokazuje przy tym pytanie).
      if (!persistAsked.current && storeRef.current.health.persisted !== true) {
        persistAsked.current = true;
        storeRef.current.requestPersistence().then(() => setHealth({ ...storeRef.current.health }));
      }
    } catch {
      setSaveState('error');
      setHealth({ ...storeRef.current.health });
    }
  }, []);

  const flush = useCallback(async () => {
    const dates = [...pending.current.keys()];
    pending.current.forEach((t) => clearTimeout(t));
    pending.current.clear();
    await Promise.all(dates.map((d) => persist(d)));
  }, [persist]);

  // Zapis natychmiast, gdy aplikacja chowa się w tle albo jest zamykana.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush]);

  const updateEntry = useCallback(
    (date: ISODate, change: (e: DayEntry) => DayEntry) => {
      const cur = entriesRef.current.get(date) ?? emptyEntry(date);
      const next = { ...change(cur), date, updatedAt: new Date().toISOString() };
      const map = new Map(entriesRef.current);
      map.set(date, next);
      entriesRef.current = map;
      setEntries(map);
      setSaveState('pending');
      const prev = pending.current.get(date);
      if (prev) clearTimeout(prev);
      pending.current.set(
        date,
        setTimeout(() => void persist(date), SAVE_DELAY),
      );
    },
    [persist],
  );

  const deleteEntry = useCallback(async (date: ISODate) => {
    const t = pending.current.get(date);
    if (t) clearTimeout(t);
    pending.current.delete(date);
    const map = new Map(entriesRef.current);
    map.delete(date);
    entriesRef.current = map;
    setEntries(map);
    await storeRef.current.deleteEntry(date);
  }, []);

  const updateMeta = useCallback(async (change: Partial<AppMeta>) => {
    const next = { ...metaRef.current, ...change };
    metaRef.current = next;
    setMeta(next);
    await storeRef.current.saveMeta(next);
  }, []);

  const importData = useCallback(
    async (incoming: DayEntry[], custom: CustomSymptom[], settings?: CycleSettings) => {
      await flush();
      const result = mergeEntries(entriesRef.current, incoming);
      if (result.toWrite.length) {
        await storeRef.current.saveEntries(result.toWrite);
        const map = new Map(entriesRef.current);
        result.toWrite.forEach((e) => map.set(e.date, e));
        entriesRef.current = map;
        setEntries(map);
      }
      const mergedCustom = mergeCustomSymptoms(metaRef.current.customSymptoms, custom);
      await updateMeta({
        customSymptoms: mergedCustom,
        cycleSettings: metaRef.current.cycleSettings ?? settings,
      });
      await storeRef.current.requestPersistence();
      setHealth(await storeRef.current.refreshHealth());
      return result;
    },
    [flush, updateMeta],
  );

  const clearAll = useCallback(async () => {
    pending.current.forEach((t) => clearTimeout(t));
    pending.current.clear();
    await storeRef.current.clearAll();
    entriesRef.current = new Map();
    setEntries(new Map());
    const fresh = { ...DEFAULT_META, onboardingDone: true };
    metaRef.current = fresh;
    setMeta(fresh);
    await storeRef.current.saveMeta(fresh);
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealth(await storeRef.current.refreshHealth());
  }, []);

  const cycleSettings = meta.cycleSettings ?? DEFAULT_CYCLE_SETTINGS;
  const info = useMemo(() => analyzeCycles(entries.values(), today, cycleSettings), [entries, today, cycleSettings]);

  const value: AppContextValue = {
    ready,
    entries,
    meta,
    cycleSettings,
    info,
    today,
    health,
    saveState,
    getEntry: (d) => entries.get(d),
    updateEntry,
    deleteEntry,
    updateMeta,
    importData,
    clearAll,
    flush,
    refreshHealth,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp poza AppProvider');
  return v;
}
