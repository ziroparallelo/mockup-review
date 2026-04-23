#!/usr/bin/env bash
# preflight.sh — idempotent bootstrap for mockup-review
#
# Usage:
#   source scripts/preflight.sh <project-dir> [port]
#   scripts/preflight.sh --check-only <project-dir> [port]
#
# Exit codes:
#   0 = success (server up, browser opened)
#   1 = scaffold failed
#   2 = server failed to start
#   3 = port conflict with non-mockup-review process
#
# Side effects:
#   - Creates <project>/.preview/mockups/{_server.py,_decisions.js,_shared.css} if missing
#   - Creates <project>/.preview/decisions.json = "{}" if missing
#   - Starts server in background, writes pid to <project>/.preview/.server.pid
#   - Opens default browser on http://127.0.0.1:<port>/.preview/mockups/index.html
#   - Emits: [preflight] ready on http://127.0.0.1:<port>
#
# Idempotency guarantees:
#   - If .server.pid exists AND that PID is running AND holds the target port → skip server start
#   - If templates already copied → skip copy
#   - If decisions.json already exists → keep current content
#
# Environment:
#   MOCKUP_REVIEW_PORT  (fallback 8765)
#   MOCKUP_REVIEW_NO_BROWSER=1  (skip browser open)

set -euo pipefail

PROJECT_DIR="${1:-}"
PORT="${MOCKUP_REVIEW_PORT:-${2:-8765}}"
CHECK_ONLY=""
[[ "${1:-}" == "--check-only" ]] && CHECK_ONLY="1" && PROJECT_DIR="${2:-}" && PORT="${MOCKUP_REVIEW_PORT:-${3:-8765}}"

if [ -z "$PROJECT_DIR" ]; then
  echo "[preflight] missing project dir argument" >&2
  exit 1
fi
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)" || {
  echo "[preflight] invalid project dir: $1" >&2
  exit 1
}

PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PID_FILE="$PROJECT_DIR/.preview/.server.pid"
URL="http://127.0.0.1:$PORT/.preview/mockups/index.html"

echo "[preflight] project: $PROJECT_DIR"
echo "[preflight] plugin:  $PLUGIN_DIR"
echo "[preflight] port:    $PORT"

# 1. Scaffold framework files if missing
mkdir -p "$PROJECT_DIR/.preview/mockups"
for f in _server.py _decisions.js _shared.css; do
  SRC="$PLUGIN_DIR/templates/$f"
  DST="$PROJECT_DIR/.preview/mockups/$f"
  if [ ! -f "$DST" ]; then
    [ -f "$SRC" ] || { echo "[preflight] missing template: $SRC" >&2; exit 1; }
    cp "$SRC" "$DST"
    echo "[preflight] scaffolded: $f"
  fi
done
[ -f "$PROJECT_DIR/.preview/decisions.json" ] || printf '{}' > "$PROJECT_DIR/.preview/decisions.json"

# 2. Check if our own server is already running on the port
server_is_ours() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  ps -p "$pid" >/dev/null 2>&1 || return 1
  # Confirm the PID holds the target port
  lsof -p "$pid" -a -i :"$PORT" >/dev/null 2>&1 || return 1
  return 0
}

if server_is_ours; then
  echo "[preflight] server already running (pid $(cat "$PID_FILE"))"
else
  # Check if SOMEONE ELSE holds the port
  OCCUPANT_PID="$(lsof -ti :"$PORT" 2>/dev/null | head -1 || true)"
  if [ -n "$OCCUPANT_PID" ]; then
    # If the occupant is a python3 running our _server.py, take it over via PID file
    OCCUPANT_CMD="$(ps -p "$OCCUPANT_PID" -o args= 2>/dev/null || true)"
    if echo "$OCCUPANT_CMD" | grep -q "_server.py"; then
      echo "$OCCUPANT_PID" > "$PID_FILE"
      echo "[preflight] adopting existing _server.py pid $OCCUPANT_PID"
    else
      echo "[preflight] port $PORT is held by another process: $OCCUPANT_CMD" >&2
      echo "[preflight] stop it or use MOCKUP_REVIEW_PORT=<other>" >&2
      exit 3
    fi
  else
    [ "${CHECK_ONLY:-}" = "1" ] && { echo "[preflight] check-only: server not running"; exit 0; }
    # 3. Start server in background, detached from this shell
    cd "$PROJECT_DIR"
    MOCKUP_REVIEW_PORT="$PORT" nohup python3 .preview/mockups/_server.py \
      > "$PROJECT_DIR/.preview/.server.log" 2>&1 &
    NEW_PID="$!"
    disown "$NEW_PID" 2>/dev/null || true
    echo "$NEW_PID" > "$PID_FILE"
    echo "[preflight] started server (pid $NEW_PID)"
  fi

  # 4. Wait up to 3s for the server to respond
  for _ in 1 2 3 4 5 6; do
    if curl -sSf -o /dev/null "http://127.0.0.1:$PORT/.preview/decisions.json" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done
  if ! curl -sSf -o /dev/null "http://127.0.0.1:$PORT/.preview/decisions.json" 2>/dev/null; then
    echo "[preflight] server did not come up — check $PROJECT_DIR/.preview/.server.log" >&2
    exit 2
  fi
fi

# 5. Open browser
if [ -z "${MOCKUP_REVIEW_NO_BROWSER:-}" ] && [ -z "${CHECK_ONLY:-}" ]; then
  if command -v open >/dev/null 2>&1; then
    open "$URL" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" 2>/dev/null || true
  fi
fi

echo "[preflight] ready on $URL"
