# T088: Add the files and responsive sections

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T088 (build), phase 11 |
| Depends on | T087 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R37 |

**Create:** `tests/site/site-sections.test.ts`

**Modify:** `site/index.html`, `site/styles.css`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T088`):

1. `npx vitest run tests/site/site-sections.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx vitest run tests/site/site-hero.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The landing page explains that the files are the design (file tree and diff) and shows breakpoints side by side (mini boards, Applies to switch).

## Context

Site module (`site/`): the public landing page from Figma "Mason" → 03 Landing. Plain HTML and CSS with no build step and no JavaScript, so the page is itself a Mason project (open `site/` in Mason to edit it). `site/assets/` (screenshot and logo) is planner-owned and already exists.

## Contracts (do not modify)

This card uses no contract types.

## Current state

`site/index.html` (T087) contains the line `    <!-- sections -->` directly above `  </main>`. `site/styles.css` ends with the base media queries.

## Steps

1. In `site/index.html` insert exactly this HTML directly above the line `    <!-- sections -->`:

```html
    <section class="band" id="files">
      <div class="wrap split">
        <div>
          <p class="eyebrow">The files are the design</p>
          <h2>No export step.<br>No drift.</h2>
          <p class="lede split__lede">Most design tools draw a picture of your site and leave someone to rebuild it. In Mason the picture is the site: open a folder, design, and the same files ship.</p>
          <dl class="facts">
            <div><dt><code>index.html</code></dt><dd>Each page is a file. Each board is that file at one width.</dd></div>
            <div><dt><code>styles.css</code></dt><dd>Changes go to the rule that already wins, not a pile of new overrides.</dd></div>
            <div><dt><code>git</code></dt><dd>History, branches and review come from Git, not a private timeline.</dd></div>
          </dl>
        </div>
        <figure class="card files" aria-label="A Mason project folder and the change the Design panel wrote">
          <div class="files__head"><span>northfield-site</span><span class="tag">main · 3 changes</span></div>
          <ul class="files__list">
            <li>index.html</li>
            <li>menu.html</li>
            <li>visit.html</li>
            <li class="is-changed">styles.css <span>modified</span></li>
            <li>tokens.json</li>
            <li>.mason/taste.md</li>
            <li>images/</li>
          </ul>
          <div class="diff">
            <div class="diff__head"><span>styles.css <span class="diff__count">+3</span></span><span>written by the Design panel</span></div>
<pre><span>@media (max-width: 768px) {</span>
<span class="diff__add">  .hero h1 {</span>
<span class="diff__add">    font-size: 32px;</span>
<span class="diff__add">  }</span>
<span>}</span></pre>
          </div>
        </figure>
      </div>
    </section>
    <section class="band band--deep" id="responsive">
      <div class="wrap split split--flip">
        <figure class="card mini" aria-label="Three boards of one page with the Applies to switch set to tablet">
          <div class="mini__boards">
            <div class="mini__board"><span class="mini__label"><span class="dot dot--desktop"></span>Desktop</span><div class="mini__page mini__page--wide"><span class="bar"></span><span class="bar"></span><span class="bar short"></span><span class="block"></span></div></div>
            <div class="mini__board is-active"><span class="mini__label"><span class="dot dot--tablet"></span>Tablet</span><div class="mini__page"><span class="bar"></span><span class="bar short"></span><span class="block"></span></div></div>
            <div class="mini__board"><span class="mini__label"><span class="dot dot--mobile"></span>Mobile</span><div class="mini__page mini__page--narrow"><span class="bar"></span><span class="bar short"></span><span class="block"></span></div></div>
          </div>
          <p class="mini__caption">Applies to</p>
          <div class="segmented"><span>All sizes</span><span class="is-on"><span class="dot dot--tablet"></span>≤ 768</span><span><span class="dot dot--mobile"></span>≤ 375</span></div>
          <div class="prop"><span class="prop__name">Headline size</span><span class="prop__values"><span><span class="dot dot--desktop"></span>40</span><span class="is-on"><span class="dot dot--tablet"></span>32</span><span><span class="dot dot--mobile"></span>28</span><span class="prop__reset">Reset</span></span></div>
        </figure>
        <div>
          <p class="eyebrow">Responsive, done properly</p>
          <h2>Breakpoints side by side, not separate mockups.</h2>
          <p class="lede split__lede">Every page shows its breakpoints in one row. Pick where a change applies (all sizes, tablet or mobile) and Mason writes it into the right @media rule. Coloured dots show where each value comes from, so a 28px mobile heading is never a mystery.</p>
        </div>
      </div>
    </section>
```

2. Append exactly these lines to the end of `site/styles.css`:

