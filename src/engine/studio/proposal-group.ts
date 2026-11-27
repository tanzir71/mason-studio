import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS, PROP_LABELS, SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { InspectProp, Proposal, ProposalChange, ProposalInput, Scope } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { resolveCascade } from "../css/cascade.ts";
import { checkBans, parseTaste } from "../checks/taste.ts";
import { findNode } from "../html/select.ts";
import { TASTE_FILE } from "./checks-group.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import { planStyles } from "./style-group.ts";
import { commitChanges } from "./write.ts";

export const MAX_PROPOSAL_CHANGES = 20;
const SCOPES: readonly Scope[] = ["all", "tablet", "mobile"];

/** Find a proposal by id or PROPOSAL_NOT_FOUND. */
export function requireProposal(ctx: EngineContext, id: string): Proposal {
  const p = ctx.proposals.find((x) => x.id === id);
  if (!p) throw new MasonError("PROPOSAL_NOT_FOUND", id);
  return p;
}

export function createProposalGroup(ctx: EngineContext): Pick<StudioService, "proposals" | "propose" | "acceptProposal" | "rejectProposal"> {
  const emit = (proposal: Proposal) => ctx.deps.events.emit({ type: "proposal", proposal });
  return {
    async proposals() { return [...ctx.proposals]; },
    /**
     * Validates (summary and source not empty; 1..20 changes; prop in INSPECT_PROPS; scope all/tablet/mobile; value not
     * empty and without ; { }; path exists) → INVALID_INPUT / ELEMENT_NOT_FOUND. Each change gets label
     * `${element name} ${PROP_LABELS[prop]}`, from = the current winning value at the scope's width (or null), and
     * blocked = the first taste ban matching `${prop}: ${value}` (null without .mason/taste.md). Stored newest first.
     */
    async propose(input: ProposalInput) {
      const fs = requireFs(ctx);
      const source = input.source.trim();
      const summary = input.summary.trim();
      if (source === "" || summary === "") throw new MasonError("INVALID_INPUT", "A proposal needs a source and a summary.");
      if (!Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > MAX_PROPOSAL_CHANGES) {
        throw new MasonError("INVALID_INPUT", `A proposal needs 1 to ${MAX_PROPOSAL_CHANGES} changes.`);
      }
      const { model, sheets } = await loadPage(ctx, input.page);
      const profile = (await fs.exists(TASTE_FILE)) ? parseTaste(await fs.readText(TASTE_FILE)) : null;
      const changes: ProposalChange[] = input.changes.map((c) => {
        if (!(INSPECT_PROPS as readonly string[]).includes(c.prop)) throw new MasonError("INVALID_INPUT", `Unknown property ${c.prop}.`);
        if (!SCOPES.includes(c.scope)) throw new MasonError("INVALID_INPUT", `Unknown scope ${c.scope}.`);
        const value = String(c.value ?? "").trim();
        if (value === "" || /[;{}]/.test(value)) throw new MasonError("INVALID_INPUT", `Bad value for ${c.prop}.`);
        const node = findNode(model.body, c.path);
        const el = model.matcher(c.path);
        if (!node || !el) throw new MasonError("ELEMENT_NOT_FOUND", c.path);
        const width = BREAKPOINTS.find((b) => b.id === SCOPE_BREAKPOINT[c.scope])!.width;
        const from = resolveCascade(sheets, el, c.prop, width).find((e) => e.winning)?.declaration.value ?? null;
        const blocked = profile ? checkBans(profile, `${c.prop}: ${value}`, { file: null, line: null, path: c.path })[0] ?? null : null;
        return { path: c.path, prop: c.prop as InspectProp, value, scope: c.scope, label: `${node.name} ${PROP_LABELS[c.prop as InspectProp]}`, from, blocked };
      });
      const proposal: Proposal = { id: ctx.deps.newId(), source, page: input.page, summary, createdAt: ctx.deps.now(), status: "pending", changes };
      ctx.proposals.unshift(proposal);
      emit(proposal);
      return proposal;
    },
    /** Applies the pending proposal's changes (blocked ones only when includeBlocked) as ONE undo step, message `Applied ${n} changes from ${source}`. */
    async acceptProposal(id, includeBlocked) {
      const proposal = requireProposal(ctx, id);
      if (proposal.status !== "pending") throw new MasonError("PROPOSAL_CLOSED", id);
      const chosen = proposal.changes.filter((c) => includeBlocked || c.blocked === null);
      if (chosen.length === 0) throw new MasonError("INVALID_INPUT", "Every change is blocked.");
      const plan = await planStyles(ctx, proposal.page, chosen);
      const noun = chosen.length === 1 ? "change" : "changes";
      const result = await commitChanges(ctx, plan.changes, { message: `Applied ${chosen.length} ${noun} from ${proposal.source}` });
      proposal.status = "accepted";
      emit(proposal);
      return result;
    },
    async rejectProposal(id) {
      const proposal = requireProposal(ctx, id);
      if (proposal.status !== "pending") throw new MasonError("PROPOSAL_CLOSED", id);
      proposal.status = "rejected";
      emit(proposal);
      return proposal;
    },
  };
}
