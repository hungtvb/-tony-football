import { expect, test } from "./fixtures.mjs";
import { installEngineRuntimeHarness } from "./engine-runtime-harness.mjs";

test.describe.configure({ timeout: 60_000 });

async function openGoalTest(page) {
  await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_GOAL_PRESENTATION__?.ready === true
  ));
}

function goalPhase(phase, team = 0, score = [1, 0]) {
  return { previousPhase: null, phase, team, score, duration: 4.39, elapsed: 0 };
}

test("preview fixture still exposes hidden highlight, cards, replay, and completion", async ({ page }) => {
  await openGoalTest(page);
  await page.evaluate(() => {
    void window.__TONY_GOAL_PRESENTATION__.preview({ team: "home", score: [2, 1], replay: true });
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(overlay).toHaveClass(/show/);
  await expect(page.locator("#goalPresentationHomeScore")).toHaveText("2");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "replay"
  ));
  await expect(overlay).not.toHaveClass(/show/);
  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.endPreviewReplay());
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
});

test("synthetic engine phases drive card visibility without presentation timers", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate((phases) => {
    document.body.dataset.flow = "match";
    window.__TONY_DEBUG__.emitGameEvent("score:changed", { team: 1, score: [0, 1] });
    for (const payload of phases) window.__TONY_DEBUG__.emitGameEvent("goal:phase-changed", payload);
  }, [
    goalPhase("goal-card", 1, [0, 1]),
  ]);

  const overlay = page.locator("#goalPresentationOverlay");
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "away");
  await expect(overlay).toHaveAttribute("data-stage", "goal");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("NEON UTD");

  await page.evaluate((payload) => window.__TONY_DEBUG__.emitGameEvent("goal:phase-changed", payload),
    goalPhase("score-card", 1, [0, 1]));
  await expect(overlay).toHaveAttribute("data-stage", "score");
  await expect(overlay).toHaveClass(/show/);

  await page.evaluate((payload) => {
    window.__TONY_DEBUG__.emitGameEvent("goal:phase-changed", payload);
    window.__TONY_DEBUG__.emitGameEvent("replay:started");
  }, goalPhase("replay", 1, [0, 1]));
  await expect(overlay).not.toHaveClass(/show/);
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate((payload) => {
    window.__TONY_DEBUG__.emitGameEvent("replay:ended");
    window.__TONY_DEBUG__.emitGameEvent("goal:phase-changed", payload);
  }, goalPhase("kickoff", 1, [0, 1]));
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
  await expect(overlay).not.toHaveClass(/show/);
});

test("direct-goal harness remains presentation-only projection evidence", async ({ page }) => {
  await installEngineRuntimeHarness(page);
  await openGoalTest(page);
  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect.poll(() => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state)).toBe("playing");
  const prepared = await page.evaluate(() => {
    const snapshot = window.__TONY_E2E_BROWSER_RUNTIME__?.advanceForE2E(150);
    return {
      tick: snapshot?.tick ?? null,
      kickoffTimer: snapshot?.match?.kickoffTimer ?? null,
    };
  });
  expect(prepared.tick).toBeGreaterThanOrEqual(150);
  expect(prepared.kickoffTimer).toBe(0);

  const triggered = await page.evaluate(() => (
    window.__TONY_E2E_BROWSER_RUNTIME__?.recordGoalForE2E(0) ?? false
  ));
  expect(triggered).toBe(true);
  await expect(page.locator("#homeScore")).toHaveText("1");

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(page.locator("#goalPresentationOverlay")).toHaveClass(/show/);
  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "replay"
  ));
  await expect(page.locator("#goalPresentationOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");
  await expect.poll(() => page.evaluate(() => (
    window.__TONY_DEBUG__.diagnostics().engineSnapshot?.replayActive ?? false
  ))).toBe(true);

  for (let chunk = 0; chunk < 5; chunk += 1) {
    await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(60));
    await page.waitForTimeout(0);
  }

  await page.waitForFunction(() => {
    const snapshot = window.__TONY_DEBUG__.diagnostics().engineSnapshot;
    return snapshot && snapshot.replayActive === false && snapshot.goalSequence === null;
  });
  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);
});
