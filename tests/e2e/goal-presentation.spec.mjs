import { expect, test } from "./fixtures.mjs";

test.describe.configure({ timeout: 60_000 });

async function openGoalTest(page) {
  await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_GOAL_PRESENTATION__?.ready === true
  ));
}

test("goal presentation yields native highlight and replay windows", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    const badge = document.getElementById("replayBadge");
    badge.textContent = "● INSTANT REPLAY";
    badge.classList.add("show");
    void window.__TONY_GOAL_PRESENTATION__.preview({
      team: "home",
      score: [2, 1],
      replay: true,
    });
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    return diagnostics.timelineHistory.some(({ phase, visible }) => (
      phase === "native-highlight" && visible === false
    ));
  });

  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "home");
  await expect(overlay).toHaveAttribute("data-stage", "goal");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("TONY FC");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("TF");
  await expect(page.locator("#goalPresentationHomeScore")).toHaveText("2");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");
  await expect(page.locator("#goalPresentationReplayFlag")).toHaveText("REPLAY AVAILABLE");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().history.includes("replay")
  ));
  await expect(overlay).not.toHaveClass(/show/);

  await page.evaluate(() => document.getElementById("replayBadge").classList.remove("show"));
  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    const required = ["goal", "score", "replay", "complete", "hidden"];
    return diagnostics.running === false && required.every((stage) => diagnostics.history.includes(stage));
  });
  await expect(overlay).not.toHaveClass(/show/);
});

test("score observer automatically presents an away goal after the highlight lead-in", async ({ page }) => {
  await openGoalTest(page);

  await page.evaluate(() => {
    document.body.dataset.flow = "match";
    document.getElementById("awayScore").textContent = "1";
  });

  await page.waitForFunction(() => {
    const diagnostics = window.__TONY_GOAL_PRESENTATION__.diagnostics();
    return diagnostics.timelineHistory.some(({ phase, visible }) => (
      phase === "native-highlight" && visible === false
    ));
  });

  const overlay = page.locator("#goalPresentationOverlay");
  await page.waitForFunction(() => (
    window.__TONY_GOAL_PRESENTATION__.diagnostics().timelinePhase === "goal-card"
  ));
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute("data-team", "away");
  await expect(page.locator("#goalPresentationTeam")).toHaveText("NEON UTD");
  await expect(page.locator("#goalPresentationCrest")).toHaveText("NU");
  await expect(page.locator("#goalPresentationAwayScore")).toHaveText("1");

  await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.releaseTestHold());
  await page.waitForFunction(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().running === false);
  await expect(overlay).not.toHaveClass(/show/);
});
