# Android (Capacitor) — Daily Tracker

Shell nativo sobre la SPA web. **No reescribe UI**: empaqueta `packages/web/dist` en un WebView.

| | |
|--|--|
| App id | `com.cerebrostudios.dailytracker` |
| Proyecto | `packages/web/android/` |
| Config | `packages/web/capacitor.config.ts` |

## Requisitos en tu máquina

1. **Node 22+** (ya del monorepo)
2. **Android Studio** (SDK + platform tools)
3. JDK 17+ (el que trae Android Studio suele bastar)
4. Variable `ANDROID_HOME` / SDK configurado

No hace falta generar el proyecto Android otra vez: ya está en el repo (`cap add android` hecho).

## Build y abrir en Android Studio

Desde la raíz del monorepo:

```bash
# 1) Build SPA + copiar a android/assets
npm run build:android

# 2) Abrir el IDE nativo
npm run android:open
```

En Android Studio: elige un emulador o dispositivo → **Run**.

### Variables importantes al build web

El WebView **no es same-origin** con Railway. Debes compilar la web apuntando a la API pública:

```bash
# Ejemplo (PowerShell)
$env:VITE_API_BASE_URL="https://tu-app.up.railway.app"
$env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="eyJ..."
npm run build:android
```

| Variable | Uso en native |
|----------|----------------|
| `VITE_API_BASE_URL` | **Obligatoria** en APK (URL absoluta HTTPS de la API/SPA host) |
| `VITE_SUPABASE_URL` / `ANON_KEY` | Auth + datos (igual que PWA) |

En el servidor API, `ALLOWED_ORIGINS` debe incluir el origen del WebView si usas CORS estricto. Con Capacitor 8 + `androidScheme: 'https'` el origen típico es:

`https://localhost`

(Añade ese origen o desactiva CORS restrictivo para ese host.)

## Live reload (dev en dispositivo)

1. `npm run dev:web` en el PC (misma Wi‑Fi que el teléfono).
2. Anota la IP LAN del PC (`ipconfig`).
3. ```bash
   cd packages/web
   $env:CAP_SERVER_URL="http://192.168.1.XX:3005"
   npx cap run android
   ```

## Deep links y OAuth Google

- Custom scheme ya declarado: `com.cerebrostudios.dailytracker://`
- En Supabase → Auth → URL configuration, añade redirect URLs, p. ej.:
  - `com.cerebrostudios.dailytracker://auth/callback`
  - `https://tu-dominio/board` (si usas App Links)
- El listener `App.appUrlOpen` en `src/lib/capacitor.ts` redirige la SPA.

Para **Android App Links** verificados (abrir `https://tu-dominio/...` en la app):

1. Descomenta el `intent-filter` HTTPS en `AndroidManifest.xml` y pon tu `host`.
2. Publica `/.well-known/assetlinks.json` en el dominio (ver [docs Google](https://developer.android.com/training/app-links)).

## Iconos nativos

Los mipmap por defecto de Capacitor son genéricos. Para branding:

1. Usa Android Studio → **Image Asset** con `packages/web/public/icons/icon-512.png`
2. O regenera PNG web: `npm run icons --workspace=packages/web`

## Generar AAB / APK de release

1. `npm run build:android` con vars de producción.
2. Android Studio → **Build → Generate Signed Bundle / APK**.
3. Crea un keystore (guárdalo fuera del git).
4. Sube el **AAB** a Play Console.

Checklist Play Store (resumen): privacy policy, Data safety, target API actual, capturas, política de contenido.

## Scripts npm

| Script | Dónde | Qué hace |
|--------|--------|----------|
| `npm run build:android` | root / web | `vite build` + `cap sync android` |
| `npm run android:open` | root | Abre Android Studio |
| `npm run cap:sync` | web | Solo sync (tras un build) |

## Troubleshooting

| Problema | Qué mirar |
|----------|-----------|
| Login / API fallan en el emulador | `VITE_API_BASE_URL` vacío → same-origin no aplica en native |
| CORS | `ALLOWED_ORIGINS` con `https://localhost` |
| `cap sync` sin assets | Correr `npm run build` en web antes |
| Gradle fail | Abre el proyecto en Android Studio y deja que baje el SDK |
| OAuth vuelve al browser y no a la app | Redirect URI + intent-filter scheme |

## Relación con PWA

| Canal | Cuándo |
|-------|--------|
| **PWA** (Chrome install) | Mayoría de usuarios; sin Play Store |
| **Capacitor APK/AAB** | Listado Play, deep links nativos, status bar |

Roadmap general: [`../roadmap_android.md`](../roadmap_android.md).
