#!/usr/bin/env python3
"""Mockup review server — serves static files + accepts POST decisions.

Endpoints:
  GET  /<any>                    — static file server (project root)
  GET  /.preview/decisions.json  — current decisions state
  POST /.preview/decisions       — body: JSON {fixId, action, value, note}
                                    merges into .preview/decisions.json
"""
import http.server
import json
import os
import socketserver
from pathlib import Path
from urllib.parse import urlparse

PORT = int(os.environ.get("MOCKUP_REVIEW_PORT", "8765"))
BIND = os.environ.get("MOCKUP_REVIEW_BIND", "127.0.0.1")
# Allow override for testing; production default is 3 levels up (.preview/mockups -> project)
_root_override = os.environ.get("MOCKUP_REVIEW_ROOT")
PROJECT_ROOT = Path(_root_override).resolve() if _root_override else Path(__file__).resolve().parent.parent.parent
DECISIONS_PATH = PROJECT_ROOT / ".preview" / "decisions.json"
COMMENTS_LOG_PATH = PROJECT_ROOT / ".preview" / "comments-log.jsonl"


def load_decisions():
    if DECISIONS_PATH.exists():
        try:
            return json.loads(DECISIONS_PATH.read_text())
        except Exception:
            return {}
    return {}


def save_decisions(data):
    DECISIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DECISIONS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/.preview/mtime":
            # Query: ?path=/.preview/mockups/fix-02-cta-contattaci.html
            from urllib.parse import parse_qs
            q = parse_qs(parsed.query)
            target = (q.get("path", ["/"])[0]).lstrip("/")
            full = PROJECT_ROOT / target
            mt = 0
            if full.exists():
                mt = int(full.stat().st_mtime * 1000)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(json.dumps({"mtime": mt}).encode("utf-8"))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/.preview/send-to-claude":
            self._handle_send_to_claude()
            return
        if parsed.path != "/.preview/decisions":
            self.send_error(404, "not found")
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as e:
            self.send_error(400, f"bad json: {e}")
            return
        fix_id = payload.get("fixId")
        if not fix_id:
            self.send_error(400, "missing fixId")
            return
        data = load_decisions()
        entry = data.get(fix_id, {})
        prev_note = entry.get("note", "")
        for k in ("status", "variant", "set", "note"):
            if k in payload:
                entry[k] = payload[k]
        entry["updatedAt"] = payload.get("updatedAt") or ""
        # reset _seen flag when note changes so the hook / prompt picks it up
        if "note" in payload:
            entry.pop("_seen", None)
        data[fix_id] = entry
        save_decisions(data)
        # Append to log when note changes
        new_note = entry.get("note", "")
        if new_note and new_note != prev_note:
            try:
                COMMENTS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
                log_entry = {
                    "timestamp": entry["updatedAt"],
                    "fixId": fix_id,
                    "status": entry.get("status", ""),
                    "variant": entry.get("variant", ""),
                    "note": new_note,
                }
                with COMMENTS_LOG_PATH.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            except Exception:
                pass
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "saved": entry}).encode("utf-8"))

    def _handle_send_to_claude(self):
        import subprocess
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as e:
            self.send_error(400, f"bad json: {e}")
            return
        prompt = payload.get("prompt", "").strip()
        if not prompt:
            self.send_error(400, "missing prompt")
            return
        result = {"ok": False, "methods": []}
        # 1. Copy to clipboard
        try:
            p = subprocess.run(["pbcopy"], input=prompt.encode("utf-8"), check=True, timeout=3)
            result["methods"].append("clipboard")
        except Exception as e:
            result["clipboardError"] = str(e)
        # 2. AppleScript — activate Terminal (or iTerm/Warp if specified), type text + enter
        target_app = payload.get("app") or "Terminal"
        escaped = prompt.replace("\\", "\\\\").replace('"', '\\"')
        apple_script = f'''
try
  tell application "{target_app}" to activate
  delay 0.35
  tell application "System Events"
    keystroke "{escaped}"
    delay 0.15
    key code 36
  end tell
  return "{target_app}"
on error errMsg
  return "error: " & errMsg
end try
'''
        try:
            proc = subprocess.run(
                ["osascript", "-e", apple_script],
                capture_output=True, text=True, timeout=5,
            )
            result["frontApp"] = proc.stdout.strip()
            if proc.returncode == 0:
                result["methods"].append("keystroke")
                result["ok"] = True
            else:
                result["osascriptError"] = proc.stderr.strip()
        except Exception as e:
            result["osascriptError"] = str(e)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))

    def log_message(self, fmt, *args):
        # quiet per console — stampa solo POST
        if args and args[0].startswith("POST"):
            super().log_message(fmt, *args)


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    print(f"[mockup-server] serving {PROJECT_ROOT} on http://{BIND}:{PORT}")
    print(f"[mockup-server] decisions file: {DECISIONS_PATH}")
    with ThreadedServer((BIND, PORT), Handler) as srv:
        srv.serve_forever()
