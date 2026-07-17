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
  await page.locator('[data-weather="rain"]').click();
  await expect(page.locator('[data-weather="rain"]')).toHaveClass(/active/);
  await page.evaluate(() => {
    const evidence = { events: [], shotReleased: false };
    const key = (type, code, value) => window.dispatchEvent(new KeyboardEvent(type, {
      code,
      key: value,
      bubbles: true,
    }));
    window.addEventListener("tony:game-event", ({ detail }) => {
      evidence.events.push({ type: detail.type, payload: detail.payload });
      if (detail.type === "match:started") key("keydown", "KeyD", "d");
      if (
        !evidence.shotReleased
        && detail.type === "possession:changed"
        && detail.payload?.ownerId === "home-4"
      ) {
        evidence.shotReleased = true;
        key("keyup", "KeyD", "d");
      }
    });
    window.__TONY_NATURAL_GOAL_EVIDENCE__ = evidence;
  });

  await page.locator("#playButton").click();
  await expect(page.locator("#matchState")).toHaveText("LIVE");
  await expect.poll(
    () => page.evaluate(() => window.__TONY_NATURAL_GOAL_EVIDENCE__.shotReleased),
    { timeout: 10_000 },
  ).toBe(true);

  await expect(page.locator("#homeScore")).toHaveText("1");
  await expect(page.locator("#awayScore")).toHaveText("0");
  await expect(page.locator("#replayBadge")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).toContainText("INSTANT REPLAY");

  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/, { timeout: 12_000 });
  await expect(page.locator("#homeScore")).toHaveText("1");
  const eventTypes = await page.evaluate(() => (
    window.__TONY_NATURAL_GOAL_EVIDENCE__.events.map((event) => event.type)
  ));
  expect(eventTypes).toContain("possession:changed");
  expect(eventTypes).toContain("ball:kicked");
  expect(eventTypes).toContain("score:changed");
  expect(eventTypes).toContain("replay:started");
  expect(eventTypes).toContain("replay:ended");
});
