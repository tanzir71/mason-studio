import { useContext, useEffect } from "react";
import { Check } from "lucide-react";
import { StudioContext, TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { CheckFinding } from "../../contracts/model.ts";
import { Button } from "../components/Button.tsx";
import { collectContrast } from "../canvas/contrast.ts";
import "./checks.css";

const ORDER = { blocked: 0, warning: 1, info: 2 } as const;

/** The open page's desktop board document, found by its test id. */
export function desktopDocument(page: string): Document | null {
  const frame = document.querySelector(`[data-testid="${TEST_IDS.board}${page}-desktop"] iframe`) as HTMLIFrameElement | null;
  return frame?.contentDocument ?? null;
}

export function summaryText(findings: CheckFinding[]): string {
  const n = (s: CheckFinding["severity"]) => findings.filter((f) => f.severity === s).length;
  return `${n("blocked")} blocked · ${n("warning")} warnings · ${n("info")} notes`;
}

export function ChecksPanel() {
  const store = useContext(StudioContext)!;
  const actions = useActions();
  const page = useStudio((s) => s.page);
  const checks = useStudio((s) => s.checks);
  const contrast = useStudio((s) => s.contrast);
  const run = () => {
    const current = store.getState().page;
    if (current === null) return;
    void actions.runChecks();
    const doc = desktopDocument(current);
    actions.setContrast(doc ? collectContrast(doc) : []);
  };
  useEffect(() => { if (store.getState().checks === null) run(); }, [page]);
  const findings = [...(checks?.findings ?? []), ...contrast].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const passed = [...(checks?.passed ?? []), ...(checks && contrast.length === 0 ? ["Text contrast passes"] : [])];
  return (
    <div className="m-checks" data-testid={TEST_IDS.checksPanel}>
      <div className="m-checks__bar">
        <span className="m-checks__summary">{checks ? summaryText(findings) : "Not run yet"}</span>
        <Button size="sm" variant="secondary" onClick={run}>Run checks</Button>
      </div>
      {!checks && <p className="m-checks__intro">Checks look for taste bans, accessibility issues and raw colors on this page.</p>}
      {findings.length > 0 && (
        <ul className="m-findings">
          {findings.map((f) => (
            <li key={f.id} className={`m-finding m-finding--${f.severity}`} data-finding={f.id}>
              <span className="m-dot" />
              <span className="m-finding__title">{f.title}</span>
              {f.detail && <span className="m-finding__detail">{f.detail}</span>}
              {(f.file || f.path !== null) && (
                <span className="m-finding__where">
                  {f.file && (
                    <button type="button" className="m-finding__link" onClick={() => { void actions.openCode(f.file!, f.line); }}>
                      {f.line ? `${f.file}:${f.line}` : f.file}
                    </button>
                  )}
                  {f.path !== null && <button type="button" className="m-finding__link" onClick={() => actions.select(f.path)}>Select layer</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <ul className="m-passed" aria-label="Passed">
          {passed.map((p) => <li key={p}><Check aria-hidden="true" />{p}</li>)}
        </ul>
      )}
    </div>
  );
}
