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

test("goal presentation yields native highlight and replay windows", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    void window.__TONY_GOAL_PRESENTATION__.preview({
      team: "home",
      score: [2, 1],
      replay: true,
    });
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    return diagnostics.timelineHistory.some(({ phase, visible }) => (
      phase === "native-highlight" && visible === false
    ));
  });

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "home");
  await expect(overlay).toHaveAttribute("data-stage", "goal");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("TONY FC");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("TF");
  await expect(page.locator("#goalPresentationHomeScore")).toHaveText("2");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().history.includes("replay")
  ));
  await expect(overlay).not.toHaveClass(/show/);

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.endPreviewReplay());
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    const required = ["goal", "score", "replay", "complete", "hidden"];
    return diagnostics.running === false && required.every((stage) => diagnostics.history.includes(stage));
  });
  await expect(overlay).not.toHaveClass(/show/);
});

test("score event automatically presents an away goal after the highlight lead-in", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    document.body.dataset.flow = "match";
    window.__TONY_DEBUG__.emitGameEvent("score:changed", {
      team: 1,
      score: [0, 1],
      replayAvailable: false,
    });
  });

  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    return diagnostics.timelineHistory.some(({ phase, visible }) => (
      phase === "native-highlight" && visible === false
    ));
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "away");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("NEON UTD");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("NU");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
  await expect(overlay).not.toHaveClass(/show/);
});

test("separate replay events extend the goal flow without score DOM inference", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    document.body.dataset.flow = "match";
    window.__TONY_DEBUG__.emitGameEvent("score:changed", {
      team: 0,
      score: [1, 0],
    });
    window.__TONY_DEBUG__.emitGameEvent("replay:started");
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "native-replay"
  ));
  await expect(overlay).not.toHaveClass(/show/);

  await page.evaluate(() => window.__TONY_DEBUG__.emitGameEvent("replay:ended"));
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
});

test("default engine goal drives browser score, replay, commentary, and coherent kickoff", async ({ page }) => {
  await installEngineRuntimeHarness(page);
  await openGoalTest(page);

  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect.poll(
    () => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state),
  ).toBe("playing");

  const beforeGoal = await page.locator("#commentary").textContent();
  await page.evaluate(() => {
    const badge = document.querySelector("#replayBadge");
    const commentary = document.querySelector("#commentary");
    const homeScore = document.querySelector("#homeScore");
    const awayScore = document.querySelector("#awayScore");
    const evidence = {
      badge: [{ className: badge.className, text: badge.textContent }],
      commentary: [commentary.textContent],
      scores: [[homeScore.textContent, awayScore.textContent]],
      engine: [],
      events: [],
    };
    const capture = () => {
      evidence.badge.push({ className: badge.className, text: badge.textContent });
      evidence.commentary.push(commentary.textContent);
      evidence.scores.push([homeScore.textContent, awayScore.textContent]);
    };
    new MutationObserver(capture).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      characterData: true,
      childList: true,
      subtree: true,
    });
    window.__TONY_DEFAULT_GOAL_EVIDENCE__ = evidence;
    window.addEventListener("tony:game-event", ({ detail }) => {
      evidence.events.push({
        type: detail.type,
        badge: { className: badge.className, text: badge.textContent },
      });
    });
    const captureEngine = () => {
      const snapshot = window.__TONY_DEBUG__.diagnostics().engineSnapshot;
      if (snapshot) evidence.engine.push(snapshot);
      requestAnimationFrame(captureEngine);
    };
    requestAnimationFrame(captureEngine);
  });
  const triggered = await page.evaluate(() => {
    const diagnostics = window.__TONY_DEBUG__.diagnostics();
    if (diagnostics.runtimeMode !== "engine") return false;
    return window.__TONY_E2E_BROWSER_RUNTIME__?.recordGoalForE2E(0) ?? false;
  });
  expect(triggered).toBe(true);

  await expect(page.locator("#homeScore")).toHaveText("1");
  await expect(page.locator("#awayScore")).toHaveText("0");

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(page.locator("#goalPresentationHomeScore")).toHaveText("1");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("0");
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "native-replay"
  ));
  await expect(page.locator("#goalPresentationOverlay")).not.toHaveClass(/show/);

  for (let chunk = 0; chunk < 4; chunk += 1) {
    await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(60));
    await page.waitForTimeout(0);
  }

  await page.waitForFunction(() => {
    const snapshot = window.__TONY_DEBUG__.diagnostics().engineSnapshot;
    return snapshot
      && snapshot.score[0] === 1
      && snapshot.replayActive === false
      && snapshot.goalSequence === null;
  }, null, { timeout: 12_000 });

  await expect(page.locator("#replayBadge")).not.toHaveClass(/show/);
  await expect(page.locator("#homeScore")).toHaveText("1");
  await expect(page.locator("#awayScore")).toHaveText("0");

  const evidence = await page.evaluate(() => ({
    ...window.__TONY_DEFAULT_GOAL_EVIDENCE__,
    timeline: window.__TONY_GOAL_PRESENTATION__.diagnostics().timelineHistory,
  }));
  expect(evidence.commentary).toContain("Đang xem lại bàn thắng.");
  expect(evidence.commentary).toContain("Chuẩn bị giao bóng lại.");
  expect(evidence.commentary).not.toEqual([beforeGoal]);
  expect(evidence.events.some(({ type, badge }) => (
    type === "replay:started"
    && badge.className.includes("show")
    && badge.text.includes("INSTANT REPLAY")
  ))).toBe(true);
  expect(evidence.scores.some(([home, away]) => home === "1" && away === "0")).toBe(true);
  expect(evidence.engine.some(({ replayActive }) => replayActive === true)).toBe(true);
  expect(evidence.engine.some(({ goalSequence }) => goalSequence?.team === 0)).toBe(true);
  expect(evidence.engine.some(({ goalSequence, kickoffTimer, ballOwnerId }) => (
    goalSequence === null && kickoffTimer > 0 && ballOwnerId === null
  ))).toBe(true);
  expect(evidence.timeline.some(({ phase, visible }) => (
    phase === "native-replay" && visible === false
  ))).toBe(true);
});
