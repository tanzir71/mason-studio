import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MasonError } from "../contracts/errors.ts";
import { HOST } from "../contracts/http.ts";
import type { HttpServer, McpHandler, RunningMason, StartMason, StartOptions, StudioService } from "../contracts/ports.ts";
// @seam:imports

export const MASON_VERSION = "0.1.0";
/** Repository root: two folders above this file. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Composition root. Seam cards insert code above the four compose anchors, in this order. */
export const startMason: StartMason = async (options: StartOptions): Promise<RunningMason> => {
  const homeDir = options.homeDir ?? process.env.MASON_HOME ?? join(homedir(), ".mason");
  const uiDir = options.uiDir ?? join(REPO_ROOT, "dist", "ui");
  const templatesDir = join(REPO_ROOT, "templates");
  let studio: StudioService | null = null;
  let mcp: McpHandler | null = null;
  let server: HttpServer | null = null;
  const onClose: (() => void)[] = [];
  // @seam:compose-core
  // @seam:compose-mcp
  // @seam:compose-server
  // @seam:compose-watch
  void homeDir; void uiDir; void templatesDir; void mcp;
  if (!studio || !server) throw new MasonError("NOT_IMPLEMENTED", "startMason");
  const readyStudio: StudioService = studio;
  const readyServer: HttpServer = server;
  const port = await readyServer.listen(options.port);
  if (options.project) await readyStudio.openProject(options.project);
  return {
    url: `http://${HOST}:${port}/`,
    port,
    studio: readyStudio,
    close: async () => {
      for (const fn of onClose) fn();
      await readyServer.close();
    },
  };
};
