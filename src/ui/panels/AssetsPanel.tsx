import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Token, TokenFormat, TokenType } from "../../contracts/model.ts";
import { Button } from "../components/Button.tsx";
import "./panels.css";
import "./assets.css";
import "./design.css";

const TYPE_TITLES: Record<TokenType, string> = { color: "Colors", dimension: "Sizes", fontFamily: "Fonts", fontWeight: "Weights", number: "Numbers" };
const TYPE_ORDER: readonly TokenType[] = ["color", "dimension", "fontFamily", "fontWeight", "number"];
const CHIPS: Record<Exclude<TokenType, "color">, string> = { dimension: "px", fontFamily: "Aa", fontWeight: "B", number: "#" };

/** "tokens-studio" when the JSON has $metadata or $themes, or any object with both "value" and "type" and no "$value"; else "dtcg". */
export function detectTokenFormat(json: string): TokenFormat {
  let root: unknown;
  try { root = JSON.parse(json); } catch { return "dtcg"; }
  if (typeof root !== "object" || root === null) return "dtcg";
  if ("$metadata" in root || "$themes" in root) return "tokens-studio";
  const walk = (v: unknown): boolean => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
    if ("value" in v && "type" in v && !("$value" in v)) return true;
    return Object.values(v).some(walk);
  };
  return walk(root) ? "tokens-studio" : "dtcg";
}

function TokenRow({ token }: { token: Token }) {
  return (
    <div className="m-token" data-token={token.name}>
      {token.type === "color"
        ? <span className="m-swatch" style={{ background: token.value }} />
        : <span className="m-token__chip" aria-hidden="true">{CHIPS[token.type]}</span>}
      <span className="m-token__name">{token.name}</span>
      <span className="m-token__value">{token.alias ? `→ ${token.alias}` : token.value}</span>
    </div>
  );
}

export function AssetsPanel() {
  const actions = useActions();
  const tokens = useStudio((s) => s.tokens);
  const list = tokens?.tokens ?? [];
  return (
    <div className="m-panel-scroll" data-testid={TEST_IDS.assetsPanel}>
      <div className="m-group">
        <div className="m-group__head">
          <h2 className="m-group__title">Tokens</h2>
          <span className="m-row__meta">{list.length}</span>
        </div>
        {list.length === 0 && <p className="m-assets-empty">No tokens.json yet. Import a DTCG or Tokens Studio file.</p>}
        {TYPE_ORDER.map((type) => {
          const ofType = list.filter((t) => t.type === type);
          if (ofType.length === 0) return null;
          return (
            <div key={type}>
              <h3 className="m-assets-type">{TYPE_TITLES[type]}</h3>
              {ofType.map((t) => <TokenRow key={t.name} token={t} />)}
            </div>
          );
        })}
      </div>
      <div className="m-assets-actions">
        <label className="m-btn m-btn--secondary m-file-button">
          Import tokens
          <input type="file" accept=".json,application/json" aria-label="Import tokens file"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              const json = await file.text();
              await actions.importTokens(detectTokenFormat(json), json);
            }} />
        </label>
        <Button variant="ghost" disabled={list.length === 0} onClick={() => { void actions.exportTokens(); }}>Write tokens.css</Button>
      </div>
    </div>
  );
}
