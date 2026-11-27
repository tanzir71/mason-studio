// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ToolDock } from "../../src/ui/app/ToolDock.tsx";
import { Toast, TOAST_MS } from "../../src/ui/app/Toast.tsx";
import { comboOf, isTyping, matchShortcut, runShortcut } from "../../src/ui/app/shortcuts.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
const key = (k: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; code: string }> = {}) =>
  ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("shortcuts", () => {
  it("builds key combos with shift and mod", () => {
    expect(comboOf(key("Z", { shiftKey: true, ctrlKey: true }), false)).toBe("shift+mod+z");
    expect(comboOf(key("!", { shiftKey: true, code: "Digit1" }), false)).toBe("shift+1");
    expect(comboOf(key("i", { metaKey: true }), true)).toBe("mod+i");
    expect(comboOf(key("i", { metaKey: true }), false)).toBe("i");
  });
  it("matches the contract shortcuts", () => {
    expect(matchShortcut(key("v"), false)).toBe("tool:move");
    expect(matchShortcut(key("A", { shiftKey: true }), false)).toBe("wrap");
    expect(matchShortcut(key("z", { ctrlKey: true }), false)).toBe("undo");
    expect(matchShortcut(key("Backspace"), false)).toBe("delete");
    expect(matchShortcut(key("v", { altKey: true }), false)).toBeNull();
    expect(matchShortcut(key("q"), false)).toBeNull();
  });
  it("runs shortcut actions against the store", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", selection: "1", zoom: 0.5 });
    for (const a of ["tool:rect", "delete", "deselect", "zoom:in", "code", "undo"] as const) runShortcut(a, store, 900);
    expect(store.calls.map((c) => c.name)).toEqual(["setTool", "removeSelected", "select", "setZoom", "openCode", "undo"]);
    expect(store.calls[0].args).toEqual(["rect"]);
    expect(store.calls[4].args).toEqual(["index.html", null]);
  });
  it("does not delete or wrap without a selection", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    runShortcut("delete", store, 900);
    runShortcut("wrap", store, 900);
    expect(store.calls).toEqual([]);
  });
  it("recognises typing targets", () => {
    expect(isTyping(document.createElement("input"))).toBe(true);
    expect(isTyping(document.createElement("div"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("ToolDock and Toast", () => {
  it("sets tools and opens the agent prompt", async () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", tool: "move" });
    render(<StudioContext.Provider value={store}><ToolDock /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Text (T)" }));
    await userEvent.click(screen.getByRole("button", { name: "Ask agent (Mod+I)" }));
    await userEvent.click(screen.getByRole("button", { name: "Code (Mod+E)" }));
    expect(store.calls).toEqual([{ name: "setTool", args: ["text"] }, { name: "openAgentPrompt", args: [] }, { name: "openCode", args: ["index.html", null] }]);
  });
  it("shows a toast with undo and dismisses it after a delay", () => {
    vi.useFakeTimers();
    const store = createFakeStore({ toast: { id: 1, tone: "success", text: "Saved to styles.css", undo: true } });
    render(<StudioContext.Provider value={store}><Toast /></StudioContext.Provider>);
    expect(screen.getByTestId("toast")).toHaveTextContent("Saved to styles.cssUndo");
    act(() => { screen.getByRole("button", { name: "Undo" }).click(); });
    act(() => { vi.advanceTimersByTime(TOAST_MS); });
    expect(store.calls.map((c) => c.name)).toEqual(["dismissToast", "undo", "dismissToast"]);
    vi.useRealTimers();
  });
});
