// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Board, measureHeight } from "../../src/ui/canvas/Board.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";

const page = { name: "Home", file: "index.html", title: "Home", stylesheets: [] };

describe("Board", () => {
  it("renders the label, the iframe and its children", () => {
    render(<Board page={page} bp={BREAKPOINTS[1]} revision={3} active onActivate={() => {}} onFrame={() => {}}><span>overlay</span></Board>);
    const board = screen.getByTestId("board-Home-tablet");
    expect(board).toHaveClass("m-board", "is-active");
    expect(board).toHaveTextContent("Tablet≤ 768");
    const frame = screen.getByTitle("Home Tablet");
    expect(frame).toHaveAttribute("src", "/p/index.html?r=3");
    expect(frame).toHaveAttribute("width", "768");
    expect(screen.getByText("overlay")).toBeInTheDocument();
  });
  it("activates on label click and reports the frame on load", () => {
    const onActivate = vi.fn();
    const onFrame = vi.fn();
    render(<Board page={page} bp={BREAKPOINTS[0]} revision={0} active={false} onActivate={onActivate} onFrame={onFrame} />);
    fireEvent.click(screen.getByRole("button", { name: /Desktop/ }));
    fireEvent.load(screen.getByTitle("Home Desktop"));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledWith(screen.getByTitle("Home Desktop"));
  });
  it("clamps the measured height", () => {
    const doc = (h: number) => ({ documentElement: { scrollHeight: h } } as unknown as Document);
    expect([measureHeight(null), measureHeight(doc(0)), measureHeight(doc(120)), measureHeight(doc(2400)), measureHeight(doc(9000))]).toEqual([900, 900, 400, 2400, 6000]);
  });
});
