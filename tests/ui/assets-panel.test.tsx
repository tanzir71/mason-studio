// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AssetsPanel, detectTokenFormat } from "../../src/ui/panels/AssetsPanel.tsx";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tokens = parseDtcg(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"), "tokens.json");
const renderPanel = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", tokens, ...state });
  render(<StudioContext.Provider value={store}><AssetsPanel /></StudioContext.Provider>);
  return store;
};

describe("AssetsPanel", () => {
  it("detects the token file format", () => {
    expect(detectTokenFormat(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"))).toBe("dtcg");
    expect(detectTokenFormat('{ "core": { "a": { "value": "#000", "type": "color" } } }')).toBe("tokens-studio");
    expect(detectTokenFormat('{ "$metadata": {} }')).toBe("tokens-studio");
    expect(detectTokenFormat("nope")).toBe("dtcg");
  });
  it("groups tokens by type with swatches and values", () => {
    renderPanel();
    const panel = screen.getByTestId("assets-panel");
    expect(within(panel).getByText("Colors")).toBeInTheDocument();
    expect(within(panel).getByText("Fonts")).toBeInTheDocument();
    const ink = panel.querySelector('[data-token="color.ink"]')!;
    expect(ink).toHaveTextContent("color.ink#1e2a22");
    expect((ink.querySelector(".m-swatch") as HTMLElement).style.background).not.toBe("");
  });
  it("explains the empty state", () => {
    renderPanel({ tokens: { tokens: [], file: null } });
    expect(screen.getByText("No tokens.json yet. Import a DTCG or Tokens Studio file.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write tokens.css" })).toBeDisabled();
  });
  it("imports a chosen file with the detected format and writes tokens.css", async () => {
    const store = renderPanel();
    const json = '{ "core": { "a": { "value": "#000000", "type": "color" } } }';
    await userEvent.upload(screen.getByLabelText("Import tokens file"), new File([json], "tokens.json", { type: "application/json" }));
    await waitFor(() => expect(store.calls).toEqual([{ name: "importTokens", args: ["tokens-studio", json] }]));
    await userEvent.click(screen.getByRole("button", { name: "Write tokens.css" }));
    expect(store.calls[1]).toEqual({ name: "exportTokens", args: [] });
  });
});
