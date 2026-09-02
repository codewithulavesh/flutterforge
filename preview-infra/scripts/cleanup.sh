#!/bin/bash
# Free up all previews - 8GB safe
echo "Stopping all preview runtimes..."
docker ps --filter "label=preview.session" --format "{{.ID}}" | xargs -r docker rm -f || true
docker ps -a --filter "label=preview.session" --format "{{.ID}}" | xargs -r docker rm -f || true
rm -rf /tmp/previews/*
echo "Pruning builder cache (keep layer cache)..."
docker system prune -f --volumes || true
echo "Done. Free RAM: $(docker system df || true)"
