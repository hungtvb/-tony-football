import { expect, test } from "@playwright/test";

async function openMatchSetup(page) {
  await page.goto("/?visualTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__TONY_DEBUG__?.ready === true && window.__TONY_MATCH_INTRO__?.ready === true,
  );
  await expect(page.locator("#mainMenuOverlay")).toHaveClass(/show/);
  await page.locator("#quickMatchButton").click();
  await expect(page.locator("#startOverlay")).toHaveClass(/show/);
}

test("match setup enters versus countdown kickoff and playing", async ({ page }) => {
  await openMatchSetup(page);

  await page.locator('[data-difficulty="legend"]').click();
  await page.locator('[data-pitch="midnight"]').click();
  await page.locator('[data-ball="volt"]').click();
  await page.locator('[data-weather="rain"]').click();
  await page.locator("#playButton").click();

  const intro = page.locator("#matchIntroOverlay");
  await expect(intro).toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match-intro");
  await expect(page.locator("#introDifficulty")).toHaveText("LEGEND");
  await expect(page.locator("#introPitch")).toHaveText("MIDNIGHT");
  await expect(page.locator("#introBall")).toHaveText("VOLT");
  await expect(page.locator("#introWeather")).toHaveText("TRỜI MƯA");

  await page.waitForFunction(() => {
    const history = window.__TONY_MATCH_INTRO__?.history ?? [];
    return ["versus", "countdown:3", "countdown:2", "countdown:1", "kickoff", "complete"]
      .every((stage) => history.includes(stage));
  });

  await expect(intro).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match");
  const gameState = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state);
  expect(gameState).toBe("playing");
});

test("gameplay remains locked until the presentation completes", async ({ page }) => {
  await openMatchSetup(page);
  await page.locator("#playButton").click();

  await expect(page.locator("#matchIntroOverlay")).toHaveClass(/show/);
  const stateDuringIntro = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state);
  expect(stateDuringIntro).toBe("menu");

  await page.evaluate(() => window.__TONY_MATCH_INTRO__.skip());
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match");
  await expect(page.locator("#matchIntroOverlay")).not.toHaveClass(/show/);
});
