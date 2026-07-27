/**
 * 50 skins for Daily Tracker:
 * - 20 dark solid
 * - 20 light solid
 * - 10 Aero (Apple-style Liquid Glass materials)
 *
 * CSS variables drive Tailwind tokens. Aero skins add mesh backdrops +
 * backdrop-filter blur (same family of technique as macOS/iOS vibrancy).
 */

export type SkinMode = 'dark' | 'light' | 'aero';

/** Text contrast tone (color-scheme / .dark class). Aero skins declare this explicitly. */
export type SkinTone = 'dark' | 'light';

export type SkinMaterial = 'solid' | 'glass';

export interface SkinTokens {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accentGreen: string;
  accentTeal: string;
  accentRed: string;
  accentPink: string;
  /** Scrollbar track */
  scrollTrack: string;
  /** Scrollbar thumb */
  scrollThumb: string;
  /**
   * Solid fill for form controls (inputs, selects, date/time).
   * Defaults to `surface` for solid skins. Aero must set an opaque value.
   */
  field?: string;
  /**
   * Opaque fallback for theme-color / under mesh.
   * Aero: solid base behind the glass wallpaper.
   */
  solidBackground?: string;
  /** CSS multi-layer gradient / mesh used as “wallpaper” under glass */
  backdrop?: string;
  /** backdrop-filter blur radius, e.g. "28px" */
  glassBlur?: string;
  /** backdrop-filter saturate %, e.g. "180%" */
  glassSaturate?: string;
}

export interface SkinDefinition {
  id: string;
  name: string;
  nameEn: string;
  mode: SkinMode;
  /** For aero: light or dark content. Defaults to mode when mode is dark|light. */
  tone?: SkinTone;
  material?: SkinMaterial;
  tokens: SkinTokens;
}

function skin(
  id: string,
  name: string,
  nameEn: string,
  mode: SkinMode,
  tokens: SkinTokens
): SkinDefinition {
  return {
    id,
    name,
    nameEn,
    mode,
    material: 'solid',
    tokens,
  };
}

function aeroSkin(
  id: string,
  name: string,
  nameEn: string,
  tone: SkinTone,
  tokens: SkinTokens
): SkinDefinition {
  return {
    id,
    name,
    nameEn,
    mode: 'aero',
    tone,
    material: 'glass',
    tokens: {
      glassBlur: '28px',
      glassSaturate: '180%',
      ...tokens,
    },
  };
}

/** Resolve whether UI chrome uses dark (light text) or light (dark text). */
export function skinTone(skin: SkinDefinition): SkinTone {
  if (skin.mode === 'aero') return skin.tone ?? 'light';
  return skin.mode;
}

