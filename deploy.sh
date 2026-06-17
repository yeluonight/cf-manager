#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ---- .env check ----
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env not found, copied from .env.example"
    warn "Please edit .env (set ENCRYPTION_KEY at minimum), then re-run."
    exit 1
  else
    err ".env missing. Create one from .env.example first."
    exit 1
  fi
fi

source .env

if [ -z "${ENCRYPTION_KEY:-}" ] || [ "$ENCRYPTION_KEY" = "your-random-encryption-key-here" ]; then
  err "ENCRYPTION_KEY is not set. Edit .env first."
  exit 1
fi

if [ -z "${API_SECRET:-}" ]; then
  err "API_SECRET is not set. Running without authentication is no longer allowed."
  err "Generate one with: openssl rand -hex 32"
  exit 1
fi

# Check .env file permissions — warn if too permissive
ENV_PERMS=$(stat -c '%a' .env 2>/dev/null || stat -f '%Lp' .env 2>/dev/null || echo 'unknown')
if [ "$ENV_PERMS" != "unknown" ] && [ "$ENV_PERMS" -gt 600 ]; then
  warn ".env file permissions are $ENV_PERMS — recommend chmod 600 for security"
fi

# ---- Deploy ----
log "Building new images (old containers keep running) ..."
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose build --parallel

log "Rolling update ..."
docker compose up -d --remove-orphans

log "Cleaning up old images ..."
docker image prune -f 2>/dev/null || true

log "Waiting for services to become healthy ..."
for i in $(seq 1 15); do
  STATUS=$(docker compose ps --format json 2>/dev/null || true)
  if echo "$STATUS" | grep -qE '"unhealthy"|"starting"'; then
    sleep 2
  else
    break
  fi
done

echo ""
docker compose ps
echo ""
log "Done! Access at http://localhost:${APP_PORT:-3000}"
