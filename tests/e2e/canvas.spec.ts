import { expect, test } from "@playwright/test";

test("opens the project on the canvas with three boards per page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("top-bar")).toContainText("northfield");
  for (const id of ["Home-desktop", "Home-tablet", "Home-mobile", "Menu-desktop"]) {
    await expect(page.getByTestId(`board-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("board-Home-desktop").locator("iframe")).toHaveAttribute("src", /\/p\/index\.html\?r=/);
  const heading = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(heading).toHaveText("Small-batch coffee, roasted down the street.");
});

test("selects a layer and outlines it on every board", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: "Headline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("board-Home-desktop").getByTestId("overlay-selection")).toBeVisible();
  await expect(page.getByTestId("overlay-mirror")).toHaveCount(2);
  await page.getByTestId("breakpoint-strip").getByRole("button", { name: /Tablet/ }).click();
  await expect(page.getByTestId("board-Home-tablet").getByTestId("overlay-selection")).toBeVisible();
});

test("switches tools with shortcuts and opens another page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.getByRole("button", { name: "Hand (H)" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("pages-list").getByRole("button", { name: /^Menu/ }).click();
  await expect(page.getByTestId("layers-tree").getByRole("treeitem").first()).toHaveText("Menu");
});
