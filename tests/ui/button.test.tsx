// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Button, Chip, IconButton, cx } from "../../src/ui/components/Button.tsx";

describe("Button primitives", () => {
  it("joins truthy class names", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
  it("renders a typed button with variant classes and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" size="sm" onClick={onClick}>Commit</Button>);
    const button = screen.getByRole("button", { name: "Commit" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("m-btn", "m-btn--primary", "m-btn--sm");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("labels icon buttons and reflects the active state", () => {
    render(<IconButton label="Hand" active><svg /></IconButton>);
    const button = screen.getByRole("button", { name: "Hand" });
    expect(button).toHaveAttribute("title", "Hand");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("m-icon-btn", "is-active");
  });
  it("renders chips with a dot and meta text", () => {
    render(<Chip active dot="red" meta="≤ 768">Tablet</Chip>);
    const chip = screen.getByRole("button", { name: /Tablet/ });
    expect(chip).toHaveClass("m-chip", "is-active");
    expect((chip.querySelector(".m-dot") as HTMLElement).style.background).toBe("red");
    expect(chip).toHaveTextContent("Tablet≤ 768");
  });
});
