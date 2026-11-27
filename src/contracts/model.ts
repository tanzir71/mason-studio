/**
 * Mason domain model. Planner-owned contract: never edit.
 * Offsets are 0-based UTF-16 indexes into the file text; `end` is exclusive.
 */

/**
 * Element path: dot-separated indexes of ELEMENT children, starting at <body>.
 * "" is <body>; "0" is body's first element child; "0.2" is that element's third element child.
 * Every element child counts (script, style, template too). Text and comment nodes never count.
 * The browser (`Element.children`) and the server (parse5 element children) give identical paths.
 */
export type ElementPath = string;

export type LayerKind = "frame" | "stack" | "text" | "image" | "link";
export type BreakpointId = "desktop" | "tablet" | "mobile";
/** "Applies to" scope. "all" edits base rules; "tablet"/"mobile" edit `@media (max-width: Npx)` rules. */
export type Scope = "all" | "tablet" | "mobile";

export interface Breakpoint { id: BreakpointId; label: string; width: number; maxWidth: number | null }

/** Fixed breakpoint row shown for every page, in this order. */
export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 768, maxWidth: 768 },
  { id: "mobile", label: "Mobile", width: 375, maxWidth: 375 },
];
/** Breakpoint whose width is used to evaluate an edit scope. */
export const SCOPE_BREAKPOINT: Record<Scope, BreakpointId> = { all: "desktop", tablet: "tablet", mobile: "mobile" };
/** Tags kept in the tree (paths count them) but hidden from the Layers panel. */
export const NON_VISUAL_TAGS: readonly string[] = ["script", "style", "template", "noscript", "link", "meta", "title", "base"];

export interface SourceRange { start: number; end: number }

export interface ElementNode {
  path: ElementPath;
  tag: string;                       // lowercase
  /** Only these attributes, when present: id, class, src, alt, href, data-mason-name. */
  attrs: Record<string, string>;
  classes: string[];                 // class attribute split on whitespace, empty strings removed
  name: string;                      // friendlyName(...)
  kind: LayerKind;                   // layerKind(...)
  /** Whitespace-collapsed, trimmed text content for kind "text" | "link"; cut to 80 chars + "…". Else null. */
  text: string | null;
  children: ElementNode[];
  range: SourceRange;                // whole element including start and end tag
  innerRange: SourceRange | null;    // from end of start tag to start of end tag; null for void elements
}

export interface PageInfo { name: string; file: string; title: string; stylesheets: string[] }
export interface ProjectInfo { root: string; name: string; pages: PageInfo[]; breakpoints: Breakpoint[]; hasTokens: boolean; hasTaste: boolean }
export interface RecentProject { root: string; name: string; openedAt: number }
export type TemplateId = "landing" | "portfolio" | "docs" | "blank";
export interface TemplateInfo { id: TemplateId; name: string; meta: string }

// ---------- CSS ----------
export interface CssDeclaration {
  prop: string;          // lowercase
  value: string;         // as written, trimmed, without "!important"
  important: boolean;
  range: SourceRange;    // whole declaration, including the trailing ";" when present
  valueRange: SourceRange; // only the value text (excludes "!important")
}
export interface CssRule {
  file: string;
  index: number;         // order of appearance among the sheet's collected rules (0-based)
  selector: string;      // selector list as written, trimmed
  media: string | null;  // normalized params of the enclosing @media (lowercase, single spaces), null at top level
  line: number;          // 1-based line of the selector
  declarations: CssDeclaration[];
  range: SourceRange;    // selector start to closing "}" inclusive
  bodyRange: SourceRange; // after "{" up to (not including) "}"
}
export interface CssMediaBlock { file: string; media: string; range: SourceRange; bodyEnd: number /* offset of its closing "}" */ }
export interface CssSheet { file: string; text: string; rules: CssRule[]; mediaBlocks: CssMediaBlock[] }
export interface ElementMatcher { matches(selector: string): boolean }
/** [ids, classes/attributes/pseudo-classes, types/pseudo-elements] */
export type Specificity = [number, number, number];
export interface RuleRef { file: string; line: number; selector: string; media: string | null }
export interface RuleMatch { rule: CssRule; selector: string; specificity: Specificity; sheetIndex: number; applies: boolean }
export interface CascadeEntry extends RuleMatch { declaration: CssDeclaration; declIndex: number; winning: boolean }
export interface TextEdit { file: string; start: number; end: number; text: string }

