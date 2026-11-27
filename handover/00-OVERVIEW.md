# mason-studio: overview

> Planner-owned. The executor reads this for context only; it never edits it.

## Product

Mason is an open-source, local-first design canvas for people who ship websites. A project is a plain folder of HTML and CSS files; every page appears as live boards at Desktop 1280, Tablet 768 and Mobile 375, side by side. Design edits are written back into the real stylesheet: to the rule that already wins, or to the matching `@media (max-width)` rule when the person chooses Tablet or Mobile. Mason reads DTCG and Tokens Studio / Penpot tokens, checks pages against a written taste profile and accessibility rules, and lets coding agents (Claude Code, Codex, Cursor, a local Ollama model) read the canvas and propose changes over MCP, which a person accepts or rejects. It runs as a local web app (`mason <folder>` opens the browser on 127.0.0.1) and as an Electron desktop app on Windows, macOS and Linux. The visual design is the Figma file "Mason" (`lfnStZuQScVkHcDKQ4Sp6E`): pages 01 Foundations, 02 App, 03 Landing. It positions Mason as the alternative to tools like Penpot for the moment a design has to become the website itself.

## Requirements (EARS)

| Id | Requirement |
|---|---|
| R1 | THE SYSTEM SHALL read and write project files only inside the opened folder, rejecting absolute paths and `..` escapes. |
| R2 | THE SYSTEM SHALL keep recent projects and settings in `<home>/settings.json` (default `~/.mason`), written with mode 0600. |
| R3 | WHEN the studio emits an event THE SYSTEM SHALL deliver it to every subscriber in subscribe order. |
| R4 | THE SYSTEM SHALL parse stylesheets into rules and declarations with exact source offsets, including rules inside `@media`. |
| R5 | THE SYSTEM SHALL parse each page into an element tree with paths, friendly layer names, layer kinds and exact source ranges. |
| R6 | WHEN a folder with top-level .html files is opened THE SYSTEM SHALL list its pages (index first) and record it in recent projects. |
| R7 | WHEN a page is created THE SYSTEM SHALL write `<slug>.html` from the first page's head with an empty main. |
| R8 | WHEN a template is chosen for an empty folder THE SYSTEM SHALL copy it there and open it. |
| R9 | THE SYSTEM SHALL expose every StudioService method as `POST /api/rpc/<method>` on 127.0.0.1 only. |
| R10 | IF a request's Host header is not `127.0.0.1:<port>` or `localhost:<port>` THEN THE SYSTEM SHALL answer 403. |
| R11 | THE SYSTEM SHALL serve project files under `/p/` without caching and the built UI for every other GET. |
| R12 | WHEN files are written or changed outside Mason THE SYSTEM SHALL push an event to the browser and reload the boards. |
| R13 | THE SYSTEM SHALL start with `mason [folder] [--port N] [--no-open] [--home DIR]`, print its URL and open the browser. |
| R14 | THE SYSTEM SHALL drive the UI from one store over the HTTP client; every failed action becomes an error toast. |
| R15 | WHILE a project is open THE SYSTEM SHALL show each page as Desktop 1280, Tablet 768 and Mobile 375 boards with layers, selection, hover and mirrored outlines. |
| R16 | THE SYSTEM SHALL build the UI from tokenized primitives (buttons, chips, fields, tabs, sections) with Storybook stories. |
| R17 | WHEN a shortcut from SHORTCUTS is pressed outside a text input THE SYSTEM SHALL run its action. |
| R18 | THE SYSTEM SHALL resolve the CSS cascade (media, specificity, !important, source order) for an element at each breakpoint width. |
| R19 | WHEN a style is changed THE SYSTEM SHALL edit the winning rule for All sizes, or the matching `@media (max-width)` rule for Tablet/Mobile, keeping the rest of the file byte for byte. |
| R20 | WHEN Reset is used on a tablet or mobile override THE SYSTEM SHALL remove it, and the rule or media block when empty. |
| R21 | THE SYSTEM SHALL record every write as one undo step with Undo and Redo. |
| R22 | THE SYSTEM SHALL show the selection's matching rules per breakpoint with winning and overridden declarations and file:line links. |
| R23 | THE SYSTEM SHALL let the person choose where an edit applies (All sizes, ≤ 768, ≤ 375) and show which values are overrides. |
| R24 | THE SYSTEM SHALL insert frames, rectangles, ellipses, text and images, edit text in place, delete, move and wrap elements in the HTML. |
| R25 | THE SYSTEM SHALL read DTCG 2025.10 tokens.json and import Tokens Studio / Penpot token files into it. |
| R26 | THE SYSTEM SHALL generate tokens.css (with per-breakpoint values) and suggest tokens in style fields. |
| R27 | THE SYSTEM SHALL open, edit and save any project file in a code drawer, with undo. |
| R28 | THE SYSTEM SHALL read `.mason/taste.md` and block changes that match its hard bans. |
| R29 | THE SYSTEM SHALL check a page for taste bans, heading order, missing alt text, raw colors and low text contrast. |
| R30 | THE SYSTEM SHALL keep the agent endpoint, model and API key on the server and never send the key to the browser. |
| R31 | WHEN an agent proposes style changes THE SYSTEM SHALL write nothing until a person accepts them, as one undo step. |
| R32 | WHEN a person asks the agent about a layer THE SYSTEM SHALL call the configured OpenAI-compatible model and file its answer as a proposal. |
| R33 | WHERE MCP is switched on THE SYSTEM SHALL serve read and propose tools over `POST /mcp`; while off it SHALL answer 403. |
| R34 | THE SYSTEM SHALL show the project's Git changes and commit them locally. |
| R35 | WHILE no project is open THE SYSTEM SHALL show the start screen with open-folder, recent projects and templates. |
| R36 | WHEN another program changes a project file THE SYSTEM SHALL reload the boards, ignoring Mason's own saves. |
| R37 | THE SYSTEM SHALL ship a static landing page in `site/` that passes Mason's own checks and fits 375 to 1440px screens. |
| R38 | THE SYSTEM SHALL run as an Electron desktop app with a native folder picker and a `--smoke` self-test. |

