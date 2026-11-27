# T089: Add the agents and Penpot sections

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T089 (build), phase 11 |
| Depends on | T088 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R37 |

**Create:** `tests/site/site-agents.test.ts`

**Modify:** `site/index.html`, `site/styles.css`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T089`):

1. `npx vitest run tests/site/site-agents.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx vitest run tests/site/site-hero.test.ts tests/site/site-sections.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The landing page shows how agents connect over MCP and get reviewed, and a fair comparison table for Penpot users.

## Context

Site module (`site/`): the public landing page from Figma "Mason" → 03 Landing. Plain HTML and CSS with no build step and no JavaScript, so the page is itself a Mason project (open `site/` in Mason to edit it). `site/assets/` (screenshot and logo) is planner-owned and already exists. The agents section is the dark band.

## Contracts (do not modify)

This card uses no contract types.

## Current state

`site/index.html` has the hero, files and responsive sections, then `    <!-- sections -->` above `  </main>`.

## Steps

1. In `site/index.html` insert exactly this HTML directly above the line `    <!-- sections -->`:

```html
    <section class="band band--night" id="agents">
      <div class="wrap">
        <div class="split split--top">
          <div>
            <p class="eyebrow">Agents</p>
            <h2>Bring your agent. Keep the final say.</h2>
          </div>
          <p class="lede">Mason runs a local MCP server. Claude Code, Codex, Cursor or a local Ollama model can read the canvas, select elements and change styles through the same undoable path you use. Your taste rules check every change before it lands.</p>
        </div>
        <div class="trio">
          <figure class="night-card">
            <figcaption class="night-card__head">Connect in one line</figcaption>
<pre class="code">{
  "mcpServers": {
    "mason": {
      "url": "http://127.0.0.1:39765/mcp"
    }
  }
}</pre>
            <ul class="checks">
              <li>Localhost only, off until you switch it on</li>
              <li>Every change waits for your review</li>
              <li>No shell or file-system tools, ever</li>
            </ul>
          </figure>
          <figure class="night-card" aria-label="A proposal from Claude Code waiting for review">
            <figcaption class="night-card__head"><span class="dot"></span>Claude Code proposes 3 changes</figcaption>
            <p class="night-card__meta">styles.css · via MCP · nothing saved yet</p>
            <ol class="proposal">
              <li><span class="num">1</span><span>Headline size<small>32 → 44 · ≤ 768</small></span></li>
              <li><span class="num">2</span><span>Eyebrow letter spacing<small>12% → 18% · ≤ 768</small></span></li>
              <li class="is-blocked"><span class="num">3</span><span>Hero background gradient<small>Blocked: no gradients</small></span></li>
            </ol>
            <div class="proposal__actions"><span class="button button--accent button--small">Accept 2</span><span class="button button--ghost button--small">Reject</span></div>
          </figure>
          <figure class="night-card" aria-label="The project's taste file with a hard ban that blocked a change">
            <figcaption class="night-card__head"><span>.mason/taste.md</span><span class="night-card__note">plain Markdown</span></figcaption>
<pre class="code code--taste">## Design
- Serif headlines, sans body
- One accent: rust

## Hard bans
<span class="hit">- literal: linear-gradient   <span class="hit__note">blocked 1 change</span></span>
- regex: #(6e56cf|7c3aed)
- literal: !important</pre>
            <p class="night-card__foot">Checks run on every agent edit, with no AI in the loop.</p>
          </figure>
        </div>
      </div>
    </section>
    <section class="band" id="penpot">
      <div class="wrap">
        <div class="split split--top">
          <div>
            <p class="eyebrow">For Penpot users</p>
            <h2>Using Penpot? Keep it.</h2>
          </div>
          <p class="lede">Penpot is a strong platform for design teams. Mason is for the moment a design has to become a working website. Bring your Penpot tokens in, design the real pages here, and keep Penpot for flows, comments and team reviews.</p>
        </div>
        <div class="table-wrap">
          <table class="compare">
            <thead><tr><th scope="col"><span class="sr">Topic</span></th><th scope="col">Penpot</th><th scope="col">Mason</th></tr></thead>
            <tbody>
              <tr><th scope="row">Where designs live</th><td>Penpot server database</td><td class="lead">Plain files in your folder</td></tr>
              <tr><th scope="row">What developers get</th><td>Generated CSS from Inspect</td><td class="lead">Your actual stylesheet, rule by rule</td></tr>
              <tr><th scope="row">Responsive design</th><td>One board per screen size</td><td class="lead">Real @media rules, boards side by side</td></tr>
              <tr><th scope="row">Working offline</th><td>Run your own Penpot server</td><td class="lead">Desktop app, no server</td></tr>
              <tr><th scope="row">Teams</th><td class="lead">Real-time multiplayer and comments</td><td>Single-player, share through Git</td></tr>
              <tr><th scope="row">Prototyping</th><td class="lead">Interactions and flows</td><td>Live links on real pages</td></tr>
              <tr><th scope="row">Design tokens</th><td>Native tokens and shared libraries</td><td>Imports Penpot tokens, DTCG 2025.10</td></tr>
              <tr><th scope="row">AI agents</th><td>Official MCP server through a plugin</td><td>Local MCP server with taste checks</td></tr>
            </tbody>
            <tfoot><tr><td colspan="3"><span class="dot"></span>Leads on this row. Penpot leads on teamwork and prototyping; Mason leads when the output has to be the website itself.</td></tr></tfoot>
          </table>
        </div>
        <p class="footnote">Compared with Penpot 2.19, November 2026.</p>
      </div>
    </section>
```

