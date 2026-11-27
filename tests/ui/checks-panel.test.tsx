// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChecksPanel, summaryText } from "../../src/ui/panels/ChecksPanel.tsx";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { CheckFinding, CheckReport } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const ban: CheckFinding = { id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "styles.css", line: 67, path: null };
const alt: CheckFinding = { id: "a11y:alt:0.1", kind: "a11y", severity: "warning", title: "Image has no alt text", detail: "", file: null, line: null, path: "0.1" };
const report: CheckReport = { page: "Home", findings: [ban], passed: ["Headings in order"] };

describe("ChecksPanel", () => {
  it("summarizes findings by severity", () => {
    expect(summaryText([ban, alt, alt])).toBe("1 blocked · 2 warnings · 0 notes");
  });
  it("runs checks and contrast when it opens without a report", () => {
    const store = createFakeStore({ screen: "canvas", page: "Home" });
    render(<StudioContext.Provider value={store}><ChecksPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("checks-panel")).toHaveTextContent("Not run yet");
    expect(store.calls).toEqual([{ name: "runChecks", args: [] }, { name: "setContrast", args: [[]] }]);
  });
  it("lists findings with links and the passed checks", async () => {
    const store = createFakeStore({ screen: "canvas", page: "Home", checks: report, contrast: [alt] });
    render(<StudioContext.Provider value={store}><ChecksPanel /></StudioContext.Provider>);
    const panel = screen.getByTestId("checks-panel");
    expect(panel).toHaveTextContent("1 blocked · 1 warnings · 0 notes");
    const items = within(panel).getAllByRole("listitem").map((li) => li.getAttribute("data-finding"));
    expect(items.slice(0, 2)).toEqual(["taste:11", "a11y:alt:0.1"]);
    await userEvent.click(screen.getByRole("button", { name: "styles.css:67" }));
    await userEvent.click(screen.getByRole("button", { name: "Select layer" }));
    expect(store.calls).toEqual([{ name: "openCode", args: ["styles.css", 67] }, { name: "select", args: ["0.1"] }]);
    expect(within(screen.getByRole("list", { name: "Passed" })).getByText("Headings in order")).toBeInTheDocument();
  });
  it("is the Checks tab of the right panel", () => {
    render(<StudioContext.Provider value={createFakeStore({ rightTab: "checks", page: "Home", checks: report })}><RightPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
  });
});
