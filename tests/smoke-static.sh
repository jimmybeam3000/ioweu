#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8130}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

cd "${ROOT_DIR}"

node --check app.js
node --check sw.js
python3 -m json.tool manifest.webmanifest >/dev/null

python3 -m http.server "${PORT}" >/tmp/ioweu-smoke.log 2>&1 &
SERVER_PID=$!
sleep 1

curl -fsSI "http://127.0.0.1:${PORT}/" >/dev/null
curl -fsSI "http://127.0.0.1:${PORT}/app.js" >/dev/null
curl -fsSI "http://127.0.0.1:${PORT}/style.css" >/dev/null
curl -fsSI "http://127.0.0.1:${PORT}/manifest.webmanifest" >/dev/null
curl -fsSI "http://127.0.0.1:${PORT}/sw.js" >/dev/null

echo "Static smoke test passed on port ${PORT}."
