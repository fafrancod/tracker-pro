import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { bytesToMb, isAdminUser, isUserOnline } from '@daily-tracker/core';
import { mapAdminUser, matchesAdminFilters, summarizeAdminUsers } from '../lib/adminStats.js';

const app = buildApp();

describe('isAdminUser / owner email', () => {
  it('reconoce al dueño por email aunque no tenga claim admin', () => {
    expect(isAdminUser({ email: 'fafrancod@gmail.com', appMetadata: {} })).toBe(true);
    expect(isAdminUser({ email: 'FAFRANCOD@gmail.com', appMetadata: {} })).toBe(true);
  });

  it('reconoce claim app_metadata.admin', () => {
    expect(isAdminUser({ email: 'otro@x.com', appMetadata: { admin: true } })).toBe(true);
  });

  it('rechaza usuarios normales', () => {
    expect(isAdminUser({ email: 'liliandiaza@gmail.com', appMetadata: {} })).toBe(false);
  });
});

describe('adminStats mapping', () => {
  it('marca online y convierte bytes a MB', () => {
    const now = Date.parse('2026-08-14T12:00:00.000Z');
    const row = mapAdminUser(
      {
        id: 'u1',
        name: 'Lilian',
        email: 'liliandiaza@gmail.com',
        plan: 'pro',
        created_at: '2026-08-01T00:00:00.000Z',
        last_seen_at: '2026-08-14T11:59:00.000Z',
        last_path: '/board',
        last_app_version: '2.18.0',
        last_platform: 'web',
      },
      { user_id: 'u1', tasks_count: 8, projects_count: 2, total_bytes: 1536 * 1024 },
      now
    );
    expect(row.online).toBe(true);
    expect(row.plan).toBe('pro');
    expect(row.storageMb).toBe(bytesToMb(1536 * 1024));
    expect(row.counts.tasks).toBe(8);
  });

  it('isUserOnline respeta la ventana de 3 minutos', () => {
    const now = Date.parse('2026-08-14T12:00:00.000Z');
    expect(isUserOnline('2026-08-14T11:57:30.000Z', now)).toBe(true);
    expect(isUserOnline('2026-08-14T11:56:00.000Z', now)).toBe(false);
    expect(isUserOnline(null, now)).toBe(false);
  });

  it('summarize y filtros', () => {
    const now = Date.now();
    const users = [
      mapAdminUser(
        {
          id: 'a',
          name: 'A',
          email: 'a@x.com',
          plan: 'pro',
          created_at: null,
          last_seen_at: new Date(now).toISOString(),
          last_platform: 'web',
        },
        { user_id: 'a', tasks_count: 1, total_bytes: 1024 },
        now
      ),
      mapAdminUser(
        {
          id: 'b',
          name: 'B',
          email: 'b@x.com',
          plan: 'free',
          created_at: null,
          last_seen_at: null,
          last_platform: 'native',
        },
        { user_id: 'b', tasks_count: 2, total_bytes: 2048 },
        now
      ),
    ];
    const summary = summarizeAdminUsers(users, true);
    expect(summary.registered).toBe(2);
    expect(summary.online).toBe(1);
    expect(summary.planCounts.pro).toBe(1);
    expect(summary.planCounts.free).toBe(1);
    expect(summary.totals.tasks).toBe(3);
    expect(matchesAdminFilters(users[1], 'b@', 'all')).toBe(true);
    expect(matchesAdminFilters(users[1], '', 'pro')).toBe(false);
  });
});

describe('GET /api/admin/users', () => {
  it('rechaza sin auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('rechaza a un usuario no admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('lista usuarios con claim admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.summary.registered).toBe(2);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.storageFromSql).toBe(true);
    const lilian = res.body.users.find((u: { email: string }) => u.email === 'liliandiaza@gmail.com');
    expect(lilian.counts.tasks).toBe(4);
    expect(lilian.storageMb).toBe(0.25);
  });

  it('lista usuarios si el email es el dueño', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer owner-token');
    expect(res.status).toBe(200);
    expect(res.body.summary.planCounts.pro).toBe(1);
  });

  it('filtra por plan', async () => {
    const res = await request(app)
      .get('/api/admin/users?plan=pro')
      .set('Authorization', 'Bearer owner-token');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].plan).toBe('pro');
  });
});

describe('GET /api/admin/overview', () => {
  it('devuelve métricas agregadas al dueño', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer owner-token');
    expect(res.status).toBe(200);
    expect(res.body.registered).toBe(2);
    expect(res.body.totals.tasks).toBe(16);
    expect(res.body.totalStorageMb).toBe(2.25);
  });
});

describe('PATCH /api/admin/users/:id/plan', () => {
  it('rechaza a no-admin', async () => {
    const res = await request(app)
      .patch('/api/admin/users/other-uid/plan')
      .set('Authorization', 'Bearer valid-token')
      .send({ plan: 'pro' });
    expect(res.status).toBe(403);
  });

  it('otorga plan pro', async () => {
    const res = await request(app)
      .patch('/api/admin/users/other-uid/plan')
      .set('Authorization', 'Bearer owner-token')
      .send({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: 'other-uid', plan: 'pro' });
  });
});

describe('POST /api/auth/presence', () => {
  it('acepta heartbeat de un usuario autenticado', async () => {
    const res = await request(app)
      .post('/api/auth/presence')
      .set('Authorization', 'Bearer valid-token')
      .send({ path: '/board', appVersion: '2.18.0', platform: 'web' });
    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(true);
  });

  it('rechaza sin auth', async () => {
    const res = await request(app).post('/api/auth/presence').send({});
    expect(res.status).toBe(401);
  });
});
