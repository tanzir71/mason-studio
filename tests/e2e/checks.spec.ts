import { expect, test } from "@playwright/test";

test("runs checks for the home page and opens a finding in code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1")).toBeVisible();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Checks" }).click();
  const panel = page.getByTestId("checks-panel");
  await expect(panel.locator('[data-finding="tokens:styles.css:22:color"]')).toContainText("Use color.ink instead.");
  await expect(panel.locator('[data-finding="taste:invalid:0"]')).toContainText("Invalid regex: ([");
  await expect(panel.getByRole("list", { name: "Passed" })).toContainText("No hard bans matched");
  await panel.locator('[data-finding="tokens:styles.css:22:color"]').getByRole("button", { name: "styles.css:22" }).click();
  await expect(page.getByTestId("code-drawer")).toContainText("styles.css");
});

test("flags the image without alt text on the menu page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pages-list").getByRole("button", { name: /^Menu/ }).click();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Checks" }).click();
  const finding = page.getByTestId("checks-panel").locator('[data-finding^="a11y:alt:"]');
  await expect(finding).toContainText("Image has no alt text");
  await finding.getByRole("button", { name: "Select layer" }).click();
  await expect(page.getByTestId("layers-tree").getByRole("treeitem", { selected: true })).toHaveCount(1);
});
