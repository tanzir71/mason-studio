# T064: Read the taste profile and match hard bans

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T064 (build), phase 8 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R28 |

**Create:** `src/engine/checks/taste.ts`, `tests/engine/taste.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T064`):

1. `npx vitest run tests/engine/taste.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parseTaste` reads `.mason/taste.md` (sections and hard bans) and `checkBans` reports every ban a text matches.

## Context

Engine module, checks area. The taste file is the team's written design and copy rules; hard bans block agent proposals (phase 9) and show in Checks. A ban's note is split at the LAST " | " so regex alternations like `#(a|b)` survive. Pure functions: no I/O.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * parseTaste(markdown): sections keyed by lowercase "## " heading text, value = trimmed body. Bans come from the
 * "hard bans" section: lines `- literal: <pattern>` or `- regex: <pattern>`, optionally followed by ` | <note>`
 * (split at the LAST " | ", so "#(a|b)" stays intact); pattern and note are trimmed; note defaults to the pattern;
 * line = 1-based line in the file. A regex that does not compile is skipped and
 * `regex: <pattern>` is added to `invalid`.
 */
export type ParseTaste = (markdown: string) => TasteProfile;
/**
 * checkBans(profile, text, where): one finding per ban that matches `text` (literal: case-insensitive substring;
 * regex: new RegExp(pattern, "i")). Finding: id `taste:${ban.line}`, kind "taste", severity "blocked",
 * title = ban.note, detail = `Matches "${ban.kind}: ${ban.pattern}".`, file/line/path from `where`.
 */
export type CheckBans = (profile: TasteProfile, text: string,
  where: { file: string | null; line: number | null; path: ElementPath | null }) => CheckFinding[];
```

```ts
// src/contracts/model.ts
export interface HardBan { kind: "literal" | "regex"; pattern: string; note: string; line: number }
export interface TasteProfile { sections: Record<string, string>; bans: HardBan[]; invalid: string[] }
export interface CheckFinding {
  id: string; kind: CheckKind; severity: Severity; title: string; detail: string;
  file: string | null; line: number | null; path: ElementPath | null;
}
```

## Current state

`src/engine/checks/` does not exist. `tests/fixtures/northfield/.mason/taste.md` has Design, Copy and Hard bans sections; its last ban is the invalid regex `([`.

## Steps

1. Create `src/engine/checks/taste.ts` with exactly this content:

```ts
import type { CheckFinding, ElementPath, HardBan, TasteProfile } from "../../contracts/model.ts";

/** See ParseTaste in src/contracts/engine.ts. */
export function parseTaste(markdown: string): TasteProfile {
  const lines = markdown.split(/\r?\n/);
  const bodies: Record<string, string[]> = {};
  const bans: HardBan[] = [];
  const invalid: string[] = [];
  let current: string | null = null;
  lines.forEach((line, i) => {
    const head = /^##\s+(.+?)\s*$/.exec(line);
    if (head) { current = head[1].toLowerCase(); bodies[current] = []; return; }
    if (current === null) return;
    bodies[current].push(line);
    if (current !== "hard bans") return;
    const m = /^\s*-\s*(literal|regex):\s*(.+)$/.exec(line);
    if (!m) return;
    const rest = m[2];
    const cut = rest.lastIndexOf(" | ");
    const pattern = (cut >= 0 ? rest.slice(0, cut) : rest).trim();
    const note = (cut >= 0 ? rest.slice(cut + 3) : "").trim() || pattern;
    const kind = m[1] as HardBan["kind"];
    if (kind === "regex") {
      try { new RegExp(pattern, "i"); } catch { invalid.push(`regex: ${pattern}`); return; }
    }
    bans.push({ kind, pattern, note, line: i + 1 });
  });
  const sections: Record<string, string> = {};
  for (const [k, v] of Object.entries(bodies)) sections[k] = v.join("\n").trim();
  return { sections, bans, invalid };
}

/** See CheckBans in src/contracts/engine.ts. */
export function checkBans(profile: TasteProfile, text: string,
  where: { file: string | null; line: number | null; path: ElementPath | null }): CheckFinding[] {
  const out: CheckFinding[] = [];
  for (const ban of profile.bans) {
    const hit = ban.kind === "literal" ? text.toLowerCase().includes(ban.pattern.toLowerCase()) : new RegExp(ban.pattern, "i").test(text);
    if (!hit) continue;
    out.push({ id: `taste:${ban.line}`, kind: "taste", severity: "blocked", title: ban.note,
      detail: `Matches "${ban.kind}: ${ban.pattern}".`, file: where.file, line: where.line, path: where.path });
  }
  return out;
}
```

2. Create `tests/engine/taste.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkBans, parseTaste } from "../../src/engine/checks/taste.ts";
import type { CheckBans, ParseTaste } from "../../src/contracts/engine.ts";

const _t: [ParseTaste, CheckBans] = [parseTaste, checkBans];
void _t;
const taste = readFileSync("tests/fixtures/northfield/.mason/taste.md", "utf8");

describe("taste profile", () => {
  it("reads sections and hard bans with notes split at the last ' | '", () => {
    const p = parseTaste(taste);
    expect(Object.keys(p.sections)).toEqual(["design", "copy", "hard bans"]);
    expect(p.sections.design).toBe("- Serif headlines, sans body.\n- One accent: rust.");
    expect(p.bans).toEqual([
      { kind: "literal", pattern: "linear-gradient", note: "No gradients", line: 11 },
      { kind: "regex", pattern: "#(6e56cf|7c3aed)", note: "No stock AI purple", line: 12 },
      { kind: "literal", pattern: "!important", note: "Fix specificity instead", line: 13 },
    ]);
    expect(p.invalid).toEqual(["regex: (["]);
  });
  it("defaults the note to the pattern", () => {
    expect(parseTaste("## Hard bans\n- literal: Lorem ipsum\n").bans).toEqual([{ kind: "literal", pattern: "Lorem ipsum", note: "Lorem ipsum", line: 2 }]);
  });
  it("finds literal and regex bans case-insensitively", () => {
    const p = parseTaste(taste);
    const hits = checkBans(p, "background: LINEAR-GRADIENT(#7C3AED, red)", { file: "a.css", line: 3, path: null });
    expect(hits).toEqual([
      { id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "a.css", line: 3, path: null },
      { id: "taste:12", kind: "taste", severity: "blocked", title: "No stock AI purple", detail: 'Matches "regex: #(6e56cf|7c3aed)".', file: "a.css", line: 3, path: null },
    ]);
    expect(checkBans(p, "color: red;", { file: null, line: null, path: "1" })).toEqual([]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL read lowercase sections and bans with notes split at the last " | ", listing invalid regexes separately. (test: "reads sections and hard bans with notes split at the last ' | '")
- THE SYSTEM SHALL match literal and regex bans case-insensitively as blocked taste findings. (test: "finds literal and regex bans case-insensitively")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T064`.
The last line must be `GATE PASS T064`. On `GATE FAIL T064 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T064` prints `GATE PASS T064`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T064: Read the taste profile and match hard bans
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
