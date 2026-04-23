# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] — 2026-04-23

### Added

- `/client-revision` now auto-bootstraps: no need to run `/mockup-init` or `/mockup-serve` manually. It scaffolds `.preview/mockups/`, starts the server in background, waits for readiness, and opens the browser.
- `scripts/preflight.sh` — idempotent bootstrap script (safe to run many times). Writes server PID to `.preview/.server.pid` and server log to `.preview/.server.log`.
- `scripts/stop.sh` — graceful shutdown using the PID file; falls back to `lsof` kill.
- `bin/mockup-review` — standalone CLI launcher + macOS `.app` bundle (Finder/Spotlight double-click).
- Env vars: `MOCKUP_REVIEW_NO_BROWSER=1` to skip browser open; `MOCKUP_REVIEW_PORT` honored everywhere; `MOCKUP_REVIEW_ROOT` for test isolation.

### Changed

- `/mockup-stop` uses `scripts/stop.sh` for graceful shutdown (was `lsof | xargs kill`).
- `commands/client-revision.md`: new "Step 0 — Auto-Bootstrap" section at the top.
- `templates/_server.py`: honors `MOCKUP_REVIEW_ROOT` env var to override `PROJECT_ROOT` (enables testable isolation).

### Tests

- 5 new unit tests for preflight.sh idempotency, scaffolding, PID file lifecycle, port-conflict detection (`tests/test_preflight.py`).
- 1 new integration test covering preflight → POST → hook pickup (`tests/test_integration_bootstrap.py`).
- 4 new Playwright E2E tests for bootstrap behavior against a scratch project (`tests/e2e/preflight.spec.ts`).

Total: 30 tests (19 pytest + 11 Playwright).

---

## [0.1.0] — 2026-04-23

### Initial release

- HTTP server (`_server.py`) with endpoints: static file serving, `/.preview/decisions` POST, `/.preview/mtime` GET, `/.preview/send-to-claude` POST
- Decision bar client (`_decisions.js`):
  - Auto-inject into any page that includes the script
  - 4 variants bar buttons + clickable variant cards (keyboard accessible)
  - Textarea with auto-save (blur / Ctrl+Enter / 1.5s debounce)
  - Toggle re-click = deselect
  - Live-reload polling (3 files, 2s interval)
  - `onVariantSelect` callback hook for live AFTER preview
- Shared CSS (`_shared.css`) with variant highlight system (outline + SELECTED badge) and card grid layout
- `UserPromptSubmit` hook auto-injects unread comments from `decisions.json` into each user prompt
- Commands: `/mockup-init`, `/mockup-serve`, `/mockup-stop`, `/client-revision`
- macOS AppleScript integration for "send to claude" button
- Append-only comments log at `.preview/comments-log.jsonl`
