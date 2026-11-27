// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Field, Section } from "../../src/ui/components/Field.tsx";
import { Tabs } from "../../src/ui/components/Tabs.tsx";

describe("Field", () => {
  it("commits a changed value on Enter", async () => {
    const onCommit = vi.fn();
    render(<Field label="Font size" prefix="Size" value="32" onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    await userEvent.clear(input);
    await userEvent.type(input, " 36 {Enter}");
    expect(onCommit).toHaveBeenCalledWith("36");
  });
  it("does not commit an unchanged or empty value and reverts on Escape", async () => {
    const onCommit = vi.fn();
    render(<Field label="Width" value="Fill" onCommit={onCommit} />);
    const input = screen.getByLabelText("Width");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue("Fill");
    await userEvent.type(input, "x{Escape}");
    expect(input).toHaveValue("Fill");
    expect(onCommit).not.toHaveBeenCalled();
  });
  it("shows prefix, suffix and the override border", () => {
    render(<Field label="Gap" prefix="Gap" suffix="24" value="space.5" override mono testId="gap" onCommit={() => {}} />);
    const field = screen.getByTestId("gap");
    expect(field).toHaveClass("m-field", "is-override", "is-mono");
    expect(field).toHaveTextContent("Gap24");
  });
  it("follows a new value from props", () => {
    const { rerender } = render(<Field label="Size" value="32" onCommit={() => {}} />);
    rerender(<Field label="Size" value="28" onCommit={() => {}} />);
    expect(screen.getByLabelText("Size")).toHaveValue("28");
  });
});

describe("Tabs and Section", () => {
  it("marks the selected tab and reports changes", async () => {
    const onChange = vi.fn();
    render(<Tabs label="Panel" value="design" onChange={onChange} items={[{ id: "design", label: "Design" }, { id: "checks", label: "Checks" }]} />);
    expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Design" }));
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("checks");
  });
  it("renders the segmented variant with dots", () => {
    render(<Tabs variant="segmented" label="Applies to" value="all" onChange={() => {}} items={[{ id: "all", label: "All sizes" }, { id: "tablet", label: "≤ 768", dot: "teal" }]} />);
    expect(screen.getByRole("tablist", { name: "Applies to" })).toHaveClass("m-tabs--segmented");
    expect(screen.getByRole("tab", { name: "≤ 768" }).querySelector(".m-dot")).not.toBeNull();
  });
  it("renders a section with title, action and body", () => {
    render(<Section title="Layout" action={<button type="button">Add</button>} testId="layout"><p>body</p></Section>);
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByTestId("layout")).toHaveTextContent("LayoutAddbody");
  });
});
