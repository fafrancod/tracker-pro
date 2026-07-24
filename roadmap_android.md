# Roadmap Android — Daily Tracker

Cómo hacer la app **usable y publicable en Android**, partiendo de lo que ya existe (PWA + UI mobile + monorepo con `packages/core` sin DOM).

**Recomendación corta:**  
1) **Fase 0–2** = PWA instalable en Android (Chrome “Añadir a la pantalla de inicio”) — máximo valor / mínimo coste.  
2) **Fase 3** = Capacitor solo si quieres APK/AAB en Play Store o plugins nativos.  
3) **Fase 4** = React Native/Expo solo si el producto nativo justifica reescribir UI.

---

## Estado actual (inventario)

| Pieza | Estado | Nota |
|-------|--------|------|
| UI mobile (drawer, FAB, sheets) | ✅ | `Layout`, `MobileDrawer`, `mobile-sheet` |
| Viewport + `viewport-fit=cover` | ✅ | `packages/web/index.html` |
| PWA (`vite-plugin-pwa`) | ✅ | manifest + service worker en build |
| Manifest `display: standalone` | ✅ | `start_url: /board`, `orientation: portrait` |
| Iconos PWA | ✅ | PNG 192/512 + maskable + apple-touch (script `npm run icons` en web) |
| Offline de datos (tareas) | ✅ S3 | Cache lectura local + cola create/update/delete/move + banner |
| Push notifications | ❌ | No implementado |
| Safe area (notch / gesture bar) | ✅ | FAB, header, bottom sheets usan `env(safe-area-inset-*)` |
| Touch / long-press menú | ✅ | Long-press + botón ⋮ en mobile; TouchSensor dnd-kit |
| Install banner | ✅ | `PwaInstallBanner` + beforeinstallprompt |
| Capacitor / APK | ✅ S4 bootstrap | `packages/web/android`, appId `com.cerebrostudios.dailytracker` — ver `docs/ANDROID.md` |
| `packages/mobile` RN | ❌ | Contrato en docs; sin bootstrap |
| Core reutilizable | ✅ | Lógica en `packages/core` sin imports web |

**Hoy, en un Android con Chrome:** puedes abrir la URL de producción (Railway), iniciar sesión y usar el board. La experiencia “app” (standalone) mejora al instalar la PWA, con matices de iconos e instalabilidad.

---

## Quick path — usable en Android esta semana

1. Despliega `main` en Railway (HTTPS obligatorio).
2. En el teléfono: Chrome → abre la URL → menú → **Instalar app** / **Añadir a pantalla de inicio**.
3. Valida login Supabase (redirect / deep links si usas OAuth Google).
4. Smoke en **360×800** y **412×915**: board (día/semana lista+horario), crear tarea con hora, Eisenhower, settings.
5. Si “Instalar” no aparece: revisa HTTPS, manifest, iconos PNG (Fase 1).

---

## Estrategia por fases

```text
Fase 0  Hardening mobile UX (web)
   ↓
Fase 1  PWA “store-quality” Android
   ↓
Fase 2  Offline / resiliencia
   ↓
Fase 3  Capacitor (APK/AAB opcional)     ← solo si hace falta Play Store o nativo
   ↓
Fase 4  React Native / Expo (opcional) ← solo si se reescribe UI nativa
```

### Fase 0 — Hardening mobile UX (web)

Hacer que **ya en el navegador Android** se sienta sólida.

| # | Trabajo | Por qué |
|---|---------|---------|
| 0.1 | Targets táctiles ≥ 44px en botones densos (week cards, cycle-select, toolbar) | Android Material / accesibilidad |
| 0.2 | `padding-bottom: env(safe-area-inset-bottom)` en FAB, bottom bars, drawers | Evita solaparse con la barra de gestos |
| 0.3 | `overscroll-behavior` y scroll containers con `min-h-0` (ya parcialmente) | Evita “rubber band” que rompe el board |
| 0.4 | Context menu: en mobile preferir long-press o menú ⋮ (right-click no existe) | `TaskContextMenu` hoy asume mouse |
| 0.5 | DnD semanal: activación táctil (`TouchSensor` en dnd-kit) o desactivar drag en touch | Arrastre con dedo suele fallar solo con PointerSensor |
| 0.6 | Inputs `type="time"` / date: probar WebView Chrome Android (formato 24h ok) | Horarios recién añadidos |
| 0.7 | Teclado virtual: no ocultar el sheet de crear tarea (`visualViewport` o padding dinámico) | Critico en create/edit |
| 0.8 | Skins light: `theme-color` meta dinámico al cambiar skin | Barra de estado del sistema |
| 0.9 | QA checklist 360px: semana 7 cols + horario densos | Ya densa; verificar legibilidad real |

