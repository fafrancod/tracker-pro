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

# Railway pasa variables de build como --build-arg si están marcadas
# "Available at Build Time". Las declaramos explícitamente.
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_API_BASE_URL=
ARG VITE_APP_CHANNEL=prod
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_CHANNEL=$VITE_APP_CHANNEL

RUN npm run build:prod \
 && test -f packages/api/dist/server.cjs \
 && test -f packages/web/dist/index.html

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/api/dist/server.cjs ./packages/api/dist/server.cjs
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "packages/api/dist/server.cjs"]
