# Changelog

All notable changes to this project will be documented in this file.

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
