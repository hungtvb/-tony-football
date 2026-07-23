import { expect, test } from "./fixtures.mjs";
import { installNaturalGoalRuntimeHarness } from "./engine-runtime-harness.mjs";

function captureRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function clickById(page, id) {
  const clicked = await page.evaluate((targetId) => {
    const element = document.getElementById(targetId);
    if (!element) return false;
    element.click();
    return true;
  }, id);
  expect(clicked, `expected #${id} to exist and accept a click`).toBe(true);
}

async function startMatch(page) {
  await clickById(page, "quickMatchButton");
  await page.waitForFunction(() => document.body.dataset.flow === "match-setup");
  await clickById(page, "playButton");
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 30_000 });
}

async function scoreTotal(page) {
  return page.evaluate(() => {
    const home = Number(document.getElementById("homeScore")?.textContent ?? 0);
    const away = Number(document.getElementById("awayScore")?.textContent ?? 0);
    return home + away;
  });
}

async function shootTowardRightGoal(page) {
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(520);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ArrowRight");
}

async function advanceAuthoritativeRuntime(page, steps) {
  const result = await page.evaluate((count) => {
    const runtime = globalThis.__TONY_E2E_BROWSER_RUNTIME__;
    if (!runtime?.advanceForE2E) return null;
    const snapshot = runtime.advanceForE2E(count);
    return {
      tick: snapshot.tick,
      score: [...snapshot.match.score],
      replayActive: Boolean(snapshot.match.replay?.active),
      goalPhase: snapshot.match.goalSequence?.phase ?? null,
      kickoffTimer: snapshot.match.kickoffTimer,
    };
  }, steps);
  expect(result, "natural-goal harness must expose clock stepping without score mutation").toBeTruthy();
  return result;
}

async function renderTwoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function replayCameraSample(page) {
  await renderTwoFrames(page);
  return page.evaluate(() => window.__TONY_DEBUG__?.diagnostics?.().replayCameraFraming ?? null);
}

async function attachViewportScreenshot(page, testInfo, name) {
  const devtools = await page.context().newCDPSession(page);
  const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await devtools.detach();
  await testInfo.attach(name, { body: Buffer.from(screenshot.data, "base64"), contentType: "image/png" });
}