/** 20 dark skins */
const DARK_SKINS: SkinDefinition[] = [
  skin('dark-github', 'GitHub noche', 'GitHub night', 'dark', {
    background: '#0d1117',
    surface: '#161b22',
    border: '#30363d',
    textPrimary: '#e6edf3',
    textMuted: '#7d8590',
    accentGreen: '#3fb950',
    accentTeal: '#58a6ff',
    accentRed: '#f85149',
    accentPink: '#f778ba',
    scrollTrack: '#161b22',
    scrollThumb: '#30363d',
  }),
  skin('dark-midnight', 'Medianoche', 'Midnight', 'dark', {
    background: '#0a0e17',
    surface: '#121826',
    border: '#1e293b',
    textPrimary: '#e2e8f0',
    textMuted: '#64748b',
    accentGreen: '#34d399',
    accentTeal: '#38bdf8',
    accentRed: '#f87171',
    accentPink: '#e879f9',
    scrollTrack: '#121826',
    scrollThumb: '#1e293b',
  }),
  skin('dark-obsidian', 'Obsidiana', 'Obsidian', 'dark', {
    background: '#0c0c0e',
    surface: '#161618',
    border: '#2a2a2e',
    textPrimary: '#f4f4f5',
    textMuted: '#71717a',
    accentGreen: '#4ade80',
    accentTeal: '#a78bfa',
    accentRed: '#fb7185',
    accentPink: '#f472b6',
    scrollTrack: '#161618',
    scrollThumb: '#2a2a2e',
  }),
  skin('dark-forest', 'Bosque', 'Forest', 'dark', {
    background: '#0a1210',
    surface: '#12201c',
    border: '#1e3a32',
    textPrimary: '#e7f5ef',
    textMuted: '#6b9b88',
    accentGreen: '#22c55e',
    accentTeal: '#2dd4bf',
    accentRed: '#ef4444',
    accentPink: '#fb7185',
    scrollTrack: '#12201c',
    scrollThumb: '#1e3a32',
  }),
  skin('dark-ocean', 'Océano', 'Ocean', 'dark', {
    background: '#071018',
    surface: '#0f1c2a',
    border: '#1a3348',
    textPrimary: '#e0f2fe',
    textMuted: '#64748b',
    accentGreen: '#2dd4bf',
    accentTeal: '#0ea5e9',
    accentRed: '#f43f5e',
    accentPink: '#c084fc',
    scrollTrack: '#0f1c2a',
    scrollThumb: '#1a3348',
  }),
  skin('dark-ember', 'Ember', 'Ember', 'dark', {
    background: '#120a08',
    surface: '#1c100e',
    border: '#3b221c',
    textPrimary: '#fef3c7',
    textMuted: '#a8a29e',
    accentGreen: '#84cc16',
    accentTeal: '#fb923c',
    accentRed: '#ef4444',
    accentPink: '#f472b6',
    scrollTrack: '#1c100e',
    scrollThumb: '#3b221c',
  }),
  skin('dark-purple', 'Violeta', 'Violet dusk', 'dark', {
    background: '#0f0a14',
    surface: '#1a1224',
    border: '#2e2040',
    textPrimary: '#f3e8ff',
    textMuted: '#9ca3af',
    accentGreen: '#4ade80',
    accentTeal: '#a78bfa',
    accentRed: '#f87171',
    accentPink: '#e879f9',
    scrollTrack: '#1a1224',
    scrollThumb: '#2e2040',
  }),
  skin('dark-slate', 'Pizarra', 'Slate', 'dark', {
    background: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    textPrimary: '#f1f5f9',
    textMuted: '#94a3b8',
    accentGreen: '#4ade80',
    accentTeal: '#38bdf8',
    accentRed: '#f87171',
    accentPink: '#f472b6',
    scrollTrack: '#1e293b',
    scrollThumb: '#334155',
  }),
  skin('dark-nord', 'Nord', 'Nord', 'dark', {
    background: '#2e3440',
    surface: '#3b4252',
    border: '#4c566a',
    textPrimary: '#eceff4',
    textMuted: '#d8dee9',
    accentGreen: '#a3be8c',
    accentTeal: '#88c0d0',
    accentRed: '#bf616a',
    accentPink: '#b48ead',
    scrollTrack: '#3b4252',
    scrollThumb: '#4c566a',
  }),
  skin('dark-dracula', 'Drácula', 'Dracula', 'dark', {
    background: '#282a36',
    surface: '#21222c',
    border: '#44475a',
    textPrimary: '#f8f8f2',
    textMuted: '#6272a4',
    accentGreen: '#50fa7b',
    accentTeal: '#8be9fd',
    accentRed: '#ff5555',
    accentPink: '#ff79c6',
    scrollTrack: '#21222c',
    scrollThumb: '#44475a',
  }),
  skin('dark-monokai', 'Monokai', 'Monokai', 'dark', {
    background: '#272822',
    surface: '#1e1f1c',
    border: '#49483e',
    textPrimary: '#f8f8f2',
    textMuted: '#75715e',
    accentGreen: '#a6e22e',
    accentTeal: '#66d9ef',
    accentRed: '#f92672',
    accentPink: '#fd971f',
    scrollTrack: '#1e1f1c',
    scrollThumb: '#49483e',
  }),
  skin('dark-tokyo', 'Tokio noche', 'Tokyo night', 'dark', {
    background: '#1a1b26',
    surface: '#16161e',
    border: '#292e42',
    textPrimary: '#c0caf5',
    textMuted: '#565f89',
    accentGreen: '#9ece6a',
    accentTeal: '#7aa2f7',
    accentRed: '#f7768e',
    accentPink: '#bb9af7',
    scrollTrack: '#16161e',
    scrollThumb: '#292e42',
  }),
  skin('dark-rose', 'Rosa oscuro', 'Dark rose', 'dark', {
    background: '#1a0f14',
    surface: '#24151c',
    border: '#3f2430',
    textPrimary: '#fce7f3',
    textMuted: '#9f7a8a',
    accentGreen: '#86efac',
    accentTeal: '#f9a8d4',
    accentRed: '#fb7185',
    accentPink: '#f472b6',
    scrollTrack: '#24151c',
    scrollThumb: '#3f2430',
  }),
  skin('dark-copper', 'Cobre', 'Copper', 'dark', {
    background: '#14100c',
    surface: '#1f1913',
    border: '#3d3226',
    textPrimary: '#fef3c7',
    textMuted: '#a8a29e',
    accentGreen: '#a3e635',
    accentTeal: '#f59e0b',
    accentRed: '#ef4444',
    accentPink: '#fb923c',
    scrollTrack: '#1f1913',
    scrollThumb: '#3d3226',
  }),
  skin('dark-cyber', 'Ciber', 'Cyberpunk', 'dark', {
    background: '#0a0014',
    surface: '#12001f',
    border: '#2a0a40',
    textPrimary: '#e0e7ff',
    textMuted: '#818cf8',
    accentGreen: '#22d3ee',
    accentTeal: '#a855f7',
    accentRed: '#f43f5e',
    accentPink: '#ec4899',
    scrollTrack: '#12001f',
    scrollThumb: '#2a0a40',
  }),
  skin('dark-graphite', 'Grafito', 'Graphite', 'dark', {
    background: '#18181b',
    surface: '#27272a',
    border: '#3f3f46',
    textPrimary: '#fafafa',
    textMuted: '#a1a1aa',
    accentGreen: '#4ade80',
    accentTeal: '#60a5fa',
    accentRed: '#f87171',
    accentPink: '#e879f9',
    scrollTrack: '#27272a',
    scrollThumb: '#3f3f46',
  }),
  skin('dark-abyss', 'Abismo', 'Abyss', 'dark', {
    background: '#05080f',
    surface: '#0b1220',
    border: '#152238',
    textPrimary: '#dbeafe',
    textMuted: '#64748b',
    accentGreen: '#34d399',
    accentTeal: '#60a5fa',
    accentRed: '#f87171',
    accentPink: '#c084fc',
    scrollTrack: '#0b1220',
    scrollThumb: '#152238',
  }),
  skin('dark-wine', 'Vino', 'Wine', 'dark', {
    background: '#140a0c',
    surface: '#1f1014',
    border: '#3b1c24',
    textPrimary: '#ffe4e6',
    textMuted: '#9f7a82',
    accentGreen: '#86efac',
    accentTeal: '#fda4af',
    accentRed: '#e11d48',
    accentPink: '#fb7185',
    scrollTrack: '#1f1014',
    scrollThumb: '#3b1c24',
  }),
  skin('dark-matrix', 'Matrix', 'Matrix', 'dark', {
    background: '#020a02',
    surface: '#061206',
    border: '#0f2a0f',
    textPrimary: '#bbf7d0',
    textMuted: '#4d7c4d',
    accentGreen: '#22c55e',
    accentTeal: '#4ade80',
    accentRed: '#ef4444',
    accentPink: '#86efac',
    scrollTrack: '#061206',
    scrollThumb: '#0f2a0f',
  }),
  skin('dark-ink', 'Tinta', 'Ink', 'dark', {
    background: '#09090b',
    surface: '#111113',
    border: '#27272a',
    textPrimary: '#fafafa',
    textMuted: '#71717a',
    accentGreen: '#22c55e',
    accentTeal: '#3b82f6',
    accentRed: '#ef4444',
    accentPink: '#ec4899',
    scrollTrack: '#111113',
    scrollThumb: '#27272a',
  }),
];

