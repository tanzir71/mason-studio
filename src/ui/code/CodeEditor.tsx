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
