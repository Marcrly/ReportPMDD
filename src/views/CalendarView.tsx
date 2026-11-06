import { useMemo, useRef, useState } from 'react';
import { dayLevel, hasAnyAnswer, hasRatings } from '../lib/analysis';
import { daysUntilPredicted, isPredictedPeriodDay, positionOf } from '../lib/cycles';
import {
  WEEKDAYS_SHORT,
  addDays,
  calendarToday,
  formatDayMonth,
  formatMonthYear,
  formatShort,
  formatWeekdayDayMonth,
  plDays,
  plural,
  weekdayMondayFirst,
} from '../lib/dates';
import { INSTALL_STEPS, detectPlatform, useInstallPrompt } from '../lib/install';
import { activePeriod, hasDataBesidesFlow, type ActivePeriod } from '../lib/periods';
import { allSymptoms, isBleeding } from '../lib/questionnaire';
import { hrefFor, navigate } from '../lib/router';
import { isStandalone } from '../lib/share';
import type { DayEntry, ISODate } from '../lib/types';
import { useApp } from '../state/AppContext';
import { useFileActions } from '../state/useFileActions';
import { usePeriodActions } from '../state/usePeriodActions';
import { Bloom, LeafMark, Sprig } from '../components/Botanical';
import { CycleSettingsSheet } from '../components/CycleSettingsSheet';
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDrop,
  IconEdit,
  IconFlower,
  IconHome,
  IconShield,
} from '../components/Icons';
import { Sheet } from '../components/ui';

