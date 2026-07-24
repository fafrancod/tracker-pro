# Play Store — checklist Daily Tracker

Guía operativa para publicar el AAB de Capacitor. Detalle técnico de build: [`ANDROID.md`](./ANDROID.md).

## Antes de subir

| # | Item | Notas |
|---|------|--------|
| 1 | Cuenta Google Play Console | Pago único de registro developer |
| 2 | Keystore de release | Generar una vez; **backup offline** (si se pierde, no se puede actualizar la app) |
| 3 | `keystore.properties` local o secrets CI | Ver `packages/web/android/keystore.properties.example` |
| 4 | Build firmado | `npm run build:android` + `./gradlew bundleRelease` o workflow **Android** con secrets |
| 5 | `VITE_API_BASE_URL` de producción en el build web | El APK no usa same-origin |
| 6 | Privacy policy URL pública | HTTPS; enlázala en Play Console |
| 7 | Capturas (teléfono + 7") | Mínimo 2; recomendado board + Eisenhower + settings |
| 8 | Icono 512 + feature graphic 1024×500 | Desde `public/icons/icon-512.png` |

## Data safety (resumen)

Completa el formulario según el producto real:

| Dato | Recogida | Uso |
|------|----------|-----|
| Email / cuenta | Sí (Supabase Auth) | Account management |
| Contenido de tareas | Sí | App functionality |
| Identificadores de dispositivo | Posible (analytics futuro) | Solo si activas analytics/crash |
| Ubicación precisa | No | — |

Cifrado en tránsito: **sí** (HTTPS).  
Eliminación de cuenta: documentar proceso (Supabase + borrar perfil) cuando exista en producto.

## Secrets de GitHub (AAB firmado en CI)

Repo → Settings → Secrets and variables → Actions:

| Secret | Contenido |
|--------|-----------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | password del store |
| `ANDROID_KEY_ALIAS` | alias (ej. `dailytracker`) |
| `ANDROID_KEY_PASSWORD` | password de la key |

Variables (no secretas):

| Variable | Ejemplo |
|----------|---------|
| `VITE_API_BASE_URL` | `https://tu-app.up.railway.app` |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |

Workflow: [`.github/workflows/android.yml`](../.github/workflows/android.yml)  
- Siempre: **debug APK** artifact  
- Con secrets: **release AAB** artifact  

## App Links (opcional)

1. En `AndroidManifest.xml`, descomenta el `intent-filter` HTTPS y pon tu host.
2. Publica en tu dominio:

`https://TU_HOST/.well-known/assetlinks.json`

Plantilla: [`public-well-known/assetlinks.json.example`](./public-well-known/assetlinks.json.example).

3. Sustituye `sha256_cert_fingerprints` por el fingerprint del **certificado de firma de Play** (o el de tu upload key).

```bash
keytool -list -v -keystore release.keystore -alias dailytracker
```

## Orden recomendado de publicación

1. Internal testing track con AAB firmado  
2. Closed testing (amigos / beta)  
3. Production  

## Fuera de scope de CI

- Subida automática a Play (necesita service account JSON de Play API — opcional después)  
- iOS / App Store  
- Push FCM (añadir `google-services.json` cuando toque)