/** 20 light skins */
const LIGHT_SKINS: SkinDefinition[] = [
  skin('light-paper', 'Papel', 'Paper', 'light', {
    background: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    accentGreen: '#16a34a',
    accentTeal: '#2563eb',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#f1f5f9',
    scrollThumb: '#cbd5e1',
  }),
  skin('light-cloud', 'Nube', 'Cloud', 'light', {
    background: '#f0f4f8',
    surface: '#ffffff',
    border: '#d9e2ec',
    textPrimary: '#102a43',
    textMuted: '#627d98',
    accentGreen: '#27ab83',
    accentTeal: '#2bb0ed',
    accentRed: '#e12d39',
    accentPink: '#d53f8c',
    scrollTrack: '#e2e8f0',
    scrollThumb: '#9fb3c8',
  }),
  skin('light-sand', 'Arena', 'Sand', 'light', {
    background: '#faf6f1',
    surface: '#fffdf9',
    border: '#e8dfd4',
    textPrimary: '#292524',
    textMuted: '#78716c',
    accentGreen: '#65a30d',
    accentTeal: '#d97706',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#f5f0e8',
    scrollThumb: '#d6d3d1',
  }),
  skin('light-mint', 'Menta', 'Mint', 'light', {
    background: '#f0fdf6',
    surface: '#ffffff',
    border: '#bbf7d0',
    textPrimary: '#14532d',
    textMuted: '#4d7c5f',
    accentGreen: '#16a34a',
    accentTeal: '#0d9488',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#dcfce7',
    scrollThumb: '#86efac',
  }),
  skin('light-sky', 'Cielo', 'Sky', 'light', {
    background: '#f0f9ff',
    surface: '#ffffff',
    border: '#bae6fd',
    textPrimary: '#0c4a6e',
    textMuted: '#0369a1',
    accentGreen: '#059669',
    accentTeal: '#0284c7',
    accentRed: '#e11d48',
    accentPink: '#c026d3',
    scrollTrack: '#e0f2fe',
    scrollThumb: '#7dd3fc',
  }),
  skin('light-lavender', 'Lavanda', 'Lavender', 'light', {
    background: '#faf5ff',
    surface: '#ffffff',
    border: '#e9d5ff',
    textPrimary: '#3b0764',
    textMuted: '#7e22ce',
    accentGreen: '#16a34a',
    accentTeal: '#7c3aed',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#f3e8ff',
    scrollThumb: '#d8b4fe',
  }),
  skin('light-rose', 'Rosa claro', 'Blush', 'light', {
    background: '#fff1f2',
    surface: '#ffffff',
    border: '#fecdd3',
    textPrimary: '#881337',
    textMuted: '#9f1239',
    accentGreen: '#16a34a',
    accentTeal: '#e11d48',
    accentRed: '#be123c',
    accentPink: '#db2777',
    scrollTrack: '#ffe4e6',
    scrollThumb: '#fda4af',
  }),
  skin('light-lemon', 'Limón', 'Lemon', 'light', {
    background: '#fefce8',
    surface: '#ffffff',
    border: '#fde68a',
    textPrimary: '#422006',
    textMuted: '#a16207',
    accentGreen: '#65a30d',
    accentTeal: '#ca8a04',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#fef9c3',
    scrollThumb: '#fcd34d',
  }),
  skin('light-snow', 'Nieve', 'Snow', 'light', {
    background: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    textPrimary: '#020617',
    textMuted: '#64748b',
    accentGreen: '#15803d',
    accentTeal: '#1d4ed8',
    accentRed: '#b91c1c',
    accentPink: '#be185d',
    scrollTrack: '#f1f5f9',
    scrollThumb: '#cbd5e1',
  }),
  skin('light-pearl', 'Perla', 'Pearl', 'light', {
    background: '#f5f5f4',
    surface: '#fafaf9',
    border: '#e7e5e4',
    textPrimary: '#1c1917',
    textMuted: '#78716c',
    accentGreen: '#16a34a',
    accentTeal: '#0f766e',
    accentRed: '#dc2626',
    accentPink: '#c026d3',
    scrollTrack: '#e7e5e4',
    scrollThumb: '#a8a29e',
  }),
  skin('light-ice', 'Hielo', 'Ice', 'light', {
    background: '#ecfeff',
    surface: '#ffffff',
    border: '#a5f3fc',
    textPrimary: '#164e63',
    textMuted: '#0e7490',
    accentGreen: '#059669',
    accentTeal: '#0891b2',
    accentRed: '#e11d48',
    accentPink: '#c026d3',
    scrollTrack: '#cffafe',
    scrollThumb: '#67e8f9',
  }),
  skin('light-peach', 'Melocotón', 'Peach', 'light', {
    background: '#fff7ed',
    surface: '#ffffff',
    border: '#fed7aa',
    textPrimary: '#7c2d12',
    textMuted: '#c2410c',
    accentGreen: '#65a30d',
    accentTeal: '#ea580c',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#ffedd5',
    scrollThumb: '#fdba74',
  }),
  skin('light-sage', 'Salvia', 'Sage', 'light', {
    background: '#f4f7f4',
    surface: '#ffffff',
    border: '#d1ddd1',
    textPrimary: '#1a2e1a',
    textMuted: '#5c715c',
    accentGreen: '#3f7d3f',
    accentTeal: '#4a7c6f',
    accentRed: '#b91c1c',
    accentPink: '#be185d',
    scrollTrack: '#e4ebe4',
    scrollThumb: '#a3b8a3',
  }),
  skin('light-linen', 'Lino', 'Linen', 'light', {
    background: '#faf8f5',
    surface: '#fffcf7',
    border: '#e8e0d5',
    textPrimary: '#2c2416',
    textMuted: '#7a6f5f',
    accentGreen: '#5a7d3a',
    accentTeal: '#6b8cae',
    accentRed: '#c23b22',
    accentPink: '#b85c8a',
    scrollTrack: '#f0ebe3',
    scrollThumb: '#cfc4b4',
  }),
  skin('light-cotton', 'Algodón', 'Cotton', 'light', {
    background: '#f9fafb',
    surface: '#ffffff',
    border: '#e5e7eb',
    textPrimary: '#111827',
    textMuted: '#6b7280',
    accentGreen: '#059669',
    accentTeal: '#4f46e5',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#f3f4f6',
    scrollThumb: '#d1d5db',
  }),
  skin('light-honey', 'Miel', 'Honey', 'light', {
    background: '#fffbeb',
    surface: '#ffffff',
    border: '#fde68a',
    textPrimary: '#451a03',
    textMuted: '#92400e',
    accentGreen: '#65a30d',
    accentTeal: '#d97706',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: '#fef3c7',
    scrollThumb: '#fcd34d',
  }),
  skin('light-fog', 'Niebla', 'Fog', 'light', {
    background: '#f3f4f6',
    surface: '#f9fafb',
    border: '#d1d5db',
    textPrimary: '#1f2937',
    textMuted: '#6b7280',
    accentGreen: '#10b981',
    accentTeal: '#6366f1',
    accentRed: '#ef4444',
    accentPink: '#ec4899',
    scrollTrack: '#e5e7eb',
    scrollThumb: '#9ca3af',
  }),
  skin('light-coral', 'Coral', 'Coral', 'light', {
    background: '#fff5f3',
    surface: '#ffffff',
    border: '#fecaca',
    textPrimary: '#7f1d1d',
    textMuted: '#b91c1c',
    accentGreen: '#16a34a',
    accentTeal: '#f97316',
    accentRed: '#dc2626',
    accentPink: '#e11d48',
    scrollTrack: '#fee2e2',
    scrollThumb: '#fca5a5',
  }),
  skin('light-aqua', 'Agua', 'Aqua', 'light', {
    background: '#f0fdfa',
    surface: '#ffffff',
    border: '#99f6e4',
    textPrimary: '#134e4a',
    textMuted: '#0f766e',
    accentGreen: '#059669',
    accentTeal: '#14b8a6',
    accentRed: '#e11d48',
    accentPink: '#db2777',
    scrollTrack: '#ccfbf1',
    scrollThumb: '#5eead4',
  }),
  skin('light-dawn', 'Amanecer', 'Dawn', 'light', {
    background: '#fff8f1',
    surface: '#ffffff',
    border: '#fed7aa',
    textPrimary: '#431407',
    textMuted: '#9a3412',
    accentGreen: '#65a30d',
    accentTeal: '#f59e0b',
    accentRed: '#dc2626',
    accentPink: '#ec4899',
    scrollTrack: '#ffedd5',
    scrollThumb: '#fdba74',
  }),
];

