/** UI state, store hooks, shortcuts and test ids. Planner-owned contract: never edit. */
import { createContext, useContext, useSyncExternalStore } from "react";
import type {
  BreakpointId, CheckFinding, CheckReport, ElementNode, ElementPath, GitStatus, InsertKind, InspectProp, InspectResult,
  MasonEvent, ProjectInfo, Proposal, RecentProject, Scope, Settings, TemplateId, TemplateInfo, TokenFormat, TokenSet,
} from "./model.ts";
import type { StudioService } from "./ports.ts";

export type ToolId = "move" | "frame" | "rect" | "ellipse" | "text" | "image" | "hand";
export type LeftTab = "layers" | "assets";
export type RightTab = "design" | "inspect" | "checks";
export interface Toast { id: number; tone: "success" | "error" | "info"; text: string; undo: boolean }
export interface CodeState { open: boolean; file: string | null; line: number | null; text: string | null; dirty: boolean }

export interface StudioState {
  screen: "start" | "canvas";
  project: ProjectInfo | null;
  recent: RecentProject[];
  templates: TemplateInfo[];
  page: string | null;              // PageInfo.name of the open page
  tree: ElementNode | null;         // body of the open page
  selection: ElementPath | null;
  hover: ElementPath | null;
  scope: Scope;
  activeBoard: BreakpointId;
  tool: ToolId;
  leftTab: LeftTab;
  rightTab: RightTab;
  zoom: number;                     // 0.1 .. 2
  pan: { x: number; y: number };
  inspect: InspectResult | null;    // for `selection`
  tokens: TokenSet | null;
  checks: CheckReport | null;
  contrast: CheckFinding[];         // computed in the browser from board iframes
  proposals: Proposal[];
  code: CodeState;
  git: GitStatus | null;
  settings: Settings | null;
  settingsOpen: boolean;
  agentPrompt: { open: boolean; busy: boolean };
  toast: Toast | null;
  revision: number;                 // boards reload when it changes
  busy: boolean;                    // true while a write is in flight
}
export const INITIAL_STATE: StudioState = {
  screen: "start", project: null, recent: [], templates: [], page: null, tree: null, selection: null, hover: null,
  scope: "all", activeBoard: "desktop", tool: "move", leftTab: "layers", rightTab: "design", zoom: 0.34,
  pan: { x: 0, y: 0 }, inspect: null, tokens: null, checks: null, contrast: [], proposals: [],
  code: { open: false, file: null, line: null, text: null, dirty: false }, git: null, settings: null,
  settingsOpen: false, agentPrompt: { open: false, busy: false }, toast: null, revision: 0, busy: false,
};

/**
 * Store actions. Every async action catches errors: a MasonError (or any Error) becomes
 * toast { tone: "error", text: error.message, undo: false } and the promise resolves (never rejects).
 * After every successful write (applyStyle ... redo, saveCode, acceptProposal, exportTokens):
 * revision = result.revision, toast { tone: "success", text: result.message, undo: true }, then tree
 * (pageTree) and inspect (when selection is set) are reloaded.
 */
export interface StudioActions {
  init(): Promise<void>;                      // recent, templates, settings; currentProject → openProject flow, NO_PROJECT → stay on start
  openProject(root: string): Promise<void>;   // screen "canvas", page = first page, tree, git, tokens, proposals loaded
  createProject(root: string, template: TemplateId): Promise<void>;
  closeProject(): void;                       // screen "start", project/page/tree/selection cleared
  selectPage(name: string): Promise<void>;    // loads tree, clears selection and inspect
  createPage(name: string): Promise<void>;
  select(path: ElementPath | null): void;     // sets selection, then loads inspect (null clears inspect)
  hover(path: ElementPath | null): void;
  setScope(scope: Scope): void;               // also activeBoard = SCOPE_BREAKPOINT[scope]
  setActiveBoard(id: BreakpointId): void;     // also scope: desktop → "all", tablet → "tablet", mobile → "mobile"
  setTool(tool: ToolId): void;
  setLeftTab(tab: LeftTab): void;
  setRightTab(tab: RightTab): void;
  setZoom(zoom: number): void;                // clamped to 0.1 .. 2
  panBy(dx: number, dy: number): void;
  applyStyle(prop: InspectProp, value: string): Promise<void>;   // page + selection + scope
  resetStyle(prop: InspectProp): Promise<void>;
  insertElement(kind: InsertKind, parentPath: ElementPath, index: number): Promise<void>; // selects result.path
  editText(path: ElementPath, text: string): Promise<void>;
  removeSelected(): Promise<void>;            // selection becomes null
  moveElement(path: ElementPath, toIndex: number): Promise<void>; // selects result.path
  wrapSelected(): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  loadTokens(): Promise<void>;
  importTokens(format: TokenFormat, json: string): Promise<void>;
  exportTokens(): Promise<void>;
  runChecks(): Promise<void>;
  setContrast(findings: CheckFinding[]): void;
  openCode(file: string, line: number | null): Promise<void>;     // readFile → code { open: true, text, dirty: false }
  editCode(text: string): void;               // code.text = text, dirty = true
  saveCode(): Promise<void>;                  // writeFile, dirty = false
  closeCode(): void;
  refreshGit(): Promise<void>;
  commit(message: string): Promise<void>;
  openAgentPrompt(): void;
  closeAgentPrompt(): void;
  askAgent(prompt: string): Promise<void>;    // askAgent(page, selection, prompt, scope) → proposal added, prompt closed
  loadProposals(): Promise<void>;
  acceptProposal(id: string, includeBlocked: boolean): Promise<void>;
  rejectProposal(id: string): Promise<void>;
  openSettings(): void;
  closeSettings(): void;
  saveSettings(settings: Settings): Promise<void>;
  /** written / external-change → revision + 1 (written: revision = event.revision), reload tree and inspect;
   *  proposal → insert or replace by id at the front of proposals; project-opened → ignored. */
  handleEvent(event: MasonEvent): void;
  showToast(tone: Toast["tone"], text: string, undo: boolean): void; // id = previous id + 1
  dismissToast(): void;
}
export interface StudioStore {
  getState(): StudioState;
  setState(patch: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)): void;
  subscribe(listener: () => void): () => void;
  actions: StudioActions;
}
/** StudioService over HTTP plus the /api/events stream. */
export type MasonClient = StudioService & { subscribe(listener: (event: MasonEvent) => void): () => void };
/** src/ui/api/http-client.ts */
export type CreateHttpClient = (baseUrl: string) => MasonClient;
/** src/ui/state/create-store.ts */
export type CreateStudioStore = (client: MasonClient) => StudioStore;
/** src/ui/main.tsx — renders <App/> inside StudioContext into rootElement; returns an unmount function. */
export type MountStudio = (rootElement: HTMLElement, client: MasonClient) => () => void;

