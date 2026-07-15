import { expect, test } from "@playwright/test";

async function openGame(page) {
  await page.goto("/?visualTest=1");
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
}

async function startQuickMatch(page) {
  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOverlay")).toHaveClass(/show/);
}

test("main menu opens match setup as a distinct screen", async ({ page }) => {
  await openGame(page);

  const mainMenu = page.locator("#mainMenuOverlay");
  const setup = page.locator("#startOverlay");

  await expect(mainMenu).toHaveClass(/show/);
  await expect(setup).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "main-menu");

  await page.locator("#quickMatchButton").click();

  await expect(mainMenu).not.toHaveClass(/show/);
  await expect(setup).toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match-setup");

  await page.locator("#setupBackButton").click();

  await expect(mainMenu).toHaveClass(/show/);
  await expect(setup).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "main-menu");
});

test("pause can return directly to match setup", async ({ page }) => {
  await openGame(page);
  await startQuickMatch(page);

  await page.locator("#setupButton").click();

  await expect(page.locator("#startOverlay")).toHaveClass(/show/);
  await expect(page.locator("#mainMenuOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match-setup");
});

test("pause can return to the distinct main menu", async ({ page }) => {
  await openGame(page);
  await startQuickMatch(page);

  await page.locator("#mainMenuButton").click();

  await expect(page.locator("#mainMenuOverlay")).toHaveClass(/show/);
  await expect(page.locator("#startOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "main-menu");
});
