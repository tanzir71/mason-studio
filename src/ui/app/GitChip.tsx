import { useState } from "react";
import { GitBranch } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./app.css";

/** "N changes · Commit" chip with a small commit box. The store refreshes `git` whenever the page reloads. */
export function GitChip() {
  const actions = useActions();
  const git = useStudio((s) => s.git);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  if (!git || !git.isRepo) {
    return <span className="m-status m-git is-off" data-testid={TEST_IDS.gitChip}><GitBranch size={14} />No Git</span>;
  }
  const submit = () => { if (message.trim()) { void actions.commit(message.trim()); setMessage(""); setOpen(false); } };
  return (
    <div className="m-anchor m-git" data-testid={TEST_IDS.gitChip}>
      <span className="m-status"><GitBranch size={14} />{git.changes === 1 ? "1 change" : `${git.changes} changes`}</span>
      <Button size="sm" variant="secondary" disabled={git.changes === 0} onClick={() => setOpen(!open)}>Commit</Button>
      {open && (
        <div className="m-menu m-commit" role="dialog" aria-label="Commit">
          <input className="m-input" aria-label="Commit message" autoFocus placeholder={`Commit to ${git.branch ?? "this branch"}`} value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
          <Button size="sm" variant="primary" disabled={message.trim() === ""} onClick={submit}>Commit</Button>
        </div>
      )}
    </div>
  );
}
