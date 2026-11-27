/** In-memory fakes for every port. Planner-owned (protected): never edit. Used by tests only. */
import { MasonError } from "./errors.ts";
import { DEFAULT_SETTINGS } from "./model.ts";
import type { MasonEvent, StoredSettings } from "./model.ts";
import { STUDIO_METHODS } from "./ports.ts";
import type {
  EventHub, FileSystem, GitResult, GitRunner, LlmClient, LlmMessage, SettingsStore, StudioDeps, StudioService,
} from "./ports.ts";

/** Same path rule as the FileSystem contract: "\\" → "/", strip "./", reject absolute and ".." escapes. */
export function normalizeProjectPath(path: string): string {
  const p = path.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) throw new MasonError("PATH_OUTSIDE_PROJECT", path);
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { if (out.length === 0) throw new MasonError("PATH_OUTSIDE_PROJECT", path); out.pop(); continue; }
    out.push(part);
  }
  return out.join("/");
}

export class InMemoryFileSystem implements FileSystem {
  readonly root: string;
  readonly files: Map<string, Uint8Array>;
  constructor(root = "/memory", files: Record<string, string | Uint8Array> = {}) {
    this.root = root;
    this.files = new Map();
    for (const [k, v] of Object.entries(files)) this.files.set(normalizeProjectPath(k), typeof v === "string" ? new TextEncoder().encode(v) : v);
  }
  async readText(path: string): Promise<string> { return new TextDecoder().decode(await this.readBytes(path)); }
  async writeText(path: string, text: string): Promise<void> { await this.writeBytes(path, new TextEncoder().encode(text)); }
  async readBytes(path: string): Promise<Uint8Array> {
    const key = normalizeProjectPath(path);
    const v = this.files.get(key);
    if (!v) throw new MasonError("FILE_NOT_FOUND", key);
    return v;
  }
  async writeBytes(path: string, data: Uint8Array): Promise<void> { this.files.set(normalizeProjectPath(path), data); }
  async exists(path: string): Promise<boolean> {
    const key = normalizeProjectPath(path);
    if (key === "") return true;
    return this.files.has(key) || [...this.files.keys()].some((k) => k.startsWith(key + "/"));
  }
  async list(dir: string): Promise<string[]> {
    const base = normalizeProjectPath(dir);
    return [...this.files.keys()]
      .filter((k) => base === "" || k.startsWith(base + "/"))
      .filter((k) => !k.split("/").some((seg) => seg === ".git" || seg === "node_modules"))
      .sort();
  }
}

/** Responses keyed by args.join(" "); unknown commands answer { code: 0, stdout: "", stderr: "" }. */
export class FakeGitRunner implements GitRunner {
  readonly calls: string[][] = [];
  readonly responses: Record<string, GitResult>;
  constructor(responses: Record<string, GitResult> = {}) { this.responses = responses; }
  async run(args: string[]): Promise<GitResult> {
    this.calls.push(args);
    return this.responses[args.join(" ")] ?? { code: 0, stdout: "", stderr: "" };
  }
}

/** Replies in order; with no reply left it rejects with LLM_UNAVAILABLE. */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmMessage[][] = [];
  readonly replies: string[];
  constructor(replies: string[] = []) { this.replies = [...replies]; }
  async complete(messages: LlmMessage[]): Promise<string> {
    this.requests.push(messages);
    const next = this.replies.shift();
    if (next === undefined) throw new MasonError("LLM_UNAVAILABLE");
    return next;
  }
}

export class MemorySettingsStore implements SettingsStore {
  value: StoredSettings | null = null;
  async load(): Promise<StoredSettings> {
    return this.value ? structuredClone(this.value) : { settings: structuredClone(DEFAULT_SETTINGS), recent: [] };
  }
  async save(value: StoredSettings): Promise<void> { this.value = structuredClone(value); }
}

export class MemoryEventHub implements EventHub {
  readonly emitted: MasonEvent[] = [];
  private listeners: ((e: MasonEvent) => void)[] = [];
  emit(event: MasonEvent): void { this.emitted.push(event); for (const l of [...this.listeners]) l(event); }
  subscribe(listener: (e: MasonEvent) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }
}

export interface TestDeps extends StudioDeps {
  fsByRoot: Map<string, InMemoryFileSystem>;
  gitByRoot: Map<string, FakeGitRunner>;
  llm: FakeLlmClient;
  settings: MemorySettingsStore;
  events: MemoryEventHub;
}
/**
 * StudioDeps backed by fakes. `projects` maps a root (e.g. "/p") to its files; `templates` maps
 * "landing/index.html"-style paths to contents and is served from root "/templates". now() starts at
 * 1_000_000 and adds 1000 per call; newId() returns "id-1", "id-2", ...
 */
export function createTestDeps(projects: Record<string, Record<string, string>> = {}, templates: Record<string, string> = {}): TestDeps {
  const fsByRoot = new Map<string, InMemoryFileSystem>();
  for (const [root, files] of Object.entries(projects)) fsByRoot.set(root, new InMemoryFileSystem(root, files));
  fsByRoot.set("/templates", new InMemoryFileSystem("/templates", templates));
  const gitByRoot = new Map<string, FakeGitRunner>();
  let clock = 1_000_000;
  let ids = 0;
  return {
    fsByRoot, gitByRoot,
    openFs(root: string) { let fs = fsByRoot.get(root); if (!fs) { fs = new InMemoryFileSystem(root); fsByRoot.set(root, fs); } return fs; },
    openGit(root: string) { let g = gitByRoot.get(root); if (!g) { g = new FakeGitRunner(); gitByRoot.set(root, g); } return g; },
    llm: new FakeLlmClient(), settings: new MemorySettingsStore(), events: new MemoryEventHub(),
    templatesDir: "/templates",
    now() { clock += 1000; return clock; },
    newId() { ids += 1; return `id-${ids}`; },
  };
}

/** A StudioService whose methods reject with NOT_IMPLEMENTED unless given in `overrides`. */
export function createFakeStudio(overrides: Partial<StudioService> = {}): StudioService {
  const studio = {} as Record<string, unknown>;
  for (const m of STUDIO_METHODS) studio[m] = overrides[m] ?? (async () => { throw new MasonError("NOT_IMPLEMENTED", m); });
  return studio as unknown as StudioService;
}
