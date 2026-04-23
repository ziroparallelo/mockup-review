# tests/test_integration_bootstrap.py
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
PREFLIGHT = PLUGIN_ROOT / "scripts" / "preflight.sh"
STOP = PLUGIN_ROOT / "scripts" / "stop.sh"
HOOK = PLUGIN_ROOT / "hooks" / "inject-decisions-context.py"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def test_bootstrap_then_post_then_hook_picks_up(tmp_path):
    """The full /client-revision loop: preflight → POST a comment → hook emits it."""
    port = _free_port()
    # 1. Bootstrap
    r = subprocess.run(
        ["bash", str(PREFLIGHT), str(tmp_path)],
        env={**os.environ, "MOCKUP_REVIEW_PORT": str(port), "MOCKUP_REVIEW_NO_BROWSER": "1", "MOCKUP_REVIEW_ROOT": str(tmp_path)},
        capture_output=True, text=True, timeout=10,
    )
    assert r.returncode == 0, r.stderr
    try:
        # 2. POST a comment via server
        body = json.dumps({"fixId": "fix-auto", "status": "revise", "note": "end to end"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/.preview/decisions",
            data=body, headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            assert resp.status == 200

        # 3. Hook sees it as additionalContext
        h = subprocess.run(["python3", str(HOOK)], cwd=str(tmp_path), capture_output=True, text=True, timeout=5)
        assert h.returncode == 0
        payload = json.loads(h.stdout)
        assert "end to end" in payload["hookSpecificOutput"]["additionalContext"]
    finally:
        subprocess.run(["bash", str(STOP), str(tmp_path), str(port)], capture_output=True, timeout=5)
