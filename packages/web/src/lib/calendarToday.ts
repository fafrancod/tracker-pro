import { nestedScrollerConsumesWheel } from '@core/lib/calendarScroll';

export const FOCUS_TODAY_EVENT = 'daily-tracker:focus-today';

const CALENDAR_SCROLL_SEL = '[data-calendar-scroll]';

/**
 * Si la lista de chips de un día ya no puede desplazarse en esa dirección,
 * mueve el calendario padre. Sin esto, overflow anidado + overscroll-contain
 * se come la rueda y el mes/continuo no avanza.
 */
export function redirectNestedWheelToCalendar(
  event: Pick<WheelEvent, 'deltaY' | 'currentTarget'>
): void {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  if (
    nestedScrollerConsumesWheel({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      deltaY: event.deltaY,
    })
  ) {
    return;
  }
  if (el.scrollHeight - el.clientHeight <= 1) return;
  const scroller = el.closest<HTMLElement>(CALENDAR_SCROLL_SEL);
  if (!scroller || scroller === el) return;
  scroller.scrollTop += event.deltaY;
}

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
