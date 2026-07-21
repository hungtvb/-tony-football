import { expect, test } from "./fixtures.mjs";

test("visual-test composition owns snapshot-driven fallback player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
  expect(result.model.appearance.fallbackPlayers).toBe(12); expect(result.model.appearance.bootlessPlayers).toBe(0);
});

test("normal asset mode preserves kit maps and visible footwear for home, away and keeper players", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop live-match asset proof is sufficient");
  test.setTimeout(180_000);
  await page.goto("/?skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
    return diagnostics?.playerCount === 12 && diagnostics?.appearance?.riggedPlayers === 12;
  }, null, { timeout: 150_000 });
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics() }));
  expect(result.model.appearance.riggedPlayers).toBe(12);
  expect(result.model.appearance.fallbackPlayers).toBe(0);
  expect(result.model.appearance.bootlessPlayers).toBe(0);
  expect(result.model.appearance.preservedMapPlayers).toBe(12);
  const home = result.model.appearance.players.find((player) => player.team === 0 && player.role !== "GK");
  const away = result.model.appearance.players.find((player) => player.team === 1 && player.role !== "GK");
  const keeper = result.model.appearance.players.find((player) => player.role === "GK");
  for (const player of [home, away, keeper]) {
    expect(player).toBeTruthy(); expect(player.mode).toBe("asset"); expect(player.bootCount).toBeGreaterThan(0); expect(player.preservedMapCount).toBeGreaterThan(0);
  }
  expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14);

  await page.evaluate(() => document.getElementById("quickMatchButton")?.click());
  await page.waitForFunction(() => document.body.dataset.flow === "match-setup");
  await page.evaluate(() => document.getElementById("playButton")?.click());
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing", null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().engineSnapshot?.kickoffTimer === 0, null, { timeout: 30_000 });
  await expect(page.locator("#gameCanvas")).toBeVisible();

  const liveEvidence = await page.evaluate(() => ({
    appearance: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics().appearance,
    engineTick: window.__TONY_DEBUG__.diagnostics().engineSnapshot.tick,
    state: window.__TONY_DEBUG__.diagnostics().state,
  }));
  expect(liveEvidence.state).toBe("playing");
  expect(liveEvidence.engineTick).toBeGreaterThan(0);
  expect(liveEvidence.appearance.riggedPlayers).toBe(12);
  expect(liveEvidence.appearance.bootlessPlayers).toBe(0);

  await testInfo.attach("ton-93-asset-appearance.json", { body: Buffer.from(JSON.stringify(liveEvidence, null, 2)), contentType: "application/json" });
  await testInfo.attach("ton-93-live-asset-pitch.png", { body: await page.locator("#gameCanvas").screenshot({ timeout: 30_000 }), contentType: "image/png" });
});
