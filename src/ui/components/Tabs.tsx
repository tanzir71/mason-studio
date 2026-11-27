import { cx } from "./Button.tsx";
import "./primitives.css";

export interface TabItem<T extends string> { id: T; label: string; dot?: string }
export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange(id: T): void;
  /** "tabs" for panel headers, "segmented" for the filled switch (Applies to). */
  variant?: "tabs" | "segmented";
  label: string;
  testId?: string;
}
export function Tabs<T extends string>({ items, value, onChange, variant = "tabs", label, testId }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cx("m-tabs", variant === "segmented" && "m-tabs--segmented")} data-testid={testId}>
      {items.map((item) => (
        <button
          key={item.id} type="button" role="tab" aria-selected={item.id === value} className="m-tabs__tab"
          onClick={() => { if (item.id !== value) onChange(item.id); }}
        >
          {item.dot && <span className="m-dot" style={{ background: item.dot }} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
