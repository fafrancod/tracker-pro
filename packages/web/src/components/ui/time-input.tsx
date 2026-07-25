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
 * - picker nativo opcional (icono reloj)
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
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focused.current) return;
    setText(value || '');
  }, [value]);

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
    <div className={cn('inline-flex items-center gap-1', className)}>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 rounded-lg border bg-background px-1.5',
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
        {/* Picker nativo oculto; se abre con el icono */}
        <input
          ref={nativeRef}
          type="time"
          tabIndex={-1}
          value={value && /^\d{2}:\d{2}$/.test(value) ? value : ''}
          onChange={e => {
            const n = normalizeTimeInput(e.target.value);
            if (n) {
              setText(n);
              onChange(n);
            }
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden
        />
        <button
          type="button"
          disabled={disabled}
          title="Selector de hora"
          onClick={() => {
            const el = nativeRef.current;
            if (!el) return;
            try {
              el.showPicker?.();
            } catch {
              el.click();
            }
          }}
          className="rounded p-1 text-text-muted hover:text-text-primary"
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
    </div>
  );
}
