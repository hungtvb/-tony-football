import { expect, test } from "@playwright/test";

async function openPostMatch(page) {
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    window.__TONY_DEBUG__?.ready === true
    && window.__TONY_POST_MATCH__?.ready === true
  ));
}

async function preview(page, options) {
  await page.evaluate((payload) => window.__TONY_POST_MATCH__.preview(payload), options);
  await expect(page.locator("#resultOverlay")).toHaveClass(/show/);
  await expect(page.locator("body")).toHaveAttribute("data-flow", "result");
}

test("post-match hub renders the final score, statistics, and three actions", async ({ page }) => {
  await openPostMatch(page);
  await preview(page, {
    homeScore: 4,
    awayScore: 2,
    homePossession: 61,
    homeShots: 11,
    awayShots: 6,
    passAccuracy: 84,
  });

  await expect(page.locator("#resultTitle")).toHaveText("CHIẾN THẮNG!");
  await expect(page.locator("#resultOutcomeLabel")).toHaveText("3 ĐIỂM THUYẾT PHỤC");
  await expect(page.locator("#finalHome")).toHaveText("4");
  await expect(page.locator("#finalAway")).toHaveText("2");
  await expect(page.locator("#resultHomePossession")).toHaveText("61%");
  await expect(page.locator("#resultAwayPossession")).toHaveText("39%");
  await expect(page.locator("#resultHomeShots")).toHaveText("11");
  await expect(page.locator("#resultAwayShots")).toHaveText("6");
  await expect(page.locator("#resultPassAccuracy")).toHaveText("84%");
  await expect(page.locator("#playAgainButton")).toContainText("ĐÁ LẠI NGAY");
  await expect(page.locator("#resultSetupButton")).toContainText("ĐỔI THIẾT LẬP");
  await expect(page.locator("#resultMainMenuButton")).toContainText("VỀ MÀN HÌNH CHÍNH");

  const diagnostics = await page.evaluate(() => window.__TONY_POST_MATCH__.diagnostics());
  expect(diagnostics.competingVisible).toEqual([]);
});

test("play again keeps the selected match setup and starts immediately", async ({ page }) => {
  await openPostMatch(page);
  await page.locator("#quickMatchButton").click();
  await page.locator('[data-difficulty="legend"]').click();
  await page.locator('[data-pitch="midnight"]').click();
  await page.locator('[data-ball="volt"]').click();
  await page.locator('[data-weather="rain"]').click();

  await preview(page, { homeScore: 1, awayScore: 0 });
  await page.locator("#playAgainButton").click();

  await expect(page.locator("body")).toHaveAttribute("data-flow", "match");
  await expect(page.locator("#resultOverlay")).not.toHaveClass(/show/);
  await expect(page.locator('[data-difficulty="legend"]')).toHaveClass(/active/);
  await expect(page.locator('[data-pitch="midnight"]')).toHaveClass(/active/);
  await expect(page.locator('[data-ball="volt"]')).toHaveClass(/active/);
  await expect(page.locator('[data-weather="rain"]')).toHaveClass(/active/);
});

test("post-match navigation returns to setup and the main menu", async ({ page }) => {
  await openPostMatch(page);
  await preview(page, { homeScore: 2, awayScore: 2 });
  await page.locator("#resultSetupButton").click();

  await expect(page.locator("body")).toHaveAttribute("data-flow", "match-setup");
  await expect(page.locator("#startOverlay")).toHaveClass(/show/);
  await expect(page.locator("#resultOverlay")).not.toHaveClass(/show/);

  await preview(page, { homeScore: 0, awayScore: 2 });
  await page.locator("#resultMainMenuButton").click();

  await expect(page.locator("body")).toHaveAttribute("data-flow", "main-menu");
  await expect(page.locator("#mainMenuOverlay")).toHaveClass(/show/);
  await expect(page.locator("#resultOverlay")).not.toHaveClass(/show/);
});
