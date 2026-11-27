import type { BrowserWindowConstructorOptions } from "electron";

/** IPC channel of the folder picker (preload → main). */
export const PICK_FOLDER_CHANNEL = "mason:pick-folder";

/** Main window: 1440×900 (min 1024×640), Mason's dark background, isolated sandboxed renderer with the preload bridge. */
export function windowOptions(preload: string): BrowserWindowConstructorOptions {
  return {
    width: 1440, height: 900, minWidth: 1024, minHeight: 640, title: "Mason", backgroundColor: "#111110", show: true,
    webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  };
}

/** The first argument that is not a flag (the folder to open), or null. */
export function projectFromArgs(args: readonly string[]): string | null {
  return args.find((a) => !a.startsWith("-")) ?? null;
}

/** `--smoke`: start the server, check one RPC, print the result and exit without a window. */
export function isSmoke(args: readonly string[]): boolean {
  return args.includes("--smoke");
}

/** Same origin as the app → "allow" (a Mason window, e.g. Preview page); other http(s) → "external" browser; else "deny". */
export function decideWindowOpen(url: string, appOrigin: string): "allow" | "external" | "deny" {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "deny"; }
  if (parsed.origin === appOrigin) return "allow";
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? "external" : "deny";
}
