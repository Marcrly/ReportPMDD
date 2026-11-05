import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildWorkbook } from '../src/lib/exporter';
import { createBackup, mergeEntries, parseBackup, sanitizeEntry, BackupError } from '../src/lib/backup';
import { columnName, escapeXml } from '../src/lib/xlsx';
import { Store } from '../src/lib/storage';
import { addDays } from '../src/lib/dates';
import { DRSP, PMS } from '../src/lib/questionnaire';
import type { DayEntry, Rating } from '../src/lib/types';

// Prosty localStorage w pamięci dla środowiska Node.
class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

function sampleEntries(): DayEntry[] {
  const out: DayEntry[] = [];
  const start = '2026-08-01';
  for (let i = 0; i < 70; i++) {
    const date = addDays(start, i);
    const cd = (i % 28) + 1;
    const pre = cd >= 22;
    const ratings: Record<string, Rating> = {};
    for (const s of [...DRSP, ...PMS]) ratings[s.id] = (pre ? (cd === 27 ? 6 : 4) : 1) as Rating;
    out.push({
      date,
      ratings,
      events: cd === 25 ? { drsp8: 'Kłótnia z szefem & stres <projekt>' } : {},
      flow: cd <= 4 ? 'medium' : 'none',
      sleepHours: pre ? 5.5 : 7.5,
      sleepQuality: pre ? 2 : 4,
      activity: i % 2 === 0,
      activityMinutes: i % 2 === 0 ? 30 : undefined,
      activityIntensity: i % 2 === 0 ? 'moderate' : undefined,
      note: i === 3 ? 'Notatka z "cudzysłowem" i znakiem \u0007 sterującym' : undefined,
      createdAt: `${date}T20:00:00.000Z`,
      updatedAt: `${date}T20:00:00.000Z`,
    });
  }
  return out;
}

describe('xlsx', () => {
  it('nazwy kolumn', () => {
    expect(columnName(0)).toBe('A');
    expect(columnName(25)).toBe('Z');
    expect(columnName(26)).toBe('AA');
    expect(columnName(51)).toBe('AZ');
    expect(columnName(701)).toBe('ZZ');
    expect(columnName(702)).toBe('AAA');
  });
  it('escapuje XML i usuwa znaki sterujące', () => {
    expect(escapeXml('a & b < c > "d"\u0001')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
    expect(escapeXml('emoji 🌿 ok')).toBe('emoji 🌿 ok');
    expect(escapeXml('samotny \uD800 surogat')).toBe('samotny  surogat');
  });
  it('buduje poprawną paczkę xlsx z 4 arkuszami', () => {
    const bytes = buildWorkbook(
      sampleEntries(),
      [{ id: 'c_migrena', label: 'Migrena', section: 'pms', createdAt: '2026-08-01T00:00:00.000Z' }],
      '2026-10-15',
    );
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet4.xml']),
    );
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).toContain('name="Dziennik"');
    expect(wb).toContain('name="Zdarzenia powiązane"');
    const sst = strFromU8(files['xl/sharedStrings.xml']);
    expect(sst).toContain('Kłótnia z szefem &amp; stres &lt;projekt&gt;');
    expect(sst).not.toContain('\u0007');
    mkdirSync('tests/.out', { recursive: true });
    writeFileSync('tests/.out/sample.xlsx', bytes);
  });
});

