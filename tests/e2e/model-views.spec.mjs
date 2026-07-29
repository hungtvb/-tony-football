import { expect, test } from "./fixtures.mjs";

function captureRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function captureViewport(page) {
  const devtools = await page.context().newCDPSession(page);
  const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await devtools.detach();
  return Buffer.from(screenshot.data, "base64");
}

async function captureCanvasCenter(page) {
  const rect = await page.evaluate(() => {
    const bounds = document.getElementById("gameCanvas")?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, bounds.x + bounds.width * .22),
      y: Math.max(0, bounds.y + bounds.height * .08),
      width: Math.max(1, bounds.width * .56),
      height: Math.max(1, bounds.height * .84),
    };
  });
  expect(rect).toBeTruthy();
  const devtools = await page.context().newCDPSession(page);
  const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false, clip: { ...rect, scale: 1.65 } });
  await devtools.detach();
  return Buffer.from(screenshot.data, "base64");
}

test("visual-test composition owns snapshot-driven fallback player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
  expect(result.model.appearance.fallbackPlayers).toBe(12); expect(result.model.appearance.bootlessPlayers).toBe(0);
});

test("normal asset mode preserves source maps and renders body-conforming football appearance with hair", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop live-match asset proof is sufficient");
  test.setTimeout(240_000);
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto("/?skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
    return diagnostics?.playerCount === 12
      && diagnostics?.animationClips > 0
      && diagnostics?.appearance?.riggedPlayers === 12
      && diagnostics?.appearance?.visibleKitPlayers === 12;
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
    expect(player).toBeTruthy();
    expect(player.mode).toBe("asset");
    expect(player.rigKitInstalled).toBe(true);
    expect(player.appearanceMode).toBe("integrated-body-material");
    expect(player.integratedBodySurfaceCount).toBe(1);
    expect(player.skinnedSurfaceCount).toBe(1);
    expect(player.bootRegionCount).toBe(2);
    expect(player.visibleKitNodeCount).toBe(7);
    expect(player.bootGeometryCount).toBe(2);
    expect(player.hairGeometryCount).toBeGreaterThanOrEqual(1);
    expect(player.rigidPrimitiveCount).toBe(0);
    expect(player.preservedMapCount).toBeGreaterThan(0);
    expect(player.surfaceMapPreservedCount).toBeGreaterThan(0);
    expect(player.rigKitNodes.map((node) => node.name)).toEqual(expect.arrayContaining(["SuperHero_Male", "TonyRigHair"]));
    const fitted = player.rigKitNodes.filter((node) => node.integratedBody && node.skinned && node.bodyConforming);
    expect(fitted).toHaveLength(1);
    expect(fitted[0].bootRegions).toBe(2);
    expect(fitted[0].kitRegions).toBe(5);
    expect(player.rigKitNodes.filter((node) => node.hair)).toHaveLength(1);
    expect(player.rigKitNodes.filter((node) => !node.skinned && !node.hair)).toHaveLength(0);
  }
  expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14);

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
  expect(Math.abs((motionAfter.snapshotX - motionBefore.snapshotX) * .1 - (motionAfter.worldX - motionBefore.worldX))).toBeLessThan(.2);
  liveEvidence.motion = { before: motionBefore, after: motionAfter };

  await testInfo.attach("ton-94-asset-appearance.json", { body: Buffer.from(JSON.stringify(liveEvidence, null, 2)), contentType: "application/json" });
  await testInfo.attach("ton-94-live-asset-pitch.png", { body: await captureViewport(page), contentType: "image/png" });
  await testInfo.attach("ton-94-live-asset-close.png", { body: await captureCanvasCenter(page), contentType: "image/png" });
  expect(runtimeErrors).toEqual([]);
});
