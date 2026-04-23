# tests/test_hook.py
import json
import os
import subprocess
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOK = PLUGIN_ROOT / "hooks" / "inject-decisions-context.py"


def _run_hook(cwd: Path) -> tuple[int, str]:
    proc = subprocess.run(
        ["python3", str(HOOK)],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=5,
    )
    return proc.returncode, proc.stdout


def test_no_decisions_file_exits_silently(tmp_path):
    rc, out = _run_hook(tmp_path)
    assert rc == 0
    assert out == ""


def test_empty_decisions_exits_silently(tmp_path):
    (tmp_path / ".preview").mkdir()
    (tmp_path / ".preview" / "decisions.json").write_text("{}")
    rc, out = _run_hook(tmp_path)
    assert rc == 0
    assert out == ""


def test_unread_revise_note_emitted_as_context(tmp_path):
    (tmp_path / ".preview").mkdir()
    decisions = {
        "fix-02": {"status": "revise", "note": "cambia colore", "variant": "A"},
    }
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps(decisions))
    rc, out = _run_hook(tmp_path)
    assert rc == 0
    payload = json.loads(out)
    assert payload["hookSpecificOutput"]["hookEventName"] == "UserPromptSubmit"
    assert "fix-02" in payload["hookSpecificOutput"]["additionalContext"]
    assert "cambia colore" in payload["hookSpecificOutput"]["additionalContext"]


def test_seen_flag_is_persisted(tmp_path):
    (tmp_path / ".preview").mkdir()
    decisions = {
        "fix-02": {"status": "revise", "note": "first pass"},
    }
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps(decisions))
    _run_hook(tmp_path)
    saved = json.loads((tmp_path / ".preview" / "decisions.json").read_text())
    assert saved["fix-02"]["_seen"] is True


def test_already_seen_is_not_reemitted(tmp_path):
    (tmp_path / ".preview").mkdir()
    decisions = {
        "fix-02": {"status": "revise", "note": "old", "_seen": True},
    }
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps(decisions))
    rc, out = _run_hook(tmp_path)
    assert rc == 0
    assert out == ""


def test_non_revise_status_is_ignored(tmp_path):
    (tmp_path / ".preview").mkdir()
    decisions = {
        "fix-02": {"status": "approved", "note": "should not emit"},
    }
    (tmp_path / ".preview" / "decisions.json").write_text(json.dumps(decisions))
    rc, out = _run_hook(tmp_path)
    assert rc == 0
    assert out == ""
