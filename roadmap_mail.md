# Roadmap: Resend + login/registro con Google

Estado del código (2026-07): **casi todo está implementado**. Habilitar Resend y Google es sobre todo **configuración externa** + smoke tests. Detalle operativo: [`docs/AUTH_AND_EMAIL.md`](docs/AUTH_AND_EMAIL.md).

---

## Mapa de responsabilidades

| Canal | Quién | Resend? | Código |
|-------|--------|---------|--------|
| Recordatorios de tareas/eventos | API Railway | **Sí** | `packages/api/src/lib/email.ts`, `notificationDispatch.ts` |
| Confirmación de cuenta / reset password | **Supabase Auth** | Opcional (SMTP) | Plantillas Supabase, no la API de la app |
| Login / registro Google | Supabase OAuth + Google Cloud | No | `AuthContext.signInWithGoogle`, `Login.tsx` |

Variables clave:

- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`, `APP_NAME`
- `RUN_EMBEDDED_WORKER`, `NOTIFICATIONS_INTERVAL_MS`
- Supabase: provider Google + Redirect URLs
- Google Cloud: OAuth Client Web + redirect `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

---

## Fase 0 — Decisiones

| Decisión | Recomendación |
|----------|----------------|
| Dominio propio para `EMAIL_FROM` | Sí en prod (`Daily Tracker <noreply@tudominio.com>`). Dev: `onboarding@resend.dev` solo a mails de prueba Resend. |
| Confirmación de email al registrarse | Menos fricción: auto-confirm o SMTP Resend + plantillas claras. |
| Google web vs Android | Primero **web prod**; Android después (deep links). |

---

## Fase 1 — Resend en producción (notificaciones)