**Done when:** un usuario Android puede completar el flujo login → crear tarea con hora → marcar hecha → undo, sin gestos rotos.

### Fase 1 — PWA instalable “de verdad” en Android

| # | Trabajo | Detalle |
|---|---------|---------|
| 1.1 | Iconos **PNG** 192 y 512 + maskable (safe zone 80%) | Generar desde el logo; Android maltrata SVG en install prompts |
| 1.2 | Actualizar `vite.config.ts` manifest `icons` a PNG + `purpose: "any"` y `"maskable"` por separado | Best practice Chrome |
| 1.3 | `apple-touch-icon` PNG 180 (por si se usa desde tablet/otros) | Bonus |
| 1.4 | `theme_color` / `background_color` alineados al skin default o dinámicos | Coherencia splash |
| 1.5 | `id` en web app manifest (Chrome) si aplica | Estabilidad de updates de PWA |
| 1.6 | Banner “Instalar Daily Tracker” (beforeinstallprompt) opcional en Android Chrome | Mejora descubrimiento |
| 1.7 | Service worker: no cachear API mutante; solo assets (ya casi así) | Evitar datos viejos |
| 1.8 | Documentar en README “Instalar en Android” (3 pasos) | Onboarding |

**Criterio de instalación Chrome:** HTTPS + manifest válido + SW + iconos 192/512.

**Done when:** en Android Chrome aparece “Instalar app” y el icono en el launcher abre `/board` en standalone.

### Fase 2 — Offline y resiliencia (calidad “app”)

| # | Trabajo | Detalle |
|---|---------|---------|
| 2.1 | UI offline banner (`navigator.onLine` + eventos) | Expectativa clara |
| 2.2 | Cola de mutaciones offline (create/complete/edit) + sync al reconectar | IndexedDB o store persist |
| 2.3 | Cache lectura: última semana/día en local (TTL) | Abrir app en metro |
| 2.4 | Conflicto: last-write-wins documentado o merge por `updatedAt` | Evitar sorpresas |
| 2.5 | SW: precache shell; network-first para `/api/*` | Workbox strategies |
| 2.6 | Demo mode usable 100% offline (ya local) | Showcase sin red |

**Done when:** sin red se ve el último board y se pueden marcar tareas; al volver online se sincroniza sin perder datos.

### Fase 3 — Shell nativo (Capacitor) → APK / Play Store

Solo si necesitas: listado en Play Store, notificaciones nativas, o icono “app de verdad” sin depender del menú de Chrome.

| # | Trabajo | Detalle |
|---|---------|---------|
| 3.1 | Añadir `@capacitor/core` + CLI; `npx cap init` | App id p.ej. `com.cerebrostudios.dailytracker` |
| 3.2 | Build web → `cap sync android` | Pipeline: `npm run build:prod` + sync |
| 3.3 | Configurar `AndroidManifest`, deep links Supabase Auth | `https://tu-dominio/*` y custom scheme |
| 3.4 | Plugin StatusBar / Splash / Safe Area / Keyboard | UX nativa |
| 3.5 | Push: FCM + edge function o API | Opcional; recordatorios de tareas |
| 3.6 | Firma release, Play App Signing, privacy policy URL | Requisitos store |
| 3.7 | CI: build AAB en GitHub Actions | Opcional pero recomendable |
| 3.8 | Data safety form Play Console | Auth + datos de tareas |

**Stack sugerido:** Capacitor 6/7 sobre la SPA actual (no reescribir UI).

**Done when:** AAB instalable en un dispositivo físico; login y board funcionan igual que en PWA.

### Fase 4 — React Native / Expo (opcional, largo plazo)

Solo si:

- rendimiento de listas/calendario en web no basta, o  
- quieres UI 100% nativa y equipo dispuesto a mantener dos UIs.

| # | Trabajo | Detalle |
|---|---------|---------|
| 4.1 | Bootstrap `packages/mobile` con Expo | |
| 4.2 | Reusar `@daily-tracker/core` (hooks, store, services) | Ya es el diseño del monorepo |
| 4.3 | Navegación nativa + calendarios (Agenda / Timeline) | Reimplementar vistas, no copiar DOM |
| 4.4 | Auth Supabase RN | |
| 4.5 | Feature parity con web (Eisenhower, series, horarios) | Plan por épicas |

**No empezar Fase 4** hasta que PWA+Capacitor no cubran el producto.

---

## Decisiones cerradas (propuesta de producto)

