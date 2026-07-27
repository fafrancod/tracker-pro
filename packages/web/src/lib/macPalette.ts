/**
 * Soft system palette inspired by macOS (Sonoma / Sequoia chart colors).
 * Prefer these over neon Tailwind sky/fuchsia for events & charts.
 */
import type { CSSProperties } from 'react';

export const macSystem = {
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  pink: '#FF375F',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  green: '#30D158',
  mint: '#63E6E2',
  teal: '#40C8E0',
  cyan: '#64D2FF',
  gray: '#8E8E93',
  gridDark: 'rgba(142, 142, 147, 0.22)',
  gridLight: 'rgba(60, 60, 67, 0.12)',
} as const;

/** Soft fills for series without project color */
export const macChartSeries = [
  macSystem.blue,
  macSystem.teal,
  macSystem.indigo,
  macSystem.green,
  macSystem.orange,
  macSystem.purple,
  macSystem.mint,
  macSystem.pink,
] as const;

export function chartTooltipStyle(isDark: boolean): CSSProperties {
  return {
    backgroundColor: isDark
      ? 'rgba(40, 40, 45, 0.92)'
      : 'rgba(255, 255, 255, 0.92)',
    border: isDark
      ? '1px solid rgba(255,255,255,0.12)'
      : '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    color: isDark ? '#f5f5f7' : '#1d1d1f',
    fontSize: 12,
  };
}

export function isDocumentDark(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}
