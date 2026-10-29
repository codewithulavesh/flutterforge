# ── 1. Build the React/Vite renderer ─────────────────────────────────────────
FROM node:20-alpine AS web

WORKDIR /app
# Electron is a dev-only dependency; skip its 100MB binary in the web image.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── 2. Runtime: static UI + DeepSeek Harness engine bridge ───────────────────
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787

COPY --from=web /app/dist ./dist
COPY server ./server
COPY package.json ./

# The harness engine is optional at runtime: when `dsh` is not installed the
# UI still loads and the browser-side agent remains available as a fallback.
# Mount a Linux DeepSeek Harness runtime and set DSH_BIN to enable it.
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
