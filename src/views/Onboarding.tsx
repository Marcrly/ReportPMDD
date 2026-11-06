import { useState } from 'react';
import { CYCLE_LIMITS, DEFAULT_CYCLE_SETTINGS } from '../lib/cycles';
import { calendarToday, isISODate } from '../lib/dates';
import { INSTALL_STEPS, detectPlatform, useInstallPrompt } from '../lib/install';
import { isStandalone } from '../lib/share';
import type { CycleSettings } from '../lib/types';
import { useApp } from '../state/AppContext';
import { usePeriodActions } from '../state/usePeriodActions';
import { isBleeding } from '../lib/questionnaire';
import { Bloom, Bouquet, Sprig } from '../components/Botanical';
import { IconShield } from '../components/Icons';
import { Stepper } from '../components/ui';

const STEPS = 5;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { meta, updateMeta, cycleSettings, entries } = useApp();
  const { setFlow } = usePeriodActions();
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState<CycleSettings>(meta.cycleSettings ?? DEFAULT_CYCLE_SETTINGS);
  const [lastStart, setLastStart] = useState('');
  const platform = detectPlatform();
  const install = useInstallPrompt();
  const today = calendarToday();

  const finish = async () => {
    await updateMeta({ onboardingDone: true, cycleSettings: { ...cycleSettings, ...cycle } });
    if (lastStart && isISODate(lastStart) && lastStart <= today && !isBleeding(entries.get(lastStart)?.flow)) {
      // Zaznacza cały ostatni okres według podanej długości (można go potem skrócić lub przedłużyć).
      setFlow(lastStart, 'period', cycle.periodLength);
    }
    onDone();
  };

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : void finish());

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="ob-inner">
        <div className="ob-dots" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <i key={i} className={i === step ? 'is-active' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="ob-art">
              <Bouquet size={180} />
            </div>
            <h1 className="ob-title" id="ob-title">
              Twój dziennik PMDD i PMS
            </h1>
            <p className="ob-text">Co wieczór oceniasz objawy z mijającego dnia. To zajmuje 2-3 minuty.</p>
            <p className="ob-text">
              Po kilku cyklach zobaczysz, czy objawy nasilają się przed okresem, i przygotujesz konkretne dane na wizytę u lekarza.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-art">
              <ScalePreview />
            </div>
            <h1 className="ob-title" id="ob-title">
              Jak oceniać objawy
            </h1>
            <p className="ob-text">
              Ciemnozielona sekcja <strong>PMDD</strong> to 24 pytania z kwestionariusza DRSP, którego używają lekarze. Jasnozielona sekcja{' '}
              <strong>PMS</strong> to dodatkowe objawy fizyczne cyklu.
            </p>
            <p className="ob-text">
              1 oznacza „nie czułam”, 5 „silnie”. Gdy było nie do opisania, wybierz <strong>ponad skalę</strong>. Jeśli objaw miał przyczynę w czymś,
              co się wydarzyło, zaznacz <strong>zdarzenie powiązane</strong> i dopisz, co to było.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-art">
              <IconShield size={84} style={{ color: 'var(--sage-700)' }} />
            </div>
            <h1 className="ob-title" id="ob-title">
              Dane zostają u Ciebie
            </h1>
            <p className="ob-text">
              Wszystko zapisuje się tylko na tym telefonie, bez konta i bez wysyłania do internetu. Aplikacja nigdy sama nie usuwa wpisów.
            </p>
            <p className="ob-text">
              Na wypadek utraty telefonu raz w tygodniu zrób kopię zapasową (przypomnę o tym). W każdej chwili możesz też pobrać wszystko do Excela.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-art" style={{ height: 120 }}>
              <Bloom size={72} />
            </div>
            <h1 className="ob-title" id="ob-title">
              Twój cykl
            </h1>
            <p className="ob-text">
              Podaj średnie wartości, jeśli je znasz. Gdy zaznaczysz pierwszy dzień okresu, aplikacja sama zaznaczy kolejne dni według długości
              okresu. Po kilku cyklach podpowie te wartości na podstawie Twoich danych.
            </p>
            <div className="ob-fields">
              <div className="field-row">
                <span>Długość cyklu</span>
                <Stepper
                  label="Długość cyklu"
                  value={cycle.cycleLength}
                  onChange={(v) => setCycle({ ...cycle, cycleLength: v })}
                  min={CYCLE_LIMITS.cycle.min}
                  max={CYCLE_LIMITS.cycle.max}
                  step={1}
                  start={28}
                  unit="dni"
                />
              </div>
              <div className="field-row">
                <span>Długość okresu</span>
                <Stepper
                  label="Długość okresu"
                  value={cycle.periodLength}
                  onChange={(v) => setCycle({ ...cycle, periodLength: v })}
                  min={CYCLE_LIMITS.period.min}
                  max={CYCLE_LIMITS.period.max}
                  step={1}
                  start={5}
                  unit="dni"
                />
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="last-start">Pierwszy dzień ostatniego okresu (opcjonalnie)</label>
                <input id="last-start" className="input" type="date" max={today} value={lastStart} onChange={(e) => setLastStart(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="ob-art" style={{ height: 130 }}>
              <Sprig leaves={10} />
            </div>
            <h1 className="ob-title" id="ob-title">
              {isStandalone() ? 'Wszystko gotowe' : 'Dodaj do ekranu początkowego'}
            </h1>
            {isStandalone() ? (
              <p className="ob-text">Aplikacja jest zainstalowana. Zacznij od dzisiejszego wpisu.</p>
            ) : (
              <>
                <p className="ob-text">Zrób to przed pierwszym wpisem. Dziennik będzie działał jak zwykła aplikacja, także bez internetu.</p>
                <ol className="ob-list">
                  {INSTALL_STEPS[platform].map((s, i) => (
                    <li key={i}>
                      <span className="num">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                {install.canPrompt && (
                  <button type="button" className="btn btn--outline btn--block" style={{ marginTop: 12 }} onClick={() => void install.prompt()}>
                    Zainstaluj teraz
                  </button>
                )}
              </>
            )}
          </>
        )}

        <div className="ob-actions">
          <button type="button" className="btn btn--primary btn--block" onClick={next}>
            {step < STEPS - 1 ? 'Dalej' : 'Zaczynamy'}
          </button>
          {step > 0 ? (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setStep(step - 1)}>
              Wstecz
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => void finish()}>
              Pomiń wprowadzenie
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScalePreview() {
  const vals = [1, 2, 3, 4, 5];
  return (
    <div className="item item--pmdd" style={{ width: '100%', maxWidth: 340, margin: 0 }} aria-hidden="true">
      <p className="item-label" style={{ marginBottom: 12 }}>
        Czułam złość lub rozdrażnienie
      </p>
      <div className="scale">
        {vals.map((v) => (
          <span key={v} className={`scale-btn ${v === 4 ? 'is-selected' : ''}`} data-v={v} style={{ display: 'grid', placeItems: 'center' }}>
            {v}
          </span>
        ))}
        <span className="scale-btn scale-btn--over" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          ponad skalę
        </span>
      </div>
    </div>
  );
}
