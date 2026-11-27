import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const url = "file://" + resolve("site/index.html");

for (const width of [1440, 768, 375]) {
  test(`landing page fits a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Design on real web pages." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await expect(page.locator("img.shot")).toHaveJSProperty("complete", true);
    expect(await page.locator("img.shot").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1440);
  });
}

test("the download button scrolls to the download card", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("link", { name: "Download for macOS" }).click();
  await expect(page.getByRole("heading", { name: "Get Mason" })).toBeInViewport();
});