2. Append exactly these lines to the end of `site/styles.css`:

```css
/* Sections: agents and Penpot */
.band--night { background: var(--night); color: var(--night-text); }
.band--night h2 { color: #f4f3ef; }
.band--night .eyebrow, .band--night .lede { color: var(--night-muted); }
.split--top { align-items: start; }
.trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 56px; }
.night-card { display: flex; flex-direction: column; margin: 0; border: 1px solid var(--night-line); border-radius: var(--radius); background: var(--night-panel); overflow: hidden; }
.night-card__head { display: flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--night-line); font-size: 13px; font-weight: 500; color: #f4f3ef; }
.night-card__note { margin-left: auto; font-weight: 400; color: var(--night-muted); }
.night-card__meta { margin: 0; padding: 10px 16px 0; font-size: 12px; color: var(--night-muted); }
.night-card__foot { margin: auto 0 0; padding: 14px 16px; border-top: 1px solid var(--night-line); font-size: 13px; color: var(--night-muted); }
.code { margin: 0; padding: 16px; font-size: 12px; line-height: 1.7; color: #c9d4ff; background: #101010; overflow-x: auto; }
.code--taste { color: var(--night-text); background: transparent; }
.code .hit { display: block; margin: 0 -16px; padding: 0 16px; background: rgba(210, 63, 53, 0.22); }
.code .hit__note { float: right; color: #f2665c; }
.checks { margin: 0; padding: 12px 16px; list-style: none; border-top: 1px solid var(--night-line); font-size: 13px; }
.checks li { padding: 5px 0 5px 22px; position: relative; }
.checks li::before { content: ""; position: absolute; left: 2px; top: 11px; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--night-muted); }
.proposal { margin: 0; padding: 8px 16px; list-style: none; }
.proposal li { display: flex; gap: 10px; padding: 8px 0; font-size: 13px; color: #f4f3ef; }
.proposal small { display: block; font: 400 11px/1.6 var(--mono); color: var(--night-muted); }
.proposal .num { display: grid; place-items: center; flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #ffffff; font-size: 10px; font-weight: 600; }
.proposal .is-blocked .num { background: var(--bad); }
.proposal .is-blocked small { color: #f2665c; }
.proposal__actions { display: flex; gap: 8px; margin-top: auto; padding: 12px 16px; border-top: 1px solid var(--night-line); }
.button--accent { border-color: var(--accent); background: var(--accent); color: #ffffff; }
.button--ghost { border-color: var(--night-line); background: transparent; color: var(--night-text); }
.table-wrap { margin-top: 48px; overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
.compare { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; }
.compare th, .compare td { padding: 14px 20px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.compare thead th { font-weight: 500; font-size: 13px; color: var(--muted); }
.compare tbody th { width: 24%; font-weight: 500; }
.compare td { color: var(--muted); }
.compare td.lead { color: var(--ink); }
.compare td.lead::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: var(--ok); vertical-align: 1px; }
.compare tfoot td { border-bottom: 0; background: var(--paper); font-size: 13px; color: var(--ink-soft); }
.compare tfoot .dot { margin-right: 8px; }
.footnote { margin: 16px 0 0; font-size: 12px; color: var(--faint); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 900px) {
  .trio { grid-template-columns: minmax(0, 1fr); }
}
```

3. Create `tests/site/site-agents.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("site/index.html", "utf8");

describe("agents and Penpot sections", () => {
  it("shows the MCP connection, a review card and the taste file", () => {
    expect(html).toContain('id="agents"');
    expect(html).toContain("<h2>Bring your agent. Keep the final say.</h2>");
    expect(html).toContain('"url": "http://127.0.0.1:39765/mcp"');
    expect(html).toContain("Every change waits for your review");
    expect(html).toContain("Blocked: no gradients");
  });
  it("compares fairly with Penpot in an accessible table", () => {
    expect(html).toContain("<h2>Using Penpot? Keep it.</h2>");
    const rows = html.match(/<tr><th scope="row">/g) ?? [];
    expect(rows.length).toBe(8);
    expect(html).toContain("Compared with Penpot 2.19, November 2026.");
    expect(html.indexOf('id="agents"')).toBeLessThan(html.indexOf('id="penpot"'));
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show the MCP config, a review card with a blocked change and the taste file. (test: "shows the MCP connection, a review card and the taste file")
- THE SYSTEM SHALL compare eight rows with Penpot in a table with row headers. (test: "compares fairly with Penpot in an accessible table")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T089`.
The last line must be `GATE PASS T089`. On `GATE FAIL T089 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `site/` and uses only the contracts (fakes only in tests).
- Do not add JavaScript, web fonts, frameworks or a build step to the site.
- Do not use italics (`<i>`, `<em>`, `font-style: italic`), gradients or `!important` anywhere on the site.
- Do not change copy, links, class names or ids from the code given.

## Done when

- `verify.ps1 -Card T089` prints `GATE PASS T089`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T089: Add the agents and Penpot sections
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
