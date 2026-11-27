import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Scope } from "../../contracts/model.ts";
import { Tabs } from "../components/Tabs.tsx";
import { SCOPE_LABELS, SCOPE_NOTES } from "./design-fields.ts";
import "./design.css";

const ITEMS: readonly { id: Scope; label: string; dot?: string }[] = [
  { id: "all", label: SCOPE_LABELS.all },
  { id: "tablet", label: SCOPE_LABELS.tablet, dot: "var(--bp-tablet)" },
  { id: "mobile", label: SCOPE_LABELS.mobile, dot: "var(--bp-mobile)" },
];

/** "Applies to" switch: which breakpoint the next edit writes to. */
export function ScopeControl() {
  const actions = useActions();
  const scope = useStudio((s) => s.scope);
  return (
    <div className="m-scope" data-testid={TEST_IDS.scopeControl}>
      <span className="m-scope__label">Applies to</span>
      <Tabs<Scope> variant="segmented" label="Applies to" value={scope} onChange={actions.setScope} items={ITEMS} />
      <p className="m-scope__note">{SCOPE_NOTES[scope]}</p>
    </div>
  );
}
