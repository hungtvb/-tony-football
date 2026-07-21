import { expect, test } from "./fixtures.mjs";

test.describe.configure({ timeout: 60_000 });

function captureRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("production composition boots and routes input, snapshot and lifecycle presentation", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
  const boot = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
  expect(boot.renderer).toBe("webgl");
  expect(boot.threeScene.owner).toBe("clean-host");
  expect(boot.threeScene.profile).toBe("tony-football-default-v1");
  expect(boot.threeScene.foreignObjects).toBeGreaterThan(0);
  expect(boot.canvasMatch.owner).toBe("canvas-match-renderer");
  expect(boot.canvasMatch.active).toBe(false);
  expect(boot.cameraReplay.owner).toBe("snapshot-camera-replay");
  expect(boot.cameraReplay.replay.active).toBe(false);
  expect(boot.runtimeMode).toBe("engine");
  expect(boot.legacyGameplayStepCount).toBe(0);
  await expect(page.locator("#gameCanvas")).toBeVisible();
  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect.poll(() => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state)).toBe("playing");
  await expect(page.locator("#matchState")).toHaveText("LIVE");
  await page.waitForFunction(() => window.__TONY_DEBUG__.diagnostics().engineSnapshot.kickoffTimer === 0);
  const before = await page.evaluate(() => {
    const diagnostics = window.__TONY_DEBUG__.diagnostics();
    return { tick: diagnostics.engineSnapshot.tick, x: diagnostics.renderState.selectedX };
  });
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => page.evaluate(({ tick, x }) => {
    const diagnostics = window.__TONY_DEBUG__.diagnostics();
    return diagnostics.engineSnapshot.tick > tick && diagnostics.renderState.selectedX > x;
  }, before)).toBe(true);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOverlay")).toHaveClass(/show/);
  await expect.poll(() => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state)).toBe("paused");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state)).toBe("playing");
  if (testInfo.project.name === "narrow-landscape") {
    await expect(page.locator(".hud-radar")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  const finalDiagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
  expect(finalDiagnostics.legacyGameplayStepCount).toBe(0);
  expect(finalDiagnostics.cameraReplay.renderCount).toBeGreaterThan(0);
  expect(finalDiagnostics.cameraReplay.projectionSequence).toBe(finalDiagnostics.cameraReplay.renderCount);
  expect(Number.isFinite(finalDiagnostics.cameraReplay.camera.x)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("Canvas fallback boots the snapshot renderer and consumes the shared camera/replay projection", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one representative Canvas boot is sufficient");
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto("/?visualTest=1&renderer=canvas&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
  await expect.poll(() => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().canvasMatch.renderCount)).toBeGreaterThan(0);
  const diagnostics = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics());
  expect(diagnostics.renderer).toBe("canvas");
  expect(diagnostics.runtimeMode).toBe("engine");
  expect(Number.isInteger(diagnostics.engineSnapshot.tick)).toBe(true);
  expect(diagnostics.renderState.selectedPlayerId).toMatch(/^home-/);
  expect(diagnostics.canvasMatch.owner).toBe("canvas-match-renderer");
  expect(diagnostics.canvasMatch.active).toBe(true);
  expect(diagnostics.canvasMatch.status).toBe("ready");
  expect(diagnostics.canvasMatch.lastFacts.tick).toBe(diagnostics.engineSnapshot.tick);
  expect(diagnostics.canvasMatch.lastFacts.selectedPlayerId).toBe(diagnostics.renderState.selectedPlayerId);
  expect(diagnostics.cameraReplay.owner).toBe("snapshot-camera-replay");
  expect(diagnostics.cameraReplay.projectionSequence).toBeGreaterThan(0);
  expect(diagnostics.canvasMatch.lastFacts.cameraReplay.projectionSequence).toBe(diagnostics.cameraReplay.projectionSequence);
  expect(diagnostics.canvasMatch.lastFacts.cameraReplay.camera).toEqual(diagnostics.cameraReplay.camera);
  expect(diagnostics.canvasMatch.lastFacts.cameraReplay.replay.active).toBe(diagnostics.cameraReplay.replay.active);
  expect(Number.isFinite(diagnostics.canvasMatch.lastFacts.transform.a)).toBe(true);
  expect(Number.isFinite(diagnostics.canvasMatch.lastFacts.transform.e)).toBe(true);
  await expect(page.locator("#gameCanvas")).toBeVisible();
  await expect(page.locator("#radarCanvas")).toBeVisible();
  await expect(page.locator("#staminaText")).toHaveText(/^\d+%$/);
  expect(runtimeErrors).toEqual([]);
});

test("legacy runtime and debug query seams are removed before browser gameplay boots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one representative entry guard is sufficient");
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto("/?runtime=compatibility&debugScenario=low-stamina&visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
  const result = await page.evaluate(() => ({ search: window.location.search, hasApplyScenario: typeof window.__TONY_DEBUG__.applyScenario, diagnostics: window.__TONY_DEBUG__.diagnostics() }));
  expect(result.search).not.toContain("runtime=");
  expect(result.search).not.toContain("debugScenario=");
  expect(result.hasApplyScenario).toBe("undefined");
  expect(result.diagnostics.runtimeMode).toBe("engine");
  expect(result.diagnostics.state).toBe("menu");
  expect(result.diagnostics.cameraReplay.owner).toBe("snapshot-camera-replay");
  expect(runtimeErrors).toEqual([]);
});
