# Design Decisions

Referencia visual y de interaccion para Daily Tracker. Hereda la mayor parte
del playbook de la familia (`finanzas-pro/docs/DESIGN_DECISIONS.md`), con las
adaptaciones que el dominio task tracker exige.

## Personalidad Del Producto

Daily Tracker es una herramienta de planificacion semanal. Debe sentirse:

- Clara y operativa, no decorativa.
- Rapida para uso diario (idealmente varias veces por dia).
- Densa horizontalmente en desktop (semana completa visible).
- Mobile-first para chequear y marcar completados sobre la marcha.
- Profesional, no demasiado playful (compite con Things, Sunsama, TickTick).

El primer viewport autenticado debe ser util: el board de la semana actual,
no una landing.

## Layout Principal

### Desktop

- Sidebar fija a la izquierda con navegacion.
- Header del contenido con titulo de seccion y accion primaria.
- Board horizontal con 7 columnas (Lun a Dom) y scroll horizontal si no entra.
- Panel admin flotante solo para administradores (futuro).

### Mobile

- Header superior compacto con hamburger.
- Drawer lateral con cierre por overlay/Escape.
- Acciones frecuentes en FAB inferior derecho (Plus, label "Nueva tarea").
- Modales tipo bottom sheet para crear/editar.
- En semana, posible scroll horizontal o snap por columna (futuro).

Decision: igual que finanzas-pro, hamburger en mobile, sidebar en desktop.

## Navegacion

Orden actual:

1. Resumen
2. Tareas (= board, la entidad principal del producto)
3. Proyectos
4. Analytics
5. Bitacora
6. Config
7. Admin (solo si aplica)

Regla del playbook: el **segundo item debe ser la accion o entidad principal**.
En finanzas-pro es Transacciones; en Daily Tracker es Tareas.

## Acciones Principales

### FAB

- Ubicacion: esquina inferior derecha, `bottom-5 right-5`.
- Color: accent-teal (`#58a6ff`) sobre fondo oscuro.
- Tamano: 56x56 px en mobile y desktop.
- Uso: crear nueva tarea en el dia seleccionado.
- Siempre por encima del contenido.
- Si la pantalla activa no admite la accion principal (ej. Settings), el FAB se oculta.

### Boton Junto Al Titulo

- En desktop, junto al titulo de seccion: `+ Anadir tarea`.
- Icono: `Plus` de lucide.
- Motivo: el usuario suele estar arriba de la pantalla; reducir friccion.
- Mismo handler que el FAB.

## Tipografia

- UI con Inter (cargada via Google Fonts) y fallback a system-ui.
- Pesos: `font-semibold` para titulos, `font-bold` para Hx.
- Mono (JetBrains Mono) para fechas o codigos cuando aplique; **no** para titulos.
- Tamanos comunes: `text-xs` (11-13px) en chips/badges, `text-sm` en cuerpo, `text-base/lg` en headings.
- Evitar headings gigantes en dashboards.

## Color

Paleta del tracker (alineada al stack GitHub-dark inicial):

| Token | Valor |
| --- | --- |
| Background | `#0d1117` |
| Surface | `#161b22` |
| Border | `#30363d` |
| Text primary | `#e6edf3` |
| Text muted | `#7d8590` |
| Accent green | `#3fb950` (completado, exito) |
| Accent teal | `#58a6ff` (accion primaria) |
| Accent red | `#f85149` (peligro, eliminar) |
| Accent pink | `#f778ba` (decorativo, prioridad alta secundaria) |

Reglas:

- Teal es accion (FAB, boton primario), no decoracion permanente.
- Verde se reserva para tareas completadas y barras de progreso al 100%.
- Rojo solo para destructive (delete, prioridad high opcional).
- Los proyectos pueden usar colores propios desde la paleta `projectColors`.

## Cards Y Superficies

- TaskCard es el componente repetido principal: chico, denso, con drag handle.
- DayColumn es la superficie por dia con header (label, fecha, progress ring).
- Modales para crear/editar tarea o proyecto.
- Radio recomendado: 8-12px para items operativos, 12-16px para modales.

## Iconografia

- `lucide-react` para todo.
- Icon-only buttons requieren `aria-label` y/o `title`.
- Patron consistente: `Plus` para crear, `Pencil` para editar, `Trash` o `X` para borrar, `Calendar` para fecha.

## Formularios

- Form inline en `DayColumn` (escenario chico).
- Modal con Dialog para crear desde FAB (escenario medio).
- Settings y Projects usan formularios mas grandes con `react-hook-form` (pendiente).
- Guardar debe mostrar estado de carga (Loader2 girando).
- Errores llegan a Toast y a `errorLogs` si son relevantes para admin.

## Admin UI

Cuando exista, admin debe estar separado en pestanas:

- Analytics (usuarios activos, por tier, secciones, uso de features).
- Estado web (online/offline, version, build, proveedores).
- Fallos (logs filtrables por severidad/operacion/usuario).

Mismo principio que finanzas-pro: el admin no debe estar dominado por fallos.

## Dark Mode

La app **arranca en dark** (clase `dark` en `<html>`). Tokens HSL definidos
en `index.css`. Si en algun momento se ofrece light mode, agregar tokens
correspondientes y un toggle en Settings.

Reglas:

- Definir colores por tokens o variables CSS.
- Probar texto/bordes/fondos en ambos modos.
- Evitar sombras que desaparecen en dark.

## Estados Por Defecto

Todas las superficies con datos deben definir:

- **Loading**: Loader2 centrado o skeletons en TaskCard.
- **Empty**: copy claro ("Aun no hay tareas en este dia"), boton para crear.
- **Error**: Toast + opcion de reintentar (cuando aplique).

## Copy Y Lenguaje

- Comandos concretos: `Guardar`, `Editar`, `Eliminar`, `Anadir tarea`.
- Evitar textos largos en pantallas operativas.
- Tono directo y calmado, en espanol rioplatense neutro.
- Placeholders ayudan pero no reemplazan labels en campos criticos.

## Checklist De Diseno

- [x] FAB con accion primaria clara.
- [x] Misma accion principal cerca del titulo en desktop.
- [x] Mobile con hamburger y drawer.
- [x] Desktop con sidebar persistente.
- [ ] Icon buttons con `aria-label` (auditar Sidebar/Layout — la mayoria ya lo tiene).
- [ ] Modales caben en mobile (probar Dialog en viewport 320px).
- [ ] Estados loading/error/empty para Board, Projects, Analytics.
- [ ] Admin con version, estado y fallos.
- [x] Paleta multi-color (no un unico color para todo).
