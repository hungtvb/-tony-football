import { expect, test } from "./fixtures.mjs";

import { installEngineRuntimeHarness } from "./engine-runtime-harness.mjs";

test.describe.configure({ timeout: 60_000 });

test("default engine advances AI actions, authoritative statistics, and HUD projection", async ({ page }) => {
  await installEngineRuntimeHarness(page);
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);

  await page.locator("#quickMatchButton").click();
  await page.locator("#playButton").click();
  await expect.poll(
    () => page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state),
  ).toBe("playing");

  await page.evaluate(() => {
    window.__TONY_ACTIVITY_EVIDENCE__ = [];
    window.addEventListener("tony:game-event", ({ detail }) => {
      if (detail.type === "ball:kicked") {
        window.__TONY_ACTIVITY_EVIDENCE__.push({
          type: detail.payload.type,
          playerId: detail.payload.playerId,
        });
      }
    });
  });

  for (let chunk = 0; chunk < 9; chunk += 1) {
    await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(600));
    await page.waitForTimeout(0);
  }

  const evidence = await page.evaluate(() => ({
    kicks: window.__TONY_ACTIVITY_EVIDENCE__,
    snapshot: window.__TONY_DEBUG__.diagnostics().engineSnapshot,
  }));
  const homePasses = evidence.kicks.filter(({ type, playerId }) => (
    playerId.startsWith("home-") && type !== "ball:shoot"
  ));
  const shots = evidence.kicks.filter(({ type }) => type === "ball:shoot");

  expect(homePasses.length).toBeGreaterThan(0);
  expect(shots.length).toBeGreaterThan(0);
  expect(evidence.snapshot.stats.passes).toBeGreaterThan(0);
  expect(evidence.snapshot.stats.shots.some((count) => count > 0)).toBe(true);

  await expect.poll(() => page.evaluate(() => {
    const stats = window.__TONY_DEBUG__.diagnostics().engineSnapshot.stats;
    const expectedAccuracy = stats.passes > 0
      ? Math.round(stats.completed / stats.passes * 100)
      : 0;
    return document.querySelector("#homeShots").textContent === String(stats.shots[0])
      && document.querySelector("#awayShots").textContent === String(stats.shots[1])
      && document.querySelector("#passStat").textContent === `${expectedAccuracy}%`;
  })).toBe(true);
});