### 1.1 Cuenta y dominio
- [ ] Cuenta en [resend.com](https://resend.com)
- [ ] Dominio añadido y verificado (SPF, DKIM; DMARC recomendado)
- [ ] Remitente de prod definido

### 1.2 Railway (API / monorepo)
```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=Daily Tracker <noreply@tudominio.com>
APP_PUBLIC_URL=https://tu-dominio-prod
APP_NAME=Daily Tracker
RUN_EMBEDDED_WORKER=true
NOTIFICATIONS_INTERVAL_MS=60000
```

### 1.3 App y datos
- [ ] Usuario activa **notificaciones por email** en Config (`notifyEmail`)
- [ ] Tabla `notification_deliveries` aplicada (ver `supabase/schema.sql`)
- [ ] Probar `POST /api/notifications/test-email` (con sesión) o un recordatorio real
- [ ] Health / logs: `emailConfigured: true`, sin `email skipped (RESEND_API_KEY not set)`

### 1.4 Código
| Tarea | Estado |
|-------|--------|
| Cliente HTTP Resend | Hecho (`email.ts`) |
| Worker de recordatorios | Hecho |
| UI preferencias email | Hecho (Settings) |
| Plantillas HTML polish | Opcional |
| Presupuesto / rate limit | Opcional |

**Criterio de hecho fase 1:** un correo de recordatorio llega a un inbox real desde prod.

---

## Fase 2 — Google login / registro (web)

### 2.1 Google Cloud Console
- [ ] OAuth consent screen (External o Internal)
- [ ] OAuth Client ID tipo **Web application**
- [ ] Authorized JavaScript origins:
  - `http://localhost:3005`
  - `https://tu-dominio-prod`
- [ ] Authorized redirect URIs (el de **Supabase**, no solo la SPA):

  ```text
  https://<PROJECT_REF>.supabase.co/auth/v1/callback
  ```

- [ ] Client ID + Client Secret copiados

### 2.2 Supabase Auth
- [ ] Authentication → Providers → **Google** → Enable + secrets
- [ ] URL configuration:
  - **Site URL**: dominio prod (en pruebas locales: `http://localhost:3005`)
  - **Redirect URLs** allowlist:
    - `http://localhost:3005/**` (o rutas exactas)
    - `https://tu-dominio-prod/**`
    - Android (fase 4): `com.cerebrostudios.dailytracker://auth/callback`

### 2.3 App (ya implementado)
1. Botón «Continuar con Google» → `signInWithOAuth`
2. `redirectTo` → `/board` o ruta de origen (`location.state.from`)
3. Sesión vía `onAuthStateChange` / `getSession`
4. Primer acceso → `POST /api/auth/bootstrap` (perfil)

### 2.4 Mejoras de producto
| Mejora | Estado |
|--------|--------|
| redirect post-OAuth a `/board` | Hecho |
| Errores OAuth claros en Login | Hecho |
| Doc `docs/AUTH_AND_EMAIL.md` | Hecho |
| Indicador en Settings “Email/Google listo” | Opcional |
| Android deep links | Fase 4 |

### 2.5 Criterios de hecho
- [ ] Login Google en localhost
- [ ] Login Google en prod
- [ ] Usuario nuevo Google → perfil bootstrap
- [ ] Email + password sigue funcionando

### Errores frecuentes
| Síntoma | Causa |
|---------|--------|
| `redirect_uri_mismatch` | Falta callback Supabase en Google Cloud |
| Vuelve a localhost en prod | Site URL de Supabase mal puesto |
| Provider disabled | Google no enabled en Supabase |
| Usuario sin perfil | Bootstrap / `SUPABASE_SERVICE_ROLE_KEY` en API |

---

## Fase 3 — Auth emails (confirm / reset) vía Resend — opcional

Los mails de Auth **no** pasan por `packages/api`. Para unificar marca:

1. Resend → credenciales SMTP  
2. Supabase → Project Settings → Authentication → **SMTP**  
3. Sender = dominio verificado  
4. Plantillas Confirm signup / Reset password  

### Checklist
- [ ] SMTP Resend en Supabase
- [ ] Plantillas personalizadas
- [ ] Reset password E2E

---

## Fase 4 — Android OAuth

Ver `docs/ANDROID.md` y `roadmap_android.md`.

- [ ] Redirect `com.cerebrostudios.dailytracker://auth/callback` en Supabase  
- [ ] Probar `App.appUrlOpen` / Custom Tabs en dispositivo real  
- [ ] No mezclar mal Client IDs Android vs Web  

---

## Orden de ejecución

```text
1) Resend dominio + env Railway          → recordatorios OK
2) Google Cloud + Supabase provider      → botón Google funciona
3) Redirect URLs prod + smoke test       → login/registro estable
4) SMTP Auth con Resend (opcional)       → confirm/reset de marca
5) Android OAuth deep links              → app nativa
6) Polish opcional (health en Settings)  → visibilidad ops
```

**Estimación:** fases 1–3 ≈ configuración (0–2 h) si dominios y accesos están listos. Código de app mínimo. Android ≈ medio día con pruebas.

---

## Fuera de alcance

- Cambiar Auth a Firebase/Clerk  
- Reescribir el worker de notificaciones  
- Newsletters / marketing masivo  
- Crear usuarios con `INSERT` SQL en `auth.users` (usar Dashboard, Admin API, signup o Google)

---

## Crear usuarios (recordatorio)

| Método | Uso |
|--------|-----|
| UI registro / Google | Normal |
| Supabase Dashboard → Add user | Invitaciones |
| `auth.admin.createUser` (service role) | Scripts |
| SQL en `auth.users` | **Evitar** |

---

## Checklist global (copiar/pegar)

### Resend
- [ ] Dominio verificado  
- [ ] `RESEND_API_KEY` en Railway  
- [ ] `EMAIL_FROM` con dominio verificado  
- [ ] `APP_PUBLIC_URL` correcto  
- [ ] Test email OK  
- [ ] `notifyEmail` con recordatorio real  

### Google
- [ ] Consent screen  
- [ ] Client Web + redirect Supabase  
- [ ] Provider Google ON  
- [ ] Redirect URLs local + prod  
- [ ] Login Google local OK  
- [ ] Login Google prod OK  
- [ ] Bootstrap perfil OK  

### Auth email (opcional)
- [ ] SMTP Resend en Supabase  
- [ ] Plantillas confirm/reset  
- [ ] Reset E2E  

### Android (después)
- [ ] Deep link callback en Supabase  
- [ ] Prueba en dispositivo  

---

## Resumen

- **Resend** ya está cableado para recordatorios → falta dominio + secrets + prueba real.  
- **Google** ya está cableado en UI → falta Google Cloud + Supabase Auth.  
- Unificar mails de Auth se hace con **SMTP Resend en Supabase**, no reimplementando signup en la API.  

Referencia viva de pasos: [`docs/AUTH_AND_EMAIL.md`](docs/AUTH_AND_EMAIL.md).  
