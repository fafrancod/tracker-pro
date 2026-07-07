export const colors = {
  background: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textMuted: '#7d8590',
  accentGreen: '#3fb950',
  accentBlue: '#58a6ff',
  accentRed: '#f85149',
  accentPink: '#f778ba',
} as const;

export const projectColors = [
  '#3fb950',
  '#58a6ff',
  '#f85149',
  '#f778ba',
  '#d2a8ff',
  '#ffa657',
  '#79c0ff',
  '#56d364',
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export type ThemeColors = typeof colors;
export type ProjectColor = (typeof projectColors)[number];
