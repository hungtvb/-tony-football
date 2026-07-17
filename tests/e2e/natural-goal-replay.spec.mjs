import { expect, test } from "./fixtures.mjs";
import { installNaturalGoalRuntimeHarness } from "./engine-runtime-harness.mjs";

test.describe.configure({ timeout: 60_000 });

async function openNaturalGoalTest(page) {
  await installNaturalGoalRuntimeHarness(page);
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_GOAL_PRESENTATION__?.ready === true
  ));
}

test("browser wiring presents score and replay for a command-driven goal", async ({ page }) => {
  await openNaturalGoalTest(page);

  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect(page.locator("#matchState")).toHaveText("LIVE");
  await expect(page.locator("#controlsMode")).toHaveText("TẤN CÔNG", { timeout: 10_000 });
  await expect(page.locator("#playerName")).toHaveText("TONY");

  await page.evaluate(() => {
    const evidence = { events: [] };
    window.addEventListener("tony:game-event", ({ detail }) => evidence.events.push(detail.type));
    window.__TONY_NATURAL_GOAL_EVIDENCE__ = evidence;
  });

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(950);
  await page.keyboard.up("KeyD");

  await expect(page.locator("#homeScore")).toHaveText("1");
  await expect(page.locator("#awayScore")).toHaveText("0");
  await expect(page.locator("#replayBadge")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).toContainText("INSTANT REPLAY");

  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/, { timeout: 12_000 });
  await expect(page.locator("#homeScore")).toHaveText("1");
  const evidence = await page.evaluate(() => window.__TONY_NATURAL_GOAL_EVIDENCE__);
  expect(evidence.events).toContain("ball:kicked");
  expect(evidence.events).toContain("score:changed");
  expect(evidence.events).toContain("replay:started");
  expect(evidence.events).toContain("replay:ended");
});
