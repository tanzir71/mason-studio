import { contextBridge, ipcRenderer } from "electron";
import type { MasonDesktopBridge } from "../contracts/ui.tsx";
import { PICK_FOLDER_CHANNEL } from "./window.ts";

/** The only thing the renderer gets from Electron: a folder picker. See MasonDesktopBridge. */
const bridge: MasonDesktopBridge = {
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke(PICK_FOLDER_CHANNEL) as Promise<string | null>,
};
contextBridge.exposeInMainWorld("masonDesktop", bridge);