## Non-goals

- Real-time multiplayer, comments, user accounts or any cloud service.
- Prototyping flows and interactions beyond the real links of the pages.
- Vector drawing, boolean shapes, pen tools or bitmap editing.
- Editing CSS shorthands and longhands as one value (`padding` and `padding-top` are separate properties).
- Breakpoints other than Desktop 1280, Tablet ≤ 768 and Mobile ≤ 375 in this version.
- Pushing, pulling or branching in Git (only local status and commit).
- Shell or file-system tools for agents; agents only read and propose.
- Bundling web fonts (Inter and JetBrains Mono are used when installed, with system fallbacks).

## Assumptions

- "Mason" is the working product name; the GitHub links on the landing page point at `github.com/tanzir71/mason`. Change both before publishing.
- Licence: not chosen yet. The landing page links a LICENSE file the owner adds before the first release.
- A new codebase (`D:\deepseek-26\mason-studio`, its own Git repository) replaces the Phoenix Code fork; only Mason's ideas (cascade write-back, breakpoint logic, DTCG tokens, taste checks, MCP, templates) carry over, re-implemented from the contracts.
- MCP is gated by one setting (off by default) plus human review of every proposal, instead of a per-session prompt; the landing copy says "Every change waits for your review".
- The default agent endpoint is a local Ollama server (`http://127.0.0.1:11434/v1`, model `qwen2.5-coder:7b`); any OpenAI-compatible endpoint works.
- The executor is DeepSeek V4.1 Flash as the built-in agent of the user's IDE (Trae assumed; `AGENTS.md` covers others): one card per chat through `handover/ide.ps1`, no API key. Loop mode (`run-loop.ps1` with `DEEPSEEK_API_KEY`) stays available but is off (`"mode": "ide"` in `loop.config.json`).
- The executor runs on Windows (PowerShell gate). The Electron smoke test needs a desktop session; on Linux run it under `xvfb-run`.
- Most cards give complete file contents that the planner verified: the planner ran every card's tests, the type check, Storybook, all 22 Playwright tests and the Electron smoke test against a reference build in Nov 2026. The executor's job is exact transcription, wiring and passing the gate.
- The contracts (`01-CONTRACTS.md`, about 15K tokens) carry the full engine specification. In IDE mode the agent reads them only when a card uses a contract it does not paste; every card pastes the excerpts it uses. In loop mode they form the cached system-prompt prefix (about 20K tokens with the rules).

## Stack (pinned)

