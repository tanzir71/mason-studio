import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("an MCP agent's proposal is reviewed and accepted in Mason", async ({ page, request }) => {
  const original = css();
  await page.goto("/");
  await page.getByRole("button", { name: "MCP off" }).click();
  const dialog = page.getByTestId("settings-dialog");
  await dialog.getByLabel("Let MCP agents read pages and propose changes").check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "MCP on" })).toBeVisible();

  const reply = await request.post("/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "propose_style_changes", arguments: {
    page: "Home", summary: "Tighter tablet headline", agent_name: "Claude Code",
    changes: [
      { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" },
      { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all" },
    ] } } } });
  expect(reply.status()).toBe(200);
  expect(css()).toBe(original);

  const card = page.getByTestId("review-card");
  await expect(card).toContainText("Claude Code proposes 2 changes");
  await expect(card).toContainText("Blocked: No stock AI purple");
  await card.getByRole("button", { name: "Accept 1" }).click();
  await expect(page.getByTestId("toast")).toContainText("Applied 1 change from Claude Code");
  await expect(card).toHaveCount(0);
  expect(css()).toContain("font-size: 30px;");
  expect(css()).not.toContain("#7c3aed");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toBe(original);
});

test("MCP is refused while it is off", async ({ request }) => {
  const settings = JSON.parse(readFileSync("tests/.tmp/home/settings.json", "utf8"));
  settings.settings.mcpEnabled = false;
  const r0 = await request.post("/api/rpc/saveSettings", { data: { args: [settings.settings] } });
  expect(r0.status()).toBe(200);
  const r = await request.post("/mcp", { data: { jsonrpc: "2.0", id: 1, method: "ping" } });
  expect(r.status()).toBe(403);
});