export interface MonthState {
  y: number;
  m: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const BACKUP_EVERY_DAYS = 7;

export function CalendarView({ month, setMonth }: { month: MonthState; setMonth: (m: MonthState) => void }) {
  const { entries, info, today, meta, cycleSettings, updateMeta } = useApp();
  const { backup } = useFileActions();
  const periodActions = usePeriodActions();
  const [marking, setMarking] = useState(false);
  const [endSheet, setEndSheet] = useState(false);
  const [cycleSheet, setCycleSheet] = useState(false);
  const [installSheet, setInstallSheet] = useState(false);
  const [backupSnoozed, setBackupSnoozed] = useState(false);
  const install = useInstallPrompt();
  const platform = detectPlatform();
  const realToday = calendarToday();

  // ------- dzisiejszy wpis -------
  const todayEntry = entries.get(today);
  const pos = positionOf(today, info);
  const activeSymptoms = allSymptoms(meta.customSymptoms);
  const symptomsCount = activeSymptoms.length;
  const answered = todayEntry ? activeSymptoms.filter((s) => todayEntry.ratings[s.id] !== undefined).length : 0;
  const toNext = daysUntilPredicted(info, today);
  const ovu = info.prediction?.currentOvulation ?? null;
  const bleedingToday = isBleeding(todayEntry?.flow);
  const active = useMemo(() => activePeriod(entries.values(), realToday), [entries, realToday]);

  // ------- kopia zapasowa -------
  const entryCount = useMemo(() => [...entries.values()].filter(hasAnyAnswer).length, [entries]);
  const daysSinceBackup = meta.lastBackupAt ? Math.floor((Date.now() - Date.parse(meta.lastBackupAt)) / 86_400_000) : null;
  const needsBackup = !backupSnoozed && entryCount >= 3 && (daysSinceBackup === null || daysSinceBackup >= BACKUP_EVERY_DAYS);
  const showInstall = !isStandalone() && !meta.installHintDismissed;

  // ------- siatka miesiąca -------
  const cells = useMemo(() => {
    const first = `${month.y}-${pad(month.m + 1)}-01`;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const lead = weekdayMondayFirst(first);
    const out: (ISODate | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(`${month.y}-${pad(month.m + 1)}-${pad(d)}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const isCurrentMonth = realToday.startsWith(`${month.y}-${pad(month.m + 1)}`);

  // gest przesunięcia palcem zmienia miesiąc
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) shift(dx < 0 ? 1 : -1);
  };

  const onDay = (date: ISODate) => {
    if (marking) {
      if (!canMark(date, entries, realToday)) return;
      periodActions.setFlow(date, isBleeding(entries.get(date)?.flow) ? undefined : 'period');
      return;
    }
    if (date > realToday) return;
    navigate(hrefFor.day(date));
  };

  const { stats, prediction } = info;
  const manualDiff =
    cycleSettings.mode === 'manual' && stats.avgCycle !== null && Math.abs(Math.round(stats.avgCycle) - cycleSettings.cycleLength) >= 2;

  return (
    <main className="screen">
      <header className="screen-header">
        <Sprig className="header-sprig" leaves={9} opacity={0.9} />
        <div className="brand">
          <LeafMark size={24} />
          ReportPMDD
        </div>
        <h1 className="screen-title">Twój dziennik</h1>
        <p className="screen-sub">Objawy PMDD i PMS dzień po dniu</p>
      </header>

      {/* Dzisiaj */}
      <section className="card today-card" aria-labelledby="today-title">
        <p className="today-label">{today === realToday ? 'Dzisiaj' : 'Wpis za wczoraj (jest przed 4:00)'}</p>
        <h2 className="today-date" id="today-title">
          {capitalize(formatWeekdayDayMonth(today))}
        </h2>
        <div className="meta-pills">
          {pos.cycleDay !== null ? (
            <span className="meta-pill">Dzień {pos.cycleDay} cyklu</span>
          ) : (
            <span className="meta-pill">Zaznacz okres, by liczyć dni cyklu</span>
          )}
          {bleedingToday ? (
            <span className="meta-pill meta-pill--period">
              <IconDrop size={14} style={{ color: 'var(--rose-600)' }} /> Okres
            </span>
          ) : prediction && prediction.lateBy > 0 ? (
            <span className="meta-pill meta-pill--period">
              <IconDrop size={14} filled={false} style={{ color: 'var(--rose-600)' }} />
              Okres spóźnia się {prediction.lateBy} {plDays(prediction.lateBy)}
            </span>
          ) : toNext === 0 ? (
            <span className="meta-pill meta-pill--period">
              <IconDrop size={14} filled={false} style={{ color: 'var(--rose-600)' }} />
              Okres spodziewany dziś
            </span>
          ) : toNext !== null && toNext > 0 ? (
            <span className="meta-pill meta-pill--period">
              <IconDrop size={14} filled={false} style={{ color: 'var(--rose-600)' }} />
              Okres za ok. {toNext} {plDays(toNext)}
            </span>
          ) : null}
          {ovu && ovu === today ? (
            <span className="meta-pill meta-pill--ovulation">
              <IconFlower size={14} style={{ color: 'var(--honey-600)' }} /> Dziś szacowana owulacja
            </span>
          ) : ovu && ovu > today ? (
            <span className="meta-pill meta-pill--ovulation">
              <IconFlower size={14} style={{ color: 'var(--honey-600)' }} /> Owulacja ok. {formatShort(ovu)}
            </span>
          ) : null}
        </div>

        {todayEntry && hasRatings(todayEntry) ? (
          <>
            <p className="today-done">
              <IconCheckCircle size={20} /> Wpis zapisany
              <span className="muted small tabular" style={{ marginLeft: 'auto', fontWeight: 500 }}>
                {answered} z {symptomsCount}
              </span>
            </p>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (answered / symptomsCount) * 100)}%` }} />
            </div>
            <a
              className="btn btn--secondary btn--block"
              href={hrefFor.day(today)}
              onClick={(e) => {
                e.preventDefault();
                navigate(hrefFor.day(today));
              }}
            >
              <IconEdit size={18} /> {answered < symptomsCount ? 'Dokończ wpis' : 'Edytuj wpis'}
            </a>
          </>
        ) : (
          <a
            className="btn btn--primary btn--block"
            href={hrefFor.day(today)}
            onClick={(e) => {
              e.preventDefault();
              navigate(hrefFor.day(today));
            }}
          >
            Wypełnij dzisiejszy wpis
          </a>
        )}
      </section>

      {active && (
        <PeriodCard
          period={active}
          today={realToday}
          standard={periodActions.periodLength}
          onEnd={() => setEndSheet(true)}
          onExtend={() => periodActions.extendPeriod(active)}
        />
      )}

      {needsBackup && (
        <div className="banner banner--warn" role="note">
          <IconShield className="banner-icon" />
          <div>
            <strong>Czas na kopię zapasową</strong>
            {daysSinceBackup === null
              ? 'Nie masz jeszcze kopii. Zapisz ją w iCloud Drive lub na Dysku Google, żeby nie stracić danych razem z telefonem.'
              : `Ostatnia kopia: ${daysSinceBackup} ${plDays(daysSinceBackup)} temu. Zrób nową, to kilka sekund.`}
            <div className="banner-actions">
              <button type="button" className="btn btn--primary btn--small" onClick={() => void backup()}>
                Zrób kopię teraz
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setBackupSnoozed(true)}>
                Później
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstall && (
        <div className="banner" role="note">
          <IconHome className="banner-icon" />
          <div>
            <strong>Dodaj dziennik do ekranu początkowego</strong>
            Będzie działał jak zwykła aplikacja, także bez internetu, a przeglądarka lepiej chroni jego dane.
            <div className="banner-actions">
              {install.canPrompt ? (
                <button type="button" className="btn btn--primary btn--small" onClick={() => void install.prompt()}>
                  Zainstaluj
                </button>
              ) : (
                <button type="button" className="btn btn--primary btn--small" onClick={() => setInstallSheet(true)}>
                  Jak to zrobić?
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--small" onClick={() => void updateMeta({ installHintDismissed: true })}>
                Nie teraz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kalendarz */}
      <section className="card" aria-label="Kalendarz">
        {marking && (
          <div className="mark-banner" role="status">
            <span>
              <strong>Zaznaczanie okresu.</strong> Stuknij pierwszy dzień, a zaznaczę {periodActions.periodLength}{' '}
              {plDays(periodActions.periodLength)}. Stuknij zaznaczony dzień, by skrócić okres, albo dzień po nim, by go przedłużyć.
            </span>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setMarking(false)}>
              Gotowe
            </button>
          </div>
        )}
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="Poprzedni miesiąc" onClick={() => shift(-1)}>
            <IconChevronLeft />
          </button>
          <h2 className="cal-title" aria-live="polite">
            {formatMonthYear(month.y, month.m)}
          </h2>
          <button type="button" className="icon-btn" aria-label="Następny miesiąc" onClick={() => shift(1)}>
            <IconChevronRight />
          </button>
        </div>
        <div className="cal-weekdays" aria-hidden="true">
          {WEEKDAYS_SHORT.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {cells.map((date, i) =>
            date ? (
              <DayCell key={date} date={date} marking={marking} realToday={realToday} onClick={onDay} />
            ) : (
              <span key={`b${i}`} className="cal-day cal-day--blank" aria-hidden="true" />
            ),
          )}
        </div>

        <div className="cal-actions">
          <button
            type="button"
            className={`btn btn--small ${marking ? 'btn--primary' : 'btn--outline'}`}
            aria-pressed={marking}
            onClick={() => setMarking((v) => !v)}
          >
            <IconDrop size={16} /> {marking ? 'Zakończ zaznaczanie' : 'Zaznacz okres'}
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setMonth({ y: Number(realToday.slice(0, 4)), m: Number(realToday.slice(5, 7)) - 1 })}
            >
              Wróć do dziś
            </button>
          )}
        </div>

        <div className="cal-legend">
          <span className="legend-item">
            <span className="legend-ramp" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map((l) => (
                <i key={l} style={{ background: `var(--sev-${l})` }} />
              ))}
            </span>
            Nasilenie PMDD
          </span>
          <span className="legend-item">
            <IconDrop size={14} style={{ color: 'var(--rose-600)' }} /> Okres
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--predicted" aria-hidden="true" /> Prognoza okresu
          </span>
          <span className="legend-item">
            <IconFlower size={14} style={{ color: 'var(--honey-600)' }} /> Szacowana owulacja
          </span>
        </div>
      </section>

