# ---- Stage 1: Frontend Build ----
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# ---- Stage 2: Backend Build ----
FROM node:24-alpine AS backend-builder
RUN --mount=type=cache,target=/var/cache/apk apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc
RUN npm prune --omit=dev

# ---- Stage 3: Production ----
FROM nginx:alpine

# Install Node.js for backend runtime
RUN apk add --no-cache nodejs

# Frontend: static files served by nginx
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Backend: compiled JS + production node_modules
COPY --from=backend-builder /app/dist /app/dist
COPY --from=backend-builder /app/node_modules /app/node_modules

# Nginx config (proxy /api/ and /v1/ to 127.0.0.1:3001)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Data directory for SQLite
RUN mkdir -p /app/data && chown -R 101:101 /app/data

# Entrypoint: start nginx (background) + node (foreground)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=3001
ENV DB_PATH=/app/data/cf-manager.db

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:80/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
