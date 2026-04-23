# mockup-review

Interactive HTML mockup review framework for Claude Code. Generate side-by-side variant mockups, collect user decisions in-browser (clickable cards, auto-saved textarea), live-reload when Claude updates files, and send feedback back to Claude with a single button click.

Built for client revision workflows: the user sees the mockup in a browser, clicks the variant they like, writes optional notes in the textarea, presses "invia a Claude" — the comment reaches the terminal session automatically and Claude iterates.

## Screenshots

4 variant cards side-by-side · live AFTER preview that updates on click · live-reload · decision bar at bottom · INVIA A CLAUDE button that types into the terminal via AppleScript.

## Install

### Option 1 — Standalone app/CLI (no Claude Code needed)

```bash
# Clone
git clone https://github.com/ziroparallelo/mockup-review.git ~/.local/mockup-review

# Install CLI to PATH
mkdir -p ~/.local/bin
ln -snf ~/.local/mockup-review/bin/mockup-review ~/.local/bin/mockup-review
# Ensure ~/.local/bin is in PATH (add to ~/.zshrc if not):
#   export PATH="$HOME/.local/bin:$PATH"

# Install macOS .app (folder picker launcher)
osacompile -o ~/Applications/"Mockup Review.app" ~/.local/mockup-review/macos/mockup-review-launcher.applescript
```

Then either:

- **Terminal:** `cd ~/my-project && mockup-review` — server starts + browser opens
- **Finder / Spotlight:** open `Mockup Review.app` → pick a folder → server starts + browser opens
- **Custom port:** `mockup-review --port 8790 ~/my-project`

### Option 2 — Claude Code plugin (git clone + symlink)

```bash
git clone https://github.com/ziroparallelo/mockup-review.git ~/.local/mockup-review
mkdir -p ~/.claude/plugins
ln -snf ~/.local/mockup-review ~/.claude/plugins/mockup-review
```

Restart Claude Code. Commands `/mockup-init`, `/mockup-serve`, `/mockup-stop`, `/client-revision` become available in any project, and the `UserPromptSubmit` hook auto-injects pending comments from `.preview/decisions.json` on every prompt.

### Option 3 — `claude plugin install` (when plugin is in a marketplace)

```bash
claude plugin install mockup-review
```

Requires Claude Code `>=2.0`.

## Verify install worked

```bash
mkdir /tmp/mockup-verify && cd /tmp/mockup-verify
claude
```

Inside the fresh Claude Code session, type `/mockup-init`. You should see a scaffold confirmation creating `.preview/mockups/` with `_server.py`, `_decisions.js`, `_shared.css`.

## Quick start

In any project directory:

```
/mockup-init           # scaffold .preview/mockups/ with server, JS, CSS
/mockup-serve          # start HTTP server on 127.0.0.1:8765
/client-revision       # parse client feedback and generate review mockups
```

Open `http://127.0.0.1:8765/.preview/mockups/index.html` in the browser.

## Features

- **4-variant card grid** per fix — all visible side-by-side, no dimming, click any card to select
- **Live AFTER preview** — block at top of each mockup that updates instantly when a variant is clicked
- **Auto-save textarea** — user notes saved to `.preview/decisions.json` on blur / Ctrl+Enter / debounce
- **Live reload** — when Claude edits a mockup file, the browser reloads automatically (polls mtime)
- **INVIA A CLAUDE button** — uses AppleScript to type `"leggi il commento su fix-<id>"` into the frontmost Terminal, so the comment reaches Claude without copy-paste
- **UserPromptSubmit hook** — every time the user types anything into the chat, the hook auto-injects pending comments from `decisions.json` as context
- **Append-only comments log** — `.preview/comments-log.jsonl` preserves every comment with timestamp

## File layout (after `/mockup-init`)

```
<project>/
├── .preview/
│   ├── mockups/
│   │   ├── _server.py       # HTTP server (decisions POST, mtime, send-to-claude)
│   │   ├── _decisions.js    # decision bar + live-reload client
│   │   ├── _shared.css      # design system
│   │   ├── fix-01-*.html    # your mockups (created by /client-revision)
│   │   └── ...
│   ├── decisions.json       # current user state {fix-id → {status, variant, note}}
│   └── comments-log.jsonl   # append-only comment history
└── .claude/
    └── settings.json        # (optional) project-local hook config
```

## Server endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/<any>` | Static file server (project root) |
| GET | `/.preview/mtime?path=<path>` | Returns `{mtime: <ms>}` for live-reload |
| GET | `/.preview/decisions.json` | Current decisions state |
| POST | `/.preview/decisions` | Save decision (`{fixId, status, variant?, set?, note?}`) |
| POST | `/.preview/send-to-claude` | Copy prompt to clipboard + AppleScript type into terminal (`{prompt, app?}`) |

## macOS Accessibility permission

The `send-to-claude` endpoint uses `osascript` / System Events to type keystrokes into the frontmost terminal. On first use, macOS prompts to grant **Accessibility** permission. Approve in:

```
System Settings → Privacy & Security → Accessibility → allow python3 (and/or your terminal)
```

If denied, the button still saves the comment to `decisions.json` — you can write `leggi il commento su fix-N` manually in the chat.

## Custom decisionBar.init() options

```javascript
decisionBar.init({
  fixId: 'fix-02',                              // unique per fix
  title: 'CTA header arancione',                // shown in decision bar
  allowPending: true,                           // show ⏸ pending button
  variants: [                                   // list of variants (optional)
    { id: 'A', label: 'static solid' },
    { id: 'B', label: 'ghost outline' },
  ],
  variantAnchors: {                             // maps variant id → DOM selector
    A: '#variant-A',
    B: '#variant-B',
  },
  kpiSets: [                                    // optional sub-variants (e.g. for KPI counters)
    { id: 'Public', label: 'set Pubblico' },
  ],
  onVariantSelect: (variantId) => {             // callback when variant changes
    // update live AFTER preview, etc.
  },
});
```

## Notes on architecture

- Server is pure stdlib Python (no deps). Single file, ~150 lines.
- Client JS is vanilla (no bundler). Injects the decision bar + live-reload into any page that includes `_decisions.js`.
- Live-reload polls 3 paths every 2s: the current page HTML, `_decisions.js`, `_shared.css`. Any mtime change triggers reload.
- `UserPromptSubmit` hook reads `decisions.json` from `os.getcwd()` — runs correctly in any project where you invoked Claude Code.

## Limitations

- **macOS only** for the `send-to-claude` button (uses `osascript`). On Linux/Windows the comment is still saved to `decisions.json` and the user can type the prompt manually, or you can adapt the server to use `xdotool` / `SendKeys`.
- **Single target app** — the AppleScript targets `Terminal` by default. Pass `{app: 'iTerm'}` or `{app: 'Warp'}` in the POST body to send to a different terminal.
- **Port 8765** is hardcoded. Change in `_server.py` if needed.

## License

MIT © Alessandro Buccini

## Contributing

Issues and PRs welcome at [github.com/alebuccini/mockup-review-plugin](https://github.com/alebuccini/mockup-review-plugin).
