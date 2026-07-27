/**
 * 20 Liquid Glass skins (10 light + 10 dark).
 *
 * Approximates Apple materials (macOS/iOS HIG):
 * - Wallpaper mesh (desktop)
 * - Ultra-thin canvas (translucent fill)
 * - Thin chrome with blur + vibrancy (sidebar / toolbar)
 * - Opaque fields (secondarySystemGroupedBackground)
 *
 * Web: backdrop-filter blur/saturate + rgba layers + specular edges (CSS).
 */
import type { SkinDefinition, SkinTone, SkinTokens } from './skins';

/** Apple system accent palette */
const SYS = {
  blue: '#007AFF',
  blueDark: '#0A84FF',
  green: '#34C759',
  greenDark: '#30D158',
  red: '#FF3B30',
  redDark: '#FF453A',
  pink: '#FF2D55',
  pinkDark: '#FF375F',
  indigo: '#5856D6',
  teal: '#5AC8FA',
  orange: '#FF9500',
  fieldLight: '#FFFFFF',
  fieldDark: '#1C1C1E',
  labelLight: '#1D1D1F',
  secondaryLabelLight: '#6E6E73',
  labelDark: '#F5F5F7',
  secondaryLabelDark: '#A1A1A6',
} as const;

function liquidGlass(
  id: string,
  name: string,
  nameEn: string,
  tone: SkinTone,
  opts: {
    solidBackground: string;
    backdrop: string;
    accentTeal?: string;
    accentGreen?: string;
    accentRed?: string;
    accentPink?: string;
    surface?: string;
    background?: string;
    field?: string;
    textPrimary?: string;
    textMuted?: string;
    border?: string;
    glassBlur?: string;
    glassSaturate?: string;
  }
): SkinDefinition {
  const isLight = tone === 'light';
  const tokens: SkinTokens = {
    solidBackground: opts.solidBackground,
    backdrop: opts.backdrop,
    background:
      opts.background ??
      (isLight ? 'rgba(255, 255, 255, 0.18)' : 'rgba(28, 28, 30, 0.28)'),
    surface:
      opts.surface ??
      (isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(44, 44, 46, 0.72)'),
    field: opts.field ?? (isLight ? SYS.fieldLight : SYS.fieldDark),
    border:
      opts.border ??
      (isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'),
    textPrimary: opts.textPrimary ?? (isLight ? SYS.labelLight : SYS.labelDark),
    textMuted:
      opts.textMuted ??
      (isLight ? SYS.secondaryLabelLight : SYS.secondaryLabelDark),
    accentGreen: opts.accentGreen ?? (isLight ? SYS.green : SYS.greenDark),
    accentTeal: opts.accentTeal ?? (isLight ? SYS.blue : SYS.blueDark),
    accentRed: opts.accentRed ?? (isLight ? SYS.red : SYS.redDark),
    accentPink: opts.accentPink ?? (isLight ? SYS.pink : SYS.pinkDark),
    scrollTrack: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)',
    scrollThumb: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)',
    glassBlur: opts.glassBlur ?? '48px',
    glassSaturate: opts.glassSaturate ?? (isLight ? '180%' : '160%'),
  };

  return {
    id,
    name,
    nameEn,
    mode: isLight ? 'glass-light' : 'glass-dark',
    tone,
    material: 'glass',
    tokens,
  };
}

