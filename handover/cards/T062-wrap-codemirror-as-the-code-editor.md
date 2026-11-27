# T062: Wrap CodeMirror as the code editor

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T062 (build), phase 7 |
| Depends on | T022 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R27 |

**Create:** `src/ui/code/CodeEditor.tsx`, `tests/ui/code-editor.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T062`):

1. `npx vitest run tests/ui/code-editor.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`CodeEditor` shows a file in CodeMirror 6 with CSS/HTML/JSON highlighting, the Mason theme, jump-to-line and Mod-S to save.

## Context

UI module, code area. CodeMirror owns the document; `onChange` reports every edit, and a `value` that changes from outside (for example after Undo) replaces the document. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

This card uses no contract types. Installed: codemirror 6.0.2 (`EditorView`, `basicSetup`), @codemirror/view (`keymap`), @codemirror/state (`Extension`), @codemirror/lang-css (`css`), @codemirror/lang-html (`html`), @codemirror/lang-json (`json`).

## Current state

`src/ui/code/` does not exist. The tests polyfill `Range.getClientRects` because jsdom has no layout.

## Steps

1. Create `src/ui/code/CodeEditor.tsx` with exactly this content:

```tsx
import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export type CodeLanguage = "css" | "html" | "json" | "text";
/** Language by file extension: .css, .html/.htm, .json; anything else is plain text. */
export function languageOf(file: string): CodeLanguage {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return ext === "css" ? "css" : ext === "html" || ext === "htm" ? "html" : ext === "json" ? "json" : "text";
}
const LANGUAGES: Record<CodeLanguage, () => Extension> = { css: () => css(), html: () => html(), json: () => json(), text: () => [] };

const masonTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--bg-inset)", color: "var(--text-default)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "18px" },
  ".cm-gutters": { backgroundColor: "var(--bg-inset)", color: "var(--text-faint)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--bg-raised)" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--accent-strong)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--accent-subtle)" },
}, { dark: true });

/** Syntax colors from the Mason tokens: properties in accent, values in teal, strings in amber, comments faint. */
const masonHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "var(--text-faint)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--accent-strong)" },
  { tag: [tags.number, tags.unit, tags.atom, tags.keyword, tags.bool, tags.color], color: "var(--bp-tablet)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--warning)" },
  { tag: [tags.tagName, tags.className, tags.labelName], color: "var(--text-strong)" },
  { tag: tags.variableName, color: "var(--bp-mobile)" },
]);

export interface CodeEditorProps {
  file: string;
  value: string;
  line: number | null;
  onChange(text: string): void;
  onSave(): void;
}
/** CodeMirror 6 editor. Recreated when `file` changes; `value` changes from outside replace the document. Mod-s saves. */
export function CodeEditor({ file, value, line, onChange, onSave }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        keymap.of([{ key: "Mod-s", preventDefault: true, run: () => { callbacks.current.onSave(); return true; } }]),
        basicSetup, masonTheme, syntaxHighlighting(masonHighlight), LANGUAGES[languageOf(file)](),
        EditorView.updateListener.of((u) => { if (u.docChanged) callbacks.current.onChange(u.state.doc.toString()); }),
      ],
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
  }, [file]);

  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v || line === null || line < 1 || line > v.state.doc.lines) return;
    const pos = v.state.doc.line(line).from;
    v.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 36 }) });
  }, [file, line]);

  return <div ref={host} className="m-code-editor" data-language={languageOf(file)} />;
}
```

2. Create `tests/ui/code-editor.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { EditorView } from "codemirror";
import { CodeEditor, languageOf } from "../../src/ui/code/CodeEditor.tsx";

// jsdom has no layout: CodeMirror measures text ranges, so give Range empty rects.
Range.prototype.getClientRects = function () { return [] as unknown as DOMRectList; };
Range.prototype.getBoundingClientRect = function () { return new DOMRect(); };

const viewOf = (container: HTMLElement) => EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;

describe("CodeEditor", () => {
  it("picks the language from the file extension", () => {
    expect([languageOf("a.css"), languageOf("index.HTML"), languageOf("tokens.json"), languageOf(".mason/taste.md")]).toEqual(["css", "html", "json", "text"]);
  });
  it("shows the value and reports edits", () => {
    const onChange = vi.fn();
    const { container } = render(<CodeEditor file="a.css" value={"a {}\nb {}\n"} line={2} onChange={onChange} onSave={() => {}} />);
    const view = viewOf(container);
    expect(view.state.doc.toString()).toBe("a {}\nb {}\n");
    expect(view.state.selection.main.head).toBe(5);
    view.dispatch({ changes: { from: 0, insert: "/* x */\n" } });
    expect(onChange).toHaveBeenCalledWith("/* x */\na {}\nb {}\n");
  });
  it("replaces the document when the value changes from outside", () => {
    const { container, rerender } = render(<CodeEditor file="a.css" value="a {}" line={null} onChange={() => {}} onSave={() => {}} />);
    rerender(<CodeEditor file="a.css" value="z {}" line={null} onChange={() => {}} onSave={() => {}} />);
    expect(viewOf(container).state.doc.toString()).toBe("z {}");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL pick CSS, HTML, JSON or plain text by extension. (test: "picks the language from the file extension")
- THE SYSTEM SHALL show the value, put the cursor at the given line and report edits. (test: "shows the value and reports edits")
- WHEN the value changes from outside THE SYSTEM SHALL replace the document. (test: "replaces the document when the value changes from outside")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T062`.
The last line must be `GATE PASS T062`. On `GATE FAIL T062 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/app, components, canvas, panels, styles` and uses only the contracts (fakes only in tests).
- Do not change any class name, test id, aria-label, role or visible text from the code given.
- Do not use italics, inline color literals or new CSS variables.
- Do not import from `src/engine/` or `src/server/`; the UI talks to the studio only through the store.

## Done when

- `verify.ps1 -Card T062` prints `GATE PASS T062`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T062: Wrap CodeMirror as the code editor
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
