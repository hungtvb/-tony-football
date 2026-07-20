import { expect, test } from "./fixtures.mjs";

test("production model adapter owns snapshot-driven player and ball views", async ({ page }) => {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.().playerCount === 12);
  const result = await page.evaluate(() => ({ model: window.__TONY_MODEL_VIEW_BRIDGE__.diagnostics(), scene: window.__TONY_THREE_SCENE_BRIDGE__.diagnostics(), debugModel: window.__TONY_DEBUG__?.modelViews ?? null }));
  expect(result.model.owner).toBe("browser-model-views"); expect(result.model.attached).toBe(true); expect(result.model.playerCount).toBe(12); expect(result.model.ballAttached).toBe(true); expect(result.model.assetState).toBe("ready"); expect(result.scene.owner).toBe("clean-host"); expect(result.scene.foreignObjects).toBeGreaterThanOrEqual(14); expect(result.debugModel.owner).toBe("browser-model-views");
});
