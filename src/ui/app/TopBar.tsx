import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import { Chip, IconButton } from "../components/Button.tsx";
import "./app.css";

export function TopBar() {
  const actions = useActions();
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const activeBoard = useStudio((s) => s.activeBoard);
  const mcpEnabled = useStudio((s) => s.settings?.mcpEnabled ?? false);
  const [menu, setMenu] = useState<"project" | "page" | null>(null);
  if (!project) return null;
  const info = project.pages.find((p) => p.name === page) ?? null;
  const toggle = (m: "project" | "page") => setMenu(menu === m ? null : m);
  return (
    <header className="m-topbar" data-testid={TEST_IDS.topBar}>
      <div className="m-topbar__left">
        <span className="m-logo" aria-hidden="true">M</span>
        <div className="m-anchor">
          <button type="button" className="m-crumb" aria-haspopup="menu" aria-expanded={menu === "project"} onClick={() => toggle("project")}>
            {project.name}<ChevronDown />
          </button>
          {menu === "project" && (
            <div className="m-menu" role="menu">
              <button type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); actions.openSettings(); }}>Settings</button>
              <button type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); actions.closeProject(); }}>Close project</button>
            </div>
          )}
        </div>
        <span className="m-sep">/</span>
        <div className="m-anchor">
          <button type="button" className="m-crumb m-crumb--page" aria-haspopup="menu" aria-expanded={menu === "page"} onClick={() => toggle("page")}>
            {page ?? "No page"}<ChevronDown />
          </button>
          {menu === "page" && (
            <div className="m-menu" role="menu">
              {project.pages.map((p) => (
                <button key={p.name} type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); void actions.selectPage(p.name); }}>
                  {p.name}<span className="m-menu__meta">{p.file}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="m-strip" data-testid={TEST_IDS.breakpointStrip}>
        {BREAKPOINTS.map((bp) => (
          <Chip key={bp.id} active={activeBoard === bp.id} dot={`var(--bp-${bp.id})`} meta={bp.maxWidth === null ? String(bp.width) : `≤ ${bp.maxWidth}`}
            onClick={() => actions.setActiveBoard(bp.id)}>
            {bp.label}
          </Chip>
        ))}
      </div>
      <div className="m-topbar__right">
        <button type="button" className="m-status" onClick={() => actions.openSettings()}>
          <span className="m-dot" style={{ background: mcpEnabled ? "var(--success)" : "var(--text-faint)" }} />
          {mcpEnabled ? "MCP on" : "MCP off"}
        </button>
        {/* git chip: added by the Git card */}
        <IconButton label="Preview page" disabled={!info} onClick={() => { if (info) window.open(`/p/${info.file}`, "_blank", "noopener"); }}>
          <Play />
        </IconButton>
      </div>
    </header>
  );
}
