import { useState } from 'react';
import { CYCLE_LIMITS, STATS_CYCLES } from '../lib/cycles';
import { formatDayMonth, plural } from '../lib/dates';
import { useApp } from '../state/AppContext';
import type { CycleSettings } from '../lib/types';
import { Sheet, Stepper, useToast } from './ui';

const fmt1 = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

export function CycleSettingsSheet({ onClose }: { onClose: () => void }) {
  const { cycleSettings, info, updateMeta } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState<CycleSettings>(cycleSettings);
  const { stats } = info;
  const n = stats.cycleLengths.length;

  const apply = () => {
    setDraft({
      mode: 'manual',
      cycleLength: Math.round(stats.avgCycle ?? draft.cycleLength),
      periodLength: Math.round(stats.avgPeriod ?? draft.periodLength),
    });
  };

  const save = async () => {
    await updateMeta({ cycleSettings: draft });
    toast('Zapisano ustawienia cyklu');
    onClose();
  };

  return (
    <Sheet title="Twój cykl" onClose={onClose}>
      <p className="muted small">Na tej podstawie aplikacja prognozuje kolejny okres i szacuje owulację.</p>

      <div className="segmented" role="group" aria-label="Skąd brać długość cyklu" style={{ margin: '16px 0 6px' }}>
        <button type="button" aria-pressed={draft.mode === 'manual'} onClick={() => setDraft({ ...draft, mode: 'manual' })}>
          Moje wartości
        </button>
        <button type="button" aria-pressed={draft.mode === 'auto'} onClick={() => setDraft({ ...draft, mode: 'auto' })}>
          Z ostatnich {STATS_CYCLES} cykli
        </button>
      </div>

      {draft.mode === 'manual' ? (
        <div className="ob-fields" style={{ marginTop: 8 }}>
          <div className="field-row">
            <span>Średnia długość cyklu</span>
            <Stepper
              label="Średnia długość cyklu"
              value={draft.cycleLength}
              onChange={(v) => setDraft({ ...draft, cycleLength: v })}
              min={CYCLE_LIMITS.cycle.min}
              max={CYCLE_LIMITS.cycle.max}
              step={1}
              start={28}
              unit="dni"
            />
          </div>
          <div className="field-row">
            <span>Średnia długość okresu</span>
            <Stepper
              label="Średnia długość okresu"
              value={draft.periodLength}
              onChange={(v) => setDraft({ ...draft, periodLength: v })}
              min={CYCLE_LIMITS.period.min}
              max={CYCLE_LIMITS.period.max}
              step={1}
              start={5}
              unit="dni"
            />
          </div>
        </div>
      ) : (
        <p className="small" style={{ marginTop: 8 }}>
          {n > 0
            ? `Prognoza będzie się sama aktualizować po każdym kolejnym cyklu.`
            : `Na razie brakuje pełnych cykli, więc używam Twoich wartości: cykl ${draft.cycleLength} dni, okres ${draft.periodLength} dni.`}
        </p>
      )}

      <div className="hint-box" aria-live="polite">
        <strong>Podpowiedź z Twoich danych</strong>
        {n > 0 ? (
          <>
            <p style={{ marginTop: 4 }}>
              Z {n === 1 ? 'ostatniego cyklu' : `ostatnich ${n} ${plural(n, ['cyklu', 'cykli', 'cykli'])}`}
              {stats.since ? ` (od ${formatDayMonth(stats.since)})` : ''}: cykl średnio <strong>{fmt1(stats.avgCycle as number)} dni</strong>
              {n > 1 && stats.minCycle !== stats.maxCycle ? ` (od ${stats.minCycle} do ${stats.maxCycle} dni)` : ''}
              {stats.avgPeriod !== null ? (
                <>
                  , okres średnio <strong>{fmt1(stats.avgPeriod)} dni</strong>
                </>
              ) : null}
              .
            </p>
            {n < STATS_CYCLES && (
              <p className="muted small" style={{ marginTop: 4 }}>
                Najdokładniej policzę to po {STATS_CYCLES} pełnych cyklach.
              </p>
            )}
            {draft.mode === 'manual' && (
              <button type="button" className="btn btn--outline btn--small" style={{ marginTop: 10 }} onClick={apply}>
                Użyj tych wartości
              </button>
            )}
          </>
        ) : (
          <p style={{ marginTop: 4 }}>Zaznacz w kalendarzu dni co najmniej dwóch kolejnych okresów, a policzę długość Twojego cyklu i okresu.</p>
        )}
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        Owulację szacuję kalendarzowo: 14 dni przed spodziewanym okresem. To przybliżenie, które nie nadaje się do antykoncepcji.
      </p>

      <div className="sheet-actions">
        <button type="button" className="btn btn--primary btn--block" onClick={save}>
          Zapisz
        </button>
        <button type="button" className="btn btn--secondary btn--block" onClick={onClose}>
          Anuluj
        </button>
      </div>
    </Sheet>
  );
}
