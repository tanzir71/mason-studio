import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(`tests/.tmp/northfield/${f}`, "utf8");

test("lists project tokens and imports a Tokens Studio file", async ({ page }) => {
  const before = read("tokens.css");
  await page.goto("/");
  await page.getByTestId("left-panel").getByRole("tab", { name: "Assets" }).click();
  const panel = page.getByTestId("assets-panel");
  await expect(panel.locator('[data-token="color.ink"]')).toContainText("#1e2a22");
  const json = JSON.stringify({ core: { color: { ink: { value: "#102030", type: "color" } } } });
  await panel.getByLabel("Import tokens file").setInputFiles({ name: "tokens.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await expect(page.getByTestId("toast")).toContainText("Imported 1 tokens");
  expect(read("tokens.css")).toContain("--color-ink: #102030;");
  await expect(panel.locator('[data-token="color.ink"]')).toContainText("#102030");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(read("tokens.css")).toBe(before);
});

test("sets a property to a token variable", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  const size = page.getByLabel("Font size");
  await expect(size).toHaveValue("40px");
  await size.fill("var(--type-display)");
  await size.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(read("styles.css")).toContain("font-size: var(--type-display);");
  await expect(size).toHaveValue("var(--type-display)");
  await expect(page.getByTestId("design-text")).toContainText("40px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(read("styles.css")).toContain("  font-size: 40px;");
});
