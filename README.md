# Mason

An open-source, local-first design canvas for people who ship websites. A project is a plain folder of HTML and CSS; every page shows as live boards at Desktop 1280, Tablet 768 and Mobile 375, and design edits are written back into the real stylesheet, into the rule that already wins or the right `@media` rule. Tokens (DTCG, Tokens Studio, Penpot), taste and accessibility checks, and coding agents over MCP, with a person accepting every change.

Design: Figma file "Mason" (pages 01 Foundations, 02 App, 03 Landing).

## Status

This repository starts as a build plan. `handover/` holds a complete, pre-planned build for DeepSeek V4.1 Flash: 12 phases, 113 cards, frozen contracts in `src/contracts/`, fixtures, templates and landing assets. The executor writes everything else.

Build it in your IDE with its built-in DeepSeek model (no API key): open this folder, start a new agent chat and say **next card**. One chat per card. The agent runs `handover/ide.ps1 next`, does the card, and `handover/ide.ps1 finish` checks it and commits it.

See `handover/README.md` and `handover/00-OVERVIEW.md`.

## Once built

```powershell
npm install
npx vite build
node src/cli/bin.ts path\to\your-site     # browser app on http://127.0.0.1:39765/
npm run desktop                           # Electron app
```

The landing page is `site/index.html`, itself a Mason project.
