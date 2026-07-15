import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

async function openGoalTest(page) {
  await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_GOAL_PRESENTATION__?.ready === true
  ));
}

test("goal presentation shows team score and replay stages", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    void window.__TONY_GOAL_PRESENTATION__.preview({
      team: "home",
      score: [2, 1],
      replay: true,
    });
  });

  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === true);

  const overlay = page.locator("#goalPresentationOverlay");
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "home");
  await expect(overlay).toHaveAttribute("data-stage", "goal");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("TONY FC");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("TF");
  await expect(page.locator("#goalPresentationHomeScore")).toHaveText("2");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    const required = ["goal", "score", "replay", "complete", "hidden"];
    return diagnostics.running === false && required.every((stage) => diagnostics.history.includes(stage));
  });

  await expect(overlay).not.toHaveClass(/show/);
});

test("score observer automatically presents an away goal during a match", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    document.body.dataset.flow = "match";
    document.getElementById("awayScore").textContent = "1";
  });

  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === true);

  const overlay = page.locator("#goalPresentationOverlay");
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "away");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("NEON UTD");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("NU");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
  await expect(overlay).not.toHaveClass(/show/);
});
