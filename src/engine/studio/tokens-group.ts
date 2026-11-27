import { MasonError } from "../../contracts/errors.ts";
import type { TokenSet } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { parseDtcg, serializeDtcg } from "../tokens/dtcg.ts";
import { fromTokensStudio } from "../tokens/tokens-studio.ts";
import { tokensToCss } from "../tokens/to-css.ts";
import { requireFs, requireProject } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { commitChanges } from "./write.ts";

export const TOKENS_FILE = "tokens.json";
export const TOKENS_CSS = "tokens.css";

/** tokens.json parsed, or { tokens: [], file: null } when the project has none. */
export async function readTokens(ctx: EngineContext): Promise<TokenSet> {
  const fs = requireFs(ctx);
  if (!(await fs.exists(TOKENS_FILE))) return { tokens: [], file: null };
  return parseDtcg(await fs.readText(TOKENS_FILE), TOKENS_FILE);
}

export function createTokensGroup(ctx: EngineContext): Pick<StudioService, "tokens" | "importTokens" | "exportTokens"> {
  return {
    tokens: () => readTokens(ctx),
    async importTokens(format, json) {
      if (format !== "dtcg" && format !== "tokens-studio") throw new MasonError("INVALID_INPUT", format);
      const project = requireProject(ctx);
      const parsed = format === "dtcg" ? parseDtcg(json, TOKENS_FILE) : fromTokensStudio(json);
      const set: TokenSet = { tokens: parsed.tokens, file: TOKENS_FILE };
      const text = serializeDtcg(set);
      await commitChanges(ctx, [{ path: TOKENS_FILE, after: text }, { path: TOKENS_CSS, after: tokensToCss(set) }],
        { message: `Imported ${set.tokens.length} tokens` });
      ctx.project = { ...project, hasTokens: true };
      return parseDtcg(text, TOKENS_FILE);
    },
    async exportTokens() {
      const fs = requireFs(ctx);
      if (!(await fs.exists(TOKENS_FILE))) throw new MasonError("FILE_NOT_FOUND", TOKENS_FILE);
      const css = tokensToCss(await readTokens(ctx));
      const current = (await fs.exists(TOKENS_CSS)) ? await fs.readText(TOKENS_CSS) : null;
      if (current === css) return { files: [], revision: ctx.revision, effective: true, path: null, message: "tokens.css is up to date." };
      return commitChanges(ctx, [{ path: TOKENS_CSS, after: css }]);
    },
  };
}