| Tool | Version | Used for |
|---|---|---|
| Node.js | ≥ 22.18 (type stripping) | Server, CLI, scripts; `.ts` files run directly |
| TypeScript | 7.0.2 | `tsc --noEmit` type check only |
| React / React DOM | 19.3.1 | UI |
| Vite / @vitejs/plugin-react | 8.4.0 / 6.3.0 | UI dev server and build to `dist/ui` |
| Vitest / jsdom | 5.1.2 / 31.0.1 | Unit and component tests (`// @vitest-environment jsdom` per UI test file) |
| Testing Library | react 16.3.3, user-event 14.6.13, jest-dom 8.0.0 | Component tests |
| Playwright | 1.65.1 (Chromium) | End-to-end smoke tests per phase |
| Storybook | 10.6.9 (react-vite) | Primitive component stories |
| postcss | 8.5.33 | CSS parsing with source offsets |
| parse5 + htmlparser2 adapter, css-select, domhandler | 8.1.1, 8.0.2, 7.0.0, 6.0.1 | HTML parsing and selector matching |
| @bramus/specificity | 2.4.5 | Selector specificity |
| CodeMirror | codemirror 6.0.2, view 6.44.1, state 6.7.6, language 6.13.1, lang-css/html/json | Code drawer |
| lucide-react | 1.81.0 | Icons |
| esbuild | 0.28.2 | Desktop bundle |
| Electron / electron-builder | 45.5.0 / 26.18.0 | Desktop app (added in phase 12) |

Commands used in cards (copy these exactly):

