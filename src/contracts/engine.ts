/**
 * Pure engine functions (implemented under src/engine/). Planner-owned contract: never edit.
 * Each implementation file exports a function with exactly the name and signature below.
 */
import type {
  BreakpointId, CascadeEntry, CheckFinding, CssSheet, ElementMatcher, ElementNode, ElementPath, InsertKind,
  LayerKind, RuleMatch, Scope, Specificity, TasteProfile, TextEdit, Token, TokenSet,
} from "./model.ts";

// ===================== CSS (src/engine/css/) =====================

/**
 * parseStylesheet(file, text) — postcss.parse(text, { from: file }).
 * Collects Rule nodes directly under the root and Rule nodes directly inside a root-level `@media`
 * (name compared case-insensitively). Ignores everything else (other at-rules, nested rules, comments).
 * - rule.media = normalizeMedia(atRule.params) or null; rule.index counts collected rules in source order.
 * - rule.range = [rule.source.start.offset, rule.source.end.offset); bodyRange = [offset after "{", offset of "}").
 * - decl.range = [decl.source.start.offset, decl.source.end.offset) (includes ";" when present);
 *   valueRange.start = range.start + decl.prop.length + decl.raws.between.length;
 *   valueRange.end = valueRange.start + (decl.raws.value?.raw ?? decl.value).length.
 * - mediaBlocks: one per root-level @media: { media, range, bodyEnd = source.end.offset - 1 }.
 * Throws MasonError("CSS_PARSE_ERROR", `${file}:${line}`) when postcss throws CssSyntaxError.
 */
export type ParseStylesheet = (file: string, text: string) => CssSheet;

/** "( MAX-WIDTH:768px )" → "(max-width: 768px)": lowercase, collapse whitespace, trim, no space after "(" or before ")", exactly one space after ":". */
export type NormalizeMedia = (params: string) => string;

/**
 * mediaApplies(media, width): null → true. Comma list → true if any part applies.
 * A part is terms joined by " and ": "all", "screen", "only screen" → true; "print" → false;
 * "(max-width: Npx)" → width <= N; "(min-width: Npx)" → width >= N; em/rem count as 16px.
 * Any other term (including "not ...") → false.
 */
export type MediaApplies = (media: string | null, width: number) => boolean;

/** Specificity of ONE complex selector (no commas) via @bramus/specificity: [a, b, c]. */
export type SpecificityOf = (selector: string) => Specificity;

/** Split a selector list on top-level commas (not inside (), [] or quotes); trim parts; drop empty parts. */
export type SplitSelectorList = (list: string) => string[];

/**
 * matchingRules(sheets, el, width): every rule with at least one selector in its list for which
 * el.matches(selector) is true (exceptions count as false). `selector` = the matching selector with the
 * highest specificity (first one on ties); `sheetIndex` = index in `sheets`; applies = mediaApplies(rule.media, width).
 * Sorted highest priority first: applies (true first), specificity (desc, compare a then b then c),
 * sheetIndex (desc), rule.index (desc).
 */
export type MatchingRules = (sheets: CssSheet[], el: ElementMatcher, width: number) => RuleMatch[];

/**
 * resolveCascade(sheets, el, prop, width): one entry per declaration with declaration.prop === prop in every
 * matching rule. Sorted: applies (true first), important (true first), specificity (desc), sheetIndex (desc),
 * rule.index (desc), declIndex (desc). winning = true only for the first entry, and only if it applies.
 */
export type ResolveCascade = (sheets: CssSheet[], el: ElementMatcher, prop: string, width: number) => CascadeEntry[];

