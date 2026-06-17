#!/bin/sh
set -e

# Start nginx in background
nginx -g "daemon off;" &

# Wait briefly for nginx to be ready
sleep 1

# Start Node.js backend in foreground
exec node /app/dist/index.js
