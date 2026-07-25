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

  it('genera fire_key estable con modo', () => {
    expect(notificationFireKey('t1', '2026-07-24', '08:00', 'before', 'email')).toBe(
      't1|2026-07-24|08:00|before|email'
    );
    expect(notificationFireKey('t1', '2026-07-24', '', 'day_before', 'email')).toBe(
      't1|2026-07-24|allday|day_before|email'
    );
  });

  it('zonedDateTimeToUtc respeta zona America/Santiago (UTC-3 o -4)', () => {
    const d = zonedDateTimeToUtc('2026-07-24', '12:00', 'America/Santiago');
    expect(d.toISOString()).toMatch(/2026-07-24T1[56]:00:00/);
  });

  it('modo before: filtra completadas y sin hora', () => {
    const prefs = defaultNotificationPrefs({
      notifyEmail: true,
      notifyBeforeEnabled: true,
      notifyMinutesBefore: 0,
      notifyDayBefore: false,
      notifyPastIncomplete: false,
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
    expect(occs[0].mode).toBe('before');
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T08:00:00.000Z');
  });

  it('aplica antelación de 10 minutos (before)', () => {
    const prefs = defaultNotificationPrefs({
      notifyBeforeEnabled: true,
      notifyMinutesBefore: 10,
      notifyDayBefore: false,
      notifyPastIncomplete: false,
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
    expect(occs).toHaveLength(1);
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T09:50:00.000Z');
  });

  it('modo day_before: dispara el día anterior a la hora configurada', () => {
    const prefs = defaultNotificationPrefs({
      notifyBeforeEnabled: false,
      notifyDayBefore: true,
      notifyDayBeforeTime: '20:00',
      notifyPastIncomplete: false,
      timezone: 'UTC',
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'm',
          title: 'Dentista',
          completed: false,
          kind: 'task',
          startTime: '09:30',
          dayId: '2026-07-25',
        },
      ],
      prefs
    );
    expect(occs).toHaveLength(1);
    expect(occs[0].mode).toBe('day_before');
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T20:00:00.000Z');
    expect(occs[0].body).toMatch(/mañana/i);
  });

  it('modo past: dispara minutos después de la hora', () => {
    const prefs = defaultNotificationPrefs({
      notifyBeforeEnabled: false,
      notifyDayBefore: false,
      notifyPastIncomplete: true,
      notifyPastAfterMinutes: 30,
      timezone: 'UTC',
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'p',
          title: 'Amoxi',
          completed: false,
          kind: 'rx_human',
          startTime: '08:00',
          dayId: '2026-07-24',
        },
      ],
      prefs
    );
    expect(occs).toHaveLength(1);
    expect(occs[0].mode).toBe('past');
    expect(occs[0].fireAt.toISOString()).toBe('2026-07-24T08:30:00.000Z');
    expect(occs[0].body).toMatch(/ya hiciste/i);
  });

  it('puede emitir los tres modos para la misma tarea', () => {
    const prefs = defaultNotificationPrefs({
      notifyBeforeEnabled: true,
      notifyMinutesBefore: 0,
      notifyDayBefore: true,
      notifyDayBeforeTime: '20:00',
      notifyPastIncomplete: true,
      notifyPastAfterMinutes: 30,
      timezone: 'UTC',
    });
    const occs = collectNotifiableOccurrences(
      [
        {
          id: 'all',
          title: 'Yoga',
          completed: false,
          kind: 'task',
          startTime: '10:00',
          dayId: '2026-07-25',
        },
      ],
      prefs
    );
    expect(occs.map(o => o.mode).sort()).toEqual(['before', 'day_before', 'past']);
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