      {/* Twój cykl */}
      <section className="card" aria-labelledby="cycle-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="cycle-title">
              Twój cykl
            </h2>
            <p className="card-sub">
              {cycleSettings.mode === 'auto' && prediction?.source === 'data'
                ? `Liczone z ostatnich ${stats.cycleLengths.length} ${plural(stats.cycleLengths.length, ['cyklu', 'cykli', 'cykli'])}`
                : 'Na podstawie wpisanych wartości'}
            </p>
          </div>
          <Bloom size={34} />
        </div>
        <div className="cycle-grid">
          <div className="stat">
            <p className="stat-label">Długość cyklu</p>
            <p className="stat-value">
              {prediction?.cycleLength ?? cycleSettings.cycleLength}
              <small>dni</small>
            </p>
          </div>
          <div className="stat">
            <p className="stat-label">Długość okresu</p>
            <p className="stat-value">
              {prediction?.periodLength ?? cycleSettings.periodLength}
              <small>dni</small>
            </p>
          </div>
          <div className="stat">
            <p className="stat-label">Następny okres</p>
            <p className="stat-value" style={{ fontSize: 18 }}>
              {prediction?.periods[0] ? formatDayMonth(prediction.periods[0].start) : prediction && prediction.lateBy > 0 ? 'spóźnia się' : '...'}
            </p>
            <p className="stat-note">
              {prediction && prediction.lateBy > 0 ? `o ${prediction.lateBy} ${plDays(prediction.lateBy)} względem prognozy` : 'prognoza'}
            </p>
          </div>
          <div className="stat">
            <p className="stat-label">Owulacja</p>
            <p className="stat-value" style={{ fontSize: 18 }}>
              {ovu ? formatDayMonth(ovu) : (nextOvulation(info.prediction?.ovulations ?? [], today) ?? '...')}
            </p>
            <p className="stat-note">{prediction && prediction.lateBy > 0 ? 'policzę po kolejnym okresie' : 'szacunek'}</p>
          </div>
        </div>
        {manualDiff && (
          <div className="hint-box">
            <strong>Podpowiedź:</strong> z ostatnich cykli wychodzi średnio {String(stats.avgCycle).replace('.', ',')} dni, a ustawione jest{' '}
            {cycleSettings.cycleLength}.
          </div>
        )}
        {info.starts.length === 0 && (
          <div className="hint-box">
            Stuknij <strong>Zaznacz okres</strong> i zaznacz dni ostatniego okresu. Wtedy policzę dni cyklu, owulację i kolejny okres.
          </div>
        )}
        <div className="cal-actions">
          <button type="button" className="btn btn--outline btn--small" onClick={() => setCycleSheet(true)}>
            Ustawienia cyklu
          </button>
        </div>
      </section>

