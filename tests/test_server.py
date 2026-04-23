# tests/test_server.py
import json
import os
import socket
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SERVER = PLUGIN_ROOT / "templates" / "_server.py"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture
def running_server(tmp_path):
    """Start the server in tmp_path with .preview/ scaffolded; tear down after test."""
    (tmp_path / ".preview").mkdir()
    (tmp_path / ".preview" / "decisions.json").write_text("{}")
    port = _free_port()
    env = {**os.environ, "MOCKUP_REVIEW_PORT": str(port), "MOCKUP_REVIEW_ROOT": str(tmp_path)}
    proc = subprocess.Popen(
        ["python3", str(SERVER)],
        cwd=str(tmp_path),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait up to 2s for server ready
    for _ in range(20):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/.preview/decisions.json", timeout=0.2)
            break
        except Exception:
            time.sleep(0.1)
    else:
        proc.kill()
        pytest.fail("server did not come up")
    yield port, tmp_path
    proc.terminate()
    proc.wait(timeout=2)


def _post(port, path, body):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def _get_json(port, path):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def test_post_decision_saves_to_file(running_server):
    port, tmp_path = running_server
    status, data = _post(port, "/.preview/decisions", {"fixId": "fix-99", "status": "approved"})
    assert status == 200
    assert data["ok"] is True
    saved = json.loads((tmp_path / ".preview" / "decisions.json").read_text())
    assert saved["fix-99"]["status"] == "approved"


def test_post_variant_switch_updates(running_server):
    port, tmp_path = running_server
    _post(port, "/.preview/decisions", {"fixId": "fix-x", "status": "variant", "variant": "A"})
    _post(port, "/.preview/decisions", {"fixId": "fix-x", "status": "variant", "variant": "B"})
    saved = json.loads((tmp_path / ".preview" / "decisions.json").read_text())
    assert saved["fix-x"]["variant"] == "B"


def test_note_change_appends_to_log(running_server):
    port, tmp_path = running_server
    _post(port, "/.preview/decisions", {"fixId": "fix-y", "status": "revise", "note": "first"})
    _post(port, "/.preview/decisions", {"fixId": "fix-y", "status": "revise", "note": "second"})
    log = (tmp_path / ".preview" / "comments-log.jsonl").read_text().strip().splitlines()
    assert len(log) == 2
    assert json.loads(log[0])["note"] == "first"
    assert json.loads(log[1])["note"] == "second"


def test_note_change_resets_seen_flag(running_server):
    port, tmp_path = running_server
    # Simulate hook marking as seen
    data = {"fix-z": {"status": "revise", "note": "old", "_seen": True, "updatedAt": ""}}
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps(data))
    _post(port, "/.preview/decisions", {"fixId": "fix-z", "status": "revise", "note": "new comment"})
    saved = json.loads((tmp_path / ".preview" / "decisions.json").read_text())
    assert "_seen" not in saved["fix-z"], "new note should clear _seen"


def test_mtime_endpoint(running_server):
    port, tmp_path = running_server
    target = tmp_path / "hello.txt"
    target.write_text("hi")
    status, data = _get_json(port, "/.preview/mtime?path=/hello.txt")
    assert status == 200
    assert data["mtime"] > 0


def test_mtime_missing_file_returns_zero(running_server):
    port, _ = running_server
    status, data = _get_json(port, "/.preview/mtime?path=/does-not-exist")
    assert status == 200
    assert data["mtime"] == 0
