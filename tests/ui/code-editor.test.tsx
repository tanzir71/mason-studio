// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { EditorView } from "codemirror";
import { CodeEditor, languageOf } from "../../src/ui/code/CodeEditor.tsx";

// jsdom has no layout: CodeMirror measures text ranges, so give Range empty rects.
Range.prototype.getClientRects = function () { return [] as unknown as DOMRectList; };
Range.prototype.getBoundingClientRect = function () { return new DOMRect(); };

const viewOf = (container: HTMLElement) => EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;

describe("CodeEditor", () => {
  it("picks the language from the file extension", () => {
    expect([languageOf("a.css"), languageOf("index.HTML"), languageOf("tokens.json"), languageOf(".mason/taste.md")]).toEqual(["css", "html", "json", "text"]);
  });
  it("shows the value and reports edits", () => {
    const onChange = vi.fn();
    const { container } = render(<CodeEditor file="a.css" value={"a {}\nb {}\n"} line={2} onChange={onChange} onSave={() => {}} />);
    const view = viewOf(container);
    expect(view.state.doc.toString()).toBe("a {}\nb {}\n");
    expect(view.state.selection.main.head).toBe(5);
    view.dispatch({ changes: { from: 0, insert: "/* x */\n" } });
    expect(onChange).toHaveBeenCalledWith("/* x */\na {}\nb {}\n");
  });
  it("replaces the document when the value changes from outside", () => {
    const { container, rerender } = render(<CodeEditor file="a.css" value="a {}" line={null} onChange={() => {}} onSave={() => {}} />);
    rerender(<CodeEditor file="a.css" value="z {}" line={null} onChange={() => {}} onSave={() => {}} />);
    expect(viewOf(container).state.doc.toString()).toBe("z {}");
  });
});
