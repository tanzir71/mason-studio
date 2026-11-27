/** Ports, the Studio service and module entry points. Planner-owned contract: never edit. */
import type {
  AskInput, CheckReport, ElementNode, ElementPath, FileText, GitStatus, InsertKind, InspectResult, MasonEvent,
  PageInfo, ProjectInfo, Proposal, ProposalInput, RecentProject, Scope, Settings, StoredSettings, StyleChange,
  TemplateId, TemplateInfo, TokenFormat, TokenSet, WriteResult,
} from "./model.ts";

/**
 * Files of one project, rooted at `root`. Paths are project-relative with "/" separators.
 * Paths that are absolute or escape the root ("..") → MasonError("PATH_OUTSIDE_PROJECT").
 */
export interface FileSystem {
  readonly root: string;
  readText(path: string): Promise<string>;          // missing → FILE_NOT_FOUND (detail = path)
  writeText(path: string, text: string): Promise<void>; // creates parent folders
  readBytes(path: string): Promise<Uint8Array>;      // missing → FILE_NOT_FOUND
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Files (not folders) under dir ("" = root), recursive, relative to root, sorted; skips ".git" and "node_modules". */
  list(dir: string): Promise<string[]>;
}
export interface GitResult { code: number; stdout: string; stderr: string }
/** Runs `git <args>` in the project root. Never throws for a non-zero exit code. */
export interface GitRunner { run(args: string[]): Promise<GitResult> }
export interface LlmMessage { role: "system" | "user"; content: string }
/** OpenAI-compatible chat completion. Resolves to choices[0].message.content. Network/HTTP errors → LLM_UNAVAILABLE. */
export interface LlmClient { complete(messages: LlmMessage[]): Promise<string> }
/** Persists StoredSettings as JSON. load() returns { settings: DEFAULT_SETTINGS, recent: [] } when nothing is stored. */
export interface SettingsStore { load(): Promise<StoredSettings>; save(value: StoredSettings): Promise<void> }
export interface EventSink { emit(event: MasonEvent): void }
/** In-process pub/sub. subscribe returns an unsubscribe function; listeners run synchronously in subscribe order. */
export interface EventHub extends EventSink { subscribe(listener: (event: MasonEvent) => void): () => void }

/**
 * Everything the UI, HTTP and MCP layers can do. Implemented by createStudio (src/engine/studio/).
 * Every method rejects with MasonError on failure. Methods that need an open project reject with NO_PROJECT.
 * Every write records one undo step, increments the revision and emits { type: "written" }.
 */
export interface StudioService {
  /** Opens a folder containing at least one top-level .html file (else NOT_A_PROJECT); records it in recent projects; emits project-opened. */
  openProject(root: string): Promise<ProjectInfo>;
  /** Copies templates/<template>/ into root (must be missing or empty, else FOLDER_NOT_EMPTY), then openProject(root). */
  createProject(root: string, template: TemplateId): Promise<ProjectInfo>;
  currentProject(): Promise<ProjectInfo>;
  recentProjects(): Promise<RecentProject[]>;          // newest first, max 8
  templates(): Promise<TemplateInfo[]>;                 // order: landing, portfolio, docs, blank
  /** Creates `${slug}.html` from the first page's <head> with an empty <main>; PAGE_EXISTS when present. */
  createPage(name: string): Promise<PageInfo>;
  pageTree(page: string): Promise<ElementNode>;         // body node; PAGE_NOT_FOUND
  inspect(page: string, path: ElementPath): Promise<InspectResult>;
  applyStyle(change: StyleChange): Promise<WriteResult>;
  resetStyle(page: string, path: ElementPath, prop: string, scope: Scope): Promise<WriteResult>;
  insertElement(page: string, parentPath: ElementPath, index: number, kind: InsertKind): Promise<WriteResult>;
  editText(page: string, path: ElementPath, text: string): Promise<WriteResult>;
  removeElement(page: string, path: ElementPath): Promise<WriteResult>;
  moveElement(page: string, path: ElementPath, toIndex: number): Promise<WriteResult>;
  wrapInStack(page: string, path: ElementPath): Promise<WriteResult>;
  undo(): Promise<WriteResult>;                          // NOTHING_TO_UNDO
  redo(): Promise<WriteResult>;                          // NOTHING_TO_REDO
  readFile(path: string): Promise<FileText>;
  writeFile(path: string, text: string): Promise<WriteResult>;
  tokens(): Promise<TokenSet>;                           // tokens.json at the root, or { tokens: [], file: null }
  importTokens(format: TokenFormat, json: string): Promise<TokenSet>; // writes tokens.json (DTCG) and tokens.css
  exportTokens(): Promise<WriteResult>;                  // rewrites tokens.css from tokens.json
  checks(page: string): Promise<CheckReport>;
  gitStatus(): Promise<GitStatus>;
  commit(message: string): Promise<GitStatus>;           // empty message → INVALID_INPUT; failure → GIT_FAILED
  proposals(): Promise<Proposal[]>;                       // newest first
  propose(input: ProposalInput): Promise<Proposal>;      // validates, labels, taste-checks; emits { type: "proposal" }
  acceptProposal(id: string, includeBlocked: boolean): Promise<WriteResult>;
  rejectProposal(id: string): Promise<Proposal>;
  askAgent(input: AskInput): Promise<Proposal>;          // LLM → propose(); source = settings.agent.model
  settings(): Promise<Settings>;                          // agent.apiKey is always "" here; hasApiKey tells if one is stored
  saveSettings(settings: Settings): Promise<Settings>;   // agent.apiKey "" keeps the stored key
}
/** Every StudioService method name, in declaration order. RPC and MCP accept only these. */
export const STUDIO_METHODS = [
  "openProject", "createProject", "currentProject", "recentProjects", "templates", "createPage", "pageTree",
  "inspect", "applyStyle", "resetStyle", "insertElement", "editText", "removeElement", "moveElement", "wrapInStack",
  "undo", "redo", "readFile", "writeFile", "tokens", "importTokens", "exportTokens", "checks", "gitStatus", "commit",
  "proposals", "propose", "acceptProposal", "rejectProposal", "askAgent", "settings", "saveSettings",
] as const satisfies readonly (keyof StudioService)[];
export type StudioMethod = (typeof STUDIO_METHODS)[number];

