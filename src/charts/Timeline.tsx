import { useMemo, useState } from 'react';
import type { SeriesPoint } from '../lib/analysis';
import { formatShort, formatWeekdayDayMonth } from '../lib/dates';
import { flowLabel, isBleeding } from '../lib/questionnaire';
import type { ISODate } from '../lib/types';
import { C, TableToggle, fmt1, useWidth } from './common';

interface Props {
  points: SeriesPoint[];
  ovulations: Set<ISODate>;
  preWindows: [ISODate, ISODate][];
}

const PAD_L = 24;
const PAD_R = 10;
const PLOT_H = 92;
const TITLE_H = 22;
const BAND_H = 16;
const AXIS_H = 20;

const SERIES = [
  { key: 'pmdd' as const, title: 'PMDD: średnia z DRSP 1-21', color: C.pmdd },
  { key: 'pms' as const, title: 'PMS: średnia objawów', color: C.pms },
];

export function Timeline({ points, ovulations, preWindows }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = points.length;
  const plotW = Math.max(10, width - PAD_L - PAD_R);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? PAD_L + i * step : PAD_L + plotW / 2);
  const y = (v: number, top: number) => top + ((6 - v) / 5) * PLOT_H;
  const idx = useMemo(() => new Map(points.map((p, i) => [p.date, i])), [points]);
  const blocks = SERIES.map((s, k) => ({ ...s, top: k * (TITLE_H + PLOT_H + 12) + TITLE_H }));
  const bandTop = blocks[1].top + PLOT_H + 8;
  const totalH = bandTop + BAND_H + AXIS_H;
  const showDots = n <= 35;

  const ticks = useMemo(() => {
    const k = Math.min(n, width < 380 ? 4 : 6);
    if (k <= 1) return n ? [0] : [];
    return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
  }, [n, width]);

  const onMove = (clientX: number, rect: DOMRect) => {
    if (!n) return;
    const i = n > 1 ? Math.round((clientX - rect.left - PAD_L) / step) : 0;
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => {
      const cur = h ?? n - 1;
      return Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  const hp = hover !== null ? points[hover] : null;
  const withData = points.filter((p) => p.pmdd !== null || p.pms !== null);

  return (
    <div>
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <i className="lk-band lk-band--pre" /> Tydzień przed okresem
        </span>
        <span className="legend-item">
          <i className="lk-bar" style={{ background: C.period }} /> Okres
        </span>
        <span className="legend-item">
          <i className="lk-dot" style={{ background: C.ovulation }} /> Szacowana owulacja
        </span>
      </div>

      {table ? (
        <div className="table-scroll" style={{ maxHeight: 360 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dzień</th>
                <th className="num">PMDD</th>
                <th className="num">PMS</th>
                <th className="num">Sen</th>
                <th>Okres</th>
              </tr>
            </thead>
            <tbody>
              {[...withData].reverse().map((p) => (
                <tr key={p.date}>
                  <td>
                    {formatShort(p.date)}
                    {p.cycleDay ? <span className="muted"> · dz. {p.cycleDay}</span> : null}
                  </td>
                  <td className="num">{fmt1(p.pmdd)}</td>
                  <td className="num">{fmt1(p.pms)}</td>
                  <td className="num">{p.sleepHours !== null ? `${fmt1(p.sleepHours)} h` : '-'}</td>
                  <td>{p.flow && p.flow !== 'none' ? flowLabel(p.flow) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="chart-readout" aria-live="polite">
            {hp ? (
              <>
                <strong>
                  {formatWeekdayDayMonth(hp.date)}
                  {hp.cycleDay !== null && <span className="muted"> · dzień {hp.cycleDay} cyklu</span>}
                </strong>
                <span className="tip-row">
                  <i style={{ background: C.pmdd }} />
                  PMDD <b>{fmt1(hp.pmdd)}</b>
                </span>
                <span className="tip-row">
                  <i style={{ background: C.pms }} />
                  PMS <b>{fmt1(hp.pms)}</b>
                </span>
                {hp.sleepHours !== null && <span className="tip-sub">sen {fmt1(hp.sleepHours)} h</span>}
                {hp.flow && hp.flow !== 'none' && <span className="tip-sub">{flowLabel(hp.flow).toLowerCase()} krwawienie</span>}
                {ovulations.has(hp.date) && <span className="tip-sub">szacowana owulacja</span>}
              </>
            ) : (
              <span className="muted">Dotknij wykresu, by zobaczyć wartości z danego dnia.</span>
            )}
          </div>
          <div
            ref={ref}
            className="chart-frame"
            tabIndex={0}
            role="group"
            aria-roledescription="wykres"
            aria-label={`Wykres nasilenia objawów dzień po dniu, ${withData.length} dni z ocenami. Użyj strzałek, by przeglądać dni, albo pokaż tabelę.`}
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            style={{ height: totalH }}
          >
            {width > 0 && (
              <svg width={width} height={totalH} aria-hidden="true">
                {/* tygodnie przed okresem */}
                {preWindows.map(([a, b], k) => {
                  const ia = idx.get(a) ?? (a < points[0]?.date ? 0 : undefined);
                  const ib = idx.get(b) ?? (b > points[n - 1]?.date ? n - 1 : undefined);
                  if (ia === undefined || ib === undefined || ib < ia) return null;
                  const x0 = x(ia) - step / 2;
                  const x1 = x(ib) + step / 2;
                  return (
                    <rect
                      key={k}
                      x={Math.max(PAD_L, x0)}
                      y={blocks[0].top}
                      width={Math.max(2, Math.min(PAD_L + plotW, x1) - Math.max(PAD_L, x0))}
                      height={bandTop + BAND_H - blocks[0].top}
                      fill={C.preWindow}
                    />
                  );
                })}

                {blocks.map((b) => (
                  <g key={b.key}>
                    <text x={PAD_L} y={b.top - 8} fontSize={12.5} fontWeight={650} fill={C.ink2}>
                      {b.title}
                    </text>
                    {[1, 2, 3, 4, 5, 6].map((v) => (
                      <g key={v}>
                        <line x1={PAD_L} x2={PAD_L + plotW} y1={y(v, b.top)} y2={y(v, b.top)} stroke={v === 1 ? C.axis : C.grid} strokeWidth={1} />
                        <text x={PAD_L - 7} y={y(v, b.top) + 3.5} fontSize={10} textAnchor="end" fill={C.ink3} className="tabular">
                          {v}
                        </text>
                      </g>
                    ))}
                    <Series points={points} k={b.key} color={b.color} x={x} y={(v) => y(v, b.top)} baseline={y(1, b.top)} showDots={showDots} />
                    {hp && hp[b.key] !== null && (
                      <circle cx={x(hover as number)} cy={y(hp[b.key] as number, b.top)} r={5} fill={b.color} stroke={C.surface} strokeWidth={2} />
                    )}
                  </g>
                ))}

                {/* pasek cyklu: okres i owulacja */}
                {points.map((p, i) => {
                  const bleeding = isBleeding(p.flow);
                  const spotting = p.flow === 'spotting';
                  const ov = ovulations.has(p.date);
                  if (!bleeding && !spotting && !ov) return null;
                  const w = Math.max(3, Math.min(10, step - 1));
                  return (
                    <g key={p.date}>
                      {(bleeding || spotting) && (
                        <rect x={x(i) - w / 2} y={bandTop + 3} width={w} height={8} rx={2} fill={bleeding ? C.period : C.periodLight} />
                      )}
                      {ov && <circle cx={x(i)} cy={bandTop + 7} r={4} fill={C.ovulation} stroke={C.surface} strokeWidth={1.5} />}
                    </g>
                  );
                })}

                {ticks.map((i) => (
                  <text key={i} x={x(i)} y={totalH - 5} fontSize={11} fill={C.ink3} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                    {formatShort(points[i].date)}
                  </text>
                ))}

                {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={blocks[0].top} y2={bandTop + BAND_H} stroke={C.ink2} strokeWidth={1} />}
              </svg>
            )}
          </div>
        </>
      )}
      <div className="chart-foot">
        <TableToggle on={table} onToggle={() => setTable((v) => !v)} />
      </div>
    </div>
  );
}

function Series({
  points,
  k,
  color,
  x,
  y,
  baseline,
  showDots,
}: {
  points: SeriesPoint[];
  k: 'pmdd' | 'pms';
  color: string;
  x: (i: number) => number;
  y: (v: number) => number;
  baseline: number;
  showDots: boolean;
}) {
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    const v = p[k];
    if (v === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v });
  });
  if (cur.length) segments.push(cur);
  return (
    <g>
      {segments.map((seg, s) => {
        const line = seg.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
        const area = `${line} L${x(seg[seg.length - 1].i).toFixed(1)} ${baseline} L${x(seg[0].i).toFixed(1)} ${baseline} Z`;
        return (
          <g key={s}>
            {seg.length > 1 && <path d={area} fill={color} opacity={0.1} />}
            {seg.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {(showDots || seg.length === 1) &&
              seg.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={seg.length === 1 ? 3.5 : 2.5} fill={color} stroke={C.surface} strokeWidth={1.5} />
              ))}
          </g>
        );
      })}
    </g>
  );
}
