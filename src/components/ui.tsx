import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconMinus, IconPlus } from './Icons';

// ---------------------------------------------------------------------------
// Wybór jednej opcji (chipy) z poprawną semantyką radiogroup
// ---------------------------------------------------------------------------
interface ChoiceOption<T> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

interface ChoiceGroupProps<T> {
  label: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  /** ponowne kliknięcie zaznaczonej opcji czyści odpowiedź */
  allowClear?: boolean;
  className?: string;
  optionClassName?: string;
}

export function ChoiceGroup<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  allowClear = true,
  className = '',
  optionClassName = '',
}: ChoiceGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + options.length) % options.length;
    refs.current[n]?.focus();
    onChange(options[n].value);
  };
  return (
    <div role="radiogroup" aria-label={label} className={`choices ${className}`}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
            className={`choice ${optionClassName}`}
            onClick={() => onChange(checked && allowClear ? undefined : o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Licznik z przyciskami minus / plus
// ---------------------------------------------------------------------------
interface StepperProps {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** wartość ustawiana przy pierwszym kliknięciu, gdy pole jest puste */
  start: number;
  format?: (v: number) => string;
}

export function Stepper({ label, value, onChange, min, max, step, unit, start, format }: StepperProps) {
  const fmt = format ?? ((v: number) => String(v).replace('.', ','));
  const change = (dir: 1 | -1) => {
    if (value === undefined) {
      onChange(start);
      return;
    }
    const next = Math.round((value + dir * step) * 100) / 100;
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label}: mniej`} onClick={() => change(-1)} disabled={value !== undefined && value <= min}>
        <IconMinus size={20} />
      </button>
      <output className="stepper-value" aria-live="polite">
        {value === undefined ? '...' : fmt(value)}
        <small>{unit}</small>
      </output>
      <button type="button" aria-label={`${label}: więcej`} onClick={() => change(1)} disabled={value !== undefined && value >= max}>
        <IconPlus size={20} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Przełącznik
// ---------------------------------------------------------------------------
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <label className="switch-row" htmlFor={id}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Arkusz (okno od dołu ekranu)
// ---------------------------------------------------------------------------
export function Sheet({ title, onClose, children, labelledBy }: { title: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} tabIndex={-1} ref={ref}>
        <div className="sheet-handle" />
        <h2 className="sheet-title" id={labelledBy ?? id}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komunikaty (toast)
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  duration: number;
}

const ToastCtx = createContext<(text: string, action?: Toast['action'], duration?: number) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, action?: Toast['action'], duration = 3600) => {
    clearTimeout(timer.current);
    const t = { id: Date.now(), text, action, duration };
    setToast(t);
    if (duration > 0) timer.current = setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), duration);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite" role="status">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
