// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ReviewCard, changeLine } from "../../src/ui/agent/ReviewCard.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { CheckFinding, Proposal } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const ban = { id: "taste:12", title: "No stock AI purple" } as CheckFinding;
const proposal: Proposal = { id: "p1", source: "Claude Code", page: "Home", summary: "Tighter tablet headline", createdAt: 1, status: "pending", changes: [
  { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet", label: "Headline size", from: "32px", blocked: null },
  { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all", label: "Hero fill", from: null, blocked: ban },
] };

describe("ReviewCard", () => {
  it("formats a change line", () => {
    expect(changeLine("32px", "30px", "tablet")).toBe("32px → 30px · ≤ 768");
    expect(changeLine(null, "0", "all")).toBe("new → 0 · all sizes");
  });
  it("shows the newest pending proposal with blocked changes", () => {
    render(<StudioContext.Provider value={createFakeStore({ proposals: [proposal] })}><ReviewCard /></StudioContext.Provider>);
    const card = screen.getByTestId("review-card");
    expect(card).toHaveTextContent("Claude Code proposes 2 changes");
    expect(card).toHaveTextContent("Tighter tablet headline");
    const items = within(card).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Headline size32px → 30px · ≤ 768");
    expect(items[1]).toHaveClass("is-blocked");
    expect(items[1]).toHaveTextContent("Blocked: No stock AI purple");
    expect(screen.getByRole("button", { name: "Accept 1" })).toBeEnabled();
  });
  it("accepts allowed changes, accepts all, or rejects", async () => {
    const store = createFakeStore({ proposals: [proposal] });
    render(<StudioContext.Provider value={store}><ReviewCard /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Accept 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(store.calls).toEqual([{ name: "acceptProposal", args: ["p1", false] }, { name: "acceptProposal", args: ["p1", true] }, { name: "rejectProposal", args: ["p1"] }]);
  });
  it("hides when nothing is pending", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore({ proposals: [{ ...proposal, status: "accepted" }] })}><ReviewCard /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});
