import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioContext } from "../contracts/ui.tsx";
import type { MasonClient, MountStudio } from "../contracts/ui.tsx";
import "./styles/global.css";
import { App } from "./app/App.tsx";
import { createHttpClient } from "./api/http-client.ts";
import { createStudioStore } from "./state/create-store.ts";
// @seam:imports

/** Renders the studio into rootElement and returns an unmount function. */
export const mountStudio: MountStudio = (rootElement: HTMLElement, client: MasonClient) => {
  const root = createRoot(rootElement);
  void client; void StudioContext;
  const store = createStudioStore(client);
  const offEvents = client.subscribe((event) => store.actions.handleEvent(event));
  void store.actions.init();
  root.render(<StrictMode><StudioContext.Provider value={store}><App /></StudioContext.Provider></StrictMode>);
  return () => { offEvents(); root.unmount(); };
  // @seam:mount
  root.render(<StrictMode><p>Mason is starting…</p></StrictMode>);
  return () => root.unmount();
};

const rootElement = typeof document === "undefined" ? null : document.getElementById("root");
void rootElement;
if (rootElement) mountStudio(rootElement, createHttpClient(""));
// @seam:boot
