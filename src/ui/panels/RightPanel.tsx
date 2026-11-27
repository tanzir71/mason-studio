import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { RightTab } from "../../contracts/ui.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { DesignPanel } from "./DesignPanel.tsx";
import "./panels.css";

const TABS: readonly { id: RightTab; label: string }[] = [
  { id: "design", label: "Design" }, { id: "inspect", label: "Inspect" }, { id: "checks", label: "Checks" },
];

export function RightPanel() {
  const actions = useActions();
  const tab = useStudio((s) => s.rightTab);
  return (
    <aside className="m-right" data-testid={TEST_IDS.rightPanel}>
      <div className="m-panel-head">
        <Tabs<RightTab> label="Right panel" value={tab} onChange={actions.setRightTab} items={TABS} />
      </div>
      {tab === "design" && <DesignPanel />}
      {tab === "inspect" && <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Select a layer to see its CSS.</div>}
      {tab === "checks" && <div className="m-empty" data-testid={TEST_IDS.checksPanel}>Checks run on the open page.</div>}
    </aside>
  );
}
