# Roadmap: Resend + login/registro con Google

Estado: **código de producto listo** para Resend (recordatorios) y Google (UI/OAuth).  
Lo que falta es **configuración en consolas externas** (Resend, Railway, Google Cloud, Supabase).

Guía operativa paso a paso: [`docs/AUTH_AND_EMAIL.md`](docs/AUTH_AND_EMAIL.md).

---

## Hecho por el agente (código + docs)

| Entrega | Dónde |
|---------|--------|
| Cliente Resend HTTP + skip sin key | `packages/api/src/lib/email.ts` |
| Worker recordatorios email | `notificationDispatch.ts`, `notificationsWorker.ts` |
| Test email desde Settings / Notifications | `POST /api/notifications/test-email` |
| Preferencias `notifyEmail` + modos | Settings → Notificaciones |
| Botón y flujo Google OAuth | `Login.tsx`, `AuthContext.signInWithGoogle` |
| Redirect post-Google a `/board` (o ruta de origen) | `AuthContext` |
| Errores OAuth/email legibles en login | `Login.tsx` |
| Status Resend en Settings → Sistema | `/api/version` → `emailConfigured`, `emailWorkerEnabled`, `emailFrom` |
| Public config hint email | `/api/public-config` |
| Env de ejemplo API con Resend | `packages/api/.env.example` |
| Script alta usuario (Admin API, no SQL) | `scripts/create-user.mjs` |
| Doc operativa | `docs/AUTH_AND_EMAIL.md` |
| Este roadmap | `roadmap_mail.md` |
| README enlaces Auth/Email | `README.md` |

### Cómo ver el estado Resend en la app

1. Configuración → pestaña **Sistema**.  
2. Fila **Email (Resend)**:
   - **Configurado** = hay `RESEND_API_KEY` en la API.  
   - **Sin API key** = en Railway/local no está la variable.  
3. Botón de prueba: Notificaciones → **Enviar email de prueba** (requiere key + `notifyEmail`).

### Alta de usuario por script (opcional)

```bash
# PowerShell
$env:SUPABASE_URL="https://XXXX.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
node scripts/create-user.mjs --email user@example.com --password "minimo6" --name "Nombre"
```

No usar `INSERT` en `auth.users`.

---

## Pendiente para ti (configuración externa)

### Fase 1 — Resend prod
- [ ] Cuenta Resend + dominio verificado (SPF/DKIM)
- [ ] Railway: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`
- [ ] Confirmar en Sistema: Email = Configurado
- [ ] Test email a inbox real
- [ ] Recordatorio real con `notifyEmail` ON

### Fase 2 — Google web
- [ ] Google Cloud: OAuth consent + Client Web
- [ ] Redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- [ ] Supabase: Provider Google ON + secrets
- [ ] Redirect allowlist local (`http://localhost:3005/**`) + prod
- [ ] Login Google local y prod OK
- [ ] Primer acceso crea perfil (bootstrap)

### Fase 3 — Auth mails (confirm/reset) vía Resend — opcional
- [ ] SMTP Resend en Supabase Auth
- [ ] Plantillas confirm / reset
- [ ] Reset password E2E

### Fase 4 — Android OAuth
- [ ] Redirect `com.cerebrostudios.dailytracker://auth/callback`
- [ ] Prueba dispositivo (ver `docs/ANDROID.md`)

---

## Mapa de responsabilidades

| Canal | Quién | Resend? |
|-------|--------|---------|
| Recordatorios de tareas | API Railway | **Sí** (código listo) |
| Confirm / reset password | Supabase Auth | Opcional SMTP Resend |
| Login Google | Supabase + Google Cloud | No |

Variables:

```env
RESEND_API_KEY=
EMAIL_FROM=Daily Tracker <noreply@tudominio.com>
APP_PUBLIC_URL=https://tu-dominio-prod
APP_NAME=Daily Tracker
RUN_EMBEDDED_WORKER=true
NOTIFICATIONS_INTERVAL_MS=60000
```

---

## Orden recomendado (solo ops)

```text
1) Resend dominio + env Railway     → Sistema muestra Email configurado
2) Test email desde la app
3) Google Cloud + Supabase provider → botón Google funciona
4) Smoke local + prod
5) SMTP Auth Resend (opcional)
6) Android deep links
```

---

## Fuera de alcance / no hacer

- Reescribir Auth a Firebase/Clerk  
- SQL manual en `auth.users` para contraseñas  
- Newsletters masivos  

---

## Criterios de cierre del roadmap

| Criterio | Owner |
|----------|--------|
| Código envío + worker + UI + status | **Agente — hecho** |
| Resend envía a inbox real en prod | **Tú** |
| Google login prod | **Tú** |
| Docs y script create-user | **Agente — hecho** |
