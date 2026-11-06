import { memo, useId, useRef, useState } from 'react';
import { SCALE } from '../lib/questionnaire';
import type { Rating, Symptom } from '../lib/types';
import { IconCheck, IconLink } from './Icons';

interface Props {
  symptom: Symptom;
  value: Rating | undefined;
  event: string | undefined;
  onRate: (id: string, v: Rating | undefined) => void;
  onEvent: (id: string, note: string | undefined) => void;
}

/**
 * Jedno pytanie: skala 1-5, przycisk "ponad skalę" po prawej
 * oraz opcjonalne "zdarzenie powiązane" z notatką.
 */
function SymptomItemBase({ symptom, value, event, onRate, onEvent }: Props) {
  const labelId = useId();
  const noteId = useId();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const hasEvent = event !== undefined;
  const [noteOpen, setNoteOpen] = useState(hasEvent);
  const showEventToggle = value !== undefined || hasEvent;
  const selected = SCALE.find((s) => s.value === value);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(0, i + dir));
    btns.current[n]?.focus();
    onRate(symptom.id, SCALE[n].value);
  };

  const toggleEvent = () => {
    if (hasEvent) {
      onEvent(symptom.id, undefined);
      setNoteOpen(false);
    } else {
      onEvent(symptom.id, '');
      setNoteOpen(true);
    }
  };

  return (
    <div className={`item item--${symptom.section}`}>
      <div className="item-head">
        <p className="item-label" id={labelId}>
          {symptom.drsp && <span className="item-num">{symptom.drsp}</span>}
          {symptom.label}
        </p>
        {selected && (
          <span className={`item-value ${selected.value === 6 ? 'item-value--over' : ''}`}>
            {selected.value === 6 ? 'Ponad skalę' : `${selected.value} · ${selected.label.toLowerCase()}`}
          </span>
        )}
      </div>

      <div className="scale" role="radiogroup" aria-labelledby={labelId}>
        {SCALE.map((s, i) => {
          const checked = value === s.value;
          const over = s.value === 6;
          return (
            <button
              key={s.value}
              ref={(el) => {
                btns.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={over ? 'Ponad skalę, nie do opisania' : `${s.value}, ${s.label.toLowerCase()}`}
              tabIndex={checked || (value === undefined && i === 0) ? 0 : -1}
              data-v={s.value}
              className={`scale-btn ${over ? 'scale-btn--over' : ''}`}
              onClick={() => onRate(symptom.id, checked ? undefined : s.value)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {over ? (
                <>
                  ponad
                  <br />
                  skalę
                </>
              ) : (
                s.value
              )}
            </button>
          );
        })}
      </div>

      {showEventToggle && (
        <div className="item-actions">
          <button type="button" className="event-toggle" aria-pressed={hasEvent} aria-controls={hasEvent ? noteId : undefined} onClick={toggleEvent}>
            {hasEvent ? <IconCheck size={16} /> : <IconLink size={16} />}
            Zdarzenie powiązane
          </button>
        </div>
      )}

      {hasEvent && noteOpen && (
        <div className="event-note" id={noteId}>
          <label className="visually-hidden" htmlFor={`${noteId}-t`}>
            Co się wydarzyło?
          </label>
          <textarea
            id={`${noteId}-t`}
            className="textarea"
            rows={2}
            maxLength={2000}
            placeholder="Co się wydarzyło? Np. kłótnia, stres w pracy, choroba, zła wiadomość"
            value={event}
            onChange={(e) => onEvent(symptom.id, e.target.value)}
          />
        </div>
      )}
      {hasEvent && !noteOpen && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setNoteOpen(true)}>
          {event ? `Zdarzenie: ${event.slice(0, 60)}${event.length > 60 ? '…' : ''}` : 'Dodaj opis zdarzenia'}
        </button>
      )}
    </div>
  );
}

export const SymptomItem = memo(SymptomItemBase);
