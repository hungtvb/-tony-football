import { expect, test } from "./fixtures.mjs";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../../src/game/config/simulationScaleProfile.js";

test("visual-test composition owns snapshot-driven fallback player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
  expect(result.model.appearance.fallbackPlayers).toBe(12); expect(result.model.appearance.bootlessPlayers).toBe(0);
});

test("normal asset mode preserves source maps and renders explicit football clothing and boots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop live-match asset proof is sufficient");
  // Hosted software-rendering runners can make each Playwright/CDP boundary take
  // several seconds even after all asset and motion assertions are satisfied.
  // Keep the job bounded while allowing the unchanged acceptance proof to attach
  // its diagnostics and screenshot under that observed runner slowdown.
  test.setTimeout(360_000);
  await page.goto("/?skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
    return diagnostics?.playerCount === 12 && diagnostics?.animationClips > 0 && diagnostics?.appearance?.riggedPlayers === 12 && diagnostics?.appearance?.visibleKitPlayers === 12;
  }, null, { timeout: 150_000 });
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics() }));
  expect(result.model.appearance.riggedPlayers).toBe(12);
  expect(result.model.appearance.fallbackPlayers).toBe(0);
  expect(result.model.appearance.visibleKitPlayers).toBe(12);
  expect(result.model.appearance.bootlessPlayers).toBe(0);
  expect(result.model.appearance.preservedMapPlayers).toBe(12);
  const home = result.model.appearance.players.find((player) => player.team === 0 && player.role !== "GK");
  const away = result.model.appearance.players.find((player) => player.team === 1 && player.role !== "GK");
  const keeper = result.model.appearance.players.find((player) => player.role === "GK");
  for (const player of [home, away, keeper]) {
    expect(player).toBeTruthy(); expect(player.mode).toBe("asset"); expect(player.rigKitInstalled).toBe(true); expect(player.visibleKitNodeCount).toBe(7); expect(player.bootGeometryCount).toBe(2); expect(player.preservedMapCount).toBeGreaterThan(0);
    expect(player.rigKitNodes.map((node) => node.name)).toEqual(expect.arrayContaining(["TonyRigJersey", "TonyRigShorts", "TonyRigBootLeft", "TonyRigBootRight"]));
  }
  expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14);
  expect(result.scene.geometry.worldScale).toBe(DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit);
  expect(result.scene.geometry.goal.width).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.goal.frameWidthMetres, 5);
  expect(result.scene.geometry.goal.height).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.goal.crossbarHeightMetres, 5);
  expect(result.model.projection).toEqual({
    profileId: DEFAULT_SIMULATION_SCALE_PROFILE.id,
    width: DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldWidth,
    height: DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldHeight,
    scale: DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit,
  });
  for (const player of result.model.appearance.players) {
    expect(player.scale?.profileId).toBe(DEFAULT_SIMULATION_SCALE_PROFILE.id);
    expect(player.scale?.mode).toBe("measured-rig");
    expect(player.scale?.measuredRigHeight).toBeGreaterThan(0);
    expect(player.scale?.targetHeight).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits, 5);
    expect(player.scale?.projectedHeight).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits, 4);
  }

  await page.evaluate(() => document.getElementById("quickMatchButton")?.click());
  await page.waitForFunction(() => document.body.dataset.flow === "match-setup");
  await page.evaluate(() => document.getElementById("playButton")?.click());
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 30_000 });
  await expect(page.locator("#gameCanvas")).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const liveEvidence = await page.evaluate(() => ({
    appearance: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance,
    engineTick: window.__TONY_DEBUG__.diagnostics().engineSnapshot.tick,
    state: window.__TONY_DEBUG__.diagnostics().state,
    projection: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().projection,
    sceneGeometry: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics().geometry,
  }));
  expect(liveEvidence.state).toBe("playing"); expect(liveEvidence.engineTick).toBeGreaterThan(0);
  expect(liveEvidence.appearance.riggedPlayers).toBe(12); expect(liveEvidence.appearance.visibleKitPlayers).toBe(12); expect(liveEvidence.appearance.bootlessPlayers).toBe(0);

  const motionBefore = await page.evaluate(() => {
    const diagnostics = window.__TONY_DEBUG__.diagnostics();
    const id = diagnostics.renderState.selectedPlayerId;
    const player = window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance.players.find((entry) => entry.id === id);
    return player?.motion ? { id, ...player.motion } : null;
  });
  expect(motionBefore).toBeTruthy();
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => page.evaluate((id) => {
    const player = window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance.players.find((entry) => entry.id === id);
    return Boolean(
      player?.motion?.speed > 26
      && ["Jog_Fwd_Loop", "Sprint_Loop"].includes(player.motion.animationState)
    );
  }, motionBefore.id), { timeout: 15_000 }).toBe(true);
  const motionAfter = await page.evaluate((id) => {
    const player = window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance.players.find((entry) => entry.id === id);
    return player?.motion ? { id, ...player.motion } : null;
  }, motionBefore.id);
  await page.keyboard.up("ArrowRight");
  expect(motionAfter.speed).toBeGreaterThan(26);
  expect(["Jog_Fwd_Loop", "Sprint_Loop"]).toContain(motionAfter.animationState);
  expect(motionAfter.animationTimeScale).toBeGreaterThanOrEqual(.78);
  expect(motionAfter.animationTimeScale).toBeLessThanOrEqual(1.42);
  expect(Math.abs(motionAfter.snapshotX - motionBefore.snapshotX)).toBeGreaterThan(1);
  expect(Math.abs((motionAfter.snapshotX - motionBefore.snapshotX) * DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit - (motionAfter.worldX - motionBefore.worldX))).toBeLessThan(.12);
  liveEvidence.motion = { before: motionBefore, after: motionAfter };

  const devtools = await page.context().newCDPSession(page);
  const capturedModes = [];
  const captureCamera = async (mode, attachmentName, minimumCoverage = null) => {
    await page.waitForFunction((expected) => window.__TONY_CAMERA_REPLAY_BRIDGE__?.diagnostics?.().camera.mode === expected, mode);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const scene = await page.evaluate(() => window.__TONY_THREE_SCENE_BRIDGE__.diagnostics());
    expect(scene.cameraPose).toBeTruthy();
    expect(scene.pitchCoverage).toBeTruthy();
    if (minimumCoverage) {
      expect(scene.pitchCoverage.widthRatio, `${mode} pitch width coverage`).toBeGreaterThanOrEqual(minimumCoverage.width);
      expect(scene.pitchCoverage.heightRatio, `${mode} pitch height coverage`).toBeGreaterThanOrEqual(minimumCoverage.height);
      expect(scene.pitchCoverage.boundingAreaRatio, `${mode} pitch bounding-area coverage`).toBeGreaterThanOrEqual(minimumCoverage.area);
    }
    const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await testInfo.attach(attachmentName, { body: Buffer.from(screenshot.data, "base64"), contentType: "image/png" });
    capturedModes.push({ mode, cameraPose: scene.cameraPose, pitchCoverage: scene.pitchCoverage, stadium: scene.stadium });
  };
  await captureCamera("broadcast", "ton-87-world-scale-broadcast.png", { width: .82, height: .48, area: .4 });
  await page.keyboard.press("KeyB");
  await captureCamera("close", "ton-87-world-scale-close.png");
  await page.keyboard.press("KeyB");
  await captureCamera("tactical", "ton-87-world-scale-tactical.png", { width: .88, height: .62, area: .54 });
  await devtools.detach();
  liveEvidence.cameraModes = capturedModes;
  await testInfo.attach("ton-87-world-scale-evidence.json", { body: Buffer.from(JSON.stringify(liveEvidence, null, 2)), contentType: "application/json" });
});