export interface PlanStyleInput {
  sheets: CssSheet[]; el: ElementMatcher; elementSelector: string;
  prop: string; value: string; scope: Scope; defaultFile: string;
}
/**
 * planStyleEdit(input): TextEdits that make `prop: value` win for the element at the scope's width.
 * Throws INVALID_INPUT when value is empty after trim or contains ";", "{" or "}".
 * Scope "all" (width 1280):
 *   1. If resolveCascade(...) has a winning entry: replace its declaration.valueRange with value.
 *   2. Else if matchingRules(...) has an applying rule with media null: insert the declaration into the first one.
 *   3. Else append `${elementSelector} {\n  ${prop}: ${value};\n}\n` to defaultFile (see "Append" below).
 * Scope "tablet"/"mobile" (width W, M = `(max-width: ${maxWidth}px)`):
 *   1. If an applying cascade entry has rule.media === M: replace the value of the first such entry.
 *   2. Else if an applying matching rule has rule.media === M: insert the declaration into the first such rule.
 *   3. Else let base = first applying cascade entry with rule.media null; sel = base?.selector ?? elementSelector;
 *      file = base?.rule.file ?? defaultFile. If that sheet has a mediaBlock with media === M whose bodyEnd is
 *      greater than base.rule.range.end (or any such block when base is undefined), insert
 *      `  ${sel} {\n    ${prop}: ${value};\n  }\n` at the LAST such block's bodyEnd (prefix "\n" when the
 *      character before bodyEnd is not "\n"). Otherwise append
 *      `\n@media (max-width: ${maxWidth}px) {\n  ${sel} {\n    ${prop}: ${value};\n  }\n}\n` (see "Append").
 * Insert a declaration into rule R:
 *   - Single-line rule (no "\n" inside bodyRange): one edit at lastDecl.range.end with text
 *     (lastDecl text ends with ";" ? "" : ";") + ` ${prop}: ${value};`; with no declarations replace bodyRange
 *     with ` ${prop}: ${value}; `.
 *   - Multi-line rule: indent = whitespace between the line start and the first declaration (if it is only
 *     spaces/tabs) else "  "; one edit at (lastDecl?.range.end ?? bodyRange.start) with text
 *     (lastDecl && !lastDecl text ends with ";" ? ";" : "") + `\n${indent}${prop}: ${value};`.
 * Append to file F: one edit at F's text length; text starts with "\n" when F's text does not end with "\n".
 * Always returns edits sorted by start ascending.
 */
export type PlanStyleEdit = (input: PlanStyleInput) => TextEdit[];

export interface PlanResetInput { sheets: CssSheet[]; el: ElementMatcher; prop: string; scope: Scope }
/**
 * planResetOverride(input): removes the element's `prop` override at "tablet"/"mobile" so the wider value shows.
 * "all" → []. For every applying cascade entry (at the scope width) whose rule.media === M (see above):
 * remove the declaration. A removal starts at the "\n" before the item when only spaces/tabs separate them
 * (else at the item start) and ends at the item end. When every declaration of a rule is removed, remove the
 * whole rule instead; when every rule inside a media block is removed, remove the whole block instead.
 * Edits never overlap; sorted by start ascending.
 */
export type PlanResetOverride = (input: PlanResetInput) => TextEdit[];

/** One edit appending `${selector} {\n  ${prop}: ${value};\n ...}\n` at the end of `text` ("\n" prefix as in Append). */
export type PlanAppendRule = (file: string, text: string, selector: string, declarations: [string, string][]) => TextEdit;

/**
 * applyTextEdits(text, edits) → new text. Edits refer to the same file (`file` is ignored).
 * Throws MasonError("EDIT_CONFLICT") when two edits overlap (a.start < b.end && b.start < a.end) or share a start.
 * Applies from the highest start to the lowest. Out-of-range offsets → INVALID_INPUT.
 */
export type ApplyTextEdits = (text: string, edits: TextEdit[]) => string;

// ===================== HTML (src/engine/html/) =====================

export interface PageModel {
  file: string;
  title: string;            // <title> text trimmed, or file name without ".html" when missing/empty
  /** href of every <link rel="stylesheet"> that is relative (no scheme, not "/" or "//"), "?"/"#" parts and a leading "./" removed. */
  stylesheets: string[];
  body: ElementNode;        // path ""
  /** css-select `is(node, selector)` for the element at path (exceptions → false); null if path is missing. */
  matcher(path: ElementPath): ElementMatcher | null;
}
/**
 * parsePage(file, text): parse5.parse(text, { treeAdapter: adapter (parse5-htmlparser2-tree-adapter),
 * sourceCodeLocationInfo: true }). ElementNode.range from sourceCodeLocation start/endOffset; innerRange from
 * startTag.endOffset to endTag.startOffset (null when there is no endTag). An implicit <body> gets range
 * [0, text.length] and innerRange null. name = friendlyName(...), kind = layerKind(...).
 */
