import { describe, expect, it } from "vitest";
import { createStudio } from "../src/engine/studio/create-studio.ts";
import { createEngineContext, requireFs } from "../src/engine/studio/context.ts";
import { createNodeFileSystem } from "../src/server/infra/node-fs.ts";
import { createNodeGitRunner } from "../src/server/infra/git.ts";
import { createHttpLlmClient } from "../src/server/infra/llm.ts";
import { createFileSettingsStore } from "../src/server/infra/settings.ts";
import { createEventHub } from "../src/server/infra/events.ts";
import { createProjectWatcher } from "../src/server/infra/watcher.ts";
import { createHttpServer } from "../src/server/http/server.ts";
import { createMcpHandler } from "../src/server/mcp/handler.ts";
import { MASON_VERSION, REPO_ROOT, startMason } from "../src/server/start.ts";
import { STUDIO_METHODS } from "../src/contracts/ports.ts";
import { createTestDeps } from "../src/contracts/fakes.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("skeleton", () => {
  it("createStudio exposes every StudioService method as a function", () => {
    const studio = createStudio(createTestDeps());
    for (const m of STUDIO_METHODS) expect(typeof studio[m]).toBe("function");
  });
  it("engine context starts empty and requires a project", () => {
    const ctx = createEngineContext(createTestDeps());
    expect(ctx.revision).toBe(0);
    expect(() => requireFs(ctx)).toThrow("No project is open.");
  });
  it("every server entry point is exported as a function", () => {
    const entries = [createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub,
      createProjectWatcher, createHttpServer, createMcpHandler, startMason];
    for (const f of entries) expect(typeof f).toBe("function");
  });
  it("REPO_ROOT points at the repository", () => {
    expect(MASON_VERSION).toBe("0.1.0");
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
  });
});
