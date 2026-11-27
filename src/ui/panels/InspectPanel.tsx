import { Copy } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import { IconButton, cx } from "../components/Button.tsx";
import "./inspect.css";

/** Cascade rules of the selection at the active board's breakpoint; file:line links open the code drawer. */
export function InspectPanel() {
  const actions = useActions();
  const selection = useStudio((s) => s.selection);
  const inspect = useStudio((s) => s.inspect);
  const activeBoard = useStudio((s) => s.activeBoard);
  if (selection === null) return <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Select a layer to see its CSS.</div>;
  if (!inspect || inspect.path !== selection) return <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Loading CSS…</div>;
  const bp = BREAKPOINTS.find((b) => b.id === activeBoard)!;
  const rows = inspect.rules[activeBoard];
  return (
    <div className="m-inspect" data-testid={TEST_IDS.inspectPanel}>
      <div className="m-inspect__selector">
        <code>{inspect.selector}</code>
        <IconButton label="Copy selector" onClick={() => { void navigator.clipboard?.writeText(inspect.selector); }}><Copy /></IconButton>
      </div>
      <span className="m-inspect__bp">{`Rules at ${bp.label} ${bp.width}px`}</span>
      {rows.length === 0 && <p className="m-empty">No rules match this element.</p>}
      {rows.map((row) => (
        <section key={`${row.rule.file}:${row.rule.line}`} className={cx("m-rule", !row.applies && "is-inactive")} data-rule={`${row.rule.file}:${row.rule.line}`}>
          <header className="m-rule__head">
            <span className="m-rule__sel">
              {row.rule.selector}
              {row.rule.media && <span className="m-rule__media">{`@media ${row.rule.media}`}</span>}
            </span>
            <button type="button" className="m-rule__link" onClick={() => { void actions.openCode(row.rule.file, row.rule.line); }}>
              {`${row.rule.file}:${row.rule.line}`}
            </button>
          </header>
          <ul className="m-rule__decls">
            {row.declarations.map((d, i) => (
              <li key={i} className={cx("m-rule__decl", d.status === "overridden" && "is-overridden")} data-status={d.status}>
                <span className="m-rule__prop">{d.prop}</span>{`: ${d.value};`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
