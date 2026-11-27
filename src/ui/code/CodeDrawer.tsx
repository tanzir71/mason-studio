import { X } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button, IconButton } from "../components/Button.tsx";
import { CodeEditor } from "./CodeEditor.tsx";
import "./code.css";

/** Bottom drawer with the open file. Save writes it through the studio (one undo step). */
export function CodeDrawer() {
  const actions = useActions();
  const code = useStudio((s) => s.code);
  const busy = useStudio((s) => s.busy);
  if (!code.open || code.file === null || code.text === null) return null;
  return (
    <section className="m-code" data-testid={TEST_IDS.codeDrawer} aria-label="Code">
      <header className="m-code__head">
        <span className="m-code__file">{code.file}</span>
        {code.dirty && <span className="m-code__dirty" aria-label="Unsaved changes" role="img" />}
        <span className="m-code__spacer" />
        <Button size="sm" variant="primary" disabled={!code.dirty || busy} onClick={() => { void actions.saveCode(); }}>Save</Button>
        <IconButton label="Close code" onClick={() => actions.closeCode()}><X /></IconButton>
      </header>
      <CodeEditor file={code.file} value={code.text} line={code.line}
        onChange={(text) => actions.editCode(text)} onSave={() => { void actions.saveCode(); }} />
    </section>
  );
}
