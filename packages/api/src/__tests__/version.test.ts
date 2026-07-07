import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';

describe('GET /api/version', () => {
  const app = buildApp();

  it('responde 200 con metadata del servicio', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: 'daily-tracker-api',
      channel: expect.any(String),
      version: expect.any(String),
    });
    expect(typeof res.body.enforceAppCheck).toBe('boolean');
  });

  it('no requiere Authorization', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
  });
});
