import { useContext, useEffect } from "react";
import { StudioContext, useStudio } from "../../contracts/ui.tsx";
import { SettingsDialog } from "../agent/SettingsDialog.tsx";
import { StartScreen } from "../start/StartScreen.tsx";
import { useShortcuts } from "./shortcuts.ts";
import { Workspace } from "./Workspace.tsx";
import "./app.css";

export function App() {
  const store = useContext(StudioContext)!;
  const screen = useStudio((s) => s.screen);
  const theme = useStudio((s) => s.settings?.theme ?? "dark");
  useShortcuts(store);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return screen === "canvas" ? <Workspace /> : <><StartScreen /><SettingsDialog /></>;
}
