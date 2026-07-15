import { expect, test } from "@playwright/test";

async function openScenario(page, scenario) {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`/?debugScenario=${scenario}`);
  await expect(page.locator("#startOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("#gameCanvas")).toBeVisible();
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
  await page.waitForTimeout(350);
  expect(consoleErrors).toEqual([]);
}

async function assertNoOverlap(page, firstSelector, secondSelector) {
  const overlaps = await page.evaluate(([first, second]) => {
    const a = document.querySelector(first)?.getBoundingClientRect();
    const b = document.querySelector(second)?.getBoundingClientRect();
    if (!a || !b) return false;
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }, [firstSelector, secondSelector]);
  expect(overlaps).toBe(false);
}

test("lower-left camera scenario preserves HUD safe regions", async ({ page }, testInfo) => {
  await openScenario(page, "lower-left-camera");
  const diagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
  expect(diagnostics.camera.x).toBeGreaterThanOrEqual(0);
  expect(diagnostics.camera.y).toBeGreaterThanOrEqual(0);
  expect(diagnostics.ball.x).toBeLessThan(240);
  expect(diagnostics.ball.y).toBeGreaterThan(500);
  await assertNoOverlap(page, ".match-toast", ".hud-radar");
  await page.screenshot({ path: testInfo.outputPath("lower-left-camera.png"), fullPage: true });
});

test("lower-right camera scenario preserves HUD safe regions", async ({ page }, testInfo) => {
  await openScenario(page, "lower-right-camera");
  const diagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
  expect(diagnostics.ball.x).toBeGreaterThan(960);
  expect(diagnostics.ball.y).toBeGreaterThan(500);
  await assertNoOverlap(page, ".match-toast", ".hud-radar");
  await page.screenshot({ path: testInfo.outputPath("lower-right-camera.png"), fullPage: true });
});

test("crowded radar keeps text outside the plot", async ({ page }, testInfo) => {
  await openScenario(page, "radar-crowded");
  await expect(page.locator("#radarCanvas")).toBeVisible();
  await assertNoOverlap(page, ".match-toast", ".hud-radar");
  const radar = page.locator(".hud-radar");
  await radar.screenshot({ path: testInfo.outputPath("radar-crowded.png") });
});

test("low stamina exposes a restrained warning state", async ({ page }, testInfo) => {
  await openScenario(page, "low-stamina");
  await expect(page.locator(".hud-player-card")).toHaveClass(/low-stamina/);
  await expect(page.locator("#staminaText")).toHaveText(/18%/);
  await page.screenshot({ path: testInfo.outputPath("low-stamina.png"), fullPage: true });
});

test("pause and replay smoke paths remain usable", async ({ page }) => {
  await openScenario(page, "normal-play");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOverlay")).toHaveClass(/show/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOverlay")).not.toHaveClass(/show/);
  await page.evaluate(() => window.__TONY_DEBUG__.applyScenario("replay"));
  await expect(page.locator("#replayBadge")).toHaveClass(/show/);
});
