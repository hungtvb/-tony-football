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
    const evidence = {
      events: [],
      shotReleased: false,
      captureStarted: false,
      clockObserver: null,
    };
    const key = (type, code, value) => window.dispatchEvent(new KeyboardEvent(type, {
      code,
      key: value,
      bubbles: true,
    }));
    const displayedClockSeconds = () => {
      const [minutes = "0", seconds = "0"] = document.querySelector("#gameClock")?.textContent?.split(":") ?? [];
      return Number(minutes) * 60 + Number(seconds);
    };
    const pulseCapture = () => {
      if (evidence.shotReleased) return;
      key("keydown", "ArrowRight", "ArrowRight");
      window.requestAnimationFrame(() => {
        key("keyup", "ArrowRight", "ArrowRight");
        if (!evidence.shotReleased) window.requestAnimationFrame(pulseCapture);
      });
    };
    const startCaptureAfterKickoff = () => {
      const clock = document.querySelector("#gameClock");
      const startWhenBallUnlocks = () => {
        if (evidence.captureStarted || displayedClockSeconds() < 30) return;
        evidence.captureStarted = true;
        evidence.clockObserver?.disconnect();
        pulseCapture();
      };
      evidence.clockObserver = new MutationObserver(startWhenBallUnlocks);
      evidence.clockObserver.observe(clock, { childList: true, characterData: true, subtree: true });
      startWhenBallUnlocks();
    };
    window.addEventListener("tony:game-event", ({ detail }) => {
      evidence.events.push({ type: detail.type, payload: detail.payload });
      if (detail.type === "match:started") {
        key("keydown", "KeyD", "d");
        startCaptureAfterKickoff();
      }
      if (
        !evidence.shotReleased
        && detail.type === "possession:changed"
        && detail.payload?.ownerId === "home-4"
      ) {
        evidence.shotReleased = true;
        evidence.clockObserver?.disconnect();
        key("keyup", "ArrowRight", "ArrowRight");
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
