import { TEST_IDS } from "../../contracts/ui.tsx";
import { Canvas } from "../canvas/Canvas.tsx";
import { LeftPanel } from "../panels/LeftPanel.tsx";
import { TopBar } from "./TopBar.tsx";
import { ToolDock } from "./ToolDock.tsx";
import { Toast } from "./Toast.tsx";
import "./app.css";

export function Workspace() {
  return (
    <div className="m-app">
      <TopBar />
      <div className="m-workspace">
        <LeftPanel />
        <main className="m-stage">
          <Canvas />
          <ToolDock />
          <Toast />
        </main>
        <aside className="m-right-placeholder" data-testid={TEST_IDS.rightPanel} />
      </div>
    </div>
  );
}