```css
/* Sections: files and responsive */
.band { padding: 112px 0; }
.band--deep { background: var(--paper-deep); }
.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: center; }
.split__lede { margin-top: 20px; }
.card { margin: 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); box-shadow: 0 12px 32px rgba(20, 20, 15, 0.06); }
.tag { padding: 2px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 12px; color: var(--muted); }
.facts { margin: 32px 0 0; }
.facts div { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid var(--line); }
.facts dt code { font-size: 13px; }
.facts dd { margin: 0; font-size: 14px; color: var(--muted); }
.files__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 500; }
.files__list { margin: 0; padding: 8px; list-style: none; font: 400 13px/1 var(--mono); }
.files__list li { display: flex; justify-content: space-between; padding: 9px 10px; border-radius: 6px; color: var(--ink-soft); }
.files__list li.is-changed { background: var(--paper); color: var(--ink); }
.files__list li span { font: 500 12px/1 var(--font); color: var(--rust); }
.diff { border-top: 1px solid var(--line); background: #faf9f6; border-radius: 0 0 var(--radius) var(--radius); }
.diff__head { display: flex; justify-content: space-between; padding: 12px 18px 8px; font: 400 12px/1 var(--mono); color: var(--muted); }
.diff__count { color: var(--ok); }
.diff pre { margin: 0; padding: 0 0 14px; font-size: 12px; line-height: 1.9; overflow-x: auto; white-space: normal; }
.diff pre span { display: block; padding: 0 18px; white-space: pre; }
.diff__add { background: rgba(46, 139, 94, 0.12); }
.diff__add::before { content: "+"; display: inline-block; width: 14px; margin-left: -10px; color: var(--ok); }
.split--flip > :first-child { order: 0; }
.mini { padding: 20px; }
.mini__boards { display: grid; grid-template-columns: 1.7fr 1.1fr 0.55fr; gap: 12px; align-items: start; }
.mini__label { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.mini__board.is-active .mini__label { color: var(--ink); font-weight: 500; }
.mini__page { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 4px; background: #f8f6f1; min-height: 120px; }
.mini__board.is-active .mini__page { border-color: var(--tablet); box-shadow: 0 0 0 1px var(--tablet); }
.mini__page .bar { display: block; height: 6px; border-radius: 2px; background: var(--ink); }
.mini__page .bar.short { width: 60%; background: var(--faint); }
.mini__page .block { display: block; height: 40px; margin-top: 8px; border-radius: 3px; background: #e6e2da; }
.mini__caption { margin: 20px 0 8px; font-size: 12px; color: var(--muted); }
.segmented { display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); font-size: 13px; }
.segmented > span { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; border-radius: 6px; color: var(--muted); }
.segmented .is-on { background: var(--panel); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
.prop { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 8px; background: var(--paper); font-size: 13px; }
.prop__name { font-weight: 500; }
.prop__values { display: flex; align-items: center; gap: 12px; color: var(--muted); font-family: var(--mono); font-size: 12px; }
.prop__values > span { display: inline-flex; align-items: center; gap: 5px; }
.prop__values .is-on { padding: 3px 8px; border: 1px solid var(--tablet); border-radius: 6px; color: var(--ink); }
.prop__reset { font-family: var(--font); color: var(--ink-soft); }
.dot--desktop { background: var(--faint); }
.dot--tablet { background: var(--tablet); }
.dot--mobile { background: var(--mobile); }
@media (max-width: 900px) {
  .band { padding: 72px 0; }
  .split { grid-template-columns: minmax(0, 1fr); gap: 40px; }
  .split--flip > :first-child { order: 2; }
}
@media (max-width: 480px) {
  .facts div { grid-template-columns: 1fr; gap: 4px; }
  .mini__boards { grid-template-columns: 1.6fr 1fr; }
  .mini__board:last-child { display: none; }
  .prop { flex-direction: column; align-items: flex-start; }
}
```

3. Create `tests/site/site-sections.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("site/index.html", "utf8");

describe("files and responsive sections", () => {
  it("explains that the files are the design", () => {
    expect(html).toContain('<section class="band" id="files">');
    expect(html).toContain("<h2>No export step.<br>No drift.</h2>");
    for (const f of ["index.html", "styles.css", "git"]) expect(html).toContain(`<dt><code>${f}</code></dt>`);
    expect(html).toContain('<span class="diff__add">    font-size: 32px;</span>');
  });
  it("shows breakpoints side by side", () => {
    expect(html).toContain('id="responsive"');
    expect(html).toContain("<h2>Breakpoints side by side, not separate mockups.</h2>");
    expect(html.indexOf('id="files"')).toBeLessThan(html.indexOf('id="responsive"'));
    expect(html.indexOf('id="responsive"')).toBeLessThan(html.indexOf("<!-- sections -->"));
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show the files section with the three facts and the diff. (test: "explains that the files are the design")
- THE SYSTEM SHALL show the responsive section after it, above the sections marker. (test: "shows breakpoints side by side")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T088`.
The last line must be `GATE PASS T088`. On `GATE FAIL T088 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T088` prints `GATE PASS T088`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T088: Add the files and responsive sections
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
