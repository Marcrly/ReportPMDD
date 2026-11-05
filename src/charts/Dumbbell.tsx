import { useState } from 'react';
import type { ItemAggregate } from '../lib/analysis';
import type { Symptom } from '../lib/types';
import { C, TableToggle, fmt1, fmtSigned, useWidth } from './common';

interface Row extends ItemAggregate {
  symptom: Symptom;
}

interface Props {
  rows: Row[];
  cycles: number;
}

const DOT_R = 5.5;

/**
 * Wykres "hantlowy": dla każdego objawu średnia po okresie (jaśniejsza kropka)
 * i przed okresem (ciemniejsza kropka) na skali 1-6.
 */
const TOP_PER_GROUP = 6;

export function Dumbbell({ rows, cycles }: Props) {
  const [table, setTable] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  const pick = (section: string) => {
    const all = rows.filter((r) => r.symptom.section === section);
    return showAll ? all : all.filter((r, i) => r.met > 0 || i < TOP_PER_GROUP);
  };
  const groups = [
    { key: 'pmdd', title: 'PMDD', rows: pick('pmdd') },
    { key: 'pms', title: 'PMS i okres', rows: pick('pms') },
  ].filter((g) => g.rows.length);
  const hidden = rows.length - groups.reduce((n, g) => n + g.rows.length, 0);

  const labelW = width < 400 ? 128 : 170;
  const deltaW = 44;
  const trackW = Math.max(60, width - labelW - deltaW - 12);
  const sx = (v: number) => 8 + ((v - 1) / 5) * (trackW - 16);

  return (
    <div>
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <i className="lk-dot" style={{ background: C.post }} /> Po okresie (dni 4 do 10)
        </span>
        <span className="legend-item">
          <i className="lk-dot" style={{ background: C.pre }} /> Przed okresem (dni -7 do -1)
        </span>
      </div>

      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Objaw</th>
                <th className="num">Po</th>
                <th className="num">Przed</th>
                <th className="num">Różnica</th>
                <th className="num">Wyraźny wzrost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.symptom.short}</td>
                  <td className="num">{fmt1(r.postMean)}</td>
                  <td className="num">{fmt1(r.preMean)}</td>
                  <td className="num">{fmtSigned(r.diff)}</td>
                  <td className="num">
                    {r.met} z {r.n}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="dumbbell">
          {width > 0 &&
            groups.map((g) => (
              <div key={g.key} className="dumbbell-group">
                <div className="dumbbell-row dumbbell-axis" aria-hidden="true">
                  <span className={`dumbbell-group-title dumbbell-group-title--${g.key}`} style={{ width: labelW }}>
                    {g.title}
                  </span>
                  <svg width={trackW} height={18}>
                    {[1, 2, 3, 4, 5, 6].map((v) => (
                      <text key={v} x={sx(v)} y={13} fontSize={10.5} textAnchor="middle" fill={C.ink3}>
                        {v}
                      </text>
                    ))}
                  </svg>
                  <span className="dumbbell-delta muted" style={{ width: deltaW }}>
                    zmiana
                  </span>
                </div>
                {g.rows.map((r) => {
                  const pre = r.preMean as number;
                  const post = r.postMean as number;
                  const label = `${r.symptom.short}: po okresie ${fmt1(post)}, przed okresem ${fmt1(pre)}, różnica ${fmtSigned(r.diff)}${
                    r.met ? `, wyraźny wzrost w ${r.met} z ${r.n} cykli` : ''
                  }`;
                  return (
                    <div key={r.id} className="dumbbell-row" role="img" aria-label={label} title={label}>
                      <span className="dumbbell-label" style={{ width: labelW }}>
                        {r.symptom.short}
                        {r.met > 0 && (
                          <span className="flag" title={`Wyraźny wzrost przed okresem w ${r.met} z ${r.n} cykli`}>
                            {r.met}/{r.n}
                          </span>
                        )}
                      </span>
                      <svg width={trackW} height={24} aria-hidden="true">
                        {[1, 2, 3, 4, 5, 6].map((v) => (
                          <line key={v} x1={sx(v)} x2={sx(v)} y1={4} y2={20} stroke={C.grid} strokeWidth={1} />
                        ))}
                        <line x1={sx(post)} x2={sx(pre)} y1={12} y2={12} stroke={C.link} strokeWidth={3} strokeLinecap="round" />
                        <circle cx={sx(post)} cy={12} r={DOT_R} fill={C.post} stroke={C.surface} strokeWidth={2} />
                        <circle cx={sx(pre)} cy={12} r={DOT_R} fill={C.pre} stroke={C.surface} strokeWidth={2} />
                      </svg>
                      <span className="dumbbell-delta tabular" style={{ width: deltaW }}>
                        {fmtSigned(r.diff)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
      {!table && (hidden > 0 || showAll) && (
        <button type="button" className="btn btn--outline btn--small" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Pokaż tylko najważniejsze' : `Pokaż wszystkie objawy (${rows.length})`}
        </button>
      )}
      <div className="chart-foot">
        <span className="muted small">
          {cycles} {cycles === 1 ? 'okres' : cycles < 5 ? 'okresy' : 'okresów'} w porównaniu
        </span>
        <TableToggle on={table} onToggle={() => setTable((v) => !v)} />
      </div>
    </div>
  );
}
