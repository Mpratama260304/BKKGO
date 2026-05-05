# =============================================================================
# Multi-stage build for BKKGO Shortlink System.
# Stage 1: build the React frontend with Vite.
# Stage 2: install backend deps and copy in the built frontend (served by Express).
# =============================================================================

# ----- Stage 1: frontend build ------------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ----- Stage 2: backend runtime -----------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# better-sqlite3 needs build tools to compile its native module.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && mkdir -p /app/backend /app/frontend/dist /data

COPY backend/package.json backend/package-lock.json* /app/backend/
WORKDIR /app/backend
RUN npm install --omit=dev --no-audit --no-fund \
 && apk del .build-deps

# Copy backend source and built frontend.
COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Persist SQLite DB and uploaded banners outside the image layer.
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/bkkgo.sqlite

VOLUME ["/data", "/app/backend/uploads"]

EXPOSE 4000

# Healthcheck hits the lightweight /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "server.js"]