/**
 * 10 Aero skins — Liquid Glass materials.
 *
 * Layer roles (like Apple HIG):
 * - solidBackground + backdrop → wallpaper (fixed layer)
 * - background → near-transparent canvas (lets wallpaper show)
 * - surface → frosted chrome (sidebar, header, cards) with blur
 * - field → **opaque** control fill (inputs, selects, date/time) — never translucent
 */
const AERO_SKINS: SkinDefinition[] = [
  aeroSkin('aero-clear', 'Aero Clear', 'Aero Clear', 'light', {
    solidBackground: '#b8d0f0',
    background: 'rgba(255, 255, 255, 0.18)',
    surface: 'rgba(255, 255, 255, 0.72)',
    field: '#ffffff',
    border: 'rgba(15, 23, 42, 0.12)',
    textPrimary: '#0f172a',
    textMuted: '#475569',
    accentGreen: '#059669',
    accentTeal: '#0284c7',
    accentRed: '#e11d48',
    accentPink: '#db2777',
    scrollTrack: 'rgba(255,255,255,0.35)',
    scrollThumb: 'rgba(15,23,42,0.28)',
    glassBlur: '40px',
    glassSaturate: '200%',
    backdrop: `
      radial-gradient(120% 80% at 10% 0%, rgba(96, 165, 250, 0.95) 0%, transparent 55%),
      radial-gradient(90% 70% at 90% 10%, rgba(167, 139, 250, 0.9) 0%, transparent 50%),
      radial-gradient(80% 60% at 50% 100%, rgba(56, 189, 248, 0.85) 0%, transparent 55%),
      linear-gradient(160deg, #c7ddf8 0%, #a8c8f0 45%, #93b4e8 100%)
    `,
  }),
  aeroSkin('aero-frost', 'Aero Frost', 'Aero Frost', 'light', {
    solidBackground: '#cfd8e6',
    background: 'rgba(248, 250, 252, 0.16)',
    surface: 'rgba(255, 255, 255, 0.78)',
    field: '#ffffff',
    border: 'rgba(15, 23, 42, 0.1)',
    textPrimary: '#0c4a6e',
    textMuted: '#64748b',
    accentGreen: '#0d9488',
    accentTeal: '#0284c7',
    accentRed: '#e11d48',
    accentPink: '#a855f7',
    scrollTrack: 'rgba(241,245,249,0.45)',
    scrollThumb: 'rgba(100,116,139,0.35)',
    glassBlur: '36px',
    glassSaturate: '180%',
    backdrop: `
      radial-gradient(100% 80% at 0% 0%, rgba(186, 230, 253, 0.98) 0%, transparent 50%),
      radial-gradient(90% 70% at 100% 20%, rgba(165, 243, 252, 0.9) 0%, transparent 50%),
      radial-gradient(70% 50% at 40% 100%, rgba(226, 232, 240, 0.9) 0%, transparent 50%),
      linear-gradient(180deg, #e8eef5 0%, #d0d9e6 100%)
    `,
  }),
  aeroSkin('aero-sunset', 'Aero Sunset', 'Aero Sunset', 'light', {
    solidBackground: '#fdba74',
    background: 'rgba(255, 247, 237, 0.2)',
    surface: 'rgba(255, 255, 255, 0.78)',
    field: '#fffbf7',
    border: 'rgba(124, 45, 18, 0.12)',
    textPrimary: '#7c2d12',
    textMuted: '#9a3412',
    accentGreen: '#65a30d',
    accentTeal: '#ea580c',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: 'rgba(255,237,213,0.5)',
    scrollThumb: 'rgba(234,88,12,0.35)',
    glassBlur: '36px',
    glassSaturate: '190%',
    backdrop: `
      radial-gradient(100% 80% at 0% 10%, rgba(251, 146, 60, 0.95) 0%, transparent 55%),
      radial-gradient(90% 70% at 100% 0%, rgba(251, 113, 133, 0.85) 0%, transparent 50%),
      radial-gradient(80% 60% at 60% 100%, rgba(252, 211, 77, 0.8) 0%, transparent 55%),
      linear-gradient(145deg, #ffedd5 0%, #fed7aa 50%, #fecdd3 100%)
    `,
  }),
  aeroSkin('aero-ocean', 'Aero Ocean', 'Aero Ocean', 'light', {
    solidBackground: '#7dd3fc',
    background: 'rgba(224, 242, 254, 0.18)',
    surface: 'rgba(255, 255, 255, 0.76)',
    field: '#ffffff',
    border: 'rgba(12, 74, 110, 0.12)',
    textPrimary: '#0c4a6e',
    textMuted: '#0369a1',
    accentGreen: '#0d9488',
    accentTeal: '#0284c7',
    accentRed: '#e11d48',
    accentPink: '#c026d3',
    scrollTrack: 'rgba(186,230,253,0.45)',
    scrollThumb: 'rgba(2,132,199,0.4)',
    glassBlur: '38px',
    glassSaturate: '210%',
    backdrop: `
      radial-gradient(110% 80% at 15% 0%, rgba(14, 165, 233, 0.95) 0%, transparent 55%),
      radial-gradient(90% 70% at 90% 30%, rgba(20, 184, 166, 0.75) 0%, transparent 50%),
      radial-gradient(80% 60% at 40% 100%, rgba(2, 132, 199, 0.7) 0%, transparent 55%),
      linear-gradient(165deg, #bae6fd 0%, #7dd3fc 40%, #38bdf8 100%)
    `,
  }),
  aeroSkin('aero-aurora', 'Aero Aurora', 'Aero Aurora', 'light', {
    solidBackground: '#86efac',
    background: 'rgba(236, 253, 245, 0.18)',
    surface: 'rgba(255, 255, 255, 0.76)',
    field: '#ffffff',
    border: 'rgba(6, 78, 59, 0.12)',
    textPrimary: '#064e3b',
    textMuted: '#047857',
    accentGreen: '#059669',
    accentTeal: '#7c3aed',
    accentRed: '#e11d48',
    accentPink: '#c026d3',
    scrollTrack: 'rgba(209,250,229,0.45)',
    scrollThumb: 'rgba(16,185,129,0.4)',
    glassBlur: '40px',
    glassSaturate: '200%',
    backdrop: `
      radial-gradient(100% 80% at 0% 20%, rgba(16, 185, 129, 0.9) 0%, transparent 55%),
      radial-gradient(90% 70% at 100% 10%, rgba(139, 92, 246, 0.8) 0%, transparent 50%),
      radial-gradient(80% 60% at 50% 100%, rgba(45, 212, 191, 0.75) 0%, transparent 55%),
      linear-gradient(155deg, #d1fae5 0%, #c7d2fe 50%, #f5d0fe 100%)
    `,
  }),
  aeroSkin('aero-bloom', 'Aero Bloom', 'Aero Bloom', 'light', {
    solidBackground: '#f9a8d4',
    background: 'rgba(253, 242, 248, 0.2)',
    surface: 'rgba(255, 255, 255, 0.78)',
    field: '#fff7fb',
    border: 'rgba(131, 24, 67, 0.12)',
    textPrimary: '#831843',
    textMuted: '#9d174d',
    accentGreen: '#16a34a',
    accentTeal: '#db2777',
    accentRed: '#e11d48',
    accentPink: '#ec4899',
    scrollTrack: 'rgba(252,231,243,0.5)',
    scrollThumb: 'rgba(219,39,119,0.35)',
    glassBlur: '36px',
    glassSaturate: '185%',
    backdrop: `
      radial-gradient(100% 80% at 10% 0%, rgba(236, 72, 153, 0.9) 0%, transparent 55%),
      radial-gradient(90% 70% at 95% 15%, rgba(251, 113, 133, 0.75) 0%, transparent 50%),
      radial-gradient(80% 60% at 40% 100%, rgba(192, 132, 252, 0.7) 0%, transparent 55%),
      linear-gradient(150deg, #fce7f3 0%, #fbcfe8 45%, #f5d0fe 100%)
    `,
  }),
  aeroSkin('aero-sierra', 'Aero Sierra', 'Aero Sierra', 'light', {
    solidBackground: '#86efac',
    background: 'rgba(240, 253, 244, 0.18)',
    surface: 'rgba(255, 255, 255, 0.76)',
    field: '#ffffff',
    border: 'rgba(20, 83, 45, 0.12)',
    textPrimary: '#14532d',
    textMuted: '#166534',
    accentGreen: '#16a34a',
    accentTeal: '#0d9488',
    accentRed: '#dc2626',
    accentPink: '#db2777',
    scrollTrack: 'rgba(220,252,231,0.45)',
    scrollThumb: 'rgba(22,163,74,0.4)',
    glassBlur: '36px',
    glassSaturate: '180%',
    backdrop: `
      radial-gradient(100% 80% at 20% 0%, rgba(34, 197, 94, 0.85) 0%, transparent 55%),
      radial-gradient(90% 70% at 100% 30%, rgba(20, 184, 166, 0.7) 0%, transparent 50%),
      radial-gradient(80% 60% at 30% 100%, rgba(132, 204, 22, 0.55) 0%, transparent 55%),
      linear-gradient(160deg, #dcfce7 0%, #bbf7d0 50%, #86efac 100%)
    `,
  }),
  aeroSkin('aero-midnight', 'Aero Midnight', 'Aero Midnight', 'dark', {
    solidBackground: '#0b1220',
    background: 'rgba(15, 23, 42, 0.28)',
    surface: 'rgba(30, 41, 59, 0.72)',
    field: '#1e293b',
    border: 'rgba(148, 163, 184, 0.28)',
    textPrimary: '#f1f5f9',
    textMuted: '#94a3b8',
    accentGreen: '#34d399',
    accentTeal: '#38bdf8',
    accentRed: '#fb7185',
    accentPink: '#e879f9',
    scrollTrack: 'rgba(15,23,42,0.55)',
    scrollThumb: 'rgba(148,163,184,0.4)',
    glassBlur: '40px',
    glassSaturate: '190%',
    backdrop: `
      radial-gradient(100% 80% at 10% 0%, rgba(56, 189, 248, 0.45) 0%, transparent 55%),
      radial-gradient(90% 70% at 95% 20%, rgba(99, 102, 241, 0.5) 0%, transparent 50%),
      radial-gradient(80% 60% at 40% 100%, rgba(14, 165, 233, 0.35) 0%, transparent 55%),
      linear-gradient(165deg, #020617 0%, #0f172a 45%, #1e1b4b 100%)
    `,
  }),
  aeroSkin('aero-nebula', 'Aero Nebula', 'Aero Nebula', 'dark', {
    solidBackground: '#1a0b2e',
    background: 'rgba(24, 16, 40, 0.3)',
    surface: 'rgba(46, 16, 64, 0.72)',
    field: '#2e1065',
    border: 'rgba(216, 180, 254, 0.28)',
    textPrimary: '#faf5ff',
    textMuted: '#c4b5fd',
    accentGreen: '#4ade80',
    accentTeal: '#c4b5fd',
    accentRed: '#fb7185',
    accentPink: '#f472b6',
    scrollTrack: 'rgba(30,10,50,0.55)',
    scrollThumb: 'rgba(167,139,250,0.45)',
    glassBlur: '42px',
    glassSaturate: '210%',
    backdrop: `
      radial-gradient(100% 80% at 0% 10%, rgba(168, 85, 247, 0.55) 0%, transparent 55%),
      radial-gradient(90% 70% at 100% 0%, rgba(236, 72, 153, 0.45) 0%, transparent 50%),
      radial-gradient(80% 60% at 50% 100%, rgba(99, 102, 241, 0.5) 0%, transparent 55%),
      linear-gradient(155deg, #0c0118 0%, #2e1065 50%, #4a044e 100%)
    `,
  }),
  aeroSkin('aero-graphite', 'Aero Graphite', 'Aero Graphite', 'dark', {
    solidBackground: '#09090b',
    background: 'rgba(24, 24, 27, 0.32)',
    surface: 'rgba(39, 39, 42, 0.78)',
    field: '#27272a',
    border: 'rgba(255, 255, 255, 0.14)',
    textPrimary: '#fafafa',
    textMuted: '#a1a1aa',
    accentGreen: '#4ade80',
    accentTeal: '#d4d4d8',
    accentRed: '#f87171',
    accentPink: '#e879f9',
    scrollTrack: 'rgba(24,24,27,0.55)',
    scrollThumb: 'rgba(161,161,170,0.45)',
    glassBlur: '34px',
    glassSaturate: '165%',
    backdrop: `
      radial-gradient(100% 80% at 20% 0%, rgba(113, 113, 122, 0.45) 0%, transparent 55%),
      radial-gradient(90% 70% at 100% 30%, rgba(63, 63, 70, 0.55) 0%, transparent 50%),
      radial-gradient(80% 60% at 40% 100%, rgba(39, 39, 42, 0.65) 0%, transparent 55%),
      linear-gradient(160deg, #000000 0%, #18181b 50%, #27272a 100%)
    `,
  }),
];

