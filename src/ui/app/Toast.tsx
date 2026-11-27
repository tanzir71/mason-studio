import { useEffect } from "react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./app.css";

export const TOAST_MS = 5000;

export function Toast() {
  const actions = useActions();
  const toast = useStudio((s) => s.toast);
  const id = toast?.id ?? null;
  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(() => actions.dismissToast(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, actions]);
  if (!toast) return null;
  return (
    <div className={`m-toast m-toast--${toast.tone}`} role="status" data-testid={TEST_IDS.toast}>
      <span className="m-dot" />
      <span>{toast.text}</span>
      {toast.undo && <Button size="sm" variant="secondary" onClick={() => { actions.dismissToast(); void actions.undo(); }}>Undo</Button>}
    </div>
  );
}