| Purpose | Command |
|---|---|
| Install | `npm install --no-audit --no-fund` |
| Unit tests (files) | `npx vitest run <files>` |
| All unit tests | `npx vitest run` |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` |
| Build UI | `npx vite build` |
| Storybook | `npx storybook build --quiet -o storybook-static` |
| Prepare e2e fixture | `node tests/e2e/prepare.ts` |
| Smoke (browser) | `npx playwright test <spec> --project=chromium` |
| Desktop bundle | `node src/desktop/build.ts` |
| Smoke (desktop) | `npx electron dist/desktop/main.mjs --smoke` |
| Run Mason | `node src/cli/bin.ts <folder>` |

## Module map

| Module | Paths | Responsibility | Provides | Consumes |
|---|---|---|---|---|
| contracts | `src/contracts/**` | Shared types, ports, constants, fakes, contract suites, UI tokens (planner-owned) | - | - |
| engine | `src/engine/**`, `src/types/**` | Pure CSS/HTML/token/check logic and the studio groups behind StudioService | createStudio | - |
| infra | `src/server/infra/**` | Node file system, settings file, event hub, Git, LLM client, watcher | createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub, createProjectWatcher, suppressOwnWrites | - |
| http | `src/server/http/**` | Local HTTP server: RPC, events, project files, UI, MCP route | createHttpServer | - |
| mcp | `src/server/mcp/**` | MCP JSON-RPC handler and tools | createMcpHandler | - |
| shell | `src/server/start.ts` | Composition root `startMason` | startMason | createStudio, createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub, createHttpServer, createMcpHandler, createProjectWatcher, suppressOwnWrites |
| cli | `src/cli/**` | The `mason` command | - | startMason |
| ui-api | `src/ui/api/**` | Browser client for RPC and events | createHttpClient | - |
| ui-state | `src/ui/state/**` | Studio store and action slices | createStudioStore | - |
| ui | `src/ui/app/**`, `src/ui/components/**`, `src/ui/canvas/**`, `src/ui/panels/**`, `src/ui/code/**`, `src/ui/agent/**`, `src/ui/start/**`, `src/ui/styles/**` | React components: app shell, canvas, panels, code drawer, agent UI, start screen | App | - |
| ui-shell | `src/ui/main.tsx`, `src/ui/index.html` | Browser entry that mounts the store and app | mountStudio | createHttpClient, createStudioStore, App |
| site | `site/**` | Static landing page | - | - |
| desktop | `src/desktop/**`, `electron-builder.yml` | Electron main process, preload bridge, packaging | - | startMason |

Rules: modules import each other only through `src/contracts/`; the joins happen in seam cards at `// @seam:` anchors in `src/server/start.ts`, `src/ui/main.tsx`, `src/cli/bin.ts` and `src/desktop/main.ts`. Inside a module, groups and slices register at `// @seam:groups` (create-studio.ts), `// @seam:slices` (create-store.ts) and `// @seam:routes` (server.ts).

## Data flow

1. `mason <folder>` (cli `bin.ts`) → shell `startMason` builds infra (file system, settings, events, Git, LLM), `createStudio(deps)` (engine), `createMcpHandler` (mcp) and `createHttpServer` (http), listens on 127.0.0.1, opens the folder, and the watcher follows `project-opened`.
2. Browser loads the UI (`dist/ui`) → ui-shell `mountStudio` creates `createHttpClient("")` and `createStudioStore(client)`, subscribes to `/api/events`, runs `init()`.
3. The canvas renders a row of boards per page; each board is an iframe of `/p/<page>.html?r=<revision>`. Clicks map to element paths (`dom-paths.ts`) and call `select(path)` → `client.inspect(page, path)` → engine `inspect` (cascade per breakpoint).
4. A Design field commit → store `applyStyle(prop, value)` → `POST /api/rpc/applyStyle` → engine `planStyles` → `planStyleEdit` (TextEdits on the original CSS) → `commitChanges` writes files, pushes an undo step, bumps the revision and emits `written` → SSE → store reloads the tree and inspect; boards reload with the new revision.
5. An agent calls `tools/call propose_style_changes` on `/mcp` → engine `propose` labels and taste-checks the changes and emits `proposal` → SSE → review card → Accept → `acceptProposal` writes once through `planStyles` + `commitChanges`.
6. Another program edits a file → watcher → `suppressOwnWrites` drops Mason's own saves → `external-change` → store bumps the revision and reloads.

## Seam matrix

| Seam | Producer → Consumer | Symbols | Type | Card |
|---|---|---|---|---|
| S001 | infra → engine | createNodeFileSystem | contract-test | S001 |
| S002 | infra → engine | createFileSettingsStore | contract-test | S002 |
| S003 | engine → shell | createStudio | compose | S003 |
| S003-infra | infra → shell | createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub | compose | S003 |
| S003-http | http → shell | createHttpServer | compose | S003 |
| S004 | shell → cli | startMason | compose | S004 |
| S005 | ui-api → ui-shell | createHttpClient | compose | S005 |
| S005-state | ui-state → ui-shell | createStudioStore | compose | S005 |
| S005-ui | ui → ui-shell | App | compose | S005 |
| S006 | mcp → shell | createMcpHandler | compose | S006 |
| S007 | infra → shell | createProjectWatcher, suppressOwnWrites | compose | S007 |
| S008 | shell → desktop | startMason | compose | S008 |

## Phases

| Phase | Cards | Checkpoint | Delivers |
|---|---|---|---|
| 1 Foundation | T001…T002 (2) | C1 | Pinned toolchain, contract suites green, every entry point stubbed, every anchor placed |
| 2 Read a project | T003…S004 (18) | C2 | Server opens a project, parses HTML/CSS, serves RPC, events and files; `mason` command |
| 3 Canvas | T017…S005 (17) | C3 | Browser app: boards per page and breakpoint, layers, selection, tools, shortcuts |
| 4 Design panel | T033…T044 (12) | C4 | Cascade, style write-back to the right rule and @media block, reset, undo/redo, Design panel |
| 5 Elements | T045…T051 (7) | C5 | Insert, edit text, delete, move, wrap elements |
| 6 Tokens | T052…T058 (7) | C6 | DTCG and Tokens Studio tokens, tokens.css, Assets panel, token suggestions |
| 7 Inspect and code | T059…T063 (5) | C7 | Inspect panel with the cascade, CodeMirror code drawer |
| 8 Checks | T064…T070 (7) | C8 | Taste bans, accessibility, raw colors, contrast; Checks panel |
| 9 Agents and MCP | T071…T080 (11) | C9 | Settings, proposals with review, ask-agent via any OpenAI-compatible model, MCP server |
| 10 Git, start screen, watcher | T081…S007 (7) | C10 | Git status and commit, start screen, file watcher |
| 11 Landing page | T087…T090 (4) | C11 | Landing page from the Figma design |
| 12 Desktop app | T091…S008 (4) | C12 | Electron desktop app with folder picker, packaging config, smoke test |

## Glossary

| Term | Meaning |
|---|---|
| Board | One page rendered at one breakpoint width in an iframe on the canvas |
| Element path | Dot-separated element-child indexes from `<body>` ("" is body); identical on server (parse5) and browser (`Element.children`) |
| Scope / Applies to | Where an edit lands: All sizes (base rule), ≤ 768 or ≤ 375 (`@media (max-width)` rules) |
| Winning rule | The declaration the cascade picks for a property at a width |
| Override | A tablet or mobile value that wins from its own `@media (max-width: N px)` rule |
| Proposal | A set of agent style changes waiting for a person to accept or reject |
| Taste profile | `.mason/taste.md`: design and copy notes plus hard bans (literal or regex) |
| Revision | Counter that changes on every write or outside change; boards reload when it changes |
| Studio | The StudioService object created by `createStudio`; everything the UI, HTTP and MCP can do |
