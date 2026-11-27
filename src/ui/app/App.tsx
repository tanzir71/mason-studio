import { useContext, useEffect } from "react";
import { StudioContext, TEST_IDS, useStudio } from "../../contracts/ui.tsx";
import { useShortcuts } from "./shortcuts.ts";
import { Workspace } from "./Workspace.tsx";
import "./app.css";

/** Placeholder start screen; the Start screen card replaces it. */
function StartPlaceholder() {
  return (
    <main className="m-start-placeholder" data-testid={TEST_IDS.startScreen}>
      <h1>Mason</h1>
      <p>Run mason with a folder to open it.</p>
    </main>
  );
}

export function App() {
  const store = useContext(StudioContext)!;
  const screen = useStudio((s) => s.screen);
  const theme = useStudio((s) => s.settings?.theme ?? "dark");
  useShortcuts(store);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return screen === "canvas" ? <Workspace /> : <StartPlaceholder />;
}
