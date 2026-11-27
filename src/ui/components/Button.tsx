import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./primitives.css";

/** Joins the truthy class names with spaces. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}
export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cx("m-btn", `m-btn--${variant}`, size === "sm" && "m-btn--sm", className)} {...rest} />;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}
/** Square icon button. `label` becomes aria-label and title; `active` sets aria-pressed and the accent fill. */
export function IconButton({ label, active = false, className, type = "button", ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} aria-pressed={active} className={cx("m-icon-btn", active && "is-active", className)} {...rest} />;
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** CSS color of the leading dot; no dot when omitted. */
  dot?: string;
  /** Small mono text after the label, e.g. "1280" or "≤ 768". */
  meta?: string;
  children: ReactNode;
}
export function Chip({ active = false, dot, meta, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cx("m-chip", active && "is-active", className)} {...rest}>
      {dot && <span className="m-dot" style={{ background: dot }} />}
      {children}
      {meta && <span className="m-chip__meta">{meta}</span>}
    </button>
  );
}
