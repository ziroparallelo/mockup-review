---
description: Scaffolds the mockup-review framework in the current project (creates .preview/mockups/ with server, JS, CSS assets).
allowed-tools: Bash, Read, Write
---

# /mockup-init — Scaffold mockup-review framework

Installs the mockup-review interactive review framework in the **current working directory**.

## What it creates

```
<cwd>/
├── .preview/
│   ├── mockups/
│   │   ├── _server.py       # HTTP server with decisions POST, mtime, send-to-claude, log
│   │   ├── _decisions.js    # decision bar injected + live-reload + clickable variant cards
│   │   └── _shared.css      # design system for mockup pages (variant highlighting, panels)
│   ├── decisions.json       # {} — user decisions per fix-id (auto-created by server)
│   └── comments-log.jsonl   # append-only log of all user comments
└── .gitignore additions     # adds .preview/ to gitignore if present
```

## Steps

1. Check that you are in a valid project directory (has package.json, or ask user)
2. Run:
   ```bash
   cp "${CLAUDE_PLUGIN_ROOT}/templates/_server.py" .preview/mockups/_server.py
   cp "${CLAUDE_PLUGIN_ROOT}/templates/_decisions.js" .preview/mockups/_decisions.js
   cp "${CLAUDE_PLUGIN_ROOT}/templates/_shared.css" .preview/mockups/_shared.css
   echo '{}' > .preview/decisions.json
   ```
3. Ensure `.gitignore` (if exists) has `.preview/` entry. Offer to add it if missing.
4. Instruct user to run `/mockup-serve` to start the HTTP server
5. Remind the user to create mockup HTML files in `.preview/mockups/fix-<id>-<slug>.html` each including:
   - `<link rel="stylesheet" href="_shared.css">`
   - `<script src="_decisions.js"></script>` before `</body>`
   - A `decisionBar.init({ fixId, title, variants: [...], variantAnchors: {...}, onVariantSelect: ... })` block

## Permissions notice

The `send-to-claude` endpoint uses AppleScript (macOS) to type the prompt into the frontmost terminal. First use will trigger a system prompt to grant **Accessibility** permission to `python3` — approve it in System Settings → Privacy & Security → Accessibility.