| Tema | Decisión |
|------|----------|
| Camino principal Android | **PWA primero** |
| Play Store | **Capacitor** cuando haga falta AAB |
| Lógica de negocio | Siempre en `packages/core` |
| Auth | Supabase (email; Google con redirect HTTPS) |
| Offline v1 | Lectura cache + cola de complete/create |
| Notificaciones v1 | Opcional post-PWA (FCM vía Capacitor o Web Push limitado) |

---

## Gaps de UX Android (checklist de deuda conocida)

- [ ] Context menu solo con clic derecho → long-press / menú ⋮  
- [ ] Drag-and-drop semana sin TouchSensor dnd-kit  
- [ ] Iconos PWA SVG → PNG maskable  
- [ ] Safe-area en FAB y bottom sheets  
- [ ] `theme-color` no sigue el skin  
- [ ] Semana 7 columnas en 360px: densidad alta (ya dense; validar con usuarios)  
- [ ] OAuth Google: redirect URLs en Supabase para dominio prod  
- [ ] Deep link recovery password / magic link en WebView vs Chrome  

---

## Auth y red en Android

| Escenario | Acción |
|-----------|--------|
| Email + password | OK en PWA y Capacitor |
| Google OAuth | Añadir redirect `https://<prod>/...` en Supabase Auth; probar Custom Tabs |
| Capacitor | Configurar `allowNavigation` / deep link al host de la API |
| CORS | `ALLOWED_ORIGINS` en Railway debe incluir origen prod (same-origin ideal si API sirve SPA) |
| Cookies / storage | localStorage OK en Chrome; en WebView verificar modo privado |

---

## Pipeline técnico sugerido

```bash
# Web / PWA
npm run build:prod          # web dist + api
# Railway sirve SPA + API

# Más adelante Capacitor
cd packages/web && npm run build
npx cap sync android
npx cap open android        # Android Studio → Run / Generate Signed Bundle
```

Variables críticas (sin cambios conceptuales):

- Build web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (vacío = same-origin)
- Runtime API: `SUPABASE_*`, `ALLOWED_ORIGINS`

---

## Orden de implementación recomendado (sprints)

| Sprint | Entregable | Esfuerzo orientativo |
|--------|------------|----------------------|
| **S1** | Fase 0.1–0.7 (touch, safe-area, context menu, dnd touch, teclado) | 2–4 días |
| **S2** | Fase 1 (PNG icons, manifest, install prompt, doc install) | 1–2 días |
| **S3** | Fase 2.1–2.3 (banner offline + cache lectura + cola complete) | 3–5 días |
| **S4** | Capacitor bootstrap + deep links + build AAB interno | 3–5 días |
| **S5** | Play Store listing + privacy + push opcional | 1–2 semanas |

---

## Criterios de “listo para usuarios Android”

### Mínimo viable (PWA)

- [ ] Instalable en Chrome Android  
- [ ] Icono nítido en launcher  
- [ ] Login y board usables con una mano  
- [ ] Crear / completar / editar con hora  
- [ ] No hay botones imposibles de pulsar  
- [ ] Funciona en 4G y con pérdida breve de red (al menos error claro)

### Listo para Play Store

- [ ] AAB firmado  
- [ ] Privacy policy pública  
- [ ] Data safety completado  
- [ ] Target API level actual de Play  
- [ ] Sin WebView “solo browser” sin valor nativo (o justificado como TWA/PWA wrapper)  
- [ ] Pruebas en 2+ dispositivos físicos  

---

## Fuera de alcance de este roadmap

- iOS App Store (similar, pero iconos Apple + TestFlight; PWA en iOS es más limitada).  
- Widgets de home screen Android nativos (post-Capacitor).  
- Wear OS.  
- Sustituir Supabase.

---

## Próximo paso concreto

1. ~~S1+S2 hardering táctil + PNG + install banner~~ **hecho** (ver commit en `main`).  
2. **Probar install PWA** y **build:android** en un dispositivo real.  
3. ~~Sprint S3 offline~~ **hecho**.  
4. ~~S4 Capacitor bootstrap~~ **hecho** (`docs/ANDROID.md`). Pendiente: firmar AAB + listing Play + App Links verificados.

---

## Referencias en el repo

| Recurso | Ruta |
|---------|------|
| PWA config | `packages/web/vite.config.ts` |
| HTML / viewport | `packages/web/index.html` |
| Iconos actuales | `packages/web/public/icons/` |
| Layout mobile | `packages/web/src/components/Layout/` |
| Core compartible | `packages/core/` |
| Diseño mobile-first | `docs/DESIGN_DECISIONS.md` |
| Playbook familia apps | `docs/APP_FAMILY_PLAYBOOK.md` |
| Deploy | `README.md` (Railway) |

---

*Documento vivo: actualizar la tabla “Estado actual” al cerrar cada fase.*
