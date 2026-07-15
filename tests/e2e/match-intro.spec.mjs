import { expect, test } from "./fixtures.mjs";

test.describe.configure({ timeout: 90_000 });

async function openMatchSetup(page) {
  await page.goto("/?visualTest=1&introTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__TONY_DEBUG__?.ready === true && window.__TONY_MATCH_INTRO__?.ready === true,
  );
  await expect(page.locator("#mainMenuOverlay")).toHaveClass(/show/);
  await page.locator("#quickMatchButton").click();
  await expect(page.locator("#startOverlay")).toHaveClass(/show/);
}

async function applyIntroFixture(page) {
  await page.evaluate(() => {
    for (const selector of [
      '[data-difficulty="legend"]',
      '[data-pitch="midnight"]',
      '[data-ball="volt"]',
      '[data-weather="rain"]',
    ]) {
      document.querySelector(selector)?.click();
    }
  });

  await page.waitForFunction(() => (
    document.querySelector('[data-difficulty="legend"]')?.classList.contains("active")
    && document.querySelector('[data-pitch="midnight"]')?.classList.contains("active")
    && document.querySelector('[data-ball="volt"]')?.classList.contains("active")
    && document.querySelector('[data-weather="rain"]')?.classList.contains("active")
  ));
}

async function waitForHeldIntro(page) {
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MATCH_INTRO__?.diagnostics();
    return diagnostics?.running === true
      && diagnostics.held === true
      && diagnostics.flow === "match-intro"
      && diagnostics.visible === true;
  });
}

test("match setup enters versus countdown kickoff and playing", async ({ page }) => {
  await openMatchSetup(page);
  await applyIntroFixture(page);
  await page.locator("#playButton").click();
  await waitForHeldIntro(page);

  const intro = page.locator("#matchIntroOverlay");
  await expect(intro).toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match-intro");
  await expect(page.locator("#introDifficulty")).toHaveText("LEGEND");
  await expect(page.locator("#introPitch")).toHaveText("MIDNIGHT");
  await expect(page.locator("#introBall")).toHaveText("VOLT");
  await expect(page.locator("#introWeather")).toHaveText("TRỜI MƯA");

  await page.evaluate(() => window.__TONY_MATCH_INTRO__.releaseTestHold());
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_MATCH_INTRO__?.diagnostics();
    const required = ["versus", "countdown:3", "countdown:2", "countdown:1", "kickoff", "complete"];
    return diagnostics?.flow === "match" && required.every((stage) => diagnostics.history.includes(stage));
  }, undefined, { timeout: 30_000 });

  await expect(intro).not.toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match");
  const gameState = await page.evaluate(() => window.__TONY_DEBUG__.diagnostics().state);
  expect(gameState).toBe("playing");
});

test("gameplay remains locked until the presentation completes", async ({ page }) => {
  await openMatchSetup(page);
  await page.locator("#playButton").click();
  await waitForHeldIntro(page);

  const introDiagnostics = await page.evaluate(() => ({
    intro: window.__TONY_MATCH_INTRO__.diagnostics(),
    gameState: window.__TONY_DEBUG__.diagnostics().state,
  }));
  expect(introDiagnostics.intro.state).toBe("versus");
  expect(introDiagnostics.gameState).toBe("menu");
  await expect(page.locator("#matchIntroOverlay")).toHaveClass(/show/);

  await page.evaluate(() => window.__TONY_MATCH_INTRO__.skip());
  await page.waitForFunction(() => window.__TONY_MATCH_INTRO__?.diagnostics().flow === "match");
  await expect(page.locator("body")).toHaveAttribute("data-flow", "match");
  await expect(page.locator("#matchIntroOverlay")).not.toHaveClass(/show/);
});
