import { expect, test } from "./fixtures.mjs";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../../src/game/config/simulationScaleProfile.js";

test("visual-test composition owns snapshot-driven fallback player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
  expect(result.model.appearance.fallbackPlayers).toBe(12); expect(result.model.appearance.bootlessPlayers).toBe(0);
});

test("normal asset mode renders six deterministic Player V3 variants on the existing animated rig", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop live-match asset proof is sufficient");
  test.setTimeout(360_000);
  await page.goto("/?skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
    return diagnostics?.playerCount === 12
      && diagnostics?.animationClips > 0
      && diagnostics?.appearance?.riggedPlayers === 12
      && diagnostics?.appearance?.visibleKitPlayers === 12
      && diagnostics?.appearance?.distinctVariants === 6;
  }, null, { timeout: 180_000 });
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics() }));
  const appearance = result.model.appearance;
  expect(appearance.riggedPlayers).toBe(12);
  expect(appearance.fallbackPlayers).toBe(0);
  expect(appearance.visibleKitPlayers).toBe(12);
  expect(appearance.bootlessPlayers).toBe(0);
  expect(appearance.hairlessPlayers).toBe(0);
  expect(appearance.preservedMapPlayers).toBe(12);
  expect(appearance.distinctVariants).toBe(6);

  for (const team of [0, 1]) {
    const teamVariants = appearance.players
      .filter((player) => player.team === team)
      .map((player) => player.variantIndex)
      .sort((left, right) => left - right);
    expect(teamVariants).toEqual([0, 1, 2, 3, 4, 5]);
  }

  const home = appearance.players.find((player) => player.team === 0 && player.role !== "GK");
  const away = appearance.players.find((player) => player.team === 1 && player.role !== "GK");
  const keeper = appearance.players.find((player) => player.role === "GK");
  for (const player of [home, away, keeper]) {
    expect(player).toBeTruthy();
    expect(player.mode).toBe("asset");
    expect(player.rigKitInstalled).toBe(true);
    expect(player.appearanceMode).toBe("player-v3-integrated-body-material");
    expect(player.skinnedSurfaceCount).toBe(1);
    expect(player.integratedBodySurfaceCount).toBe(1);
    expect(player.bootRegionCount).toBe(2);
    expect(player.bootGeometryCount).toBe(2);
    expect(player.bootSurfaceCount).toBe(2);
    expect(player.hairGeometryCount).toBeGreaterThanOrEqual(2);
    expect(player.hairCoverageComplete).toBe(true);
    expect(player.measuredHeadBounds).toBe(true);
    expect(player.kitCoverageComplete).toBe(true);
    expect(player.rigidPrimitiveCount).toBe(0);
    expect(player.visibleKitNodeCount).toBe(7);
    expect(player.preservedMapCount).toBeGreaterThan(0);
    expect(player.variantIndex).toBeGreaterThanOrEqual(0);
    expect(player.variantIndex).toBeLessThan(6);
    expect(player.variantName).toBeTruthy();
    expect(player.kitPattern).toBeTruthy();
    expect(player.hairStyle).toBeTruthy();

    const body = player.rigKitNodes.find((node) => node.integratedBody);
    const hairCap = player.rigKitNodes.find((node) => node.hairCoverageLayer === "scalp-cap");
    const hairCrown = player.rigKitNodes.find((node) => node.hairCoverageLayer === "crown");
    const boots = player.rigKitNodes.filter((node) => node.boot);
    expect(body?.name).toBe("SuperHero_Male");
    expect(body?.skinned).toBe(true);
    expect(body?.bodyConforming).toBe(true);
    expect(body?.variantIndex).toBe(player.variantIndex);
    expect(body?.kitPattern).toBe(player.kitPattern);
    expect(body?.coverage?.complete).toBe(true);
    expect(body?.coverage?.jerseyVertices).toBeGreaterThan(0);
    expect(body?.coverage?.shortsVertices).toBeGreaterThan(0);
    expect(body?.coverage?.sockVertices).toBeGreaterThan(0);
    expect(body?.coverage?.leftBootVertices).toBeGreaterThan(0);
    expect(body?.coverage?.rightBootVertices).toBeGreaterThan(0);
    expect(hairCap?.name).toBe("TonyPlayerV3Hair");
    expect(hairCrown?.name).toBe("TonyPlayerV3HairCrown");
    expect(hairCap?.hairStyle).toBe(player.hairStyle);
    expect(hairCrown?.hairStyle).toBe(player.hairStyle);
    expect(hairCap?.skinned).toBe(true);
    expect(hairCrown?.skinned).toBe(true);
    expect(hairCap?.surfaceKind).toBe("player-v3-skinned-hair");
    expect(hairCrown?.surfaceKind).toBe("player-v3-skinned-hair");
    expect(boots).toHaveLength(2);
    expect(boots.every((node) => node.skinned)).toBe(true);
    expect(boots.every((node) => node.bodyConforming)).toBe(true);
    expect(boots.every((node) => node.surfaceKind === "player-v3-skinned-footwear")).toBe(true);
    expect(player.rigKitNodes.filter((node) => !node.integratedBody && !node.hair && !node.boot)).toHaveLength(0);
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
  for (const player of appearance.players) {
    expect(player.scale?.profileId).toBe(DEFAULT_SIMULATION_SCALE_PROFILE.id);
    expect(player.scale?.mode).toBe("measured-rig");
    expect(player.scale?.measuredRigHeight).toBeGreaterThan(0);
    expect(player.scale?.targetHeight).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits, 5);
    expect(player.scale?.projectedHeight).toBeCloseTo(DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits, 4);
  }

  await page.evaluate(() => document.getElementById("quickMatchButton")?.click());
  await page.waitForFunction(() => document.body.dataset.flow === "match-setup");
  await page.evaluate(() => document.getElementById("playButton")?.click());
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 45_000 });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 45_000 });
  const canvas = page.locator("#gameCanvas");
  await expect(canvas).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const liveEvidence = await page.evaluate(() => ({
    appearance: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance,
    engineTick: window.__TONY_DEBUG__.diagnostics().engineSnapshot.tick,
    state: window.__TONY_DEBUG__.diagnostics().state,
    projection: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().projection,
    sceneGeometry: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics().geometry,
  }));
  expect(liveEvidence.state).toBe("playing");
  expect(liveEvidence.engineTick).toBeGreaterThan(0);
  expect(liveEvidence.appearance.riggedPlayers).toBe(12);
  expect(liveEvidence.appearance.visibleKitPlayers).toBe(12);
  expect(liveEvidence.appearance.bootlessPlayers).toBe(0);
  expect(liveEvidence.appearance.hairlessPlayers).toBe(0);
  expect(liveEvidence.appearance.distinctVariants).toBe(6);

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
    return Boolean(player?.motion?.speed > 26 && ["Jog_Fwd_Loop", "Sprint_Loop"].includes(player.motion.animationState));
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
    const evidence = { mode, cameraPose: scene.cameraPose, pitchCoverage: scene.pitchCoverage, stadium: scene.stadium };
    const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await testInfo.attach(attachmentName, { body: Buffer.from(screenshot.data, "base64"), contentType: "image/png" });
    await testInfo.attach(`${mode}-pitch-coverage.json`, { body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: "application/json" });
    capturedModes.push(evidence);
    if (minimumCoverage) {
      expect(scene.pitchCoverage.fullyVisible, `${mode} must keep the full pitch visible`).toBe(true);
      expect(scene.pitchCoverage.visibleCornerCount, `${mode} visible pitch corners`).toBe(4);
      expect(scene.pitchCoverage.widthRatio, `${mode} pitch width coverage`).toBeGreaterThanOrEqual(minimumCoverage.width);
      expect(scene.pitchCoverage.heightRatio, `${mode} pitch height coverage`).toBeGreaterThanOrEqual(minimumCoverage.height);
      expect(scene.pitchCoverage.boundingAreaRatio, `${mode} pitch bounding-area coverage`).toBeGreaterThanOrEqual(minimumCoverage.area);
    }
  };
  await captureCamera("broadcast", "ton-193-player-v3-broadcast.png", { width: .82, height: .48, area: .4 });
  await page.keyboard.press("KeyB");
  await captureCamera("close", "ton-193-player-v3-close.png");
  await page.keyboard.press("KeyB");
  await captureCamera("tactical", "ton-193-player-v3-tactical.png", { width: .88, height: .62, area: .54 });
  await devtools.detach();
  liveEvidence.cameraModes = capturedModes;

  const screenshot = await page.screenshot({ type: "png", animations: "disabled" });
  await testInfo.attach("ton-193-player-v3-live-pitch.png", { body: screenshot, contentType: "image/png" });
  await testInfo.attach("ton-193-player-v3-appearance.json", { body: Buffer.from(JSON.stringify(liveEvidence, null, 2)), contentType: "application/json" });
});
