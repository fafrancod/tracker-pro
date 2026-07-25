import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Input decimal que permite escribir "0.5" sin que se fuerce a 0.1 a mitad de tecleo.
 * El valor numérico se confirma al blur o cuando el texto es un número válido > 0.
 */
export function DecimalInput({
  value,
  onChange,
  min = 0.01,
  max = 10000,
  className,
  id,
  'aria-label': ariaLabel,
}: DecimalInputProps) {
  const [text, setText] = useState(() => formatAmount(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(formatAmount(value));
  }, [value]);

  function commit(raw: string) {
    const n = parseAmount(raw);
    if (n === null || n < min) {
      const fallback = min;
      setText(formatAmount(fallback));
      onChange(fallback);
      return;
    }
    const clamped = Math.min(max, n);
    setText(formatAmount(clamped));
    onChange(clamped);
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={e => {
        const raw = e.target.value.replace(',', '.');
        if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = parseAmount(raw);
        if (n !== null && n >= min && n <= max) {
          onChange(n);
        }
      }}
      onBlur={() => {
        focused.current = false;
        commit(text);
      }}
      className={cn(className)}
    />
  );
}

function parseAmount(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (v === '' || v === '.') return null;
  if (v.endsWith('.')) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '';
  const s = String(n);
  if (s.includes('e') || s.includes('E')) return n.toFixed(4).replace(/\.?0+$/, '');
  return s;
}
