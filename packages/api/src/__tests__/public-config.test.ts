import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';

describe('GET /api/public-config', () => {
  const app = buildApp();

  afterEach(() => {
    delete process.env.LANDING_ENABLED;
    delete process.env.PLAY_STORE_URL;
  });

  it('no requiere Authorization', async () => {
    const res = await request(app).get('/api/public-config');
    expect(res.status).toBe(200);
  });

  it('conserva el contrato actual y añade brand, publicAppUrl y landingEnabled', async () => {
    const res = await request(app).get('/api/public-config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      api: 'daily-tracker-api',
      spaHint: 'same-origin',
      configured: expect.any(Boolean),
      googleAuth: 'supabase-provider',
      emailConfigured: expect.any(Boolean),
      brand: expect.any(String),
      publicAppUrl: expect.any(String),
      landingEnabled: false,
      playStoreUrl: null,
    });
    expect(res.body.brand).toBe('Meteora');
    expect(res.body).toHaveProperty('supabaseUrl');
    expect(res.body).toHaveProperty('supabaseAnonKey');
  });

  it('no expone service role ni secretos', async () => {
    const res = await request(app).get('/api/public-config');
    expect(res.body).not.toHaveProperty('serviceRoleKey');
    expect(res.body).not.toHaveProperty('supabaseServiceRoleKey');
    expect(JSON.stringify(res.body)).not.toMatch(/service_role/i);
    expect(JSON.stringify(res.body)).not.toMatch(/RESEND/i);
  });

  it('publicAppUrl coincide con APP_PUBLIC_URL o el primer origen permitido', async () => {
    const res = await request(app).get('/api/public-config');
    expect(res.body.publicAppUrl).toBe('http://localhost:3005');
  });

  it('lee LANDING_ENABLED en runtime sin rebuild', async () => {
    process.env.LANDING_ENABLED = 'true';
    const on = await request(app).get('/api/public-config');
    expect(on.body.landingEnabled).toBe(true);

    process.env.LANDING_ENABLED = 'false';
    const off = await request(app).get('/api/public-config');
    expect(off.body.landingEnabled).toBe(false);
  });

  it('expone playStoreUrl cuando PLAY_STORE_URL está definida', async () => {
    process.env.PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cerebrostudios.dailytracker';
    const res = await request(app).get('/api/public-config');
    expect(res.body.playStoreUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.cerebrostudios.dailytracker',
    );
  });
});