export const GLASS_LIGHT_SKINS: SkinDefinition[] = [
  liquidGlass('lg-clear', 'Glass Clear', 'Glass Clear', 'light', {
    solidBackground: '#dce4ee',
    accentTeal: SYS.blue,
    backdrop: `
      radial-gradient(100% 80% at 12% 0%, rgba(180, 200, 230, 0.55) 0%, transparent 55%),
      radial-gradient(80% 60% at 90% 20%, rgba(200, 210, 230, 0.4) 0%, transparent 50%),
      linear-gradient(165deg, #eef3f9 0%, #dde6f1 50%, #d0dae8 100%)
    `,
  }),
  liquidGlass('lg-frost', 'Glass Frost', 'Glass Frost', 'light', {
    solidBackground: '#d5dbe4',
    accentTeal: '#5B8DEF',
    backdrop: `
      radial-gradient(95% 70% at 10% 8%, rgba(190, 200, 215, 0.5) 0%, transparent 55%),
      radial-gradient(75% 55% at 92% 15%, rgba(210, 218, 228, 0.45) 0%, transparent 50%),
      linear-gradient(180deg, #f2f4f8 0%, #e2e7ef 100%)
    `,
  }),
  liquidGlass('lg-cloud', 'Glass Cloud', 'Glass Cloud', 'light', {
    solidBackground: '#d4e2f0',
    accentTeal: '#0A84FF',
    backdrop: `
      radial-gradient(100% 75% at 20% 0%, rgba(165, 200, 235, 0.5) 0%, transparent 55%),
      radial-gradient(70% 50% at 85% 30%, rgba(190, 220, 245, 0.35) 0%, transparent 50%),
      linear-gradient(160deg, #f0f7fc 0%, #dceaf6 55%, #cfdff0 100%)
    `,
  }),
  liquidGlass('lg-pearl', 'Glass Pearl', 'Glass Pearl', 'light', {
    solidBackground: '#e0e0e4',
    accentTeal: '#636366',
    backdrop: `
      radial-gradient(90% 70% at 15% 10%, rgba(220, 220, 228, 0.6) 0%, transparent 55%),
      radial-gradient(70% 55% at 88% 20%, rgba(235, 235, 240, 0.5) 0%, transparent 50%),
      linear-gradient(155deg, #f7f7f9 0%, #ebebef 50%, #e0e0e6 100%)
    `,
  }),
  liquidGlass('lg-mist', 'Glass Mist', 'Glass Mist', 'light', {
    solidBackground: '#e4dfd8',
    accentTeal: '#8E8E93',
    backdrop: `
      radial-gradient(90% 65% at 8% 12%, rgba(230, 220, 210, 0.5) 0%, transparent 55%),
      radial-gradient(75% 55% at 90% 10%, rgba(235, 228, 220, 0.4) 0%, transparent 50%),
      linear-gradient(150deg, #faf8f5 0%, #efeae4 50%, #e6e0d8 100%)
    `,
  }),
  liquidGlass('lg-sand', 'Glass Sand', 'Glass Sand', 'light', {
    solidBackground: '#e8dfd2',
    accentTeal: SYS.orange,
    accentGreen: '#30B0C7',
    backdrop: `
      radial-gradient(90% 65% at 12% 8%, rgba(235, 215, 185, 0.45) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 25%, rgba(240, 225, 200, 0.35) 0%, transparent 50%),
      linear-gradient(155deg, #fbf7f0 0%, #f0e6d8 50%, #e8dccb 100%)
    `,
  }),
  liquidGlass('lg-sage', 'Glass Sage', 'Glass Sage', 'light', {
    solidBackground: '#d8e4dc',
    accentTeal: '#30B0C7',
    accentGreen: SYS.green,
    backdrop: `
      radial-gradient(90% 65% at 10% 5%, rgba(185, 210, 195, 0.45) 0%, transparent 55%),
      radial-gradient(75% 55% at 92% 28%, rgba(200, 220, 205, 0.35) 0%, transparent 50%),
      linear-gradient(160deg, #f3faf5 0%, #e3efe8 50%, #d5e4da 100%)
    `,
  }),
  liquidGlass('lg-sky', 'Glass Sky', 'Glass Sky', 'light', {
    solidBackground: '#cfe4f2',
    accentTeal: SYS.teal,
    backdrop: `
      radial-gradient(100% 70% at 15% 0%, rgba(150, 205, 235, 0.5) 0%, transparent 55%),
      radial-gradient(70% 55% at 90% 35%, rgba(165, 220, 230, 0.35) 0%, transparent 50%),
      linear-gradient(165deg, #eef8fd 0%, #d5ebf7 48%, #c5e0f2 100%)
    `,
  }),
  liquidGlass('lg-rose', 'Glass Rose', 'Glass Rose', 'light', {
    solidBackground: '#eadde3',
    accentTeal: SYS.pink,
    accentPink: SYS.pink,
    backdrop: `
      radial-gradient(90% 65% at 12% 8%, rgba(230, 200, 215, 0.45) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 20%, rgba(235, 210, 225, 0.35) 0%, transparent 50%),
      linear-gradient(150deg, #fbf5f8 0%, #f0e4eb 50%, #e6d7e0 100%)
    `,
  }),
  liquidGlass('lg-lilac', 'Glass Lilac', 'Glass Lilac', 'light', {
    solidBackground: '#e0dcec',
    accentTeal: SYS.indigo,
    accentPink: '#AF52DE',
    backdrop: `
      radial-gradient(90% 65% at 8% 10%, rgba(205, 195, 230, 0.45) 0%, transparent 55%),
      radial-gradient(70% 50% at 92% 18%, rgba(220, 205, 235, 0.35) 0%, transparent 50%),
      linear-gradient(155deg, #f7f5fb 0%, #ebe6f5 50%, #e0daf0 100%)
    `,
  }),
];

