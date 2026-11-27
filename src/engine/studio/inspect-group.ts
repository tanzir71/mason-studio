import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS } from "../../contracts/model.ts";
import type {
  BreakpointId, CascadeRow, CssRule, CssSheet, ElementMatcher, ElementPath, InspectProp, InspectResult, PropInfo, RuleRef,
} from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { matchingRules, resolveCascade } from "../css/cascade.ts";
import { elementSelector, findNode } from "../html/select.ts";
import { loadPage } from "./page-group.ts";
import type { EngineContext } from "./context.ts";

export function ruleRef(rule: CssRule): RuleRef {
  return { file: rule.file, line: rule.line, selector: rule.selector, media: rule.media };
}

/** PropInfo for one property: winning value and rule at each breakpoint width, and the overridden breakpoints. */
export function propInfo(sheets: CssSheet[], el: ElementMatcher, prop: string): PropInfo {
  const values = {} as Record<BreakpointId, string | null>;
  const winners = {} as Record<BreakpointId, RuleRef | null>;
  for (const bp of BREAKPOINTS) {
    const win = resolveCascade(sheets, el, prop, bp.width).find((e) => e.winning);
    values[bp.id] = win ? win.declaration.value : null;
    winners[bp.id] = win ? ruleRef(win.rule) : null;
  }
  const overriddenAt = BREAKPOINTS.filter((bp) => bp.maxWidth !== null && winners[bp.id]?.media === `(max-width: ${bp.maxWidth}px)`).map((bp) => bp.id);
  return { values, winners, overriddenAt };
}

/** Cascade rows at one width: every matching rule, each declaration marked winning or overridden. */
export function cascadeRows(sheets: CssSheet[], el: ElementMatcher, width: number): CascadeRow[] {
  const matches = matchingRules(sheets, el, width);
  const winningKeys = new Set<string>();
  const props = new Set(matches.flatMap((m) => m.rule.declarations.map((d) => d.prop)));
  for (const prop of props) {
    const win = resolveCascade(sheets, el, prop, width).find((e) => e.winning);
    if (win) winningKeys.add(`${win.rule.file}:${win.rule.index}:${win.declIndex}`);
  }
  return matches.map((m) => ({
    rule: ruleRef(m.rule), specificity: m.specificity, applies: m.applies,
    declarations: m.rule.declarations.map((d, i) => ({
      prop: d.prop, value: d.value,
      status: winningKeys.has(`${m.rule.file}:${m.rule.index}:${i}`) ? "winning" as const : "overridden" as const,
    })),
  }));
}

export function createInspectGroup(ctx: EngineContext): Pick<StudioService, "inspect"> {
  return {
    async inspect(page: string, path: ElementPath): Promise<InspectResult> {
      const { model, sheets } = await loadPage(ctx, page);
      const node = findNode(model.body, path);
      const el = model.matcher(path);
      if (!node || !el) throw new MasonError("ELEMENT_NOT_FOUND", path);
      const props = {} as Record<InspectProp, PropInfo>;
      for (const prop of INSPECT_PROPS) props[prop] = propInfo(sheets, el, prop);
      const rules = {} as Record<BreakpointId, CascadeRow[]>;
      for (const bp of BREAKPOINTS) rules[bp.id] = cascadeRows(sheets, el, bp.width);
      return { page, path, name: node.name, tag: node.tag, selector: elementSelector(model.body, path), props, rules };
    },
  };
}
