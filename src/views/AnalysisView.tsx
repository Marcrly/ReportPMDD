import { useEffect, useMemo, useState } from 'react';
import {
  RANGE_LABEL,
  aggregateItems,
  compareOnsets,
  dailySeries,
  hasAnyAnswer,
  lifestyleBreakdown,
  listEvents,
  phaseDates,
  phaseStats,
  rangeStart,
  type PhaseStats,
  type RangeKey,
} from '../lib/analysis';
import { addDays, diffDays, formatDayMonth, formatShort, fromDayIndex, dayIndex, plural } from '../lib/dates';
import { DOMAINS, allSymptoms, ratingLabel } from '../lib/questionnaire';
import { hrefFor, navigate } from '../lib/router';
import type { ISODate } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Bouquet } from '../components/Botanical';
import { IconCheckCircle, IconChevronLeft, IconChevronRight, IconInfo } from '../components/Icons';
import { Dumbbell } from '../charts/Dumbbell';
import { Heatmap } from '../charts/Heatmap';
import { Timeline } from '../charts/Timeline';
import { fmt1 } from '../charts/common';

const RANGES: RangeKey[] = ['1m', '3m', '6m', 'all'];
const RANGE_KEY = 'rp1.ui.range';

function loadRange(): RangeKey {
  try {
    const v = localStorage.getItem(RANGE_KEY) as RangeKey | null;
    return v && RANGES.includes(v) ? v : '3m';
  } catch {
    return '3m';
  }
}