describe('kopia zapasowa', () => {
  it('zapis i odczyt bez strat', () => {
    const entries = sampleEntries();
    const json = createBackup(entries, []);
    const parsed = parseBackup(json);
    expect(parsed.entries).toHaveLength(entries.length);
    expect(parsed.entries[3].note).toBe(entries[3].note);
    expect(parsed.entries[24].events).toEqual(entries[24].events);
  });
  it('odrzuca obce pliki', () => {
    expect(() => parseBackup('nie json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ foo: 1 }))).toThrow(BackupError);
  });
  it('czyści niepoprawne dane', () => {
    const e = sanitizeEntry({ date: '2026-02-30', ratings: {} });
    expect(e).toBeNull();
    const ok = sanitizeEntry({ date: '2026-02-03', ratings: { drsp1: 9, drsp2: 3, 'zły klucz!': 2 }, flow: 'tsunami', sleepHours: 7.3 });
    expect(ok?.ratings).toEqual({ drsp2: 3 });
    expect(ok?.flow).toBeUndefined();
    expect(ok?.sleepHours).toBe(7.5);
  });
  it('scalanie: nowsza wersja wygrywa, nic nie znika', () => {
    const cur = new Map<string, DayEntry>([
      ['2026-01-01', { date: '2026-01-01', ratings: { drsp1: 2 }, events: {}, createdAt: 'x', updatedAt: '2026-01-02T10:00:00.000Z' }],
      ['2026-01-02', { date: '2026-01-02', ratings: { drsp1: 2 }, events: {}, createdAt: 'x', updatedAt: '2026-01-02T10:00:00.000Z' }],
    ]);
    const incoming: DayEntry[] = [
      { date: '2026-01-01', ratings: { drsp1: 5 }, events: {}, createdAt: 'x', updatedAt: '2026-01-05T10:00:00.000Z' },
      { date: '2026-01-02', ratings: { drsp1: 1 }, events: {}, createdAt: 'x', updatedAt: '2025-12-31T10:00:00.000Z' },
      { date: '2026-01-03', ratings: { drsp1: 3 }, events: {}, createdAt: 'x', updatedAt: '2026-01-03T10:00:00.000Z' },
    ];
    const r = mergeEntries(cur, incoming);
    expect(r).toMatchObject({ added: 1, updated: 1, unchanged: 1 });
    expect(r.toWrite.map((e) => e.date).sort()).toEqual(['2026-01-01', '2026-01-03']);
  });
});

describe('magazyn danych', () => {
  beforeEach(async () => {
    localStorage.clear();
    const s = new Store();
    await s.init();
    await s.clearAll();
  });

  it('zapisuje do IndexedDB i kopii lustrzanej', async () => {
    const s = new Store();
    await s.init();
    const e = sampleEntries()[0];
    await s.saveEntry(e);
    const again = await new Store().init();
    expect(again.entries.map((x) => x.date)).toEqual([e.date]);
    expect(localStorage.getItem(`rp1.entry.${e.date}`)).toBeTruthy();
  });

  it('odtwarza IndexedDB z kopii lustrzanej (samonaprawa)', async () => {
    const e = sampleEntries()[5];
    localStorage.setItem(`rp1.entry.${e.date}`, JSON.stringify(e));
    const s = new Store();
    const loaded = await s.init();
    expect(loaded.entries.map((x) => x.date)).toContain(e.date);
    localStorage.clear(); // np. przeglądarka wyczyściła localStorage
    const reloaded = await new Store().init();
    expect(reloaded.entries.map((x) => x.date)).toContain(e.date);
  });

  it('wybiera nowszą wersję wpisu z dwóch magazynów', async () => {
    const s = new Store();
    await s.init();
    const e = sampleEntries()[1];
    await s.saveEntry(e);
    const newer = { ...e, ratings: { drsp1: 6 as Rating }, updatedAt: '2030-01-01T00:00:00.000Z' };
    localStorage.setItem(`rp1.entry.${e.date}`, JSON.stringify(newer));
    const loaded = await new Store().init();
    expect(loaded.entries.find((x) => x.date === e.date)?.ratings.drsp1).toBe(6);
  });

  it('zapisuje ustawienia', async () => {
    const s = new Store();
    await s.init();
    await s.saveMeta({
      customSymptoms: [{ id: 'c_abc', label: 'Migrena', section: 'pms', createdAt: '2026-01-01T00:00:00.000Z' }],
      onboardingDone: true,
    });
    const loaded = await new Store().init();
    expect(loaded.meta.onboardingDone).toBe(true);
    expect(loaded.meta.customSymptoms[0].label).toBe('Migrena');
  });
});
