import { TEST_IDS } from "../../contracts/ui.tsx";
import type { ElementPath } from "../../contracts/model.ts";
import { boxOf, elementAtPath } from "./dom-paths.ts";

export interface OverlayProps {
  frame: HTMLIFrameElement | null;
  path: ElementPath | null;
  kind: "selection" | "hover" | "mirror";
  /** Any value that changes when the box must be measured again (loads, revision, zoom). */
  version: string;
}
/** Outline of the element at `path` inside `frame`, in unscaled board pixels. Renders nothing when not found. */
export function Overlay({ frame, path, kind, version }: OverlayProps) {
  void version;
  const doc = frame?.contentDocument ?? null;
  if (!doc || path === null) return null;
  const el = elementAtPath(doc, path);
  if (!el) return null;
  const box = boxOf(el);
  const testId = kind === "selection" ? TEST_IDS.selection : kind === "mirror" ? TEST_IDS.mirror : undefined;
  return (
    <div className={`m-ov m-ov--${kind}`} data-testid={testId} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
      {kind === "selection" && <span className="m-ov__size">{`${box.width} × ${box.height}`}</span>}
    </div>
  );
}
