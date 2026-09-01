import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';

const app = buildApp();

describe('requireAuth middleware', () => {
  it('rechaza requests sin Authorization', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rechaza tokens invalidos', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
  });

  it('acepta token valido pero falla por payload invalido (zod)', async () => {
    // El token mockeado en setup.ts ("valid-token") devuelve uid + email.
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ weekId: 'malformed', dayId: 'malformed', title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('POST /api/auth/bootstrap', () => {
  it('rechaza sin auth', async () => {
    const res = await request(app).post('/api/auth/bootstrap').send({});
    expect(res.status).toBe(401);
  });

  it('crea el perfil cuando no existe (201)', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      uid: 'test-uid',
      created: true,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        plan: 'free',
      },
    });
    expect(res.body.profile.settings.onboardingTourCompleted).toBe(false);
  });
});

describe('DELETE /api/auth/me', () => {
  it('rechaza sin auth', async () => {
    const res = await request(app).delete('/api/auth/me').send({ email: 'test@example.com' });
    expect(res.status).toBe(401);
  });

  it('rechaza si el email no coincide', async () => {
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: 'otro@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('borra la cuenta cuando el email coincide (sin body)', async () => {
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: 'TEST@example.com' });
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});

describe('rutas inexistentes', () => {
  it('devuelve 404 con estructura de error normalizada', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
