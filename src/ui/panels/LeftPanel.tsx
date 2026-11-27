import { useState } from "react";
import { Plus } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { IconButton, cx } from "../components/Button.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { LayersTree } from "./LayersTree.tsx";
import { AssetsPanel } from "./AssetsPanel.tsx";
import "./panels.css";

export function LeftPanel() {
  const actions = useActions();
  const leftTab = useStudio((s) => s.leftTab);
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <aside className="m-left" data-testid={TEST_IDS.leftPanel}>
      <div className="m-panel-head">
        <Tabs label="Left panel" value={leftTab} onChange={actions.setLeftTab}
          items={[{ id: "layers", label: "Layers" }, { id: "assets", label: "Assets" }]} />
      </div>
      {leftTab === "layers" ? (
        <div className="m-panel-scroll">
          <div className="m-group" data-testid={TEST_IDS.pagesList}>
            <div className="m-group__head">
              <h2 className="m-group__title">Pages</h2>
              <IconButton label="New page" onClick={() => { setAdding(true); setName(""); }}><Plus /></IconButton>
            </div>
            {project?.pages.map((p) => (
              <button key={p.name} type="button" className={cx("m-row", p.name === page && "is-selected")} onClick={() => { void actions.selectPage(p.name); }}>
                <span className="m-row__name">{p.name}</span>
                <span className="m-row__meta">{p.file}</span>
              </button>
            ))}
            {adding && (
              <div className="m-new-page">
                <input
                  className="m-field__input m-field" aria-label="New page name" placeholder="Page name" autoFocus value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setAdding(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) { setAdding(false); void actions.createPage(name.trim()); }
                    if (e.key === "Escape") setAdding(false);
                  }}
                />
              </div>
            )}
          </div>
          <div className="m-group">
            <div className="m-group__head"><h2 className="m-group__title">Layers</h2></div>
            <LayersTree />
          </div>
        </div>
      ) : (
        <AssetsPanel />
      )}
    </aside>
  );
}
