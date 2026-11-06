import { useEffect, useMemo, useRef, useState } from 'react';
import { BackupError, parseBackup } from '../lib/backup';
import { formatDate, formatDateTime, formatDayMonth, plural } from '../lib/dates';
import { hasAnyAnswer } from '../lib/analysis';
import { INSTALL_STEPS, detectPlatform } from '../lib/install';
import { isStandalone } from '../lib/share';
import type { SectionId } from '../lib/types';
import { useApp } from '../state/AppContext';
import { useFileActions } from '../state/useFileActions';
import { Sprig } from '../components/Botanical';
import { CycleSettingsSheet } from '../components/CycleSettingsSheet';
import { IconAlert, IconCheckCircle, IconDownload, IconPlus, IconShield, IconTable, IconUpload } from '../components/Icons';
import { ChoiceGroup, Sheet, useToast } from '../components/ui';

export const APP_VERSION = '1.0.0';

export function DataView({ onShowIntro }: { onShowIntro: () => void }) {
  const { entries, meta, health, refreshHealth, importData, updateMeta, clearAll, cycleSettings, info } = useApp();
  const { backup, exportExcel } = useFileActions();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [cycleSheet, setCycleSheet] = useState(false);
  const [installSheet, setInstallSheet] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSection, setNewSection] = useState<SectionId>('pms');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const logged = useMemo(() => [...entries.values()].filter(hasAnyAnswer).sort((a, b) => (a.date < b.date ? -1 : 1)), [entries]);
  const standalone = isStandalone();
  const platform = detectPlatform();

  const onImport = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      const res = await importData(parsed.entries, parsed.customSymptoms, parsed.cycleSettings);
      toast(
        `Przywrócono kopię: ${res.added} ${plural(res.added, ['nowy dzień', 'nowe dni', 'nowych dni'])}, ${res.updated} ${plural(res.updated, [
          'zaktualizowany',
          'zaktualizowane',
          'zaktualizowanych',
        ])}.`,
        undefined,
        6000,
      );
    } catch (err) {
      setImportError(err instanceof BackupError ? err.message : 'Nie udało się odczytać pliku. Upewnij się, że to kopia z ReportPMDD (.json).');
    }
  };

  const addCustom = async () => {
    const label = newLabel.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!label) return;
    const id = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await updateMeta({ customSymptoms: [...meta.customSymptoms, { id, label, section: newSection, createdAt: new Date().toISOString() }] });
    setNewLabel('');
    toast(`Dodano objaw: ${label}`);
  };

  const toggleArchive = (id: string) =>
    updateMeta({ customSymptoms: meta.customSymptoms.map((c) => (c.id === id ? { ...c, archived: c.archived ? undefined : true } : c)) });

  const usage =
    health.usageBytes !== null ? `${(health.usageBytes / 1024 / 1024).toFixed(health.usageBytes < 1024 * 1024 ? 2 : 1).replace('.', ',')} MB` : null;

  return (
    <main className="screen">
      <header className="screen-header">
        <Sprig className="header-sprig" leaves={8} opacity={0.85} flip />
        <h1 className="screen-title">Twoje dane</h1>
        <p className="screen-sub">Kopie, eksport i ustawienia</p>
      </header>

      <section className="card" aria-labelledby="safe-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="safe-title">
              Bezpieczeństwo danych
            </h2>
            <p className="card-sub">Dane są tylko na tym urządzeniu. Aplikacja nie wysyła ich do internetu.</p>
          </div>
          <IconShield size={28} style={{ color: 'var(--sage-700)', flex: 'none' }} />
        </div>
        <ul className="status-list">
          <StatusRow
            ok={health.indexedDb && health.mirror}
            title={health.indexedDb && health.mirror ? 'Podwójny zapis działa' : 'Zapis działa tylko w jednym miejscu'}
            text={
              health.indexedDb && health.mirror
                ? 'Każdy wpis trafia do dwóch niezależnych magazynów przeglądarki. Aplikacja nigdy sama nie usuwa danych.'
                : 'Jedna z metod zapisu jest niedostępna (np. tryb prywatny). Rób kopie zapasowe częściej.'
            }
          />
          <StatusRow
            ok={health.persisted === true}
            title={health.persisted === true ? 'Trwałe przechowywanie włączone' : 'Trwałe przechowywanie niepotwierdzone'}
            text={
              health.persisted === true
                ? 'Przeglądarka nie usunie danych nawet przy braku miejsca w telefonie.'
                : 'Przeglądarka sama decyduje o tej ochronie. Pomaga dodanie aplikacji do ekranu początkowego i regularne korzystanie.'
            }
          />
          <StatusRow
            ok={standalone}
            title={standalone ? 'Aplikacja na ekranie początkowym' : 'Otwarta w przeglądarce'}
            text={standalone ? 'Tak jest najbezpieczniej.' : 'Dodaj ją do ekranu początkowego i korzystaj tylko z ikony.'}
            action={!standalone ? { label: 'Jak to zrobić?', run: () => setInstallSheet(true) } : undefined}
          />
          <StatusRow
            ok={logged.length > 0}
            title={`${logged.length} ${plural(logged.length, ['dzień', 'dni', 'dni'])} z wpisem`}
            text={logged.length ? `Od ${formatDate(logged[0].date)}.${usage ? ` Zajęte miejsce: ${usage}.` : ''}` : 'Nie ma jeszcze wpisów.'}
          />
          <StatusRow
            ok={!!meta.lastBackupAt}
            title={meta.lastBackupAt ? 'Ostatnia kopia zapasowa' : 'Brak kopii zapasowej'}
            text={meta.lastBackupAt ? formatDateTime(meta.lastBackupAt) : 'Zrób pierwszą kopię poniżej.'}
          />
        </ul>
        {health.lastError && <p className="muted small">Szczegóły techniczne: {health.lastError}</p>}
      </section>

      <section className="card" aria-labelledby="bk-title">
        <h2 className="card-title" id="bk-title">
          Kopia zapasowa
        </h2>
        <p className="card-sub" style={{ marginBottom: 14 }}>
          Plik z wszystkimi wpisami. Zapisz go w iCloud Drive, na Dysku Google albo wyślij sobie mailem. Przypomnę o nowej kopii co 7 dni.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={() => void backup()} disabled={!logged.length}>
            <IconDownload size={19} /> Zrób kopię
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => fileInput.current?.click()}>
            <IconUpload size={19} /> Przywróć z kopii
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onImport(f);
            }}
          />
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Przywracanie niczego nie kasuje: dni z kopii łączą się z obecnymi, a przy różnicach zostaje nowsza wersja dnia.
        </p>
        {importError && (
          <p className="small" role="alert" style={{ color: 'var(--berry-700)', marginTop: 8 }}>
            {importError}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="xl-title">
        <h2 className="card-title" id="xl-title">
          Eksport do Excela
        </h2>
        <p className="card-sub" style={{ marginBottom: 14 }}>
          Plik .xlsx otworzysz w Excelu, Numbers i Arkuszach Google. Oceny są pokolorowane jak w aplikacji.
        </p>
        <ul className="ob-list" style={{ marginTop: 0, marginBottom: 14 }}>
          <li>
            <IconTable size={20} style={{ color: 'var(--sage-700)', flex: 'none' }} />
            <span>
              <strong>Dziennik:</strong> jeden wiersz na dzień, wszystkie odpowiedzi, dzień cyklu i faza.
            </span>
          </li>
          <li>
            <IconTable size={20} style={{ color: 'var(--sage-700)', flex: 'none' }} />
            <span>
              <strong>Zdarzenia powiązane, Cykle, Legenda:</strong> opisy zdarzeń, porównanie przed i po okresie, skala i źródła.
            </span>
          </li>
        </ul>
        <button type="button" className="btn btn--primary btn--block" onClick={() => void exportExcel()} disabled={!logged.length}>
          <IconDownload size={19} /> Pobierz plik Excel
        </button>
      </section>

      <section className="card" aria-labelledby="cy-title">
        <h2 className="card-title" id="cy-title">
          Twój cykl
        </h2>
        <p className="card-sub" style={{ marginBottom: 12 }}>
          {cycleSettings.mode === 'auto'
            ? `Liczony automatycznie z ostatnich cykli${info.stats.avgCycle !== null ? `: ${String(info.stats.avgCycle).replace('.', ',')} dni` : ''}.`
            : `Ustawione: cykl ${cycleSettings.cycleLength} dni, okres ${cycleSettings.periodLength} dni.`}
        </p>
        <button type="button" className="btn btn--outline btn--small" onClick={() => setCycleSheet(true)}>
          Ustawienia cyklu
        </button>
      </section>

      <section className="card" aria-labelledby="cu-title">
        <h2 className="card-title" id="cu-title">
          Moje objawy
        </h2>
        <p className="card-sub" style={{ marginBottom: 12 }}>
          Dodaj objawy, których brakuje na liście. Pojawią się na końcu wybranej sekcji. Zarchiwizowane znikają z formularza, ale ich dane zostają.
        </p>
        {meta.customSymptoms.length > 0 && (
          <ul className="custom-list">
            {meta.customSymptoms.map((c) => (
              <li key={c.id}>
                <span className={`tag tag--${c.section}`}>{c.section === 'pmdd' ? 'PMDD' : 'PMS'}</span>
                <span className={`label ${c.archived ? 'is-archived' : ''}`}>{c.label}</span>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void toggleArchive(c.id)}>
                  {c.archived ? 'Przywróć' : 'Archiwizuj'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="field">
          <label htmlFor="new-symptom">Nowy objaw</label>
          <input
            id="new-symptom"
            className="input"
            value={newLabel}
            maxLength={120}
            placeholder="Np. Migrena, Napady paniki, Uderzenia gorąca"
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addCustom()}
          />
        </div>
        <p className="field-label" style={{ marginBottom: 8 }}>
          Sekcja
        </p>
        <ChoiceGroup<SectionId>
          label="Sekcja nowego objawu"
          options={[
            { value: 'pmdd', label: 'PMDD (ciemna)' },
            { value: 'pms', label: 'PMS (jasna)' },
          ]}
          value={newSection}
          allowClear={false}
          onChange={(v) => v && setNewSection(v)}
        />
        <button type="button" className="btn btn--secondary" style={{ marginTop: 14 }} onClick={() => void addCustom()} disabled={!newLabel.trim()}>
          <IconPlus size={18} /> Dodaj objaw
        </button>
      </section>

      <section className="card" aria-labelledby="ab-title">
        <h2 className="card-title" id="ab-title" style={{ marginBottom: 8 }}>
          O aplikacji
        </h2>
        <details className="details">
          <summary>Skąd są pytania</summary>
          <p>
            Sekcja PMDD to kwestionariusz DRSP (Daily Record of Severity of Problems, Endicott, Nee i Harrison, 2006), polecany do codziennego
            śledzenia objawów PMDD przez co najmniej 2 cykle. Skala 1-5 i „ponad skalę” odpowiada 6-stopniowej skali DRSP, więc lekarz może od razu
            użyć Twoich danych. Tłumaczenie na polski jest robocze.
          </p>
          <p>Sekcja PMS zawiera częste objawy fizyczne cyklu, których nie ma w DRSP.</p>
        </details>
        <details className="details">
          <summary>Jak przechowywane są dane</summary>
          <p>
            Wpisy zapisują się automatycznie w pamięci przeglądarki na tym urządzeniu, w dwóch miejscach naraz. Nie ma konta ani serwera. Aplikacja
            nigdy sama nie usuwa danych. Ryzyko utraty pojawia się tylko przy usunięciu aplikacji, wyczyszczeniu danych przeglądarki albo utracie
            telefonu, dlatego rób kopie zapasowe.
          </p>
          <p>Nie zmieniaj adresu strony po rozpoczęciu wpisów: dane są przypisane do adresu. W razie przeprowadzki użyj kopii zapasowej.</p>
        </details>
        <details className="details">
          <summary>Ważne</summary>
          <p>
            ReportPMDD pomaga zbierać dane i przygotować się do wizyty. Nie stawia diagnozy i nie zastępuje lekarza. Owulacja jest szacowana
            kalendarzowo i nie nadaje się do antykoncepcji.
          </p>
        </details>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--ghost btn--small" onClick={onShowIntro}>
            Pokaż wprowadzenie
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="dz-title">
        <h2 className="card-title" id="dz-title">
          Usuwanie danych
        </h2>
        <p className="card-sub" style={{ marginBottom: 12 }}>
          Usuwa wszystkie wpisy z tego urządzenia. Najpierw zrób kopię zapasową.
        </p>
        <button type="button" className="btn btn--danger btn--small" onClick={() => setDeleteSheet(true)} disabled={!entries.size}>
          Usuń wszystkie dane
        </button>
      </section>

      <p className="version">
        ReportPMDD {APP_VERSION} · dane od {logged.length ? formatDayMonth(logged[0].date) : 'dziś'}
      </p>

      {cycleSheet && <CycleSettingsSheet onClose={() => setCycleSheet(false)} />}

      {installSheet && (
        <Sheet title="Dodaj do ekranu początkowego" onClose={() => setInstallSheet(false)}>
          <ol className="ob-list">
            {INSTALL_STEPS[platform].map((s, i) => (
              <li key={i}>
                <span className="num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="sheet-actions">
            <button type="button" className="btn btn--primary btn--block" onClick={() => setInstallSheet(false)}>
              Rozumiem
            </button>
          </div>
        </Sheet>
      )}

      {deleteSheet && (
        <Sheet title="Usunąć wszystkie dane?" onClose={() => setDeleteSheet(false)}>
          <p>
            Zniknie {entries.size} {plural(entries.size, ['dzień', 'dni', 'dni'])} wpisów i Twoje ustawienia. Tego nie da się cofnąć bez kopii
            zapasowej.
          </p>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="confirm-del">Wpisz USUŃ, aby potwierdzić</label>
            <input id="confirm-del" className="input" value={confirmText} autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn btn--secondary btn--block" onClick={() => void backup()}>
              <IconDownload size={18} /> Najpierw zrób kopię
            </button>
            <button
              type="button"
              className="btn btn--danger-solid btn--block"
              disabled={confirmText.trim().toUpperCase() !== 'USUŃ'}
              onClick={async () => {
                await clearAll();
                setDeleteSheet(false);
                setConfirmText('');
                toast('Wszystkie dane zostały usunięte');
              }}
            >
              Usuń wszystko
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function StatusRow({ ok, title, text, action }: { ok: boolean; title: string; text: string; action?: { label: string; run: () => void } }) {
  return (
    <li>
      {ok ? <IconCheckCircle size={20} className="ok" /> : <IconAlert size={20} className="warn" />}
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
        {action && (
          <button type="button" className="btn btn--ghost btn--small" style={{ paddingLeft: 0 }} onClick={action.run}>
            {action.label}
          </button>
        )}
      </span>
    </li>
  );
}