export type ParsePage = (file: string, text: string) => PageModel;

/**
 * friendlyName(node): first match wins:
 * 1. attrs["data-mason-name"] (non-empty) as is; 2. tag "body" → "Page"; 3. classes[0] → humanize(classes[0]);
 * 4. attrs.id → humanize(id); 5. TAG_NAMES[tag] ?? humanize(tag).
 * humanize: split camelCase ("orderButton" → "order Button"), replace runs of "-" or "_" with one space,
 * lowercase, trim, uppercase the first letter. "hero-copy" → "Hero copy".
 */
export type FriendlyName = (node: { tag: string; attrs: Record<string, string>; classes: string[] }) => string;
export const TAG_NAMES: Record<string, string> = {
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading", p: "Text", span: "Text",
  a: "Link", button: "Button", img: "Image", picture: "Image", svg: "Vector", ul: "List", ol: "List", li: "List item",
  nav: "Navigation", header: "Header", footer: "Footer", main: "Main", section: "Section", article: "Article",
  aside: "Aside", div: "Frame", form: "Form", input: "Input", label: "Label", figure: "Figure", video: "Video",
};
/**
 * layerKind(node): img/picture/svg/video/canvas → "image"; a/button → "link"; body → "frame";
 * tag in TEXT_TAGS and every child tag in INLINE_TAGS → "text"; tag in CONTAINER_TAGS → "stack"; else "frame".
 */
export type LayerKindOf = (node: { tag: string; childTags: string[] }) => LayerKind;
export const TEXT_TAGS: readonly string[] = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "li", "blockquote", "figcaption", "small", "strong", "em", "code", "dt", "dd"];
export const INLINE_TAGS: readonly string[] = ["span", "em", "strong", "b", "i", "br", "small", "code", "a", "abbr", "mark", "sub", "sup", "time"];
export const CONTAINER_TAGS: readonly string[] = ["div", "section", "header", "footer", "main", "nav", "article", "aside", "ul", "ol", "form", "figure", "li"];

/** findNode(body, path): the node at path, or null. */
export type FindNode = (body: ElementNode, path: ElementPath) => ElementNode | null;
/**
 * elementSelector(body, path): `#${id}` when the node has an id; else "." + classes.join(".") when it has
 * classes; else the nearest ancestor below body with an id (`#${id} ${tag}`) or a class (`.${classes[0]} ${tag}`);
 * else "body > " + tags from body's child down to the node joined with " > ". Throws ELEMENT_NOT_FOUND.
 */
export type ElementSelector = (body: ElementNode, path: ElementPath) => string;
/** nextClassName(body, prefix): `${prefix}-${n}` with the smallest n >= 1 not used as a class anywhere in the tree. */
export type NextClassName = (body: ElementNode, prefix: string) => string;

/** Replace innerRange with the escaped text (& → &amp;, < → &lt;, > → &gt;). ELEMENT_NOT_FOUND; NOT_TEXT_ELEMENT unless kind is text/link with innerRange. */
export type PlanEditText = (page: PageModel, path: ElementPath, text: string) => TextEdit[];
/** Remove range; start moves back to the preceding "\n" when only spaces/tabs separate them. Path "" → INVALID_INPUT. */
export type PlanRemoveElement = (page: PageModel, html: string, path: ElementPath) => TextEdit[];

