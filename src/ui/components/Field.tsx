import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "./Button.tsx";
import "./primitives.css";

export interface FieldProps {
  /** Accessible name of the input (aria-label). */
  label: string;
  value: string;
  onCommit(value: string): void;
  /** Short visible label inside the field, e.g. "W" or "Size". */
  prefix?: string;
  /** Small mono text after the input, e.g. a token value. */
  suffix?: string;
  /** Tablet/mobile override: tinted border. */
  override?: boolean;
  mono?: boolean;
  placeholder?: string;
  testId?: string;
  /** Suggestions shown by the browser while typing (a <datalist>). */
  options?: readonly string[];
}
/**
 * Text field that commits on Enter or blur (only when the trimmed draft is not empty, differs from `value` and was
 * not just committed) and reverts on Escape.
 */
export function Field({ label, value, onCommit, prefix, suffix, override = false, mono = false, placeholder, testId, options }: FieldProps) {
  const listId = useId();
  const [draft, setDraft] = useState(value);
  const committed = useRef<string | null>(null);
  useEffect(() => { setDraft(value); committed.current = null; }, [value]);
  const commit = () => {
    const next = draft.trim();
    if (next === "" || next === value) { setDraft(value); return; }
    if (next === committed.current) return;
    committed.current = next;
    onCommit(next);
  };
  return (
    <label className={cx("m-field", override && "is-override", mono && "is-mono")} data-testid={testId}>
      {prefix && <span className="m-field__prefix">{prefix}</span>}
      <input
        className="m-field__input" aria-label={label} value={draft} placeholder={placeholder} spellCheck={false}
        list={options && options.length > 0 ? listId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); }
        }}
      />
      {suffix && <span className="m-field__suffix">{suffix}</span>}
      {options && options.length > 0 && (
        <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      )}
    </label>
  );
}

export interface SectionProps { title: string; action?: ReactNode; children?: ReactNode; testId?: string }
export function Section({ title, action, children, testId }: SectionProps) {
  return (
    <section className="m-section" data-testid={testId}>
      <header className="m-section__head">
        <h3 className="m-section__title">{title}</h3>
        {action}
      </header>
      {children && <div className="m-section__body">{children}</div>}
    </section>
  );
}
