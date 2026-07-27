import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  /** Semantic element (aside, header, div…). Default div. */
  as?: ElementType;
  /** Marks chrome for Aero CSS (sidebar/header). */
  chrome?: boolean;
  /** Soft spring entrance (opt-in). */
  animated?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, 'children'>;

/**
 * Surface panel: frosted glass under Aero skins, solid surface otherwise.
 * Prefer this for app chrome (sidebar, header bars) instead of raw bg-surface.
 */
export function GlassPanel({
  children,
  className,
  as: Comp = 'div',
  chrome = false,
  animated = false,
  ...rest
}: GlassPanelProps) {
  const classes = cn('bg-surface text-text-primary border-border', className);
  const chromeAttr = chrome ? 'glass' : undefined;

  if (animated) {
    return (
      <motion.div
        data-chrome={chromeAttr}
        className={classes}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        {...(rest as object)}
      >
        {children}
      </motion.div>
    );
  }

  const Tag = Comp;
  return (
    <Tag data-chrome={chromeAttr} className={classes} {...rest}>
      {children}
    </Tag>
  );
}
