import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioContext } from "../contracts/ui.tsx";
import type { MasonClient, MountStudio } from "../contracts/ui.tsx";
import "./styles/global.css";
// @seam:imports

/** Renders the studio into rootElement and returns an unmount function. */
export const mountStudio: MountStudio = (rootElement: HTMLElement, client: MasonClient) => {
  const root = createRoot(rootElement);
  void client; void StudioContext;
  // @seam:mount
  root.render(<StrictMode><p>Mason is starting…</p></StrictMode>);
  return () => root.unmount();
};

const rootElement = typeof document === "undefined" ? null : document.getElementById("root");
void rootElement;
// @seam:boot
