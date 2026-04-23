#!/usr/bin/env python3
"""UserPromptSubmit hook — auto-inject unread revise notes from .preview/decisions.json
as additional context on every user prompt.

Runs from the project working directory (CWD) so it reads the correct project's state.
Marks notes as _seen so they don't repeat. Silently exits if no decisions.json exists.
"""
import json
import os
import sys
from pathlib import Path

# CWD is the project directory where user invoked Claude Code
DECISIONS = Path(os.getcwd()) / ".preview" / "decisions.json"

if not DECISIONS.exists():
    sys.exit(0)

try:
    data = json.loads(DECISIONS.read_text())
except Exception:
    sys.exit(0)

if not isinstance(data, dict):
    sys.exit(0)

unread = []
changed = False
for fix_id, entry in data.items():
    if not isinstance(entry, dict):
        continue
    note = (entry.get("note") or "").strip()
    status = entry.get("status", "")
    if status == "revise" and note and not entry.get("_seen"):
        variant = entry.get("variant") or "none"
        unread.append(f"- **{fix_id}** (variant={variant}): {note}")
        entry["_seen"] = True
        changed = True

if changed:
    DECISIONS.write_text(json.dumps(data, indent=2, ensure_ascii=False))

if unread:
    msg = (
        "\n\n---\n**[mockup-review · auto-injected from .preview/decisions.json — user comments from preview page]**\n"
        + "\n".join(unread)
        + "\n\nIf the user's current prompt does not already address these comments, acknowledge them and iterate on the relevant mockup.\n"
    )
    out = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": msg,
        }
    }
    print(json.dumps(out))

sys.exit(0)
