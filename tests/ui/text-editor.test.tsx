// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TextEditor } from "../../src/ui/canvas/TextEditor.tsx";


function frameWith(html: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  frame.contentDocument!.body.innerHTML = html;
  return frame;
}

describe("TextEditor", () => {
  it("commits changed text on Enter, once", () => {
    const frame = frameWith("<main><h1>Old  title</h1></main>");
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<TextEditor frame={frame} path="0.0" onCommit={onCommit} onClose={onClose} />);
    const box = screen.getByLabelText("Edit text");
    expect(box).toHaveValue("Old title");
    fireEvent.change(box, { target: { value: "New title" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("New title");
    expect(onClose).toHaveBeenCalledTimes(1);
    frame.remove();
  });
  it("closes without saving on Escape or when nothing changed", () => {
    const frame = frameWith("<main><h1>Same</h1></main>");
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<TextEditor frame={frame} path="0.0" onCommit={onCommit} onClose={onClose} />);
    fireEvent.keyDown(screen.getByLabelText("Edit text"), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    frame.remove();
  });
});
