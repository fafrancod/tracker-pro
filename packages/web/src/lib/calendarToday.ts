export const FOCUS_TODAY_EVENT = 'daily-tracker:focus-today';

export function requestFocusToday(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FOCUS_TODAY_EVENT));
}

/** Scroll the calendar scroller so today's cell sits near the top of the viewport. */
export function scrollToCalendarToday(scroller?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false;
  const scope: ParentNode = scroller ?? document;
  const el = scope.querySelector<HTMLElement>('[data-calendar-today]');
  if (!el) return false;

  const container =
    scroller ??
    el.closest<HTMLElement>('[data-calendar-scroll], .overflow-y-auto');

  if (!container) {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    return true;
  }

  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const pad = Math.min(48, Math.max(12, cRect.height * 0.08));
  container.scrollTo({
    top: Math.max(0, container.scrollTop + (eRect.top - cRect.top) - pad),
    behavior: 'auto',
  });
  return true;
}

export function scheduleScrollToCalendarToday(
  scroller?: HTMLElement | null,
  attempts = 16
): void {
  let n = 0;
  const tick = () => {
    if (scrollToCalendarToday(scroller)) return;
    n += 1;
    if (n < attempts) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
