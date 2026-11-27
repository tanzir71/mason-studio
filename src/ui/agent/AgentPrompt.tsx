import { useState } from "react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./agent.css";

/** "Ask agent" box for the selected layer. Mod+Enter sends; Escape closes. */
export function AgentPrompt() {
  const actions = useActions();
  const open = useStudio((s) => s.agentPrompt.open);
  const busy = useStudio((s) => s.agentPrompt.busy);
  const name = useStudio((s) => s.inspect?.name ?? null);
  const model = useStudio((s) => s.settings?.agent.model ?? null);
  const [text, setText] = useState("");
  if (!open) return null;
  const send = () => { if (text.trim() !== "" && !busy) void actions.askAgent(text.trim()); };
  return (
    <section className="m-ask" data-testid={TEST_IDS.agentPrompt} aria-label="Ask agent">
      <span className="m-ask__label">{`Ask ${model ?? "the agent"} about ${name ?? "this layer"}. Changes come back as a proposal.`}</span>
      <textarea className="m-ask__input" aria-label="Request" autoFocus value={text} disabled={busy}
        placeholder="Make the headline tighter on tablets"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          if (e.key === "Escape") { e.preventDefault(); actions.closeAgentPrompt(); }
        }} />
      <div className="m-ask__row">
        <Button variant="ghost" size="sm" onClick={() => actions.closeAgentPrompt()}>Cancel</Button>
        <Button variant="primary" size="sm" disabled={busy || text.trim() === ""} onClick={send}>{busy ? "Asking…" : "Ask"}</Button>
      </div>
    </section>
  );
}