// ---------- Inspect and writes ----------
export const INSPECT_PROPS = [
  "display", "flex-direction", "gap", "justify-content", "align-items", "grid-template-columns",
  "width", "height", "max-width", "padding", "margin",
  "font-family", "font-weight", "font-size", "line-height", "letter-spacing", "text-align",
  "color", "background-color", "border", "border-radius", "opacity", "box-shadow",
] as const;
export type InspectProp = (typeof INSPECT_PROPS)[number];
/** Human labels used in proposals and the Design panel ("Headline size"). */
export const PROP_LABELS: Record<InspectProp, string> = {
  "display": "display", "flex-direction": "direction", "gap": "gap", "justify-content": "justify", "align-items": "align",
  "grid-template-columns": "columns", "width": "width", "height": "height", "max-width": "max width", "padding": "padding",
  "margin": "margin", "font-family": "font", "font-weight": "weight", "font-size": "size", "line-height": "line height",
  "letter-spacing": "letter spacing", "text-align": "alignment", "color": "color", "background-color": "fill",
  "border": "stroke", "border-radius": "radius", "opacity": "opacity", "box-shadow": "shadow",
};
export interface PropInfo {
  values: Record<BreakpointId, string | null>;      // winning declared value at each breakpoint width
  winners: Record<BreakpointId, RuleRef | null>;    // rule of that winning declaration
  overriddenAt: BreakpointId[];                     // tablet/mobile whose winner sits in "(max-width: <that maxWidth>px)"
}
export interface CascadeRow {
  rule: RuleRef; specificity: Specificity; applies: boolean;
  declarations: { prop: string; value: string; status: "winning" | "overridden" }[];
}
export interface InspectResult {
  page: string; path: ElementPath; name: string; tag: string; selector: string;
  props: Record<InspectProp, PropInfo>;
  rules: Record<BreakpointId, CascadeRow[]>;
}
export interface StyleChange { page: string; path: ElementPath; prop: InspectProp; value: string; scope: Scope }
export type InsertKind = "frame" | "rect" | "ellipse" | "text" | "image";
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
export interface FileText { path: string; text: string }

// ---------- Tokens ----------
export type TokenType = "color" | "dimension" | "fontFamily" | "fontWeight" | "number";
export interface Token {
  name: string;                 // dot path, e.g. "color.ink"
  type: TokenType;
  value: string;                // CSS text: "#1e2a22", "16px", "Fraunces, serif", "600", "1.5"
  alias: string | null;         // "color.ink" when $value was "{color.ink}", else null
  byBreakpoint: Partial<Record<BreakpointId, string>>; // from $extensions["dev.mason.breakpoints"]
}
export interface TokenSet { tokens: Token[]; file: string | null }
export type TokenFormat = "dtcg" | "tokens-studio";

// ---------- Checks and taste ----------
export type CheckKind = "taste" | "a11y" | "tokens";
export type Severity = "blocked" | "warning" | "info";
export interface CheckFinding {
  id: string; kind: CheckKind; severity: Severity; title: string; detail: string;
  file: string | null; line: number | null; path: ElementPath | null;
}
export interface CheckReport { page: string; findings: CheckFinding[]; passed: string[] }
export interface HardBan { kind: "literal" | "regex"; pattern: string; note: string; line: number }
export interface TasteProfile { sections: Record<string, string>; bans: HardBan[]; invalid: string[] }

// ---------- Agents ----------
export interface ProposedChange { path: ElementPath; prop: InspectProp; value: string; scope: Scope }
export interface ProposalInput { source: string; page: string; summary: string; changes: ProposedChange[] }
export interface ProposalChange extends ProposedChange { label: string; from: string | null; blocked: CheckFinding | null }
export type ProposalStatus = "pending" | "accepted" | "rejected";
export interface Proposal { id: string; source: string; page: string; summary: string; createdAt: number; status: ProposalStatus; changes: ProposalChange[] }
export interface AskInput { page: string; path: ElementPath; prompt: string; scope: Scope }

// ---------- Git, settings, events ----------
export interface GitStatus { isRepo: boolean; branch: string | null; changes: number; files: string[] }
export interface AgentSettings { baseUrl: string; model: string; apiKey: string }
export interface Settings { agent: AgentSettings; hasApiKey: boolean; mcpEnabled: boolean; theme: "dark" | "light" }
export const DEFAULT_SETTINGS: Settings = {
  agent: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b", apiKey: "" },
  hasApiKey: false, mcpEnabled: false, theme: "dark",
};
/** What SettingsStore persists. `settings.agent.apiKey` holds the real key here. */
export interface StoredSettings { settings: Settings; recent: RecentProject[] }
export type MasonEvent =
  | { type: "written"; files: string[]; revision: number }
  | { type: "external-change"; files: string[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "project-opened"; project: ProjectInfo };
