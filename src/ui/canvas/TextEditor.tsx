import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ElementPath } from "../../contracts/model.ts";
import { boxOf, elementAtPath } from "./dom-paths.ts";
import "./canvas.css";

export interface TextEditorProps {
  frame: HTMLIFrameElement | null;
  path: ElementPath;
  onCommit(text: string): void;
  onClose(): void;
}
/**
 * Textarea over a text element inside a board, with the element's font. Enter (without Shift) or blur commits the
 * trimmed text when it changed; Escape closes without saving. Commits at most once.
 */
export function TextEditor({ frame, path, onCommit, onClose }: TextEditorProps) {
  const doc = frame?.contentDocument ?? null;
  const el = doc ? elementAtPath(doc, path) : null;
  const initial = (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const [text, setText] = useState(initial);
  const done = useRef(false);
  if (!el) return null;
  const box = boxOf(el);
  const cs = frame?.contentWindow?.getComputedStyle(el);
  const style: CSSProperties = {
    left: box.x, top: box.y, width: Math.max(box.width, 40), minHeight: box.height,
    fontFamily: cs?.fontFamily, fontSize: cs?.fontSize, fontWeight: cs?.fontWeight, lineHeight: cs?.lineHeight,
  };
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = text.replace(/\s+/g, " ").trim();
    if (save && next !== "" && next !== initial) onCommit(next);
    onClose();
  };
  return (
    <textarea
      className="m-text-editor" aria-label="Edit text" autoFocus value={text} style={style}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
      }}
    />
  );
}
