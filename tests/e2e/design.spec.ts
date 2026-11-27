import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("edits the tablet font size of the headline and undoes it", async ({ page }) => {
  const original = css();
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("scope-control").getByRole("tab", { name: "≤ 768" }).click();
  const size = page.getByLabel("Font size");
  await expect(size).toHaveValue("32px");
  await size.fill("30px");
  await size.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(css()).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
  const tabletH1 = page.getByTestId("board-Home-tablet").frameLocator("iframe").locator("h1");
  await expect(tabletH1).toHaveCSS("font-size", "30px");
  const desktopH1 = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(desktopH1).toHaveCSS("font-size", "40px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid: Saved to styles.css");
  expect(css()).toBe(original);
});

test("resets the mobile override", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("scope-control").getByRole("tab", { name: "≤ 375" }).click();
  await expect(page.getByLabel("Font size")).toHaveValue("28px");
  await page.getByTestId("design-text").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Font size")).toHaveValue("32px");
  expect(css()).not.toContain("28px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toContain("28px");
});