export const SKINS: SkinDefinition[] = [
  ...DARK_SKINS,
  ...LIGHT_SKINS,
  ...AERO_SKINS,
];

export const DEFAULT_SKIN_ID = 'dark-github';

export function getSkinById(id: string | null | undefined): SkinDefinition {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}

export function applySkin(skinId: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const skin = getSkinById(skinId);
  const root = document.documentElement;
  const t = skin.tokens;
  const tone = skinTone(skin);
  const material = skin.material ?? (skin.mode === 'aero' ? 'glass' : 'solid');

  root.style.setProperty('--color-background', t.background);
  root.style.setProperty('--color-surface', t.surface);
  // Opaque form fills (inputs/selects). Solid skins fall back to surface.
  root.style.setProperty('--color-field', t.field ?? t.surface);
  root.style.setProperty('--color-border', t.border);
  root.style.setProperty('--color-text-primary', t.textPrimary);
  root.style.setProperty('--color-text-muted', t.textMuted);
  root.style.setProperty('--color-accent-green', t.accentGreen);
  root.style.setProperty('--color-accent-teal', t.accentTeal);
  root.style.setProperty('--color-accent-red', t.accentRed);
  root.style.setProperty('--color-accent-pink', t.accentPink);
  root.style.setProperty('--color-scroll-track', t.scrollTrack);
  root.style.setProperty('--color-scroll-thumb', t.scrollThumb);

  // Solid underlay + mesh wallpaper for glass materials
  const solidBg = t.solidBackground ?? t.background;
  root.style.setProperty('--color-background-solid', solidBg);

  if (t.backdrop && material === 'glass') {
    // Collapse whitespace so multi-line template strings stay valid CSS
    const backdrop = t.backdrop.replace(/\s+/g, ' ').trim();
    root.style.setProperty('--app-backdrop', backdrop);
    root.style.setProperty('--glass-blur', t.glassBlur ?? '28px');
    root.style.setProperty('--glass-saturate', t.glassSaturate ?? '180%');
  } else {
    root.style.removeProperty('--app-backdrop');
    root.style.setProperty('--glass-blur', '0px');
    root.style.setProperty('--glass-saturate', '100%');
  }

  root.dataset.skin = skin.id;
  root.dataset.theme = tone;
  root.dataset.material = material;
  root.dataset.skinMode = skin.mode;
  root.classList.toggle('dark', tone === 'dark');
  root.classList.toggle('light', tone === 'light');
  root.classList.toggle('aero', material === 'glass');

  /**
   * color-scheme hace que los <select> nativos (Windows/Chrome) usen
   * dropdown oscuro o claro según el skin — evita texto blanco sobre fondo blanco.
   */
  root.style.colorScheme = tone === 'dark' ? 'dark' : 'light';

  // Android / browser status bar color (always opaque)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', solidBg);
}

export function skinsByMode(mode: SkinMode): SkinDefinition[] {
  return SKINS.filter(s => s.mode === mode);
}
