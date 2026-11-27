import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunningMason } from "../contracts/ports.ts";
import { PICK_FOLDER_CHANNEL, decideWindowOpen, isSmoke, projectFromArgs, windowOptions } from "./window.ts";
import { startMason } from "../server/start.ts";
// @seam:imports

/** dist/desktop when bundled; the UI build sits next to it in dist/ui. */
const here = dirname(fileURLToPath(import.meta.url));
let running: RunningMason | null = null;

/** Starts the local Mason server for the desktop app (composed by the desktop seam card). */
async function startServer(project: string | null): Promise<RunningMason> {
  void project;
  return startMason({ port: 0, project, homeDir: app.getPath("userData"), uiDir: join(here, "..", "ui") });
  // @seam:compose-desktop
  throw new Error("The Mason server is not composed yet.");
}

/** `--smoke`: one RPC round trip, then exit 0 (prints MASON SMOKE OK) or 1. */
async function smoke(r: RunningMason): Promise<void> {
  const res = await fetch(`${r.url}api/rpc/templates`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const ok = res.ok && Array.isArray(((await res.json()) as { result?: unknown }).result);
  console.log(ok ? "MASON SMOKE OK" : `MASON SMOKE FAILED ${res.status}`);
  await r.close();
  app.exit(ok ? 0 : 1);
}

function openWindow(r: RunningMason): void {
  const win = new BrowserWindow(windowOptions(join(here, "preload.cjs")));
  const origin = new URL(r.url).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url, origin);
    if (decision === "external") void shell.openExternal(url);
    return { action: decision === "allow" ? "allow" : "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => { if (decideWindowOpen(url, origin) !== "allow") event.preventDefault(); });
  void win.loadURL(r.url);
}

async function boot(): Promise<void> {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  const project = projectFromArgs(args);
  running = await startServer(project ? resolve(project) : null);
  if (isSmoke(args)) { await smoke(running); return; }
  ipcMain.handle(PICK_FOLDER_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  openWindow(running);
}

app.whenReady().then(boot).catch((error: unknown) => { console.error(error); app.exit(1); });
app.on("window-all-closed", () => { void running?.close(); app.quit(); });