export const GLASS_DARK_SKINS: SkinDefinition[] = [
  liquidGlass('lg-midnight', 'Glass Midnight', 'Glass Midnight', 'dark', {
    solidBackground: '#0a1018',
    accentTeal: SYS.blueDark,
    surface: 'rgba(36, 48, 64, 0.78)',
    backdrop: `
      radial-gradient(95% 70% at 12% 0%, rgba(55, 90, 140, 0.4) 0%, transparent 55%),
      radial-gradient(75% 55% at 90% 22%, rgba(45, 60, 110, 0.3) 0%, transparent 50%),
      linear-gradient(165deg, #070c14 0%, #101826 50%, #121c2e 100%)
    `,
  }),
  liquidGlass('lg-graphite', 'Glass Graphite', 'Glass Graphite', 'dark', {
    solidBackground: '#0c0c0e',
    accentTeal: '#EBEBF5',
    surface: 'rgba(48, 48, 52, 0.8)',
    backdrop: `
      radial-gradient(90% 65% at 15% 5%, rgba(90, 90, 98, 0.3) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 30%, rgba(55, 55, 62, 0.35) 0%, transparent 50%),
      linear-gradient(160deg, #050506 0%, #121214 50%, #1a1a1e 100%)
    `,
  }),
  liquidGlass('lg-nebula', 'Glass Nebula', 'Glass Nebula', 'dark', {
    solidBackground: '#120e1c',
    accentTeal: '#BF5AF2',
    accentPink: SYS.pinkDark,
    surface: 'rgba(48, 38, 68, 0.78)',
    backdrop: `
      radial-gradient(90% 65% at 8% 8%, rgba(100, 70, 150, 0.38) 0%, transparent 55%),
      radial-gradient(70% 50% at 92% 15%, rgba(110, 50, 100, 0.28) 0%, transparent 50%),
      linear-gradient(155deg, #0c0814 0%, #18122a 50%, #1c1430 100%)
    `,
  }),
  liquidGlass('lg-abyss', 'Glass Abyss', 'Glass Abyss', 'dark', {
    solidBackground: '#060e16',
    accentTeal: SYS.teal,
    surface: 'rgba(28, 44, 58, 0.78)',
    backdrop: `
      radial-gradient(100% 70% at 10% 0%, rgba(30, 90, 130, 0.4) 0%, transparent 55%),
      radial-gradient(70% 55% at 90% 35%, rgba(20, 80, 100, 0.28) 0%, transparent 50%),
      linear-gradient(165deg, #040a10 0%, #0a1520 50%, #0c1a28 100%)
    `,
  }),
  liquidGlass('lg-obsidian', 'Glass Obsidian', 'Glass Obsidian', 'dark', {
    solidBackground: '#0a0a0c',
    accentTeal: '#0A84FF',
    surface: 'rgba(38, 38, 42, 0.82)',
    backdrop: `
      radial-gradient(90% 65% at 20% 0%, rgba(60, 60, 70, 0.35) 0%, transparent 55%),
      radial-gradient(70% 50% at 85% 40%, rgba(40, 40, 50, 0.4) 0%, transparent 50%),
      linear-gradient(160deg, #000000 0%, #0e0e12 50%, #16161a 100%)
    `,
  }),
  liquidGlass('lg-ember', 'Glass Ember', 'Glass Ember', 'dark', {
    solidBackground: '#140c0a',
    accentTeal: SYS.orange,
    accentRed: SYS.redDark,
    surface: 'rgba(52, 36, 30, 0.8)',
    backdrop: `
      radial-gradient(90% 65% at 10% 8%, rgba(140, 70, 40, 0.35) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 20%, rgba(100, 40, 40, 0.25) 0%, transparent 50%),
      linear-gradient(155deg, #0c0806 0%, #1a100e 50%, #201410 100%)
    `,
  }),
  liquidGlass('lg-forest', 'Glass Forest', 'Glass Forest', 'dark', {
    solidBackground: '#0a120e',
    accentTeal: SYS.greenDark,
    accentGreen: SYS.greenDark,
    surface: 'rgba(32, 48, 40, 0.8)',
    backdrop: `
      radial-gradient(90% 65% at 12% 5%, rgba(40, 100, 70, 0.35) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 30%, rgba(30, 80, 70, 0.28) 0%, transparent 50%),
      linear-gradient(160deg, #060c0a 0%, #0e1814 50%, #121e18 100%)
    `,
  }),
  liquidGlass('lg-wine', 'Glass Wine', 'Glass Wine', 'dark', {
    solidBackground: '#140a10',
    accentTeal: SYS.pinkDark,
    accentPink: SYS.pinkDark,
    surface: 'rgba(52, 32, 44, 0.8)',
    backdrop: `
      radial-gradient(90% 65% at 10% 8%, rgba(120, 40, 70, 0.35) 0%, transparent 55%),
      radial-gradient(70% 50% at 90% 22%, rgba(90, 30, 80, 0.28) 0%, transparent 50%),
      linear-gradient(150deg, #0c060a 0%, #1a0e16 50%, #20121a 100%)
    `,
  }),
  liquidGlass('lg-steel', 'Glass Steel', 'Glass Steel', 'dark', {
    solidBackground: '#0e1218',
    accentTeal: '#64D2FF',
    surface: 'rgba(40, 48, 58, 0.8)',
    backdrop: `
      radial-gradient(95% 70% at 15% 0%, rgba(70, 90, 120, 0.35) 0%, transparent 55%),
      radial-gradient(70% 50% at 88% 40%, rgba(50, 70, 90, 0.3) 0%, transparent 50%),
      linear-gradient(165deg, #080a0e 0%, #121820 50%, #161e28 100%)
    `,
  }),
  liquidGlass('lg-cosmos', 'Glass Cosmos', 'Glass Cosmos', 'dark', {
    solidBackground: '#0a0c18',
    accentTeal: '#5E5CE6',
    accentPink: '#BF5AF2',
    surface: 'rgba(36, 40, 68, 0.8)',
    backdrop: `
      radial-gradient(100% 70% at 8% 5%, rgba(60, 50, 140, 0.4) 0%, transparent 55%),
      radial-gradient(70% 55% at 92% 25%, rgba(80, 40, 120, 0.3) 0%, transparent 50%),
      linear-gradient(155deg, #060810 0%, #10122a 50%, #141430 100%)
    `,
  }),
];

/** Legacy aero-* → new lg-* (users who saved old skinId). */
export const SKIN_ALIASES: Record<string, string> = {
  'aero-frost': 'lg-frost',
  'aero-clear': 'lg-clear',
  'aero-sunset': 'lg-sand',
  'aero-ocean': 'lg-sky',
  'aero-aurora': 'lg-sage',
  'aero-bloom': 'lg-rose',
  'aero-sierra': 'lg-sage',
  'aero-midnight': 'lg-midnight',
  'aero-nebula': 'lg-nebula',
  'aero-graphite': 'lg-graphite',
};
