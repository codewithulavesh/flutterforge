#!/bin/bash
set -e

# Preview Infra Setup for 8GB Mac - Free Docker CE Swarm
echo "=== FlutterForge Preview Infra Setup (8GB Free) ==="

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "Install Docker Desktop from https://docs.docker.com/desktop/install/mac-install/"
  exit 1
fi
echo "Docker $(docker --version) OK"

# Init Swarm if not already
if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]; then
  echo "Initializing Swarm..."
  docker swarm init || true
else
  echo "Swarm already active"
fi

# Create /tmp/previews
mkdir -p /tmp/previews
chmod 777 /tmp/previews

# Pull base images (avoid rate limit, use GHCR)
echo "Pulling base images (free)..."
docker pull ghcr.io/cirruslabs/flutter:stable || docker pull cirrusci/flutter:stable || true
docker pull nginx:alpine
docker pull redis:7-alpine
docker pull node:20-alpine

# Build API
echo "Building preview-api..."
cd "$(dirname "$0")/.."
docker compose build api || docker build -t preview-api -f server/Dockerfile server/

# Start infra
echo "Starting preview infra (docker compose)..."
docker compose up -d
echo "Waiting for health..."
sleep 5
curl -f http://localhost:3001/health && echo "API OK" || echo "API not ready, check docker logs preview-api"
curl -f http://localhost:80/health || echo "Proxy check done"

echo ""
echo "=== Cloudflared (Free, no card) ==="
if ! command -v cloudflared &> /dev/null; then
  echo "Install: brew install cloudflared"
  echo "Then: cloudflared tunnel --url http://localhost:80  # quick trycloudflare.com URL"
  echo "Or: cloudflared tunnel login && cloudflared tunnel create preview"
else
  echo "cloudflared found: $(cloudflared --version)"
  echo "Quick public URL: cloudflared tunnel --url http://localhost:80"
fi

echo ""
echo "=== Frontend ==="
echo "Add to .env.local: VITE_PREVIEW_API_URL=http://localhost:3001"
echo "Or for tunnel: VITE_PREVIEW_API_URL=https://<your-tunnel>.trycloudflare.com"
echo ""
echo "Done. Open Workspace -> Preview -> Run in Docker"
echo "Capacity: 2 concurrent builds, 15-20 runtimes, 15m TTL (8GB)"
echo "Cleanup: docker compose down -v && docker swarm leave --force (optional)"
