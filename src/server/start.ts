import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MasonError } from "../contracts/errors.ts";
import { HOST } from "../contracts/http.ts";
import type { HttpServer, McpHandler, RunningMason, StartMason, StartOptions, StudioService } from "../contracts/ports.ts";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createStudio } from "../engine/studio/create-studio.ts";
import { createNodeFileSystem } from "./infra/node-fs.ts";
import { createNodeGitRunner } from "./infra/git.ts";
import { createHttpLlmClient } from "./infra/llm.ts";
import { createFileSettingsStore } from "./infra/settings.ts";
import { createEventHub } from "./infra/events.ts";
import { createHttpServer } from "./http/server.ts";
import type { LlmClient } from "../contracts/ports.ts";
import { createMcpHandler } from "./mcp/handler.ts";
import { createProjectWatcher, suppressOwnWrites } from "./infra/watcher.ts";
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
  const hub = createEventHub();
  const settings = createFileSettingsStore(join(homeDir, "settings.json"));
  let llmClient: LlmClient | null = null;
  const llm: LlmClient = { complete: (messages) => (llmClient ??= createHttpLlmClient(async () => (await settings.load()).settings.agent)).complete(messages) };
  studio = createStudio({
    openFs: (root) => createNodeFileSystem(root),
    openGit: (root) => createNodeGitRunner(root),
    llm,
    settings,
    events: hub,
    templatesDir,
    now: () => Date.now(),
    newId: () => randomUUID(),
  });
  // @seam:compose-core
  mcp = createMcpHandler(studio, { version: MASON_VERSION, enabled: async () => (await settings.load()).settings.mcpEnabled });
  // @seam:compose-mcp
  server = createHttpServer({ studio, events: hub, uiDir: existsSync(uiDir) ? uiDir : null, mcp });
  // @seam:compose-server
  const watcher = createProjectWatcher(suppressOwnWrites(hub));
  hub.subscribe((e) => { if (e.type === "project-opened") watcher.watch(e.project.root); });
  onClose.push(() => watcher.close());
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
