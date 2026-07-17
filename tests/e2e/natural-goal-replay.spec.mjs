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

test("natural browser goal shows announcement before a full progressing replay and kickoff", async ({ page }) => {
  await openNaturalGoalTest(page);

  await page.locator("#quickMatchButton").click();
  await page.locator('[data-weather="rain"]').click();
  await expect(page.locator('[data-weather="rain"]')).toHaveClass(/active/);
  await page.evaluate(() => {
    const evidence = { events: [], snapshots: [], shotReleased: false };
    const key = (type, code, value) => window.dispatchEvent(new KeyboardEvent(type, {
      code,
      key: value,
      bubbles: true,
    }));
    window.addEventListener("tony:game-event", ({ detail }) => {
      evidence.events.push({
        type: detail.type,
        payload: detail.payload,
        at: performance.now(),
      });
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
    const capture = () => {
      const snapshot = window.__TONY_DEBUG__.diagnostics().engineSnapshot;
      if (snapshot) {
        evidence.snapshots.push({
          at: performance.now(),
          replayActive: snapshot.replayActive,
          replayElapsed: snapshot.replayElapsed,
          replayDuration: snapshot.replayDuration,
          goalPhase: snapshot.goalPhase,
          kickoffTimer: snapshot.kickoffTimer,
        });
      }
      requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
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

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(page.locator("#goalPresentationOverlay")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "score-card"
  ));
  await expect(page.locator("#goalPresentationOverlay")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "replay"
  ));
  await expect(page.locator("#goalPresentationOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).toContainText("INSTANT REPLAY");

  await page.waitForFunction(() => {
    const progressing = window.__TONY_NATURAL_GOAL_EVIDENCE__.snapshots
      .filter((snapshot) => snapshot.replayActive)
      .map((snapshot) => snapshot.replayElapsed);
    return progressing.length >= 2 && Math.max(...progressing) > Math.min(...progressing);
  });

  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/, { timeout: 12_000 });
  await expect(page.locator("#homeScore")).toHaveText("1");
  await page.waitForFunction(() => {
    const snapshot = window.__TONY_DEBUG__.diagnostics().engineSnapshot;
    return snapshot?.goalPhase === null && snapshot?.kickoffTimer > 0;
  });

  const evidence = await page.evaluate(() => window.__TONY_NATURAL_GOAL_EVIDENCE__);
  const indexOf = (type, phase = null) => evidence.events.findIndex((event) => (
    event.type === type && (phase === null || event.payload?.phase === phase)
  ));
  const scoreIndex = indexOf("score:changed");
  const goalCardIndex = indexOf("goal:phase-changed", "goal-card");
  const scoreCardIndex = indexOf("goal:phase-changed", "score-card");
  const replayPhaseIndex = indexOf("goal:phase-changed", "replay");
  const replayStartIndex = indexOf("replay:started");
  const replayEndIndex = indexOf("replay:ended");
  const kickoffIndex = indexOf("goal:phase-changed", "kickoff");

  expect([scoreIndex, goalCardIndex, scoreCardIndex, replayPhaseIndex, replayStartIndex, replayEndIndex, kickoffIndex])
    .toEqual([...new Set([scoreIndex, goalCardIndex, scoreCardIndex, replayPhaseIndex, replayStartIndex, replayEndIndex, kickoffIndex])]);
  expect(scoreIndex).toBeGreaterThanOrEqual(0);
  expect(goalCardIndex).toBeGreaterThan(scoreIndex);
  expect(scoreCardIndex).toBeGreaterThan(goalCardIndex);
  expect(replayPhaseIndex).toBeGreaterThan(scoreCardIndex);
  expect(replayStartIndex).toBeGreaterThan(replayPhaseIndex);
  expect(replayEndIndex).toBeGreaterThan(replayStartIndex);
  expect(kickoffIndex).toBeGreaterThan(replayEndIndex);

  const scoreAt = evidence.events[scoreIndex].at;
  const replayStartAt = evidence.events[replayStartIndex].at;
  const replayEndAt = evidence.events[replayEndIndex].at;
  expect(replayStartAt - scoreAt).toBeGreaterThanOrEqual(1_100);
  expect(replayStartAt - scoreAt).toBeLessThan(2_200);
  expect(replayEndAt - replayStartAt).toBeGreaterThanOrEqual(2_700);
  expect(replayEndAt - replayStartAt).toBeLessThan(4_200);
});
