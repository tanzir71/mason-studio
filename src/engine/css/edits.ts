import { MasonError } from "../../contracts/errors.ts";
import type { TextEdit } from "../../contracts/model.ts";

/** See ApplyTextEdits in src/contracts/engine.ts. */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  for (const e of edits) {
    if (e.start < 0 || e.end < e.start || e.end > text.length) throw new MasonError("INVALID_INPUT", `edit ${e.start}-${e.end}`);
  }
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a.start === b.start || (a.start < b.end && b.start < a.end)) throw new MasonError("EDIT_CONFLICT", `${a.start}-${a.end} and ${b.start}-${b.end}`);
  }
  let out = text;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/** One edit at the end of `text`; prefixes "\n" when text does not end with "\n". */
export function appendEdit(file: string, text: string, addition: string): TextEdit {
  return { file, start: text.length, end: text.length, text: (text.endsWith("\n") ? "" : "\n") + addition };
}

/** See PlanAppendRule in src/contracts/engine.ts. */
export function planAppendRule(file: string, text: string, selector: string, declarations: [string, string][]): TextEdit {
  const body = declarations.map(([p, v]) => `  ${p}: ${v};\n`).join("");
  return appendEdit(file, text, `${selector} {\n${body}}\n`);
}
