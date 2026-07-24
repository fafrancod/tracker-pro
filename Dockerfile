# Tracker Pro — un solo contenedor: SPA + API
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/
COPY tsconfig.base.json ./

RUN npm ci --include=dev --no-audit --no-fund

COPY packages ./packages

# Railway inyecta VITE_* como env de build si "Available at Build Time" = ON.
# Vacías = SPA same-origin (recomendado).
RUN npm run build:prod \
 && test -f packages/api/dist/server.cjs \
 && test -f packages/web/dist/index.html

# --- runtime: solo el bundle CJS + assets estáticos (sin node_modules) ---
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/api/dist/server.cjs ./packages/api/dist/server.cjs
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "packages/api/dist/server.cjs"]
