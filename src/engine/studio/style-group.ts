import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS, SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { ElementPath, InspectProp, Scope } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { resolveCascade } from "../css/cascade.ts";
import { applyTextEdits } from "../css/edits.ts";
import { parseStylesheet } from "../css/parse.ts";
import { planResetOverride } from "../css/plan-reset.ts";
import { planStyleEdit } from "../css/plan-style.ts";
import { elementSelector } from "../html/select.ts";
import { loadPage } from "./page-group.ts";
import { commitChanges, writeEdits } from "./write.ts";
import type { FileChange } from "./write.ts";
import type { EngineContext } from "./context.ts";

export interface PlannedStyle { path: ElementPath; prop: string; value: string; scope: Scope }
export interface StylePlan { changes: FileChange[]; effective: boolean[] }

/**
 * Applies several style changes to one page in memory, in order, re-parsing the stylesheets after each one.
 * defaultFile = the page's last stylesheet href (NO_STYLESHEET when the page links none); a linked file that does
 * not exist yet starts as "". effective[i] = the change's value (trimmed) now wins at its scope's width.
 * Returns the changed files only.
 */
export async function planStyles(ctx: EngineContext, page: string, items: PlannedStyle[]): Promise<StylePlan> {
  const { model, sheets } = await loadPage(ctx, page);
  const defaultFile = model.stylesheets[model.stylesheets.length - 1];
  if (!defaultFile) throw new MasonError("NO_STYLESHEET", page);
  const original = new Map(sheets.map((s) => [s.file, s.text]));
  const texts = new Map(original);
  if (!texts.has(defaultFile)) texts.set(defaultFile, "");
  const order = model.stylesheets.filter((f, i) => texts.has(f) && model.stylesheets.indexOf(f) === i);
  const parsed = () => order.map((f) => parseStylesheet(f, texts.get(f)!));
  const effective: boolean[] = [];
  for (const item of items) {
    if (!(INSPECT_PROPS as readonly string[]).includes(item.prop)) throw new MasonError("INVALID_INPUT", item.prop);
    const el = model.matcher(item.path);
    if (!el) throw new MasonError("ELEMENT_NOT_FOUND", item.path);
    const edits = planStyleEdit({
      sheets: parsed(), el, elementSelector: elementSelector(model.body, item.path),
      prop: item.prop, value: item.value, scope: item.scope, defaultFile,
    });
    for (const file of new Set(edits.map((e) => e.file))) texts.set(file, applyTextEdits(texts.get(file) ?? "", edits.filter((e) => e.file === file)));
    const width = BREAKPOINTS.find((b) => b.id === SCOPE_BREAKPOINT[item.scope])!.width;
    const win = resolveCascade(parsed(), el, item.prop, width).find((e) => e.winning);
    effective.push(win?.declaration.value === item.value.trim());
  }
  const changes = [...texts].filter(([file, text]) => original.get(file) !== text).map(([path, after]) => ({ path, after }));
  return { changes, effective };
}

export function createStyleGroup(ctx: EngineContext): Pick<StudioService, "applyStyle" | "resetStyle"> {
  return {
    async applyStyle(change) {
      const plan = await planStyles(ctx, change.page, [change]);
      return commitChanges(ctx, plan.changes, { effective: plan.effective[0] });
    },
    async resetStyle(page, path, prop, scope) {
      const { model, sheets } = await loadPage(ctx, page);
      const el = model.matcher(path);
      if (!el) throw new MasonError("ELEMENT_NOT_FOUND", path);
      const edits = planResetOverride({ sheets, el, prop: prop as InspectProp, scope });
      if (edits.length === 0) throw new MasonError("INVALID_INPUT", "No override to reset.");
      return writeEdits(ctx, edits);
    },
  };
}
