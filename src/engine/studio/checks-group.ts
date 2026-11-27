import type { CheckFinding, CheckReport, Severity } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { checkRawColors, checkPageStructure } from "../checks/structure.ts";
import { checkBans, parseTaste } from "../checks/taste.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import { readTokens } from "./tokens-group.ts";

export const TASTE_FILE = ".mason/taste.md";
const ORDER: Record<Severity, number> = { blocked: 0, warning: 1, info: 2 };

/** Blocked first, then warnings, then info; ties by id. */
export function sortFindings(findings: CheckFinding[]): CheckFinding[] {
  return [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createChecksGroup(ctx: EngineContext): Pick<StudioService, "checks"> {
  return {
    async checks(page): Promise<CheckReport> {
      const fs = requireFs(ctx);
      const { info, html, model, sheets } = await loadPage(ctx, page);
      const structure = checkPageStructure(model.body);
      const findings: CheckFinding[] = [...structure.findings];
      const passed = [...structure.passed];
      const raw = checkRawColors(sheets, (await readTokens(ctx)).tokens);
      findings.push(...raw);
      if (raw.length === 0) passed.push("Colors use tokens");
      if (await fs.exists(TASTE_FILE)) {
        const profile = parseTaste(await fs.readText(TASTE_FILE));
        const seen = new Set<string>();
        const files = [{ file: info.file, text: html }, ...sheets.map((s) => ({ file: s.file, text: s.text }))];
        for (const f of files) {
          f.text.split("\n").forEach((lineText, i) => {
            for (const hit of checkBans(profile, lineText, { file: f.file, line: i + 1, path: null })) {
              if (seen.has(hit.id)) continue;
              seen.add(hit.id);
              findings.push(hit);
            }
          });
        }
        if (seen.size === 0) passed.push("No hard bans matched");
        profile.invalid.forEach((bad, i) => findings.push({ id: `taste:invalid:${i}`, kind: "taste", severity: "info",
          title: `Invalid ${bad}`, detail: `Fix it in ${TASTE_FILE}.`, file: TASTE_FILE, line: null, path: null }));
      }
      return { page, findings: sortFindings(findings), passed };
    },
  };
}
