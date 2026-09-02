# Preview Infra - 8GB Laptop + Cloudflare Tunnel - Free No Card

Free Docker CE Swarm workflow for Flutter web preview. 2 builds + 15 runtimes ~1000 users on 8GB.

## Quick Start (Mac, no credit card)

```bash
cd preview-infra
./scripts/setup.sh          # init swarm, pull images, docker compose up
# In another terminal:
cloudflared tunnel --url http://localhost:80  # -> https://xxxx.trycloudflare.com free
# Add to ../.env.local:
echo "VITE_PREVIEW_API_URL=https://xxxx.trycloudflare.com" >> ../.env.local
echo "VITE_PREVIEW_API_URL=http://localhost:3001" >> ../.env.local # local fallback
npm run dev # from abcd-main
# Open Workspace -> Preview -> Run in Docker
```

## Architecture (Free)
```
Workspace PreviewPanel.tsx -> usePreviewStore -> POST /api/preview/:projectId/build {files}
  -> api:3001 (dockerode + BullMQ concurrency 2) -> builder container (flutter:stable 1GB) -> nginx:alpine runtime (80MB)
  -> GET /preview/:sessionId/ -> iframe (device frame preserved)
  -> WS /api/preview/:sessionId/logs -> BuildOutputPanel
TTL 15m auto-stop, path-based proxy no wildcard DNS needed.
```

## Commands
```bash
docker compose up -d          # start
docker compose logs -f api    # logs
docker compose down           # stop
./scripts/cleanup.sh          # free all previews
docker swarm leave --force    # leave swarm (optional)
```

## Scale (still free Docker)
```bash
# Add 2nd node (Hetzner 8GB via Debit/UPI, no card)
docker swarm join --token SWARM_TOKEN MANAGER_IP:2377
docker stack deploy -c swarm-stack.yml preview # 70 runtimes ~5000 users
```

## Limits 8GB
- Max 2 concurrent builds, queue rest
- Max 20 runtimes, 15m TTL
- 2 per user
- No privileged, read-only where possible
