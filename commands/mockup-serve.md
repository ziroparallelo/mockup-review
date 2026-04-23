---
description: Starts the mockup-review HTTP server on port 8765 (bound to 127.0.0.1) from the current project.
allowed-tools: Bash
---

# /mockup-serve — Start the HTTP server

Starts the Python server that serves mockup pages and exposes the review endpoints.

## Steps

1. Kill any process already bound to port 8765:
   ```bash
   lsof -i :8765 -t 2>/dev/null | xargs kill 2>/dev/null; sleep 1
   ```
2. Start server in background from the current working directory:
   ```bash
   python3 .preview/mockups/_server.py
   ```
3. Verify:
   ```bash
   curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8765/.preview/decisions.json
   ```
   Should return `200`.

To use a different port: `MOCKUP_REVIEW_PORT=8766 python3 .preview/mockups/_server.py`

## Endpoints exposed

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/<any>` | Static file server (project root) |
| GET | `/.preview/mtime?path=<path>` | File mtime — used by client for live-reload |
| GET | `/.preview/decisions.json` | Current decisions state |
| POST | `/.preview/decisions` | Save a decision (body: `{fixId, status, variant?, set?, note?}`) |
| POST | `/.preview/send-to-claude` | Copy prompt to clipboard + AppleScript type into frontmost terminal (body: `{prompt, app?}`) |

## Entry point

Open: `http://127.0.0.1:8765/.preview/mockups/index.html`

Create an `index.html` listing your mockup pages (fix-01, fix-02, etc.) — or navigate directly to any fix page.
