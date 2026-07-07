# Daily Tracker Docs

Indice de documentos de referencia para Daily Tracker. Pertenece a la misma
familia de apps personales que Meteora (finanzas-pro). Sigue los mismos
patrones de arquitectura, UI, escalabilidad y observabilidad.

## Documentos Principales

- `TECH_STACK_AND_SCALE.md`: stack, contratos backend-owned, plan de escala 0 → 1M usuarios.
- `DESIGN_DECISIONS.md`: layout, navegacion, FAB, sidebar/drawer, tipografia, paleta del tracker.
- `STATUS_AND_NEXT_STEPS.md`: que esta implementado, que esta parcial, pasos por hito, Definition of Done.
- `APP_FAMILY_PLAYBOOK.md`: como esta app sigue el playbook de la familia y donde difiere.
- `SCALABILITY_OPERATIONS.md`: checklist operativo, App Check, jobs (auto-roll), webhooks, limits, riesgos.

## App Hermana

La fuente original de la familia es `D:\DesarrollosFF\finanzas-pro\docs`. Cuando
una decision se aplique 1:1 desde esa app, este doc se limita a referenciarla en
lugar de duplicar texto.

## Regla De Mantenimiento

Cuando una decision tecnica o visual cambia en la app, actualizar el documento
correspondiente en el mismo PR. Versionado se mueve por PR (ver
`APP_FAMILY_PLAYBOOK` → "Contrato De Version").

## Como Usar Estos Docs Para Otra App De La Familia

1. Leer `APP_FAMILY_PLAYBOOK.md` de finanzas-pro (origen) y el de este repo (especifico de tracker).
2. Copiar las decisiones que apliquen de `DESIGN_DECISIONS.md`.
3. Elegir el stack desde `TECH_STACK_AND_SCALE.md`.
4. Crear un `STATUS_AND_NEXT_STEPS.md` propio para la app hija.
5. Mantener `SCALABILITY_OPERATIONS.md` como checklist operativo vivo.
