import { expect, test } from "./fixtures.mjs";
import { installNaturalGoalRuntimeHarness } from "./engine-runtime-harness.mjs";

test.describe.configure({ timeout: 60_000 });

async function openNaturalGoalTest(page) {
  await installNaturalGoalRuntimeHarness(page);
  await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_GOAL_PRESENTATION__?.ready === true
    && window.__TONY_E2E_BROWSER_RUNTIME__
    && window.__TONY_E2E_REPLAY_CONTROLLER__
  ));
}

test("natural engine shot fills history, renders replay frames, and exits coherently", async ({ page }) => {
  await openNaturalGoalTest(page);

  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect.poll(
    () => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state),
  ).toBe("playing");
  await expect.poll(
    () => page.evaluate(() => window.__TONY_E2E_REPLAY_CONTROLLER__.bufferedFrames),
    { timeout: 12_000 },
  ).toBeGreaterThanOrEqual(9);

  await page.evaluate(() => {
    const evidence = { events: [], replayReadsAtStart: window.__TONY_E2E_REPLAY_RENDER_READS__ };
    window.addEventListener("tony:game-event", ({ detail }) => evidence.events.push(detail.type));
    window.__TONY_NATURAL_GOAL_EVIDENCE__ = evidence;
  });

  const triggered = await page.evaluate(() => (
    window.__TONY_E2E_BROWSER_RUNTIME__.shootNaturalGoalForE2E("home-4")
  ));
  expect(triggered).toBe(true);

  await expect(page.locator("#homeScore")).toHaveText("1");
  await expect(page.locator("#awayScore")).toHaveText("0");
  await expect.poll(
    () => page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.snapshot.match.stats.shots[0]),
  ).toBe(1);

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");
  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());

  await page.waitForFunction(() => {
    const replay = window.__TONY_E2E_REPLAY_CONTROLLER__;
    return replay.active && replay.playbackFrames >= 9;
  });
  await expect(page.locator("#replayBadge")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).toContainText("INSTANT REPLAY");

  await page.waitForFunction(() => (
    window.__TONY_E2E_REPLAY_RENDER_READS__
      > window.__TONY_NATURAL_GOAL_EVIDENCE__.replayReadsAtStart
  ));
  const firstReplayTick = await page.evaluate(() => (
    window.__TONY_E2E_REPLAY_CONTROLLER__.currentSnapshot()?.tick ?? null
  ));
  expect(firstReplayTick).not.toBeNull();
  await page.waitForFunction((tick) => {
    const replay = window.__TONY_E2E_REPLAY_CONTROLLER__;
    return replay.active && replay.currentSnapshot()?.tick !== tick;
  }, firstReplayTick);

  await page.waitForFunction(() => {
    const snapshot = window.__TONY_E2E_BROWSER_RUNTIME__.snapshot;
    const replay = window.__TONY_E2E_REPLAY_CONTROLLER__;
    return snapshot.match.score[0] === 1
      && snapshot.match.replay.active === false
      && snapshot.match.goalSequence === null
      && replay.active === false;
  }, null, { timeout: 12_000 });

  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);
  await expect(page.locator("#homeScore")).toHaveText("1");
  const evidence = await page.evaluate(() => window.__TONY_NATURAL_GOAL_EVIDENCE__);
  expect(evidence.events).toContain("ball:kicked");
  expect(evidence.events).toContain("score:changed");
  expect(evidence.events).toContain("replay:started");
  expect(evidence.events).toContain("replay:ended");
});
