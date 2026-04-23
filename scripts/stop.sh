#!/usr/bin/env bash
# stop.sh — graceful shutdown of the mockup-review server started by preflight.sh
# Uses .preview/.server.pid when available; falls back to port 8765 kill.
set -euo pipefail

PROJECT_DIR="${1:-$PWD}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
PORT="${MOCKUP_REVIEW_PORT:-${2:-8765}}"
PID_FILE="$PROJECT_DIR/.preview/.server.pid"

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
    kill "$pid" 2>/dev/null || true
    echo "[stop] killed pid $pid"
  fi
  rm -f "$PID_FILE"
fi

# Fallback: anything still on the target port
leftover="$(lsof -ti :"$PORT" 2>/dev/null | head -1 || true)"
if [ -n "$leftover" ]; then
  kill "$leftover" 2>/dev/null || true
  echo "[stop] killed leftover pid $leftover on port $PORT"
fi
echo "[stop] done"
