import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const html = () => readFileSync("tests/.tmp/northfield/index.html", "utf8");

/** Page coordinates of the center of `selector` inside the Home desktop board. */
async function pointOn(page: Page, selector: string) {
  const board = page.getByTestId("board-Home-desktop");
  const hit = await board.locator(".m-board__hit").boundingBox();
  const r = await board.frameLocator("iframe").locator(selector).evaluate((el) => el.getBoundingClientRect().toJSON());
  const zoom = hit!.width / 1280;
  return { x: hit!.x + (r.x + r.width / 2) * zoom, y: hit!.y + (r.y + r.height / 2) * zoom };
}

test("inserts a rectangle into the hero copy with the rectangle tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator(".hero-copy")).toBeVisible();
  await page.keyboard.press("r");
  const p = await pointOn(page, ".hero-copy");
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html, styles.css");
  expect(html()).toContain('<div class="rect-1"></div>');
  expect(readFileSync("tests/.tmp/northfield/styles.css", "utf8")).toContain(".rect-1 {");
  await expect(page.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("layers-tree").getByRole("treeitem", { name: "Rect 1" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).not.toContain("rect-1");
});

test("edits the headline text in place", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1")).toBeVisible();
  const p = await pointOn(page, "h1");
  await page.mouse.dblclick(p.x, p.y);
  const editor = page.getByLabel("Edit text");
  await expect(editor).toHaveValue("Small-batch coffee, roasted down the street.");
  await editor.fill("Fresh beans, every week.");
  await editor.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html");
  expect(html()).toContain('<h1 class="headline">Fresh beans, every week.</h1>');
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).toContain("Small-batch coffee, roasted down the street.");
});

test("deletes the footer and undoes it with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("layers-tree").getByRole("treeitem", { name: "Footer" }).click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html");
  expect(html()).not.toContain("<footer");
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).toContain("<footer");
});