export interface StudioDeps {
  openFs(root: string): FileSystem;     // file system rooted at a project folder
  openGit(root: string): GitRunner;
  llm: LlmClient;
  settings: SettingsStore;
  events: EventSink;
  templatesDir: string;                 // absolute path of the repo's templates/ folder
  now(): number;
  newId(): string;
}

// ---------- Module entry points (one exported function each) ----------
/** src/engine/studio/create-studio.ts */
export type CreateStudio = (deps: StudioDeps) => StudioService;
/** src/server/infra/node-fs.ts */
export type CreateNodeFileSystem = (root: string) => FileSystem;
/** src/server/infra/git.ts */
export type CreateNodeGitRunner = (root: string) => GitRunner;
/** src/server/infra/llm.ts — POST `${baseUrl}/chat/completions` with { model, messages, response_format: { type: "json_object" } }, Bearer apiKey when not empty. */
export type CreateHttpLlmClient = (getAgent: () => Promise<{ baseUrl: string; model: string; apiKey: string }>) => LlmClient;
/** src/server/infra/settings.ts — JSON file at filePath, written with mode 0o600. */
export type CreateFileSettingsStore = (filePath: string) => SettingsStore;
/** src/server/infra/events.ts */
export type CreateEventHub = () => EventHub;
/** src/server/infra/watcher.ts — fs.watch(root, { recursive: true }); emits { type: "external-change", files } debounced 150 ms, ignoring .git/ and node_modules/. */
export interface ProjectWatcher { watch(root: string): void; close(): void }
export type CreateProjectWatcher = (events: EventSink) => ProjectWatcher;

/** Handles one MCP HTTP POST body (JSON-RPC 2.0). `null` result means "no body, HTTP 202". */
export interface McpReply { status: number; body: unknown | null }
export type McpHandler = (body: unknown) => Promise<McpReply>;
/** src/server/mcp/handler.ts */
export type CreateMcpHandler = (studio: StudioService, options: { version: string; enabled(): Promise<boolean> }) => McpHandler;

export interface HttpServerOptions { studio: StudioService; events: EventHub; uiDir: string | null; mcp: McpHandler | null }
export interface HttpServer { listen(port: number): Promise<number>; close(): Promise<void> }
/** src/server/http/server.ts — binds 127.0.0.1 only; see contracts/http.ts for routes. */
export type CreateHttpServer = (options: HttpServerOptions) => HttpServer;

export interface StartOptions { port: number; project: string | null; homeDir: string | null; uiDir: string | null }
export interface RunningMason { url: string; port: number; studio: StudioService; close(): Promise<void> }
/** src/server/start.ts — composition root. homeDir null → MASON_HOME env var or ~/.mason; uiDir null → <repo>/dist/ui. */
export type StartMason = (options: StartOptions) => Promise<RunningMason>;
