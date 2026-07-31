import { expect, test } from "./fixtures.mjs";

test("visual-test composition owns snapshot-driven fallback player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
  expect(result.model.appearance.fallbackPlayers).toBe(12); expect(result.model.appearance.bootlessPlayers).toBe(0);
});

test("normal asset mode renders six deterministic Player V3 variants on the existing animated rig", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop live-match asset proof is sufficient");
  test.setTimeout(240_000);
  await page.goto("/?skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
    return diagnostics?.playerCount === 12
      && diagnostics?.animationClips > 0
      && diagnostics?.appearance?.riggedPlayers === 12
      && diagnostics?.appearance?.visibleKitPlayers === 12
      && diagnostics?.appearance?.distinctVariants === 6;
  }, null, { timeout: 150_000 });
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
    expect(player.hairGeometryCount).toBeGreaterThanOrEqual(1);
    expect(player.rigidPrimitiveCount).toBe(0);
    expect(player.visibleKitNodeCount).toBe(7);
    expect(player.bootGeometryCount).toBe(2);
    expect(player.preservedMapCount).toBeGreaterThan(0);
    expect(player.variantIndex).toBeGreaterThanOrEqual(0);
    expect(player.variantIndex).toBeLessThan(6);
    expect(player.variantName).toBeTruthy();
    expect(player.kitPattern).toBeTruthy();
    expect(player.hairStyle).toBeTruthy();
    const body = player.rigKitNodes.find((node) => node.integratedBody);
    const hair = player.rigKitNodes.find((node) => node.hair);
    expect(body?.name).toBe("SuperHero_Male");
    expect(body?.skinned).toBe(true);
    expect(body?.bodyConforming).toBe(true);
    expect(body?.variantIndex).toBe(player.variantIndex);
    expect(body?.kitPattern).toBe(player.kitPattern);
    expect(hair?.name).toBe("TonyPlayerV3Hair");
    expect(hair?.hairStyle).toBe(player.hairStyle);
    expect(player.rigKitNodes.filter((node) => !node.integratedBody && !node.hair)).toHaveLength(0);
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
  expect(liveEvidence.appearance.riggedPlayers).toBe(12); expect(liveEvidence.appearance.visibleKitPlayers).toBe(12); expect(liveEvidence.appearance.bootlessPlayers).toBe(0); expect(liveEvidence.appearance.distinctVariants).toBe(6);

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
  expect(Math.abs((motionAfter.snapshotX - motionBefore.snapshotX) * .1 - (motionAfter.worldX - motionBefore.worldX))).toBeLessThan(.2);
  liveEvidence.motion = { before: motionBefore, after: motionAfter };

  const devtools = await page.context().newCDPSession(page);
  const screenshot = await devtools.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await devtools.detach();
  await testInfo.attach("ton-193-player-v3-appearance.json", { body: Buffer.from(JSON.stringify(liveEvidence, null, 2)), contentType: "application/json" });
  await testInfo.attach("ton-193-player-v3-live-pitch.png", { body: Buffer.from(screenshot.data, "base64"), contentType: "image/png" });
});