      {cycleSheet && <CycleSettingsSheet onClose={() => setCycleSheet(false)} />}
      {endSheet && active && (
        <Sheet title="Który dzień był ostatni?" onClose={() => setEndSheet(false)}>
          <p className="muted small">Dni okresu po wybranym dniu zostaną odznaczone.</p>
          <div className="choices" style={{ marginTop: 14 }}>
            {lastDayOptions(active, realToday).map((d, i) => (
              <button
                key={d}
                type="button"
                className="choice"
                onClick={() => {
                  periodActions.endPeriod(active, d);
                  setEndSheet(false);
                }}
              >
                Dzień {i + 1} <small>{d === realToday ? 'dziś' : formatShort(d)}</small>
              </button>
            ))}
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setEndSheet(false)}>
              Anuluj
            </button>
          </div>
        </Sheet>
      )}
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
          {platform === 'ios' && (
            <p className="muted small" style={{ marginTop: 12 }}>
              <IconAlert size={14} style={{ verticalAlign: '-2px' }} /> Na iPhonie aplikacja z ekranu początkowego ma osobny schowek danych niż
              Safari. Jeśli masz już wpisy w Safari, zrób kopię zapasową i przywróć ją po zainstalowaniu.
            </p>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn btn--primary btn--block" onClick={() => setInstallSheet(false)}>
              Rozumiem
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function nextOvulation(list: ISODate[], today: ISODate): string | null {
  const n = list.find((d) => d >= today);
  return n ? formatDayMonth(n) : null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Które dni można stuknąć w trybie zaznaczania okresu: wszystkie do dziś,
 * a w przyszłości tylko zaznaczone (żeby skrócić) i dzień tuż po zaznaczonym (żeby przedłużyć).
 */
function canMark(date: ISODate, entries: Map<ISODate, DayEntry>, realToday: ISODate): boolean {
  if (date <= realToday) return true;
  return isBleeding(entries.get(date)?.flow) || isBleeding(entries.get(addDays(date, -1))?.flow);
}

/** Dni do wyboru jako ostatni dzień okresu: od pierwszego do dziś (albo do końca, jeśli wcześniej). */
function lastDayOptions(period: ActivePeriod, realToday: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const until = period.end < realToday ? period.end : realToday;
  for (let d = period.start; d <= until; d = addDays(d, 1)) out.push(d);
  return out;
}

function PeriodCard({
  period,
  today,
  standard,
  onEnd,
  onExtend,
}: {
  period: ActivePeriod;
  today: ISODate;
  standard: number;
  onEnd: () => void;
  onExtend: () => void;
}) {
  const ongoing = period.day <= period.length;
  return (
    <section className="card period-card" aria-labelledby="period-title">
      <div className="period-head">
        <span className="period-icon" aria-hidden="true">
          <IconDrop size={20} />
        </span>
        <div>
          <h2 className="card-title" id="period-title">
            {ongoing ? `Okres: dzień ${period.day} z ${period.length}` : `Okres trwał ${period.length} ${plDays(period.length)}`}
          </h2>
          <p className="card-sub">
            {ongoing
              ? `Zaznaczony do ${formatDayMonth(period.end)}${period.autoDays ? `, standardowo ${standard} ${plDays(standard)}` : ''}. Jeśli skończy się wcześniej albo potrwa dłużej, zmień to tutaj.`
              : `Ostatni zaznaczony dzień: ${formatDayMonth(period.end)}. Jeśli krwawienie trwa nadal, przedłuż okres.`}
          </p>
        </div>
      </div>
      <div className="period-actions">
        {ongoing && period.end >= today && period.length > 1 && (
          <button type="button" className="btn btn--outline btn--small" onClick={onEnd}>
            Skończył się wcześniej
          </button>
        )}
        <button type="button" className="btn btn--outline btn--small" onClick={onExtend}>
          Przedłuż o 1 dzień
        </button>
      </div>
    </section>
  );
}

function DayCell({ date, marking, realToday, onClick }: { date: ISODate; marking: boolean; realToday: ISODate; onClick: (d: ISODate) => void }) {
  const { entries, info } = useApp();
  const e = entries.get(date);
  const level = dayLevel(e);
  // Dzień, w którym zaznaczony jest tylko okres, pokazuje samą kroplę (bez tła "jest wpis").
  const logged = hasDataBesidesFlow(e);
  const bleeding = isBleeding(e?.flow);
  const spotting = e?.flow === 'spotting';
  const future = date > realToday;
  const markable = marking && canMark(date, entries, realToday);
  const predicted = isPredictedPeriodDay(date, info, realToday);
  const ovulation = info.ovulationDays.has(date);
  const isToday = date === realToday;
  const day = Number(date.slice(8));

  const parts = [formatDayMonth(date)];
  if (isToday) parts.push('dziś');
  if (level !== null) parts.push(`nasilenie PMDD ${level} z 6`);
  else if (logged) parts.push('jest wpis');
  if (bleeding) parts.push(future ? 'okres zaznaczony z wyprzedzeniem' : e?.periodAuto ? 'okres, zaznaczony automatycznie' : 'okres');
  if (spotting) parts.push('plamienie');
  if (predicted) parts.push('prognoza okresu');
  if (ovulation) parts.push('szacowana owulacja');
  if (future) parts.push('przyszłość');

  const cls = [
    'cal-day',
    logged && 'has-entry is-logged',
    isToday && 'is-today',
    future && 'is-future',
    predicted && 'is-predicted',
    markable && 'is-marking',
    bleeding && 'is-period',
    bleeding && future && 'is-planned',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      data-level={level ?? undefined}
      aria-label={parts.join(', ')}
      aria-pressed={marking ? bleeding : undefined}
      disabled={marking ? !markable : future}
      onClick={() => onClick(date)}
    >
      <span>{day}</span>
      <span className="cal-marks" aria-hidden="true">
        {bleeding && <IconDrop size={11} />}
        {spotting && <IconDrop size={10} filled={false} />}
        {ovulation && <IconFlower size={11} className="mark-ovulation" />}
        {!bleeding && !spotting && !ovulation && logged && level === null && <i className="mark-dot" />}
      </span>
    </button>
  );
}