export const INSERT_SNIPPETS: Record<InsertKind, string> = {
  frame: '<div class="{cls}"></div>', rect: '<div class="{cls}"></div>', ellipse: '<div class="{cls}"></div>',
  text: '<p class="{cls}">Text</p>', image: '<img class="{cls}" src="" alt="">',
};
export const INSERT_STYLES: Record<InsertKind, [string, string][]> = {
  frame: [["display", "flex"], ["flex-direction", "column"], ["gap", "16px"], ["padding", "24px"], ["min-height", "120px"]],
  rect: [["width", "160px"], ["height", "120px"], ["background-color", "#d9d9d9"]],
  ellipse: [["width", "120px"], ["height", "120px"], ["border-radius", "50%"], ["background-color", "#d9d9d9"]],
  text: [["font-size", "16px"]],
  image: [["width", "240px"], ["height", "160px"], ["object-fit", "cover"]],
};
export interface InsertPlan { edits: TextEdit[]; className: string; path: ElementPath }
/**
 * planInsertElement(page, html, css, parentPath, index, kind): cls = nextClassName(body, kind); snippet =
 * INSERT_SNIPPETS[kind] with "{cls}" replaced. index is clamped to [0, element children count].
 * indent(node) = spaces/tabs between the line start and node.range.start ("" when other text is there).
 * - index < count: insert `${snippet}\n${indent(child)}` at children[index].range.start.
 * - index === count > 0: insert `\n${indent(last)}${snippet}` at last.range.end.
 * - no children: p = indent(parent); if innerRange text is whitespace only replace innerRange with
 *   `\n${p}  ${snippet}\n${p}`, else insert that text at innerRange.end.
 * css: { file, text } of the page's last stylesheet, or null → throw NO_STYLESHEET. Adds
 * planAppendRule(css.file, css.text, "." + cls, INSERT_STYLES[kind]). Parent without innerRange → INVALID_INPUT.
 * path = parentPath === "" ? String(index) : `${parentPath}.${index}` (after clamping).
 */
export type PlanInsertElement = (page: PageModel, html: string, css: { file: string; text: string } | null,
  parentPath: ElementPath, index: number, kind: InsertKind) => InsertPlan;
/**
 * planMoveElement(page, html, path, toIndex): reorder within the same parent. from = last path segment;
 * to = toIndex clamped to [0, siblings - 1]; from === to → { edits: [], path }. Edits: the removal from
 * planRemoveElement plus an insertion of html.slice(range): to < from → `${text}\n${indent(sib)}` at
 * siblings[to].range.start; to > from → `\n${indent(sib)}${text}` at siblings[to].range.end.
 * Returns { edits sorted by start, path: parent path + to }.
 */
export type PlanMoveElement = (page: PageModel, html: string, path: ElementPath, toIndex: number) => { edits: TextEdit[]; path: ElementPath };
/**
 * planWrapInStack(page, html, css, path): cls = nextClassName(body, "stack"); insert `<div class="${cls}">` at
 * range.start and `</div>` at range.end; append `.${cls}` with display: flex; flex-direction: column; gap: 16px.
 * Path "" → INVALID_INPUT; css null → NO_STYLESHEET. Result path = path (the wrapper takes the element's place).
 */
export type PlanWrapInStack = (page: PageModel, html: string, css: { file: string; text: string } | null, path: ElementPath) => InsertPlan;

// ===================== Tokens (src/engine/tokens/) =====================

/**
 * parseDtcg(json, file): DTCG 2025.10. Nested groups; a token is an object with "$value". "$type" inherits
 * from the nearest group. Types other than TokenType are skipped. Values → CSS text:
 *   color: "#rrggbb" string, or { colorSpace: "srgb", components: [r,g,b] (0..1), alpha?, hex? } → hex when
 *          given else from components (lowercase "#rrggbb", "#rrggbbaa" when alpha < 1);
 *   dimension: "16px" string or { value, unit } → `${value}${unit}`; fontFamily: string or string[] joined ", ";
 *   fontWeight/number: String(value). "{a.b}" values → alias "a.b" and value = the resolved value of a.b.
 * byBreakpoint = $extensions["dev.mason.breakpoints"] mapped through the same conversion.
 * tokens sorted by name. Invalid JSON or an unresolved alias → MasonError("TOKENS_INVALID", detail).
 */
