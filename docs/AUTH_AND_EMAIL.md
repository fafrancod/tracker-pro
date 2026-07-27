# Auth (Google) + Email (Resend)

Guía operativa. El código de la app **ya soporta** ambos; este doc es checklist de configuración.

## Mapa de responsabilidades

| Canal | Quién lo envía / resuelve | Env vars / consola |
|-------|---------------------------|--------------------|
| Recordatorios de tareas (email) | API Railway → **Resend HTTP** | `RESEND_API_KEY`, `EMAIL_FROM` |
| Confirmación de cuenta / reset password | **Supabase Auth** (SMTP) | Opcional: SMTP de Resend en Supabase |
| Login / registro con Google | Supabase OAuth + Google Cloud | Provider Google + redirect URLs |

Código relevante:

- `packages/api/src/lib/email.ts` — envío Resend
- `packages/api/src/lib/notificationDispatch.ts` — worker de recordatorios
- `packages/web/src/contexts/AuthContext.tsx` — `signInWithGoogle`, email/password
- `packages/web/src/pages/Login.tsx` — UI

---

## 1. Resend (notificaciones de producto)

### 1.1 Resend
1. Cuenta en [resend.com](https://resend.com).
2. Añade y verifica un **dominio** (SPF + DKIM; DMARC recomendado).
3. Remitente de prod, p. ej. `Daily Tracker <noreply@tudominio.com>`.
4. En desarrollo sin dominio: `onboarding@resend.dev` solo envía a destinatarios de prueba de Resend.

### 1.2 Railway (servicio API / monorepo)

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=Daily Tracker <noreply@tudominio.com>
APP_PUBLIC_URL=https://tu-dominio-prod
APP_NAME=Daily Tracker
RUN_EMBEDDED_WORKER=true
NOTIFICATIONS_INTERVAL_MS=60000
```

### 1.3 App
1. Usuario: Config → notificaciones → activar **email** (`notifyEmail`).
2. Probar:
   - `POST /api/notifications/test-email` (con sesión), o
   - crear un recordatorio con ventana cercana y esperar el worker.
3. Health: respuesta de la API con `emailConfigured: true` cuando hay key.

### Checklist Resend
- [ ] Dominio verificado en Resend
- [ ] `RESEND_API_KEY` en Railway
- [ ] `EMAIL_FROM` con dominio verificado
- [ ] `APP_PUBLIC_URL` correcto
- [ ] Correo de prueba recibido
- [ ] Logs sin `email skipped (RESEND_API_KEY not set)`

---

## 2. Google login / registro (web)

### 2.1 Google Cloud Console
1. **APIs & Services → OAuth consent screen** (External o Internal).
2. **Credentials → Create OAuth client ID → Web application**.
3. **Authorized JavaScript origins**:
   - `http://localhost:3005`
   - `https://tu-dominio-prod`
4. **Authorized redirect URIs** (el de Supabase, no solo tu SPA):

   ```text
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```

5. Copia **Client ID** y **Client Secret**.

### 2.2 Supabase
1. **Authentication → Providers → Google** → Enable → pegar ID y secret.
2. **Authentication → URL configuration**:
   - **Site URL**: `https://tu-dominio-prod` (en local de pruebas: `http://localhost:3005`).
   - **Redirect URLs** (allowlist):
     - `http://localhost:3005/**` (o rutas exactas)
     - `https://tu-dominio-prod/**`
     - Android (después): `com.cerebrostudios.dailytracker://auth/callback`

### 2.3 App
1. Abrir `/login` → **Continuar con Google**.
2. Tras OAuth, la app redirige a `/board` (o a la ruta guardada en `location.state.from`).
3. Primer acceso: `POST /api/auth/bootstrap` crea el perfil.

### Checklist Google
- [ ] Consent screen listo (testing o production)
- [ ] Client Web + redirect `.../auth/v1/callback`
- [ ] Provider Google enabled
- [ ] Redirect URLs local + prod
- [ ] Login Google en localhost OK
- [ ] Login Google en prod OK
- [ ] Perfil bootstrap en primer acceso OK
- [ ] Email/password sigue funcionando

### Errores frecuentes
| Síntoma | Causa típica |
|---------|----------------|
| `redirect_uri_mismatch` | Falta el callback de Supabase en Google Cloud |
| Vuelve a localhost en prod | Site URL de Supabase mal puesto |
| Botón no hace nada / provider disabled | Google no enabled en Supabase |
| Usuario sin perfil | Fallo de bootstrap / API sin `SUPABASE_SERVICE_ROLE_KEY` |

---

## 3. Auth emails (confirm / reset) vía Resend — opcional

Los mails de **Auth** no pasan por `packages/api`. Para marca unificada:

1. Resend → credenciales SMTP (o docs “SMTP” de Resend).
2. Supabase → **Project Settings → Authentication → SMTP**.
3. Sender = mismo dominio verificado.
4. Personalizar plantillas (Confirm signup, Reset password).

### Checklist Auth SMTP
- [ ] SMTP Resend en Supabase
- [ ] Plantillas confirm / reset
- [ ] Reset password E2E

---

## 4. Android (después de web)

Ver `docs/ANDROID.md` (deep links OAuth):

- Redirect: `com.cerebrostudios.dailytracker://auth/callback` en Supabase.
- Probar en dispositivo real.

---

## 5. Crear usuarios (no usar SQL en `auth.users`)

| Método | Uso |
|--------|-----|
| UI registro / Google | Normal |
| Dashboard Supabase → Add user | Invitaciones admin |
| `auth.admin.createUser` (service role) | Scripts |
| `INSERT` SQL en `auth.users` | **Evitar** |

---

## Orden recomendado

1. Resend dominio + env Railway  
2. Google Cloud + Supabase provider  
3. Smoke test local + prod  
4. SMTP Auth con Resend (opcional)  
5. Android OAuth  
