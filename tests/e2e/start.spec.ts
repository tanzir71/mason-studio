import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test("closes the project to the start screen and reopens it from recent", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("top-bar").getByRole("button", { name: "northfield" }).click();
  await page.getByRole("menuitem", { name: "Close project" }).click();
  const start = page.getByTestId("start-screen");
  await expect(start.getByRole("heading", { name: "Start designing" })).toBeVisible();
  await expect(start.getByRole("button", { name: "Landing page 1 page" })).toBeVisible();
  await start.getByRole("button", { name: /northfield/ }).click();
  await expect(page.getByTestId("board-Home-desktop")).toBeVisible();
});

test("reloads boards when a file changes outside Mason", async ({ page }) => {
  const file = "tests/.tmp/northfield/styles.css";
  const original = readFileSync(file, "utf8");
  await page.goto("/");
  const h1 = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(h1).toHaveCSS("font-size", "40px");
  writeFileSync(file, original.replace("  font-size: 40px;", "  font-size: 44px;"));
  await expect(h1).toHaveCSS("font-size", "44px");
  writeFileSync(file, original);
  await expect(h1).toHaveCSS("font-size", "40px");
});

test("shows Git changes and commits them", async ({ page }) => {
  await page.goto("/");
  const chip = page.getByTestId("git-chip");
  await expect(chip).toContainText("7 changes");
  await chip.getByRole("button", { name: "Commit" }).click();
  await page.getByLabel("Commit message").fill("Start the Northfield site");
  await page.getByLabel("Commit message").press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Committed");
  await expect(chip).toContainText("0 changes");
});
