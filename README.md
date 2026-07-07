# Daily Tracker

Planificador semanal de tareas. Monorepo npm workspaces: `packages/core`, `packages/web`, `packages/api`.

## Desarrollo local

```bash
npm install
npm run dev:web   # http://localhost:3005
npm run dev:api   # http://localhost:4000
```

Copia los `.env.example` de cada paquete y rellena las variables.

## Despliegue en Railway

Conecta este repositorio y crea **dos servicios** desde la misma raíz del monorepo:

| Servicio | Build | Start |
| --- | --- | --- |
| API | `npm ci && npm run build:api` | `npm run start:api` |
| Web | `npm ci && npm run build:web` | `npx serve packages/web/dist -s -l $PORT` |

Variables de entorno: ver `packages/api/.env.example` y `packages/web/.env.example`. En producción, `VITE_API_BASE_URL` debe apuntar a la URL pública del servicio API y `ALLOWED_ORIGINS` debe incluir la URL del frontend.

Documentación técnica: [`docs/README.md`](docs/README.md).