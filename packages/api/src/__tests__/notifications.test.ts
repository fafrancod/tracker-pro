import { describe, it, expect } from 'vitest';
import {
  collectNotifiableOccurrences,
  notificationFireKey,
  normalizeMinutesBefore,
  zonedDateTimeToUtc,
  defaultNotificationPrefs,
} from '../lib/notificationsShared.js';

describe('notificationsShared', () => {
  it('normaliza minutos a opciones válidas', () => {
    expect(normalizeMinutesBefore(10)).toBe(10);
    expect(normalizeMinutesBefore(7)).toBe(5);
    expect(normalizeMinutesBefore(-1)).toBe(10);
  });

  it('genera fire_key estable', () => {
    expect(notificationFireKey('t1', '2026-07-24', '08:00', 'email')).toBe(
      't1|2026-07-24|08:00|email'
    );
  });

  it('zonedDateTimeToUtc respeta zona America/Santiago (UTC-3 o -4)', () => {
    const d = zonedDateTimeToUtc('2026-07-24', '12:00', 'America/Santiago');
    // Invierno Chile ≈ UTC-4 → 12:00 local = 16:00 UTC
    expect(d.toISOString()).toMatch(/2026-07-24T1[56]:00:00/);
  });

  it('collectNotifiableOccurrences filtra completadas y sin hora', () => {
    const prefs = defaultNotificationPrefs({
      notifyEmail: true,
      notifyMinutesBefore: 0,
      timezone: 'UTC',
      notifyTasks: true,
      notifyRx: true,
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'a',
          title: 'Pastilla',
          completed: false,
          kind: 'rx_human',
          startTime: '08:00',
          dayId: '2026-07-24',
        },
        {
          id: 'b',
          title: 'Hecha',
          completed: true,
          kind: 'task',
          startTime: '09:00',
          dayId: '2026-07-24',
        },
        {
          id: 'c',
          title: 'Sin hora',
          completed: false,
          kind: 'task',
          startTime: null,
          dayId: '2026-07-24',
        },
      ],
      prefs
    );
    expect(occs).toHaveLength(1);
    expect(occs[0].taskId).toBe('a');
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T08:00:00.000Z');
  });

  it('aplica antelación de 10 minutos', () => {
    const prefs = defaultNotificationPrefs({
      notifyMinutesBefore: 10,
      timezone: 'UTC',
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'x',
          title: 'Reunión',
          completed: false,
          kind: 'task',
          startTime: '10:00',
          dayId: '2026-07-24',
        },
      ],
      prefs
    );
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T09:50:00.000Z');
  });

  it('respeta notifyRx=false', () => {
    const prefs = defaultNotificationPrefs({
      notifyRx: false,
      notifyTasks: true,
      timezone: 'UTC',
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'rx',
          title: 'Amoxi',
          completed: false,
          kind: 'rx_pet',
          startTime: '08:00',
          dayId: '2026-07-24',
        },
      ],
      prefs
    );
    expect(occs).toHaveLength(0);
  });
});
