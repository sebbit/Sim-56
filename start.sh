#!/usr/bin/env bash
# Zeitmaschine - start in background (only needed without systemd; install.sh sets up a service)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data logs run
if [ -f run/server.pid ] && kill -0 "$(cat run/server.pid)" 2>/dev/null; then
  echo "Already running (PID $(cat run/server.pid))."; exit 0
fi
NODE=./runtime/node/bin/node; [ -x "$NODE" ] || NODE=node
set -a; [ -f config.env ] && . ./config.env; set +a
nohup "$NODE" server.js >> logs/server.log 2>&1 &
echo $! > run/server.pid
sleep 0.8
if kill -0 "$(cat run/server.pid)" 2>/dev/null; then
  echo "Started (PID $(cat run/server.pid)): web http://<host>:${HTTP_PORT:-8056}/  telnet <host> ${TELNET_PORT:-2323}"
else
  echo "Start failed, see logs/server.log"; rm -f run/server.pid; exit 1
fi
