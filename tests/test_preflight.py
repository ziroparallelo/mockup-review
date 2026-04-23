# tests/test_preflight.py
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
PREFLIGHT = PLUGIN_ROOT / "scripts" / "preflight.sh"
STOP = PLUGIN_ROOT / "scripts" / "stop.sh"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def _run_preflight(project_dir, port):
    return subprocess.run(
        ["bash", str(PREFLIGHT), str(project_dir)],
        env={**os.environ, "MOCKUP_REVIEW_PORT": str(port), "MOCKUP_REVIEW_NO_BROWSER": "1", "MOCKUP_REVIEW_ROOT": str(project_dir)},
        capture_output=True,
        text=True,
        timeout=10,
    )


def _wait_port(port, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/.preview/decisions.json", timeout=0.3)
            return True
        except Exception:
            time.sleep(0.1)
    return False


def test_first_run_scaffolds_and_starts(tmp_path):
    port = _free_port()
    r = _run_preflight(tmp_path, port)
    try:
        assert r.returncode == 0, r.stderr
        assert "scaffolded: _server.py" in r.stdout
        assert "started server" in r.stdout
        assert (tmp_path / ".preview" / "mockups" / "_server.py").exists()
        assert (tmp_path / ".preview" / "mockups" / "_decisions.js").exists()
        assert (tmp_path / ".preview" / "mockups" / "_shared.css").exists()
        assert (tmp_path / ".preview" / "decisions.json").read_text() == "{}"
        assert (tmp_path / ".preview" / ".server.pid").exists()
        assert _wait_port(port)
    finally:
        subprocess.run(["bash", str(STOP), str(tmp_path), str(port)], capture_output=True, timeout=5)


def test_second_run_is_idempotent(tmp_path):
    port = _free_port()
    r1 = _run_preflight(tmp_path, port)
    assert r1.returncode == 0
    pid1 = (tmp_path / ".preview" / ".server.pid").read_text().strip()
    try:
        r2 = _run_preflight(tmp_path, port)
        assert r2.returncode == 0
        assert "server already running" in r2.stdout
        assert "started server" not in r2.stdout
        assert "scaffolded" not in r2.stdout
        pid2 = (tmp_path / ".preview" / ".server.pid").read_text().strip()
        assert pid1 == pid2
    finally:
        subprocess.run(["bash", str(STOP), str(tmp_path), str(port)], capture_output=True, timeout=5)


def test_preserves_existing_decisions(tmp_path):
    (tmp_path / ".preview").mkdir()
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps({"fix-pre": {"status": "approved"}}))
    port = _free_port()
    r = _run_preflight(tmp_path, port)
    try:
        assert r.returncode == 0
        saved = json.loads((tmp_path / ".preview" / "decisions.json").read_text())
        assert "fix-pre" in saved
    finally:
        subprocess.run(["bash", str(STOP), str(tmp_path), str(port)], capture_output=True, timeout=5)


def test_stop_removes_pid_file(tmp_path):
    port = _free_port()
    _run_preflight(tmp_path, port)
    pid_file = tmp_path / ".preview" / ".server.pid"
    assert pid_file.exists()
    subprocess.run(["bash", str(STOP), str(tmp_path), str(port)], capture_output=True, timeout=5)
    assert not pid_file.exists()


def test_port_conflict_with_foreign_process(tmp_path):
    """If a non-mockup-review process holds the port, preflight exits 3."""
    port = _free_port()
    # Bind a socket to occupy the port (not a _server.py)
    blocker = subprocess.Popen(
        ["python3", "-c", f"import socket, time; s=socket.socket(); s.bind(('127.0.0.1', {port})); s.listen(); time.sleep(10)"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(0.3)
        r = _run_preflight(tmp_path, port)
        assert r.returncode == 3
        assert "port" in r.stderr.lower()
    finally:
        blocker.terminate()
        blocker.wait(timeout=2)
