// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "../src/ui/app/App.tsx";
import { mountStudio } from "../src/ui/main.tsx";
import { createHttpClient } from "../src/ui/api/http-client.ts";
import { createStudioStore } from "../src/ui/state/create-store.ts";
import { createFakeClient } from "../src/contracts/fakes-ui.ts";

describe("ui skeleton", () => {
  it("UI entry points are exported as functions", () => {
    for (const f of [App, mountStudio, createHttpClient, createStudioStore]) expect(typeof f).toBe("function");
  });
  it("index.html mounts main.tsx into #root", () => {
    const html = readFileSync("src/ui/index.html", "utf8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="./main.tsx"');
  });
  it("mountStudio renders into the element and unmounts", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, createFakeClient().client);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.childNodes.length).toBeGreaterThan(0);
    unmount();
    expect(el.innerHTML).toBe("");
    el.remove();
  });
});
