#!/usr/bin/env bash
# Zeitmaschine BBS - stop
set -euo pipefail
cd "$(dirname "$0")"
[ -f run/server.pid ] || { echo "Not running."; exit 0; }
pid=$(cat run/server.pid)
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid"
  echo "Stopped."
else
  echo "Not running (stale PID file)."
fi
rm -f run/server.pid
