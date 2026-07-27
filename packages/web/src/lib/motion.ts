/**
 * Shared Framer Motion presets — soft springs (macOS-like), not flashy.
 */
import type { Transition, Variants } from 'framer-motion';

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.7,
};

export const fadeScale: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const sheetEnter: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const slideFromLeft: Variants = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};

export const chromeFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};
