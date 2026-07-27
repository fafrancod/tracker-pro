import { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatTimeTyping,
  normalizeTimeInput,
  nowTimeLocal,
} from '@core/lib/time';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Si se define y end < start, el contenedor se marca (solo visual). */
  minTime?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Muestra botón «Ahora». Default true. */
  showNow?: boolean;
  nowLabel?: string;
  clearLabel?: string;
}

/**
 * Entrada de hora amigable:
 * - escribe 930 o 9:30 → normaliza a 09:30
 * - botón Ahora
 * - limpia con una pulsación
 * - selector propio de hora/minutos (no depende del popup nativo del navegador)
 */
export function TimeInput({
  value,
  onChange,
  minTime,
  className,
  inputClassName,
  disabled,
  id,
  'aria-label': ariaLabel,
  showNow = true,
  nowLabel = 'Ahora',
  clearLabel = 'Quitar',
}: TimeInputProps) {
  const [text, setText] = useState(value || '');
  const focused = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const parsedTime = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  const selectedHour = parsedTime?.[1] ?? '';
  const selectedMinute = parsedTime?.[2] ?? '';

  useEffect(() => {
    if (focused.current) return;
    setText(value || '');
  }, [value]);

  useEffect(() => {
    if (!isPickerOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsPickerOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPickerOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPickerOpen]);

  function commit(raw: string) {
    const normalized = normalizeTimeInput(raw);
    if (normalized === null) {
      setText('');
      onChange('');
      return;
    }
    setText(normalized);
    onChange(normalized);
  }

  const invalidRange =
    Boolean(minTime && value && minTime > value) ||
    Boolean(minTime && text && normalizeTimeInput(text) && minTime > (normalizeTimeInput(text) as string));

  return (
    <div ref={pickerRef} className={cn('relative inline-flex items-center gap-1', className)}>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 rounded-lg border bg-field px-1.5',
          invalidRange ? 'border-accent-red' : 'border-border',
          disabled && 'opacity-50'
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:mm"
          disabled={disabled}
          aria-label={ariaLabel}
          value={text}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={e => {
            const next = formatTimeTyping(e.target.value);
            setText(next);
            const n = normalizeTimeInput(next);
            if (n) onChange(n);
          }}
          onBlur={() => {
            focused.current = false;
            commit(text);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            'w-[4.5rem] bg-transparent px-1 py-1.5 text-xs text-text-primary tabular-nums placeholder:text-text-muted focus:outline-none',
            inputClassName
          )}
        />
        <button
          type="button"
          disabled={disabled}
          title="Elegir hora"
          aria-label="Elegir hora"
          aria-expanded={isPickerOpen}
          onClick={() => setIsPickerOpen(open => !open)}
          className={cn(
            'rounded-md p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary',
            isPickerOpen && 'bg-accent-teal/18 text-accent-teal'
          )}
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
        {value ? (
          <button
            type="button"
            disabled={disabled}
            title={clearLabel}
            onClick={() => {
              setText('');
              onChange('');
            }}
            className="rounded p-1 text-text-muted hover:text-accent-red"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {showNow && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const n = nowTimeLocal();
            setText(n);
            onChange(n);
          }}
          className="shrink-0 rounded-md border border-border px-1.5 py-1 text-[10px] font-medium text-text-muted hover:border-accent-teal/40 hover:text-accent-teal"
        >
          {nowLabel}
        </button>
      )}
      {isPickerOpen && (
        <div
          data-glass-float
          role="dialog"
          aria-label="Selector de hora"
          className="time-picker-panel absolute left-0 top-[calc(100%+0.5rem)] z-[90] w-52 rounded-2xl border p-2"
        >
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            <span>Hora</span>
            <span>Minutos</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto pr-1">
              {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map(hour => (
                <button
                  key={hour}
                  type="button"
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs tabular-nums text-text-primary transition-colors hover:bg-white/12',
                    selectedHour === hour && 'bg-accent-teal/24 font-semibold text-accent-teal'
                  )}
                  onClick={() => {
                    const next = `${hour}:${selectedMinute || '00'}`;
                    setText(next);
                    onChange(next);
                  }}
                >
                  {hour}
                </button>
              ))}
            </div>
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto pl-1">
              {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map(minute => (
                <button
                  key={minute}
                  type="button"
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs tabular-nums text-text-primary transition-colors hover:bg-white/12',
                    selectedMinute === minute && 'bg-accent-teal/24 font-semibold text-accent-teal'
                  )}
                  onClick={() => {
                    const next = `${selectedHour || '00'}:${minute}`;
                    setText(next);
                    onChange(next);
                    setIsPickerOpen(false);
                  }}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