export const StudioContext = createContext<StudioStore | null>(null);
/** Selector must return a primitive or a value stored in state (never a new object/array). */
export function useStudio<T>(select: (state: StudioState) => T): T {
  const store = useContext(StudioContext);
  if (!store) throw new Error("StudioContext is missing");
  return useSyncExternalStore(store.subscribe, () => select(store.getState()), () => select(store.getState()));
}
export function useActions(): StudioActions {
  const store = useContext(StudioContext);
  if (!store) throw new Error("StudioContext is missing");
  return store.actions;
}

export type ShortcutAction =
  | "tool:move" | "tool:frame" | "tool:rect" | "tool:ellipse" | "tool:text" | "tool:image" | "tool:hand"
  | "wrap" | "agent" | "code" | "undo" | "redo" | "delete" | "deselect" | "zoom:fit" | "zoom:in" | "zoom:out";
/** "mod" = Ctrl on Windows/Linux, Cmd on macOS. Keys are lowercase KeyboardEvent.key values joined with "+". */
export const SHORTCUTS: readonly { keys: string; action: ShortcutAction }[] = [
  { keys: "v", action: "tool:move" }, { keys: "f", action: "tool:frame" }, { keys: "a", action: "tool:frame" },
  { keys: "r", action: "tool:rect" }, { keys: "o", action: "tool:ellipse" }, { keys: "t", action: "tool:text" },
  { keys: "shift+mod+k", action: "tool:image" }, { keys: "h", action: "tool:hand" }, { keys: "shift+a", action: "wrap" },
  { keys: "mod+i", action: "agent" }, { keys: "mod+e", action: "code" }, { keys: "mod+z", action: "undo" },
  { keys: "shift+mod+z", action: "redo" }, { keys: "delete", action: "delete" }, { keys: "backspace", action: "delete" },
  { keys: "escape", action: "deselect" }, { keys: "shift+1", action: "zoom:fit" }, { keys: "mod+=", action: "zoom:in" },
  { keys: "mod+-", action: "zoom:out" },
];

/** data-testid values. Board ids: `${TEST_IDS.board}${pageName}-${breakpointId}`. */
export const TEST_IDS = {
  startScreen: "start-screen", topBar: "top-bar", breakpointStrip: "breakpoint-strip", gitChip: "git-chip",
  leftPanel: "left-panel", pagesList: "pages-list", layersTree: "layers-tree", assetsPanel: "assets-panel",
  canvas: "canvas", board: "board-", selection: "overlay-selection", mirror: "overlay-mirror", toolDock: "tool-dock",
  rightPanel: "right-panel", designPanel: "design-panel", scopeControl: "scope-control", inspectPanel: "inspect-panel",
  checksPanel: "checks-panel", codeDrawer: "code-drawer", toast: "toast", reviewCard: "review-card",
  agentPrompt: "agent-prompt", settingsDialog: "settings-dialog",
} as const;

/** Electron preload bridge (src/desktop/preload.ts). Absent in the browser. */
export interface MasonDesktopBridge { isDesktop: true; pickFolder(): Promise<string | null> }
declare global { interface Window { masonDesktop?: MasonDesktopBridge } }
