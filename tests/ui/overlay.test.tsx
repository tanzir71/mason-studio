// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Overlay } from "../../src/ui/canvas/Overlay.tsx";

function frameWith(html: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  frame.contentDocument!.body.innerHTML = html;
  return frame;
}

describe("Overlay", () => {
  it("draws the selection box with its size", () => {
    const frame = frameWith("<header></header><main><h1>Hi</h1></main>");
    const h1 = frame.contentDocument!.querySelector("h1")!;
    h1.getBoundingClientRect = () => ({ left: 64, top: 120.4, width: 420, height: 70 } as DOMRect);
    render(<Overlay frame={frame} path="1.0" kind="selection" version="1" />);
    const box = screen.getByTestId("overlay-selection");
    expect(box).toHaveClass("m-ov", "m-ov--selection");
    expect(box).toHaveStyle({ left: "64px", top: "120px", width: "420px", height: "70px" });
    expect(box).toHaveTextContent("420 × 70");
    frame.remove();
  });
  it("draws mirrors without a size label", () => {
    const frame = frameWith("<main></main>");
    render(<Overlay frame={frame} path="0" kind="mirror" version="1" />);
    expect(screen.getByTestId("overlay-mirror")).toHaveTextContent("");
    frame.remove();
  });
  it("renders nothing without a frame, a path or a matching element", () => {
    const frame = frameWith("<main></main>");
    const { container } = render(<><Overlay frame={null} path="0" kind="hover" version="1" /><Overlay frame={frame} path={null} kind="hover" version="1" /><Overlay frame={frame} path="4" kind="hover" version="1" /></>);
    expect(container.innerHTML).toBe("");
    frame.remove();
  });
});
