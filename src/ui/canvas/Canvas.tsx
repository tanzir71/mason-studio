import { useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { StudioContext, TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import type { Breakpoint, PageInfo } from "../../contracts/model.ts";
import { IconButton, cx } from "../components/Button.tsx";
import { Board } from "./Board.tsx";
import { Overlay } from "./Overlay.tsx";
import { TextEditor } from "./TextEditor.tsx";
import { boardPointerDown, boardPointerMove, editablePath, pathAtPoint } from "./tools.ts";
import "./canvas.css";

const INSERT_TOOL_IDS: readonly string[] = ["frame", "rect", "ellipse", "text", "image"];

export function Canvas() {
  const store = useContext(StudioContext)!;
  const actions = useActions();
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const revision = useStudio((s) => s.revision);
  const zoom = useStudio((s) => s.zoom);
  const pan = useStudio((s) => s.pan);
  const tool = useStudio((s) => s.tool);
  const selection = useStudio((s) => s.selection);
  const hover = useStudio((s) => s.hover);
  const activeBoard = useStudio((s) => s.activeBoard);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const [loads, setLoads] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ key: string; path: string } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = store.getState();
      if (e.ctrlKey || e.metaKey) actions.setZoom(s.zoom * (1 - e.deltaY * 0.01));
      else actions.panBy(-e.deltaX, -e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [store, actions]);

  if (!project) return null;
  const version = `${loads}:${revision}:${zoom}`;

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "hand" && e.button !== 1) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    actions.panBy(e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => { drag.current = null; };

  const renderBoard = (info: PageInfo, bp: Breakpoint) => {
    const key = `${info.name}-${bp.id}`;
    const isOpen = info.name === page;
    const frame = frames.current.get(key) ?? null;
    const pointer = (e: ReactPointerEvent<HTMLDivElement>) => ({
      page: info.name, board: bp.id,
      path: pathAtPoint(frames.current.get(key) ?? null, e.currentTarget, e.clientX, e.clientY, store.getState().zoom),
    });
    return (
      <Board
        key={key} page={info} bp={bp} revision={revision} active={isOpen && activeBoard === bp.id}
        onActivate={() => { if (isOpen) actions.setActiveBoard(bp.id); else void actions.selectPage(info.name); }}
        onFrame={(f) => { frames.current.set(key, f); setLoads((n) => n + 1); }}
      >
        {isOpen && (
          <>
            <Overlay frame={frame} path={hover} kind="hover" version={version} />
            <Overlay frame={frame} path={selection} kind={activeBoard === bp.id ? "selection" : "mirror"} version={version} />
          </>
        )}
        {editing?.key === key && (
          <TextEditor frame={frame} path={editing.path}
            onCommit={(text) => { void actions.editText(editing.path, text); }}
            onClose={() => setEditing(null)} />
        )}
        {tool !== "hand" && (
          <div
            className="m-board__hit"
            onPointerDown={(e) => { e.stopPropagation(); boardPointerDown(store.getState(), actions, pointer(e)); }}
            onPointerMove={(e) => boardPointerMove(store.getState(), actions, pointer(e))}
            onPointerLeave={() => { if (isOpen) actions.hover(null); }}
            onDoubleClick={(e) => {
              const path = editablePath(store.getState(), { page: info.name, board: bp.id, path: pathAtPoint(frames.current.get(key) ?? null, e.currentTarget, e.clientX, e.clientY, store.getState().zoom) });
              if (path !== null) setEditing({ key, path });
            }}
          />
        )}
      </Board>
    );
  };

  return (
    <div
      ref={root}
      className={cx("m-canvas", tool === "hand" && "is-hand", INSERT_TOOL_IDS.includes(tool) && "is-insert")}
      data-testid={TEST_IDS.canvas}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="m-canvas__content" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, "--zoom": zoom } as CSSProperties}>
        {project.pages.map((info) => (
          <section key={info.name} className={cx("m-page-row", info.name !== page && "is-inactive")}>
            <h2 className="m-page-row__title">{info.name}<span className="m-page-row__file">{info.file}</span></h2>
            <div className="m-page-row__boards">{BREAKPOINTS.map((bp) => renderBoard(info, bp))}</div>
          </section>
        ))}
      </div>
      <div className="m-zoom">
        <IconButton label="Zoom out" onClick={() => actions.setZoom(zoom - 0.1)}><Minus /></IconButton>
        <span className="m-zoom__value">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => actions.setZoom(zoom + 0.1)}><Plus /></IconButton>
      </div>
    </div>
  );
}
