import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Proposal, Scope } from "../../contracts/model.ts";
import { Button, cx } from "../components/Button.tsx";
import "./agent.css";

const SCOPE_TEXT: Record<Scope, string> = { all: "all sizes", tablet: "≤ 768", mobile: "≤ 375" };

/** "32px → 30px · ≤ 768"; "new → 30px" when nothing was set. */
export function changeLine(from: string | null, value: string, scope: Scope): string {
  return `${from ?? "new"} → ${value} · ${SCOPE_TEXT[scope]}`;
}

/** Review card for the newest pending proposal. Nothing is written until Accept. */
export function ReviewCard() {
  const actions = useActions();
  const proposals = useStudio((s) => s.proposals);
  const busy = useStudio((s) => s.busy);
  const pending = proposals.filter((p) => p.status === "pending");
  const proposal: Proposal | undefined = pending[0];
  if (!proposal) return null;
  const allowed = proposal.changes.filter((c) => c.blocked === null).length;
  const blocked = proposal.changes.length - allowed;
  return (
    <section className="m-review" data-testid={TEST_IDS.reviewCard} aria-label="Proposed changes">
      <header className="m-review__head">
        <h2 className="m-review__title"><span className="m-dot" />{`${proposal.source} proposes ${proposal.changes.length} ${proposal.changes.length === 1 ? "change" : "changes"}`}</h2>
        <span className="m-review__meta">{proposal.summary}</span>
        <span className="m-review__meta">{`${proposal.page} · nothing is saved until you accept`}</span>
      </header>
      <ol className="m-review__list">
        {proposal.changes.map((c, i) => (
          <li key={i} className={cx("m-change", c.blocked !== null && "is-blocked")}>
            <span className="m-change__num">{i + 1}</span>
            <span className="m-change__label">{c.label}</span>
            <span className="m-change__value">{changeLine(c.from, c.value, c.scope)}</span>
            {c.blocked && <span className="m-change__blocked">{`Blocked: ${c.blocked.title}`}</span>}
          </li>
        ))}
      </ol>
      <footer className="m-review__actions">
        <Button variant="primary" size="sm" disabled={busy || allowed === 0} onClick={() => { void actions.acceptProposal(proposal.id, false); }}>
          {`Accept ${allowed}`}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void actions.rejectProposal(proposal.id); }}>Reject</Button>
        <span className="m-review__spacer" />
        {blocked > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void actions.acceptProposal(proposal.id, true); }}>Accept all</Button>}
        {pending.length > 1 && <span className="m-review__more">{`+${pending.length - 1} more`}</span>}
      </footer>
    </section>
  );
}
