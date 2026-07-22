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

test.describe("TON-94 current-main golden match", () => {
  test.describe.configure({ timeout: 240_000 });

  test("normal WebGL assets complete a natural goal, replay, restart and second-match lifecycle", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "one desktop normal-asset golden match is sufficient");
    await installNaturalGoalRuntimeHarness(page);
    const runtimeErrors = captureRuntimeErrors(page);

    await page.goto("/?skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true, null, { timeout: 30_000 });
    await page.waitForFunction(() => {
      const model = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
      return model?.playerCount === 12 && model?.appearance?.riggedPlayers === 12;
    }, null, { timeout: 150_000 });

    const appearance = await page.evaluate(() => window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance);
    expect(appearance.riggedPlayers).toBe(12);
    expect(appearance.fallbackPlayers).toBe(0);
    expect(appearance.bootlessPlayers).toBe(0);
    expect(appearance.visibleKitPlayers).toBe(12);
    expect(appearance.players).toHaveLength(12);
    for (const player of appearance.players) {
      expect(player.rigKitInstalled).toBe(true);
      expect(player.visibleKitNodeCount).toBe(7);
      expect(player.bootGeometryCount).toBe(2);
      expect(player.preservedMapCount).toBeGreaterThan(0);
    }

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

    // This is intentionally command-driven. No recordGoalForE2E/direct score mutation is used.
    await shootTowardRightGoal(page);
    await expect.poll(() => scoreTotal(page), { timeout: 30_000, intervals: [250, 500, 1_000] }).toBeGreaterThan(0);

    await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__?.diagnostics?.().timelinePhase === "goal-card", null, { timeout: 15_000 });
    await expect(page.locator("#goalPresentationOverlay")).toHaveClass(/show/);
    await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__?.diagnostics?.().timelinePhase === "replay", null, { timeout: 20_000 });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.replayActive === true, null, { timeout: 10_000 });
    await page.waitForFunction(() => {
      const snapshot = window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot;
      return snapshot?.replayActive === false && snapshot?.goalSequence === null && snapshot?.kickoffTimer === 0;
    }, null, { timeout: 45_000 });

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "paused");
    await clickById(page, "restartButton");
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 15_000 });
    await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 30_000 });
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
