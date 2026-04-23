---
description: Stops the mockup-review HTTP server (port 8765) and optionally cleans up .preview/ directory.
allowed-tools: Bash, AskUserQuestion
---

# /mockup-stop — Stop the server

1. Kill process on port 8765:
   ```bash
   lsof -i :8765 -t 2>/dev/null | xargs kill 2>/dev/null
   ```

2. Ask the user via AskUserQuestion whether to also remove `.preview/mockups/*.html` files (the generated mockups) and `.preview/decisions.json`. **Never** automatically delete — always confirm.

3. If user confirms cleanup, run:
   ```bash
   rm -rf .preview/mockups/fix-*.html .preview/mockups/index.html .preview/mockups/logo-test.html
   echo '{}' > .preview/decisions.json
   ```
   Keep `_server.py`, `_decisions.js`, `_shared.css` (framework files) unless user explicitly requests full removal.
