# tests/test_integration.py
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SERVER = PLUGIN_ROOT / "templates" / "_server.py"
HOOK = PLUGIN_ROOT / "hooks" / "inject-decisions-context.py"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def test_user_writes_comment_then_hook_picks_it_up(tmp_path):
    """Full flow: server saves decision → hook injects it as context → re-run hook does NOT inject again."""
    (tmp_path / ".preview").mkdir()
    (tmp_path / ".preview" / "decisions.json").write_text("{}")
    port = _free_port()
    env = {**os.environ, "MOCKUP_REVIEW_PORT": str(port), "MOCKUP_REVIEW_ROOT": str(tmp_path)}
    proc = subprocess.Popen(
        ["python3", str(SERVER)],
        cwd=str(tmp_path), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(20):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/.preview/decisions.json", timeout=0.2)
            break
        except Exception:
            time.sleep(0.1)
    else:
        proc.kill()
        pytest.fail("server did not come up")
    try:
        # 1. User posts a comment
        body = json.dumps({"fixId": "fix-integration", "status": "revise", "note": "change everything"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/.preview/decisions",
            data=body, headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as r:
            assert r.status == 200

        # 2. Log was appended
        log = (tmp_path / ".preview" / "comments-log.jsonl").read_text().strip().splitlines()
        assert len(log) == 1
        assert json.loads(log[0])["note"] == "change everything"

        # 3. Hook emits the comment as additionalContext
        h1 = subprocess.run(["python3", str(HOOK)], cwd=str(tmp_path), capture_output=True, text=True, timeout=5)
        assert h1.returncode == 0
        assert h1.stdout.strip(), "hook should output JSON"
        payload = json.loads(h1.stdout)
        assert "change everything" in payload["hookSpecificOutput"]["additionalContext"]

        # 4. Second run is silent (already seen)
        h2 = subprocess.run(["python3", str(HOOK)], cwd=str(tmp_path), capture_output=True, text=True, timeout=5)
        assert h2.returncode == 0
        assert h2.stdout == ""
    finally:
        proc.terminate()
        proc.wait(timeout=2)
