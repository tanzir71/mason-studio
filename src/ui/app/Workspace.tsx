import { Canvas } from "../canvas/Canvas.tsx";
import { CodeDrawer } from "../code/CodeDrawer.tsx";
import { AgentPrompt } from "../agent/AgentPrompt.tsx";
import { ReviewCard } from "../agent/ReviewCard.tsx";
import { SettingsDialog } from "../agent/SettingsDialog.tsx";
import { LeftPanel } from "../panels/LeftPanel.tsx";
import { RightPanel } from "../panels/RightPanel.tsx";
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
          <CodeDrawer />
          <ReviewCard />
          <AgentPrompt />
        </main>
        <RightPanel />
      </div>
      <SettingsDialog />
    </div>
  );
}
