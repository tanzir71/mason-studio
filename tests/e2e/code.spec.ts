import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("opens a rule from Inspect in the code drawer, edits and saves it", async ({ page }) => {
  const original = css();
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Inspect" }).click();
  const inspect = page.getByTestId("inspect-panel");
  await expect(inspect.locator('[data-rule="styles.css:22"] [data-status="winning"]').first()).toBeVisible();
  await inspect.getByRole("button", { name: "styles.css:22" }).click();
  const drawer = page.getByTestId("code-drawer");
  await expect(drawer).toContainText("styles.css");
  await drawer.locator(".cm-content").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("/* edited in Mason */\n");
  await expect(drawer.getByRole("img", { name: "Unsaved changes" })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(css().startsWith("/* edited in Mason */\n")).toBe(true);
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toBe(original);
  await drawer.getByRole("button", { name: "Close code" }).click();
  await expect(drawer).toHaveCount(0);
});