export type ParseDtcg = (json: string, file: string | null) => TokenSet;
/** serializeDtcg(set): nested groups by name segments; colors as { colorSpace: "srgb", components, hex }; dimensions as { value, unit }; aliases as "{name}"; JSON.stringify(..., null, 2) + "\n". */
export type SerializeDtcg = (set: TokenSet) => string;
/**
 * fromTokensStudio(json): Tokens Studio / Penpot export. Top-level keys starting with "$" are metadata; every
 * other top-level key is a set, read in $metadata.tokenSetOrder order when present, else key order. Inside a set,
 * a token is an object with "value" and "type". Names drop the set name. First set wins on duplicate names.
 * type map: color → color; spacing, sizing, dimension, borderRadius, borderWidth, fontSizes, letterSpacing →
 * dimension (a bare number gets "px"); fontFamilies → fontFamily; fontWeights → fontWeight;
 * lineHeights, opacity, number → number; others skipped. "{a.b}" → alias. Errors → TOKENS_INVALID.
 */
export type FromTokensStudio = (json: string) => TokenSet;
/** "color.ink" → "--color-ink" (dots and spaces → "-", lowercase). */
export type CssVarName = (tokenName: string) => string;
/**
 * tokensToCss(set): "/* Generated by Mason from tokens.json. Do not edit. *\/\n:root {\n  --a: v;\n}\n" (aliases →
 * `var(--b)`), then for "tablet" then "mobile" when any token has a byBreakpoint value:
 * "@media (max-width: 768px) {\n  :root {\n    --a: v;\n  }\n}\n" (375 for mobile).
 */
export type TokensToCss = (set: TokenSet) => string;

// ===================== Checks (src/engine/checks/) =====================

/**
 * parseTaste(markdown): sections keyed by lowercase "## " heading text, value = trimmed body. Bans come from the
 * "hard bans" section: lines `- literal: <pattern>` or `- regex: <pattern>`, optionally followed by ` | <note>`
 * (split at the LAST " | ", so "#(a|b)" stays intact); pattern and note are trimmed; note defaults to the pattern;
 * line = 1-based line in the file. A regex that does not compile is skipped and
 * `regex: <pattern>` is added to `invalid`.
 */
export type ParseTaste = (markdown: string) => TasteProfile;
/**
 * checkBans(profile, text, where): one finding per ban that matches `text` (literal: case-insensitive substring;
 * regex: new RegExp(pattern, "i")). Finding: id `taste:${ban.line}`, kind "taste", severity "blocked",
 * title = ban.note, detail = `Matches "${ban.kind}: ${ban.pattern}".`, file/line/path from `where`.
 */
export type CheckBans = (profile: TasteProfile, text: string,
  where: { file: string | null; line: number | null; path: ElementPath | null }) => CheckFinding[];
export interface Rgba { r: number; g: number; b: number; a: number }
/** #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces (and "/ a"), white, black, transparent; else null. */
export type ParseCssColor = (value: string) => Rgba | null;
/** WCAG 2 contrast of fg over bg (fg alpha composited onto bg), rounded to 2 decimals. */
export type ContrastRatio = (fg: Rgba, bg: Rgba) => number;
/**
 * checkPageStructure(body): warnings (kind "a11y"):
 *  - more than one h1: id "a11y:h1-count", title `Page has ${n} H1 headings`;
 *  - heading level jump (next > previous + 1, document order): id `a11y:heading:${path}`, title `Heading jumps from H${p} to H${n}`;
 *  - img without an alt attribute: id `a11y:alt:${path}`, title "Image has no alt text".
 * detail "", file/line null, path set (null for h1-count). passed: "Headings in order" when there are no heading
 * findings, "Images have alt text" when there are no alt findings.
 */
export type CheckPageStructure = (body: ElementNode) => { findings: CheckFinding[]; passed: string[] };
/**
 * checkRawColors(sheets, tokens): for each declaration in rules whose selector is not ":root" and whose value
 * contains a hex color (/#[0-9a-f]{3,8}\b/i): info finding id `tokens:${file}:${line}:${prop}`, kind "tokens",
 * title `Raw color ${hex} in ${selector}`, detail `Use ${token.name} instead.` when a color token has the same
 * lowercase 6-digit hex, else "Not a token.", file = rule.file, line = rule.line, path null.
 */
export type CheckRawColors = (sheets: CssSheet[], tokens: Token[]) => CheckFinding[];

/** Breakpoint for a scope width lookup, re-exported for convenience in engine code. */
export type WidthOf = (id: BreakpointId) => number;
