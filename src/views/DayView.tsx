import { Fragment, useCallback, useMemo, useState } from 'react';
import { positionOf } from '../lib/cycles';
import { calendarToday, formatLong, formatShort, plDays } from '../lib/dates';
import { FLOW, INTENSITY, SLEEP_QUALITY, isBleeding, sectionSymptoms } from '../lib/questionnaire';
import { goBack } from '../lib/router';
import type { DayEntry, Flow, ISODate, Rating, SectionId, Symptom } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Sprig } from '../components/Botanical';
import { IconAlert, IconBack, IconCheck, IconDrop, IconFlower, IconMoon, IconTrash, IconWalk } from '../components/Icons';
import { SymptomItem } from '../components/SymptomItem';
import { ChoiceGroup, Sheet, Stepper, useToast } from '../components/ui';
import { usePeriodActions } from '../state/usePeriodActions';

export function DayView({ date }: { date: ISODate }) {
  const { entries, meta, info, updateEntry, deleteEntry, saveState, flush } = useApp();
  const toast = useToast();
  const { setFlow, periodLength } = usePeriodActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const entry = entries.get(date);
  const future = date > calendarToday();
  const pos = positionOf(date, info);
  const ovulation = info.ovulationDays.has(date);

  const pmdd = useMemo(() => sectionSymptoms('pmdd', meta.customSymptoms), [meta.customSymptoms]);
  const pms = useMemo(() => sectionSymptoms('pms', meta.customSymptoms), [meta.customSymptoms]);

  const update = useCallback((fn: (e: DayEntry) => DayEntry) => updateEntry(date, fn), [date, updateEntry]);

  const onRate = useCallback(
    (id: string, v: Rating | undefined) =>
      update((e) => {
        const ratings = { ...e.ratings };
        if (v === undefined) delete ratings[id];
        else ratings[id] = v;
        return { ...e, ratings };
      }),
    [update],
  );

  const onEvent = useCallback(
    (id: string, note: string | undefined) =>
      update((e) => {
        const events = { ...e.events };
        if (note === undefined) delete events[id];
        else events[id] = note;
        return { ...e, events };
      }),
    [update],
  );

  const fillRest = (list: Symptom[]) =>
    update((e) => {
      const ratings = { ...e.ratings };
      list.forEach((s) => {
        if (ratings[s.id] === undefined) ratings[s.id] = 1;
      });
      return { ...e, ratings };
    });

  const done = async () => {
    await flush();
    goBack();
  };

  const remove = async () => {
    await deleteEntry(date);
    setConfirmDelete(false);
    toast('Wpis usunięty');
    goBack();
  };

  if (future) {
    return (
      <main className="screen screen--day">
        <DayBar date={date} subtitle="Dzień w przyszłości" saveState="idle" />
        <div className="card empty">
          <strong>Ten dzień jeszcze nie nadszedł</strong>
          Wpis możesz dodać wieczorem tego dnia.
        </div>
      </main>
    );
  }

  const answered = (list: Symptom[]) => list.filter((s) => entry?.ratings[s.id] !== undefined).length;

  const subtitle = [
    pos.cycleDay !== null ? `Dzień ${pos.cycleDay} cyklu` : null,
    isBleeding(entry?.flow) ? 'okres' : null,
    ovulation ? 'szacowana owulacja' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="screen screen--day">
      <DayBar date={date} subtitle={subtitle || 'Wpis dnia'} saveState={saveState} />

      <div className="jump-chips">
        <button type="button" className="jump-chip jump-chip--pmdd" onClick={() => scrollTo('sec-pmdd')}>
          PMDD{' '}
          <span>
            {answered(pmdd)}/{pmdd.length}
          </span>
        </button>
        <button type="button" className="jump-chip jump-chip--pms" onClick={() => scrollTo('sec-pms')}>
          PMS{' '}
          <span>
            {answered(pms)}/{pms.length}
          </span>
        </button>
      </div>

      {/* Na początek dnia */}
      <section className="card" aria-labelledby="basics-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="basics-title">
              Na początek
            </h2>
            <p className="card-sub">Sen, ruch i krwawienie</p>
          </div>
        </div>

        <div className="q">
          <p className="q-label" id="q-sleepq">
            <IconMoon size={18} style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--sage-700)' }} />
            Jak spałaś ostatniej nocy?
          </p>
          <ChoiceGroup
            label="Jak spałaś ostatniej nocy?"
            options={SLEEP_QUALITY.map((s) => ({ value: s.value, label: s.label }))}
            value={entry?.sleepQuality}
            onChange={(v) => update((e) => ({ ...e, sleepQuality: v }))}
          />
        </div>

        <div className="q">
          <p className="q-label">Ile godzin spałaś?</p>
          <Stepper
            label="Godziny snu"
            value={entry?.sleepHours}
            onChange={(v) => update((e) => ({ ...e, sleepHours: v }))}
            min={0}
            max={16}
            step={0.5}
            start={7}
            unit="h"
          />
          {entry?.sleepHours !== undefined && (
            <button
              type="button"
              className="btn btn--ghost btn--small stepper-clear"
              onClick={() => update((e) => ({ ...e, sleepHours: undefined }))}
            >
              Wyczyść
            </button>
          )}
        </div>

        <div className="q">
          <p className="q-label">
            <IconWalk size={18} style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--sage-700)' }} />
            Czy była dziś aktywność fizyczna?
          </p>
          <ChoiceGroup
            label="Czy była dziś aktywność fizyczna?"
            options={[
              { value: true, label: 'Tak' },
              { value: false, label: 'Nie' },
            ]}
            value={entry?.activity}
            onChange={(v) => update((e) => ({ ...e, activity: v }))}
          />
          {entry?.activity && (
            <div className="q-sub">
              <p className="q-label">Ile minut?</p>
              <Stepper
                label="Minuty aktywności"
                value={entry.activityMinutes}
                onChange={(v) => update((e) => ({ ...e, activityMinutes: v }))}
                min={5}
                max={600}
                step={5}
                start={30}
                unit="min"
              />
              <p className="q-label" style={{ marginTop: 14 }}>
                Intensywność
              </p>
              <ChoiceGroup
                label="Intensywność aktywności"
                options={INTENSITY.map((i) => ({ value: i.value, label: i.label, ariaLabel: `${i.label}, ${i.hint}` }))}
                value={entry.activityIntensity}
                onChange={(v) => update((e) => ({ ...e, activityIntensity: v }))}
              />
            </div>
          )}
        </div>

        <div className="q">
          <p className="q-label">
            <IconDrop size={17} style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--rose-600)' }} />
            Krwawienie (okres)
          </p>
          <ChoiceGroup<Flow>
            label="Krwawienie"
            options={FLOW.map((f) => ({ value: f.value, label: f.label }))}
            value={entry?.flow === 'period' ? undefined : entry?.flow}
            onChange={(v) => setFlow(date, v)}
            optionClassName="choice--flow"
          />
          {entry?.flow === 'period' ? (
            <p className="q-hint period-hint">
              <IconDrop size={14} style={{ color: 'var(--rose-600)', verticalAlign: '-2px' }} />{' '}
              {entry.periodAuto ? 'Dzień okresu zaznaczony automatycznie.' : 'Dzień okresu zaznaczony w kalendarzu.'} Możesz podać ilość krwawienia.
              Wybierz „Brak”, jeśli okres już się skończył.
            </p>
          ) : (
            <p className="q-hint">
              Pierwszy dzień krwawienia to 1. dzień cyklu. Zaznaczę wtedy cały okres ({periodLength} {plDays(periodLength)}), a Ty możesz go skrócić
              lub przedłużyć. Plamienie nie rozpoczyna okresu.
            </p>
          )}
          {ovulation && (
            <p className="q-hint">
              <IconFlower size={14} style={{ color: 'var(--honey-600)', verticalAlign: '-2px' }} /> To szacowany dzień owulacji (14 dni przed
              okresem).
            </p>
          )}
        </div>
      </section>

      <Section id="sec-pmdd" section="pmdd" symptoms={pmdd} entry={entry} onRate={onRate} onEvent={onEvent} onFillRest={fillRest} />

      <Section id="sec-pms" section="pms" symptoms={pms} entry={entry} onRate={onRate} onEvent={onEvent} onFillRest={fillRest} />

      <section className="card" aria-labelledby="note-title">
        <h2 className="card-title" id="note-title" style={{ marginBottom: 10 }}>
          Notatka dnia
        </h2>
        <label className="visually-hidden" htmlFor="day-note">
          Notatka dnia
        </label>
        <textarea
          id="day-note"
          className="textarea"
          maxLength={4000}
          placeholder="Co jeszcze chcesz zapamiętać? Leki, alkohol, choroba, ważne wydarzenia..."
          value={entry?.note ?? ''}
          onChange={(ev) => {
            const note = ev.target.value;
            update((e) => ({ ...e, note: note || undefined }));
          }}
        />
      </section>

      {entry && (
        <div className="danger-link">
          <button type="button" className="btn btn--ghost btn--small" style={{ color: 'var(--berry-700)' }} onClick={() => setConfirmDelete(true)}>
            <IconTrash size={16} /> Usuń wpis z tego dnia
          </button>
        </div>
      )}

      <div className="done-bar">
        <div className="done-bar-inner">
          <button type="button" className="btn btn--primary btn--block" onClick={() => void done()}>
            <IconCheck size={20} /> Gotowe
          </button>
        </div>
      </div>

      {confirmDelete && (
        <Sheet title="Usunąć wpis?" onClose={() => setConfirmDelete(false)}>
          <p>Wszystkie odpowiedzi z dnia {formatShort(date)} zostaną usunięte z tego urządzenia. Tego nie da się cofnąć.</p>
          <div className="sheet-actions">
            <button type="button" className="btn btn--danger-solid btn--block" onClick={() => void remove()}>
              Usuń wpis
            </button>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirmDelete(false)}>
              Zostaw
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function DayBar({ date, subtitle, saveState }: { date: ISODate; subtitle: string; saveState: string }) {
  return (
    <div className="day-bar">
      <button type="button" className="icon-btn" aria-label="Wróć do kalendarza" onClick={() => goBack()}>
        <IconBack />
      </button>
      <div className="day-bar-title">
        <h1>{formatLong(date).replace(/ \d{4}$/, '')}</h1>
        <p>{subtitle}</p>
      </div>
      <span className={`save-state ${saveState === 'error' ? 'is-error' : ''}`} aria-live="polite">
        {saveState === 'pending' && 'Zapisuję...'}
        {saveState === 'saved' && (
          <>
            <IconCheck size={14} /> Zapisano
          </>
        )}
        {saveState === 'error' && (
          <>
            <IconAlert size={14} /> Błąd zapisu
          </>
        )}
      </span>
    </div>
  );
}

interface SectionProps {
  id: string;
  section: SectionId;
  symptoms: Symptom[];
  entry: DayEntry | undefined;
  onRate: (id: string, v: Rating | undefined) => void;
  onEvent: (id: string, note: string | undefined) => void;
  onFillRest: (list: Symptom[]) => void;
  children?: React.ReactNode;
}

function Section({ id, section, symptoms, entry, onRate, onEvent, onFillRest, children }: SectionProps) {
  const answered = symptoms.filter((s) => entry?.ratings[s.id] !== undefined).length;
  const groups: { name: string; items: Symptom[] }[] = [];
  symptoms.forEach((s) => {
    const g = groups[groups.length - 1];
    if (g && g.name === s.group) g.items.push(s);
    else groups.push({ name: s.group, items: [s] });
  });
  const isPmdd = section === 'pmdd';
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className={`section-head section-head--${section}`} id={id}>
        <Sprig
          className="section-sprig"
          leaf={isPmdd ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)'}
          stem={isPmdd ? 'rgba(255,255,255,0.3)' : 'rgba(52,70,50,0.25)'}
          leaves={7}
        />
        <h2 id={`${id}-title`}>{isPmdd ? 'PMDD' : 'PMS i okres'}</h2>
        <p>
          {isPmdd
            ? 'Kwestionariusz DRSP, polecany do codziennego śledzenia PMDD. Oceń, jak było dziś.'
            : 'Objawy fizyczne cyklu, których nie ma w DRSP.'}
        </p>
        <div className="scale-legend" aria-hidden="true">
          <span>1 = nie czułam</span>
          <span>5 = silnie</span>
          <span>ponad skalę = nie do opisania</span>
        </div>
        <span className="section-badge">
          {answered} z {symptoms.length}
        </span>
      </div>

      {groups.map((g) => (
        <Fragment key={g.name}>
          <h3 className="group-title">{g.name}</h3>
          {g.items.map((s) => (
            <SymptomItem key={s.id} symptom={s} value={entry?.ratings[s.id]} event={entry?.events[s.id]} onRate={onRate} onEvent={onEvent} />
          ))}
        </Fragment>
      ))}

      {children}

      {answered < symptoms.length && (
        <div className="quick-fill">
          <button type="button" className="btn btn--outline btn--small" onClick={() => onFillRest(symptoms)}>
            Pozostałe w tej sekcji: nie czułam (1)
          </button>
        </div>
      )}
    </section>
  );
}
