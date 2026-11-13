# Poster Digital NFC: Nuxt 4 app (frontend + Nitro API) in one container.
# Stage 1 builds and tests; stage 2 runs only the self-contained .output folder.

# ---- Build ----------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Dependencies first, so they are cached while only the source changes.
# --ignore-scripts: skips `nuxt prepare` (the source isn't copied yet) and the ffmpeg
# download of the dev-only video tool; the build below prepares Nuxt itself.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npx nuxt prepare && npm test && npm run build

# ---- Run ------------------------------------------------------------------
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Owned by root, run as the unprivileged `node` user: the app can't change its own code.
COPY --from=build /app/.output ./.output
# SQL migrations, applied by the app at start-up (server/plugins/database.ts).
COPY --from=build /app/server/db/migrations ./server/db/migrations

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
