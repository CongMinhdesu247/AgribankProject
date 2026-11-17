#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sudo docker compose ps -a
sudo docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);console.log('API readiness OK')}).catch(e=>{console.error(e.message);process.exit(1)})"
ids="$(sudo docker compose ps -q)"
if [ -n "$ids" ]; then
  sudo docker inspect --format '{{.Name}} OOMKilled={{.State.OOMKilled}} Restarts={{.RestartCount}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' $ids
  sudo docker stats --no-stream $ids
fi