export function AnalysisView() {
  const { entries, info, today, meta } = useApp();
  const [range, setRange] = useState<RangeKey>(loadRange);
  const [excludeEvents, setExcludeEvents] = useState(false);
  const [cycleIdx, setCycleIdx] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(RANGE_KEY, range);
    } catch {
      /* tryb prywatny: pomijamy */
    }
  }, [range]);

  const opts = useMemo(() => ({ excludeEvents }), [excludeEvents]);
  const list = useMemo(() => [...entries.values()].filter(hasAnyAnswer), [entries]);
  const firstDate = useMemo(() => (list.length ? list.reduce((m, e) => (e.date < m ? e.date : m), list[0].date) : null), [list]);
  const from = rangeStart(range, today, firstDate);
  const symptoms = useMemo(() => allSymptoms(meta.customSymptoms, true), [meta.customSymptoms]);
  const pmsIds = useMemo(() => symptoms.filter((s) => s.section === 'pms').map((s) => s.id), [symptoms]);

  const points = useMemo(() => dailySeries(entries, from, today, pmsIds, opts, info), [entries, from, today, pmsIds, opts, info]);
  const preWindows = useMemo(
    () => info.starts.map((s) => [addDays(s, -7), addDays(s, -1)] as [ISODate, ISODate]).filter(([, b]) => b >= from),
    [info.starts, from],
  );
  const comps = useMemo(() => compareOnsets(info, entries, symptoms, opts, today, from), [info, entries, symptoms, opts, today, from]);
  const rows = useMemo(() => {
    const byId = new Map(symptoms.map((s) => [s.id, s]));
    return aggregateItems(comps, symptoms)
      .filter((a) => a.n > 0 && a.diff !== null)
      .map((a) => ({ ...a, symptom: byId.get(a.id)! }))
      .sort((a, b) => (b.diff as number) - (a.diff as number));
  }, [comps, symptoms]);

  const rangeDates = useMemo(() => {
    const out: ISODate[] = [];
    for (let i = dayIndex(from); i <= dayIndex(today); i++) out.push(fromDayIndex(i));
    return out;
  }, [from, today]);
  const phases = useMemo(() => phaseDates(comps), [comps]);
  const pre = useMemo(() => phaseStats(phases.pre, entries, opts), [phases, entries, opts]);
  const post = useMemo(() => phaseStats(phases.post, entries, opts), [phases, entries, opts]);
  const all = useMemo(() => phaseStats(rangeDates, entries, opts), [rangeDates, entries, opts]);
  const lifestyle = useMemo(() => lifestyleBreakdown(rangeDates, entries, opts), [rangeDates, entries, opts]);
  const events = useMemo(() => listEvents(entries.values(), from), [entries, from]);

  const cyclesInRange = info.cycles.filter((c) => (c.end ?? today) >= from);
  // Domyślnie ostatni pełny cykl (bieżący zwykle ma za mało dni, by coś pokazać).
  const lastComplete = cyclesInRange.map((c) => c.complete).lastIndexOf(true);
  const ongoing = cyclesInRange[cyclesInRange.length - 1];
  const defaultIdx =
    ongoing && !ongoing.complete && diffDays(today, ongoing.start) < 14 && lastComplete !== -1 ? lastComplete : cyclesInRange.length - 1;
  const currentIdx = Math.min(cycleIdx ?? defaultIdx, cyclesInRange.length - 1);
  const shownCycle = cyclesInRange[currentIdx] ?? null;
  const symptomById = useMemo(() => new Map(symptoms.map((s) => [s.id, s])), [symptoms]);

  const evaluatedComps = comps.filter((c) => c.domainsEvaluated > 0).length;
  const topDomains = useMemo(() => {
    const counts = new Map<string, number>();
    comps.forEach((c) => c.domainsMet.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1)));
    return DOMAINS.filter((d) => counts.has(d.id))
      .map((d) => ({ label: d.label, count: counts.get(d.id) as number }))
      .sort((a, b) => b.count - a.count);
  }, [comps]);

  const daysLogged = list.filter((e) => e.date >= from).length;
  const completeCycles = cyclesInRange.filter((c) => c.complete).length;

  if (!list.length) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 className="screen-title">Analiza</h1>
          <p className="screen-sub">Wzorce z Twoich wpisów</p>
        </header>
        <div className="card empty">
          <Bouquet size={150} />
          <strong>Tu pojawią się wykresy</strong>
          <p>
            Wypełniaj dziennik co wieczór. Pierwsze wykresy zobaczysz po kilku wpisach, a porównanie „przed okresem i po okresie” po pierwszym okresie
            z wpisami z obu tygodni.
          </p>
          <a
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            href={hrefFor.day(today)}
            onClick={(e) => {
              e.preventDefault();
              navigate(hrefFor.day(today));
            }}
          >
            Wypełnij dzisiejszy wpis
          </a>
        </div>
      </main>
    );
  }

  const firstComparison = info.prediction?.periods[0] ? addDays(info.prediction.periods[0].start, 9) : null;

  return (
    <main className="screen">
      <div className="filters" role="group" aria-label="Zakres analizy">
        <div className="segmented" role="group" aria-label="Zakres dat">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="inline-switch">
          <input type="checkbox" role="switch" className="switch" checked={excludeEvents} onChange={(e) => setExcludeEvents(e.target.checked)} />
          Pomiń zdarzenia powiązane
        </label>
      </div>

      <header className="screen-header" style={{ minHeight: 0, paddingTop: 0 }}>
        <h1 className="screen-title" style={{ marginTop: 0 }}>
          Analiza
        </h1>
        <p className="screen-sub">
          {formatDayMonth(from)} do {formatDayMonth(today)}. To wskazówki do rozmowy z lekarzem, nie diagnoza.
        </p>
      </header>

      <div className="kpis">
        <div className="stat">
          <p className="stat-label">Dni z wpisem</p>
          <p className="stat-value">{daysLogged}</p>
          <p className="stat-note">z {diffDays(today, from) + 1} w zakresie</p>
        </div>
        <div className="stat">
          <p className="stat-label">Pełne cykle</p>
          <p className="stat-value">{completeCycles}</p>
          <p className="stat-note">w zakresie</p>
        </div>
        <div className="stat">
          <p className="stat-label">Średni cykl</p>
          <p className="stat-value">
            {info.stats.avgCycle !== null ? fmt1(info.stats.avgCycle) : '...'}
            <small>dni</small>
          </p>
          <p className="stat-note">
            ostatnie {info.stats.cycleLengths.length || 0} {plural(info.stats.cycleLengths.length, ['cykl', 'cykle', 'cykli'])}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Średni okres</p>
          <p className="stat-value">
            {info.stats.avgPeriod !== null ? fmt1(info.stats.avgPeriod) : '...'}
            <small>dni</small>
          </p>
          <p className="stat-note">ostatnie {info.stats.periodLengths.length || 0}</p>
        </div>
      </div>

      <section className="card" aria-labelledby="tl-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="tl-title">
              Dzień po dniu
            </h2>
            <p className="card-sub">Średnie nasilenie na skali 1-6. Różowe tło to tydzień przed okresem.</p>
          </div>
        </div>
        <Timeline points={points} ovulations={info.ovulationDays} preWindows={preWindows} />
      </section>

      <section className="card" aria-labelledby="cmp-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="cmp-title">
              Przed okresem a po okresie
            </h2>
            <p className="card-sub">Średnia z 7 dni przed okresem i z dni 4 do 10 od jego początku.</p>
          </div>
        </div>
        {comps.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table summary-table">
                <thead>
                  <tr>
                    <th>Okres od</th>
                    <th className="num">Obszary</th>
                    <th className="num">Nastrój</th>
                    <th className="num">Wpływ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...comps].reverse().map((c) => (
                    <tr key={c.onset}>
                      <td>{formatDayMonth(c.onset)}</td>
                      {c.domainsEvaluated === 0 ? (
                        <td className="num muted" colSpan={3}>
                          za mało wpisów
                        </td>
                      ) : (
                        <>
                          <td className="num">
                            <strong>{c.domainsMet.length}</strong> z 11
                          </td>
                          <td className="num">{c.coreDomainsMet.length} z 4</td>
                          <td className="num">{c.impairmentEvaluated ? (c.impairmentMet ? 'tak' : 'nie') : '?'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topDomains.length > 0 && (
              <p className="summary-note">
                <IconCheckCircle size={18} />
                <span>
                  <strong>Najczęściej silniejsze przed okresem:</strong>{' '}
                  {topDomains.map((d) => `${d.label.toLowerCase()} (${d.count} z ${evaluatedComps})`).join('; ')}.
                </span>
              </p>
            )}
            <p className="muted small" style={{ margin: '2px 0 14px' }}>
              Obszary: ile z 11 obszarów objawów DSM-5 było wyraźnie silniejszych w tygodniu przed okresem niż w dniach 4 do 10. Nastrój: ile z 4
              obszarów nastroju. Wpływ: czy objawy przed okresem utrudniały pracę, spotkania lub relacje.
            </p>
            {rows.length > 0 && <Dumbbell rows={rows} cycles={comps.length} />}
          </>
        ) : (
          <div className="hint-box">
            Porównanie pojawi się, gdy będzie okres z co najmniej 4 wpisami w tygodniu przed nim i 4 wpisami w dniach 4 do 10 po jego rozpoczęciu.
            {firstComparison && firstComparison > today && <> Przy regularnych wpisach: ok. {formatDayMonth(firstComparison)}.</>}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="hm-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="hm-title">
              Mapa objawów w cyklu
            </h2>
            <p className="card-sub">Każda kratka to jeden dzień. Im ciemniej, tym silniej.</p>
          </div>
        </div>
        {shownCycle ? (
          <>
            <div className="cycle-pager">
              <button
                type="button"
                className="icon-btn"
                aria-label="Poprzedni cykl"
                disabled={currentIdx <= 0}
                onClick={() => setCycleIdx(currentIdx - 1)}
              >
                <IconChevronLeft />
              </button>
              <p className="cycle-pager-label" aria-live="polite">
                Cykl od {formatDayMonth(shownCycle.start)}
                <small>
                  {shownCycle.complete
                    ? `${shownCycle.length} dni, do ${formatShort(shownCycle.end as string)}`
                    : `trwa, dzień ${diffDays(today, shownCycle.start) + 1}`}
                </small>
              </p>
              <button
                type="button"
                className="icon-btn"
                aria-label="Następny cykl"
                disabled={currentIdx >= cyclesInRange.length - 1}
                onClick={() => setCycleIdx(currentIdx + 1)}
              >
                <IconChevronRight />
              </button>
            </div>
            <Heatmap
              key={shownCycle.start}
              start={shownCycle.start}
              end={shownCycle.end ?? today}
              complete={shownCycle.complete}
              symptoms={symptoms}
              byDate={entries}
              opts={opts}
              ovulations={info.ovulationDays}
            />
          </>
        ) : (
          <div className="hint-box">Mapa pojawi się po zaznaczeniu pierwszego dnia okresu (w kalendarzu: Zaznacz okres).</div>
        )}
      </section>

      <section className="card" aria-labelledby="sl-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="sl-title">
              Sen i aktywność
            </h2>
            <p className="card-sub">Przed = 7 dni przed okresem, po = dni 4 do 10 cyklu, ogółem = wszystkie dni z wpisem w zakresie.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th />
                <th className="num">Przed</th>
                <th className="num">Po</th>
                <th className="num">Ogółem</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Sen (godz.)" pick={(s) => s.sleepHours} stats={[pre, post, all]} />
              <StatRow label="Jakość snu (1-5)" pick={(s) => s.sleepQuality} stats={[pre, post, all]} />
              <StatRow
                label="Dni z aktywnością"
                pick={(s) => (s.activeShare === null ? null : s.activeShare * 100)}
                stats={[pre, post, all]}
                unit="%"
                decimals={0}
              />
              <StatRow label="Nasilenie PMDD" pick={(s) => s.pmdd} stats={[pre, post, all]} />
              <tr>
                <td>Liczba dni</td>
                <td className="num">{pre.days || '-'}</td>
                <td className="num">{post.days || '-'}</td>
                <td className="num">{all.days || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="group-title" style={{ marginTop: 18 }}>
          Nasilenie PMDD a sen i ruch
        </h3>
        <div className="dotscale">
          {[...lifestyle.sleep, ...lifestyle.activity].map((g) => (
            <div className="dotscale-row" key={g.label}>
              <span>{g.label}</span>
              <span className="dotscale-track" aria-hidden="true">
                {g.pmdd !== null && <i style={{ left: `${((g.pmdd - 1) / 5) * 100}%` }} />}
              </span>
              <span className="value">
                {fmt1(g.pmdd)}{' '}
                <small>
                  ({g.n} {plural(g.n, ['dzień', 'dni', 'dni'])})
                </small>
              </span>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Skala 1-6. To zależność w Twoich danych, a nie dowód, że sen lub ruch zmieniają objawy.
        </p>
      </section>

      <section className="card" aria-labelledby="ev-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="ev-title">
              Zdarzenia powiązane
            </h2>
            <p className="card-sub">Objawy, które mogły mieć przyczynę poza cyklem.</p>
          </div>
        </div>
        {events.length ? (
          <ul className="event-list">
            {events.slice(0, 40).map((ev) => {
              const s = symptomById.get(ev.symptomId);
              return (
                <li key={`${ev.date}-${ev.symptomId}`}>
                  <p className="event-meta">
                    {formatDayMonth(ev.date)} · {s?.section === 'pms' ? 'PMS' : 'PMDD'}
                    {ev.rating ? ` · ${ev.rating === 6 ? 'ponad skalę' : `${ev.rating}, ${ratingLabel(ev.rating).toLowerCase()}`}` : ''}
                  </p>
                  <p className="event-symptom">{s?.short ?? ev.symptomId}</p>
                  {ev.note && <p className="event-text">{ev.note}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted small">Brak zdarzeń w wybranym zakresie.</p>
        )}
      </section>

      <section className="card">
        <details className="details">
          <summary>
            <IconInfo size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Jak to liczymy
          </summary>
          <ul>
            <li>Dzień 1 cyklu to pierwszy dzień krwawienia. Plamienie nie rozpoczyna cyklu.</li>
            <li>Nasilenie PMDD to średnia z 21 objawów kwestionariusza DRSP (pytania 22-24 o wpływ na codzienność liczone są osobno).</li>
            <li>
              Objaw jest „wyraźnie silniejszy przed okresem”, gdy: średnia z 7 dni przed okresem jest wyższa o co najmniej 30% skali niż w dniach 4 do
              10, co najmniej 2 dni przed okresem mają ocenę 4 lub wyższą, a w dniach 4 do 10 żaden dzień nie przekracza 3. Potrzeba min. 4 wpisów w
              każdym z tych okresów.
            </li>
            <li>
              To uproszczona wersja metody C-PASS (Eisenlohr-Moul i in., 2017). W DSM-5 o PMDD mówi się, gdy taki wzorzec obejmuje co najmniej 5
              obszarów objawów, w tym co najmniej 1 obszar nastroju, wpływa na codzienność, powtarza się w większości cykli i potwierdza go lekarz.
            </li>
            <li>Owulacja jest szacowana kalendarzowo: 14 dni przed kolejnym okresem.</li>
            <li>Przełącznik „Pomiń zdarzenia powiązane” wyłącza z obliczeń oceny objawów, przy których zaznaczono zdarzenie.</li>
          </ul>
        </details>
      </section>

      <p className="disclaimer">
        Analiza nie stawia diagnozy. Pokaż wykresy i plik Excel lekarzowi (psychiatrze lub ginekologowi). Do oceny PMDD zaleca się codzienne wpisy
        przez co najmniej 2 cykle.
      </p>
    </main>
  );
}

function StatRow({
  label,
  pick,
  stats,
  unit = '',
  decimals = 1,
}: {
  label: string;
  pick: (s: PhaseStats) => number | null;
  stats: PhaseStats[];
  unit?: string;
  decimals?: number;
}) {
  return (
    <tr>
      <td>{label}</td>
      {stats.map((s, i) => {
        const v = pick(s);
        return (
          <td key={i} className="num">
            {v === null ? '-' : `${decimals === 0 ? Math.round(v) : fmt1(v)}${unit}`}
          </td>
        );
      })}
    </tr>
  );
}
