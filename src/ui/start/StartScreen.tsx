import { useState } from "react";
import { Folder, FolderOpen, LayoutTemplate, Settings } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { TemplateId } from "../../contracts/model.ts";
import { Button, IconButton, cx } from "../components/Button.tsx";
import "../agent/agent.css";
import "./start.css";

/** "just now", "12 min ago", "3 h ago", "Yesterday", or "Nov 19". */
export function formatAgo(openedAt: number, now: number): string {
  const min = Math.floor((now - openedAt) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  if (h < 48) return "Yesterday";
  return new Date(openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Block = [number, number, number, number, string];
/** Abstract template previews: [left %, top %, width %, height %, color]. */
const THUMBS: Record<Exclude<TemplateId, "blank">, Block[]> = {
  landing: [[6, 8, 18, 5, "#1e2a22"], [74, 7, 20, 7, "#1e2a22"], [6, 26, 40, 7, "#1e2a22"], [6, 36, 30, 7, "#1e2a22"], [6, 52, 22, 7, "#b4532a"], [54, 24, 40, 40, "#c4956c"], [6, 74, 28, 14, "#fbf8f2"], [36, 74, 28, 14, "#fbf8f2"], [66, 74, 28, 14, "#fbf8f2"]],
  portfolio: [[6, 10, 26, 6, "#f4f3ef"], [6, 20, 50, 3, "#4a4944"], [6, 34, 28, 26, "#3a3936"], [36, 34, 28, 26, "#4a4944"], [66, 34, 28, 26, "#33322f"], [6, 64, 28, 26, "#4a4944"], [36, 64, 28, 26, "#5a5954"], [66, 64, 28, 26, "#3a3936"]],
  docs: [[0, 0, 26, 100, "#f0efea"], [6, 10, 14, 3, "#b9b5aa"], [6, 20, 12, 3, "#b9b5aa"], [6, 30, 14, 3, "#b9b5aa"], [32, 10, 40, 6, "#151513"], [32, 22, 60, 3, "#b9b5aa"], [32, 30, 56, 3, "#b9b5aa"], [32, 38, 60, 3, "#b9b5aa"], [32, 60, 60, 16, "#f0efea"]],
};

function Thumb({ id }: { id: TemplateId }) {
  if (id === "blank") return <div className="m-template__thumb m-thumb--blank" aria-hidden="true">+</div>;
  return (
    <div className={`m-template__thumb m-thumb--${id}`} aria-hidden="true">
      {THUMBS[id].map(([l, t, w, h, c], i) => <span key={i} className="m-thumb__block" style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, background: c }} />)}
    </div>
  );
}

export function StartScreen() {
  const actions = useActions();
  const recent = useStudio((s) => s.recent);
  const templates = useStudio((s) => s.templates);
  const [folder, setFolder] = useState("");
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [target, setTarget] = useState("");
  const desktop = typeof window !== "undefined" ? window.masonDesktop : undefined;
  const openFolder = async () => {
    if (desktop) { const picked = await desktop.pickFolder(); if (picked) void actions.openProject(picked); return; }
    if (folder.trim()) void actions.openProject(folder.trim());
  };
  const now = Date.now();
  return (
    <div className="m-start" data-testid={TEST_IDS.startScreen}>
      <header className="m-start__bar">
        <span className="m-start__brand"><span className="m-logo" aria-hidden="true">M</span>Mason</span>
        <IconButton label="Settings" onClick={() => actions.openSettings()}><Settings /></IconButton>
      </header>
      <main className="m-start__main">
        <section>
          <h1 className="m-start__title">Start designing</h1>
          <p className="m-start__lede">Your designs are plain HTML and CSS in a folder you choose. Nothing leaves this computer unless you connect an agent.</p>
          <div className="m-start__actions">
            <div className="m-action">
              <span className="m-action__icon"><FolderOpen /></span>
              <span className="m-action__title">Open a folder</span>
              <span className="m-action__text">Design on an existing site. Mason reads its HTML, CSS and tokens.</span>
              {desktop ? (
                <span />
              ) : (
                <form className="m-start__form" style={{ gridColumn: 2 }} onSubmit={(e) => { e.preventDefault(); void openFolder(); }}>
                  <input className="m-input" aria-label="Folder path" placeholder="/Users/you/Sites/my-site" value={folder} onChange={(e) => setFolder(e.target.value)} />
                  <Button type="submit" variant="primary" disabled={folder.trim() === ""}>Open</Button>
                </form>
              )}
              {desktop && <Button style={{ gridColumn: 2, justifySelf: "start" }} variant="primary" onClick={() => { void openFolder(); }}>Choose folder</Button>}
            </div>
            <div className="m-action">
              <span className="m-action__icon"><LayoutTemplate /></span>
              <span className="m-action__title">Start from a template</span>
              <span className="m-action__text">{template ? `New ${templates.find((t) => t.id === template)?.name ?? template} in an empty folder.` : "Pick a template on the right. Plain files you own."}</span>
              {template && (
                <form className="m-start__form" style={{ gridColumn: 2 }} onSubmit={(e) => { e.preventDefault(); if (target.trim()) void actions.createProject(target.trim(), template); }}>
                  <input className="m-input" aria-label="New folder path" placeholder="/Users/you/Sites/new-site" value={target} onChange={(e) => setTarget(e.target.value)} />
                  <Button type="submit" variant="primary" disabled={target.trim() === ""}>Create</Button>
                </form>
              )}
            </div>
          </div>
          {recent.length > 0 && (
            <>
              <h2 className="m-start__section">Recent</h2>
              <ul className="m-recent">
                {recent.map((r) => (
                  <li key={r.root}>
                    <button type="button" className="m-recent__item" onClick={() => { void actions.openProject(r.root); }}>
                      <Folder aria-hidden="true" />
                      <span>{r.name}</span>
                      <span className="m-recent__path">{r.root}</span>
                      <span className="m-recent__when">{formatAgo(r.openedAt, now)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section aria-label="Templates">
          <div className="m-templates__head"><span>Templates</span><span className="m-recent__when">Plain HTML and CSS</span></div>
          <div className="m-templates__grid">
            {templates.map((t) => (
              <button key={t.id} type="button" className={cx("m-template", template === t.id && "is-chosen")} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
                <Thumb id={t.id} />
                <span className="m-template__meta"><span style={{ color: "var(--text-strong)" }}>{t.name}</span><span>{t.meta}</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