test.describe("TON-94 current-main golden match", () => {
  test.describe.configure({ timeout: 120_000 });

  test("natural score completes goal-card, replay, kickoff, restart and second-match lifecycle", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "one desktop natural-goal golden match is sufficient");
    await installNaturalGoalRuntimeHarness(page);
    const runtimeErrors = captureRuntimeErrors(page);

    // Asset readiness is an independent required lane. visualTest keeps this
    // gameplay/replay boundary deterministic and prevents GLB decode from
    // consuming the same CI timeout budget.
    await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true, null, { timeout: 30_000 });
    await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
    await startMatch(page);
    await expect(page.locator("#matchState")).toHaveText("LIVE");

    const beforeMovement = await page.evaluate(() => {
      const diagnostics = window.__TONY_DEBUG__.diagnostics();
      return { tick: diagnostics.engineSnapshot.tick, x: diagnostics.renderState.selectedX };
    });
    await page.keyboard.down("ArrowRight");
    await expect.poll(() => page.evaluate(({ tick, x }) => {
      const diagnostics = window.__TONY_DEBUG__.diagnostics();
      return diagnostics.engineSnapshot.tick > tick && diagnostics.renderState.selectedX > x;
    }, beforeMovement), { timeout: 10_000 }).toBe(true);
    await page.keyboard.up("ArrowRight");

    // The score itself remains command-driven through the real browser input.
    // No recordGoalForE2E/direct score mutation is available in this fixture.
    await shootTowardRightGoal(page);
    await expect.poll(() => scoreTotal(page), { timeout: 30_000, intervals: [250, 500, 1_000] }).toBeGreaterThan(0);

    // Advance only authoritative time after the natural score so transient goal
    // phases cannot be missed by a slow software renderer.
    await advanceAuthoritativeRuntime(page, 90);
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.replayActive === true, null, { timeout: 10_000 });

    const replayEvidence = await page.evaluate(() => ({
      goal: window.__TONY_GOAL_PRESENTATION__?.diagnostics?.(),
      engine: window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot,
      cameraReplay: window.__TONY_CAMERA_REPLAY_BRIDGE__?.diagnostics?.(),
    }));
    const phases = replayEvidence.goal.timelineHistory.map((entry) => entry.phase);
    expect(phases).toEqual(expect.arrayContaining(["native-highlight", "goal-card", "score-card", "replay"]));
    expect(replayEvidence.engine.replayActive).toBe(true);
    expect(replayEvidence.cameraReplay.replay.active).toBe(true);
    expect(replayEvidence.cameraReplay.replay.missingFrame).toBe(false);

    const cameraSamples = [];
    for (let index = 0; index < 3; index += 1) {
      const sample = await replayCameraSample(page);
      expect(sample, "replay camera diagnostics must be available").toBeTruthy();
      cameraSamples.push(sample);
      if (index < 2) await advanceAuthoritativeRuntime(page, 15);
    }
    await attachViewportScreenshot(page, testInfo, "ton-94-natural-replay.png");

    expect(new Set(cameraSamples.map((sample) => sample.frameIndex)).size).toBeGreaterThan(1);
    expect(cameraSamples.every((sample) => sample.active === true)).toBe(true);
    expect(cameraSamples.every((sample) => sample.scoringRight === true)).toBe(true);
    expect(cameraSamples.every((sample) => sample.look.x < sample.target.x)).toBe(true);
    expect(cameraSamples.every((sample) => Math.abs(sample.position.x) <= 58)).toBe(true);
    expect(cameraSamples.every((sample) => sample.position.y >= 12)).toBe(true);
    expect(cameraSamples.every((sample) => Math.abs(sample.position.z) <= 32)).toBe(true);
    expect(new Set(cameraSamples.map((sample) => Math.sign(sample.target.x - sample.look.x))).size).toBe(1);

    await advanceAuthoritativeRuntime(page, 600);
    await page.waitForFunction(() => {
      const snapshot = window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot;
      return snapshot?.replayActive === false && snapshot?.goalSequence === null && snapshot?.kickoffTimer === 0;
    }, null, { timeout: 15_000 });

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "paused");
    await clickById(page, "restartButton");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 15_000 });
    await advanceAuthoritativeRuntime(page, 120);
    await expect(page.locator("#homeScore")).toHaveText("0");
    await expect(page.locator("#awayScore")).toHaveText("0");

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "paused");
    await clickById(page, "mainMenuButton");
    await page.waitForFunction(() => document.body.dataset.flow === "main-menu");
    await startMatch(page);
    await expect(page.locator("#homeScore")).toHaveText("0");
    await expect(page.locator("#awayScore")).toHaveText("0");

    const finalDiagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
    expect(finalDiagnostics.runtimeMode).toBe("engine");
    expect(finalDiagnostics.legacyGameplayStepCount).toBe(0);
    expect(finalDiagnostics.cameraReplay.owner).toBe("snapshot-camera-replay");
    expect(runtimeErrors).toEqual([]);
  });

  test("forced Canvas runs an actual match with movement, pause and restart", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "one desktop Canvas golden match is sufficient");
    const runtimeErrors = captureRuntimeErrors(page);

    await page.goto("/?visualTest=1&renderer=canvas&skipIntro=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true, null, { timeout: 30_000 });
    await startMatch(page);

    const before = await page.evaluate(() => {
      const diagnostics = window.__TONY_DEBUG__.diagnostics();
      return {
        tick: diagnostics.engineSnapshot.tick,
        x: diagnostics.renderState.selectedX,
        renders: diagnostics.canvasMatch.renderCount,
      };
    });
    await page.keyboard.down("ArrowRight");
    await expect.poll(() => page.evaluate(({ tick, x, renders }) => {
      const diagnostics = window.__TONY_DEBUG__.diagnostics();
      return diagnostics.engineSnapshot.tick > tick
        && diagnostics.renderState.selectedX > x
        && diagnostics.canvasMatch.renderCount > renders;
    }, before), { timeout: 10_000 }).toBe(true);
    await page.keyboard.up("ArrowRight");

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "paused");
    await expect(page.locator("#pauseOverlay")).toHaveClass(/show/);
    await clickById(page, "restartButton");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 15_000 });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 30_000 });

    const finalDiagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
    expect(finalDiagnostics.renderer).toBe("canvas");
    expect(finalDiagnostics.canvasMatch.active).toBe(true);
    expect(finalDiagnostics.canvasMatch.status).toBe("ready");
    expect(finalDiagnostics.canvasMatch.lastFacts.tick).toBe(finalDiagnostics.engineSnapshot.tick);
    expect(finalDiagnostics.canvasMatch.lastFacts.cameraReplay.projectionSequence).toBe(finalDiagnostics.cameraReplay.projectionSequence);
    expect(finalDiagnostics.runtimeMode).toBe("engine");
    expect(runtimeErrors).toEqual([]);
  });
});
