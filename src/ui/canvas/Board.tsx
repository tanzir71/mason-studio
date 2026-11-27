import { useState } from "react";
import type { ReactNode } from "react";
import { TEST_IDS } from "../../contracts/ui.tsx";
import type { Breakpoint, PageInfo } from "../../contracts/model.ts";
import { cx } from "../components/Button.tsx";
import "./canvas.css";

export const DEFAULT_BOARD_HEIGHT = 900;
/** Board height from the loaded document: scrollHeight clamped to [400, 6000]. */
export function measureHeight(doc: Document | null): number {
  const h = doc?.documentElement?.scrollHeight ?? 0;
  return h > 0 ? Math.min(6000, Math.max(400, h)) : DEFAULT_BOARD_HEIGHT;
}

export interface BoardProps {
  page: PageInfo;
  bp: Breakpoint;
  revision: number;
  active: boolean;
  onActivate(): void;
  /** Called with the iframe after every load. */
  onFrame(frame: HTMLIFrameElement): void;
  /** Hit layer, overlays: rendered on top of the iframe, same size. */
  children?: ReactNode;
}
export function Board({ page, bp, revision, active, onActivate, onFrame, children }: BoardProps) {
  const [height, setHeight] = useState(DEFAULT_BOARD_HEIGHT);
  return (
    <div className={cx("m-board", active && "is-active")} data-testid={`${TEST_IDS.board}${page.name}-${bp.id}`}>
      <button type="button" className="m-board__label" onClick={onActivate}>
        <span className="m-dot" style={{ background: `var(--bp-${bp.id})` }} />
        {bp.label}
        <span className="m-board__width">{bp.maxWidth === null ? String(bp.width) : `≤ ${bp.maxWidth}`}</span>
      </button>
      <div className="m-board__frame" style={{ width: bp.width, height }}>
        <iframe
          key={revision}
          title={`${page.name} ${bp.label}`}
          src={`/p/${page.file}?r=${revision}`}
          width={bp.width}
          height={height}
          onLoad={(e) => {
            const frame = e.currentTarget;
            setHeight(measureHeight(frame.contentDocument));
            onFrame(frame);
          }}
        />
        {children}
      </div>
    </div>
  );
}
