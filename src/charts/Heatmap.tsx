import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ratingOf, type AnalysisOptions, type EntryMap } from '../lib/analysis';
import { addDays, diffDays, formatDayMonth, formatShort } from '../lib/dates';
import { isBleeding, ratingLabel } from '../lib/questionnaire';
import type { ISODate, Symptom } from '../lib/types';
import { C, SEV, sevColor, sevInk } from './common';

interface Props {
  start: ISODate;
  /** ostatni dzień do pokazania (koniec cyklu albo dziś) */
  end: ISODate;
  /** czy znamy początek kolejnego okresu (wtedy zaznaczamy tydzień przed) */
  complete: boolean;
  symptoms: Symptom[];
  byDate: EntryMap;
  opts: AnalysisOptions;
  ovulations: Set<ISODate>;
}

const ROW_H = 18;
const HEAD_H = 34;

export function Heatmap({ start, end, complete, symptoms, byDate, opts, ovulations }: Props) {
  const [numbers, setNumbers] = useState(false);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const checkEnd = () => {
    const el = scroller.current;
    if (el) setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };
  useLayoutEffect(checkEnd);
  const days = Math.max(1, diffDays(end, start) + 1);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const cellW = numbers ? 20 : 13;
  const gap = 2;
  const colX = (c: number) => c * (cellW + gap);
  const gridW = days * (cellW + gap);

  // tylko objawy, które mają jakiekolwiek oceny w tym cyklu
  const rows = useMemo(() => symptoms.filter((s) => dates.some((d) => byDate.get(d)?.ratings[s.id] !== undefined)), [symptoms, dates, byDate]);
  const firstPms = rows.findIndex((s) => s.section === 'pms');
  const rowY = (r: number) => HEAD_H + r * ROW_H + (firstPms !== -1 && r >= firstPms ? 10 : 0);
  const gridH = rowY(rows.length) + 4;
  const preFrom = complete ? Math.max(0, days - 7) : -1;

  if (!rows.length) return <p className="muted small">W tym cyklu nie ma jeszcze ocen objawów.</p>;

  const selInfo = sel && rows[sel.r] ? describe(rows[sel.r], dates[sel.c], sel.c + 1, byDate, opts) : null;

  return (
    <div>
      <div className="heatmap">
        <div className="heatmap-labels" style={{ height: gridH }}>
          {rows.map((s, r) => (
            <span key={s.id} className={`heatmap-label heatmap-label--${s.section}`} style={{ top: rowY(r), height: ROW_H }} title={s.label}>
              {s.short}
            </span>
          ))}
        </div>
        <div className={`heatmap-scroll ${atEnd ? 'is-end' : ''}`} ref={scroller} onScroll={checkEnd}>
          <svg
            width={gridW}
            height={gridH}
            role="img"
            aria-label={`Mapa objawów cyklu od ${formatDayMonth(start)}: ${rows.length} objawów, ${days} dni. Włącz liczby, by odczytać wartości.`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - rect.left;
              const py = e.clientY - rect.top;
              const c = Math.floor(px / (cellW + gap));
              let r = -1;
              rows.forEach((_, i) => {
                if (py >= rowY(i) && py < rowY(i) + ROW_H) r = i;
              });
              if (c >= 0 && c < days && r >= 0) setSel({ r, c });
            }}
          >
            {/* tło: tydzień po okresie (dni 4-10) i przed okresem (ostatnie 7 dni) */}
            {days >= 4 && <rect x={colX(3) - 1} y={0} width={colX(Math.min(10, days)) - colX(3)} height={gridH} fill={C.postWindow} rx={4} />}
            {preFrom >= 0 && <rect x={colX(preFrom) - 1} y={0} width={colX(days) - colX(preFrom)} height={gridH} fill={C.preWindow} rx={4} />}

            {dates.map((d, c) => {
              const e = byDate.get(d);
              const bleeding = isBleeding(e?.flow);
              const spotting = e?.flow === 'spotting';
              const dayNo = c + 1;
              const label = dayNo === 1 || dayNo % 5 === 0 || c === days - 1;
              return (
                <g key={d}>
                  {label && (
                    <text x={colX(c) + cellW / 2} y={11} fontSize={10} textAnchor="middle" fill={C.ink3} className="tabular">
                      {dayNo}
                    </text>
                  )}
                  {(bleeding || spotting) && <rect x={colX(c)} y={17} width={cellW} height={7} rx={2} fill={bleeding ? C.period : C.periodLight} />}
                  {ovulations.has(d) && <circle cx={colX(c) + cellW / 2} cy={20.5} r={3.6} fill={C.ovulation} />}
                </g>
              );
            })}

            {rows.map((s, r) =>
              dates.map((d, c) => {
                const e = byDate.get(d);
                const v = e?.ratings[s.id];
                const hasEvent = !!e && Object.prototype.hasOwnProperty.call(e.events, s.id);
                const excluded = hasEvent && opts.excludeEvents;
                const yy = rowY(r);
                const isSel = sel?.r === r && sel?.c === c;
                return (
                  <g key={`${s.id}-${d}`}>
                    {v !== undefined ? (
                      <rect
                        x={colX(c)}
                        y={yy + 1}
                        width={cellW}
                        height={ROW_H - 3}
                        rx={3}
                        fill={sevColor(v)}
                        opacity={excluded ? 0.35 : 1}
                        stroke={isSel ? C.ink : 'none'}
                        strokeWidth={isSel ? 1.5 : 0}
                      />
                    ) : (
                      <rect x={colX(c) + cellW / 2 - 1} y={yy + ROW_H / 2 - 2} width={2} height={2} rx={1} fill={C.axis} />
                    )}
                    {numbers && v !== undefined && (
                      <text x={colX(c) + cellW / 2} y={yy + ROW_H / 2 + 3} fontSize={10} fontWeight={650} textAnchor="middle" fill={sevInk(v)}>
                        {v}
                      </text>
                    )}
                    {hasEvent && !numbers && (
                      <circle cx={colX(c) + cellW - 3} cy={yy + 4} r={2.4} fill={v !== undefined && v >= 5 ? '#fff' : C.ink} />
                    )}
                  </g>
                );
              }),
            )}
          </svg>
        </div>
      </div>

      {selInfo && (
        <p className="heatmap-detail" aria-live="polite">
          {selInfo}
        </p>
      )}

      <div className="chart-legend" style={{ marginTop: 10 }}>
        <span className="legend-item">
          <span className="legend-ramp" aria-hidden="true">
            {SEV.map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
          1 do 5, ostatni kolor: ponad skalę
        </span>
        <span className="legend-item">
          <i className="lk-dot" style={{ background: C.ink, width: 6, height: 6 }} /> Zdarzenie powiązane
        </span>
        <span className="legend-item">
          <i className="lk-band lk-band--post" /> Dni 4 do 10
        </span>
        {complete && (
          <span className="legend-item">
            <i className="lk-band lk-band--pre" /> 7 dni przed okresem
          </span>
        )}
      </div>
      <div className="chart-foot">
        <span className="muted small">Stuknij kratkę, by zobaczyć szczegóły.</span>
        <button type="button" className="btn btn--ghost btn--small" aria-pressed={numbers} onClick={() => setNumbers((v) => !v)}>
          {numbers ? 'Ukryj liczby' : 'Pokaż liczby'}
        </button>
      </div>
    </div>
  );
}

function describe(s: Symptom, date: ISODate, cycleDay: number, byDate: EntryMap, opts: AnalysisOptions): string {
  const e = byDate.get(date);
  const v = e?.ratings[s.id];
  const base = `Dzień ${cycleDay} (${formatShort(date)}) · ${s.short}: `;
  if (v === undefined) return `${base}brak oceny`;
  const ev = e && Object.prototype.hasOwnProperty.call(e.events, s.id) ? e.events[s.id] : undefined;
  const counted = ratingOf(e, s.id, opts) !== undefined;
  return `${base}${v === 6 ? 'ponad skalę' : `${v}, ${ratingLabel(v).toLowerCase()}`}${
    ev !== undefined ? ` · zdarzenie powiązane${ev ? `: ${ev}` : ''}${counted ? '' : ' (pominięte w analizie)'}` : ''
  }`;
}
