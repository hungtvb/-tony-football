import { expect, test } from "./fixtures.mjs";
import { installEngineRuntimeHarness } from "./engine-runtime-harness.mjs";

test.describe.configure({ timeout: 180_000 });

function captureRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function clickById(page, id) {
  const clicked = await page.evaluate((targetId) => {
    const element = document.getElementById(targetId);
    if (!element) return false;
    element.click();
    return true;
  }, id);
  expect(clicked, `expected #${id} to accept a click`).toBe(true);
}

async function openAndStart(page, search = "?visualTest=1&skipIntro=1&goalTest=1") {
  await page.goto(`/${search}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);
  await clickById(page, "quickMatchButton");
  await page.waitForFunction(() => document.body.dataset.flow === "match-setup");
  await clickById(page, "playButton");
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing");
  await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(120));
}

async function renderTwoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function advanceToGoalPhase(page, phase) {
  const evidence = await page.evaluate((targetPhase) => {
    const runtime = window.__TONY_E2E_BROWSER_RUNTIME__;
    for (let index = 0; index < 900; index += 1) {
      if (runtime.snapshot.match.goalSequence?.phase === targetPhase) break;
      runtime.advanceForE2E(1);
    }
    const snapshot = runtime.snapshot;
    const overlay = document.getElementById("goalPresentationOverlay");
    return {
      phase: snapshot.match.goalSequence?.phase ?? null,
      elapsed: snapshot.match.goalSequence?.elapsed ?? null,
      duration: snapshot.match.goalSequence?.duration ?? null,
      overlayVisible: overlay?.classList.contains("show") ?? false,
      stage: overlay?.dataset.stage ?? null,
      homeScore: document.getElementById("homeScore")?.textContent ?? "",
      awayScore: document.getElementById("awayScore")?.textContent ?? "",
    };
  }, phase);
  expect(evidence.phase).toBe(phase);
  await renderTwoFrames(page);
  return evidence;
}

async function finishGoalSequence(page) {
  await page.evaluate(() => {
    const runtime = window.__TONY_E2E_BROWSER_RUNTIME__;
    for (let index = 0; index < 1_200 && runtime.snapshot.match.goalSequence; index += 1) {
      runtime.advanceForE2E(1);
    }
  });
  await renderTwoFrames(page);
}

test("browser commands, possession, HUD, radar and statistics form one chronology", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop command chronology is sufficient");
  await installEngineRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page);

  const initial = await page.evaluate(() => {
    const snapshot = window.__TONY_E2E_BROWSER_RUNTIME__.snapshot;
    return {
      tick: snapshot.tick,
      selectedPlayerId: snapshot.match.selectedPlayerId,
      selectedX: snapshot.players.find((player) => player.id === snapshot.match.selectedPlayerId)?.x ?? null,
      possession: [...snapshot.match.stats.possession],
      radar: document.getElementById("radarCanvas")?.toDataURL() ?? "",
    };
  });

  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(220);
  await page.keyboard.up("KeyE");
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyS");
  await page.keyboard.press("KeyW");
  await page.keyboard.press("KeyD");
  await renderTwoFrames(page);

  const attack = await page.evaluate(() => {
    const runtime = window.__TONY_E2E_BROWSER_RUNTIME__;
    runtime.advanceForE2E(180);
    const snapshot = runtime.snapshot;
    const selected = snapshot.players.find((player) => player.id === snapshot.match.selectedPlayerId);
    return {
      tick: snapshot.tick,
      selectedX: selected?.x ?? null,
      possession: [...snapshot.match.stats.possession],
      passes: snapshot.match.stats.passes,
      shots: [...snapshot.match.stats.shots],
      commandTypes: (window.__TONY_E2E_COMMAND_LOG__ ?? []).map((entry) => entry.type),
      frozenCommands: (window.__TONY_E2E_COMMAND_LOG__ ?? []).every(Object.isFrozen),
      radar: document.getElementById("radarCanvas")?.toDataURL() ?? "",
      stamina: document.getElementById("staminaText")?.textContent ?? "",
      clock: document.getElementById("gameClock")?.textContent ?? "",
    };
  });
  expect(attack.tick).toBeGreaterThan(initial.tick);
  expect(attack.selectedX).toBeGreaterThan(initial.selectedX);
  expect(attack.possession[0] + attack.possession[1]).toBeGreaterThan(initial.possession[0] + initial.possession[1]);
  expect(attack.commandTypes).toEqual(expect.arrayContaining([
    "player:move", "player:set-sprint", "team:trigger-run", "ball:short-pass",
    "ball:through-pass", "ball:shoot",
  ]));
  expect(attack.frozenCommands).toBe(true);
  expect(attack.radar).not.toBe(initial.radar);
  expect(attack.stamina).toMatch(/^\d+%$/);
  expect(attack.clock).toMatch(/^\d{2}:\d{2}$/);

  const goalAccepted = await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.recordGoalForE2E(0));
  expect(goalAccepted).toBe(true);
  await finishGoalSequence(page);
  await page.keyboard.press("KeyS");
  await page.keyboard.press("Space");
  const defense = await page.evaluate(() => ({
    selectedPlayerId: window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(2).match.selectedPlayerId,
    commandTypes: (window.__TONY_E2E_COMMAND_LOG__ ?? []).map((entry) => entry.type),
  }));
  expect(defense.selectedPlayerId).not.toBe(initial.selectedPlayerId);
  expect(defense.commandTypes).toContain("player:switch");
  expect(defense.commandTypes).toContain("player:tackle");

  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOverlay")).toHaveClass(/show/);
  const paused = await page.evaluate(() => ({
    engine: window.__TONY_E2E_BROWSER_RUNTIME__.snapshot.match.stats,
    possession: document.getElementById("possessionStat")?.textContent ?? "",
    homeShots: Number(document.getElementById("homeShots")?.textContent ?? -1),
    awayShots: Number(document.getElementById("awayShots")?.textContent ?? -1),
    pass: document.getElementById("passStat")?.textContent ?? "",
  }));
  expect(paused.possession).toMatch(/^\d+%$/);
  expect(paused.homeShots).toBe(paused.engine.shots[0]);
  expect(paused.awayShots).toBe(paused.engine.shots[1]);
  expect(paused.pass).toMatch(/^\d+%$/);
  expect(runtimeErrors).toEqual([]);
});

test("two goal incidents expose ordered real-time cards without leaking the first incident", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop two-goal presentation chronology is sufficient");
  await installEngineRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page);
  const incidentEvidence = [];

  for (const expectedScore of [1, 2]) {
    const accepted = await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.recordGoalForE2E(0));
    expect(accepted).toBe(true);
    const goalCard = await advanceToGoalPhase(page, "goal-card");
    expect(goalCard.overlayVisible).toBe(true);
    expect(goalCard.stage).toBe("goal");
    expect(goalCard.homeScore).toBe(String(expectedScore));

    const scoreCard = await advanceToGoalPhase(page, "score-card");
    expect(scoreCard.overlayVisible).toBe(true);
    expect(scoreCard.stage).toBe("score");
    expect(scoreCard.elapsed).toBeGreaterThan(goalCard.elapsed);

    const replay = await advanceToGoalPhase(page, "replay");
    expect(replay.elapsed).toBeGreaterThan(scoreCard.elapsed);
    await renderTwoFrames(page);
    const replayEvidence = await page.evaluate(() => {
      const bridge = window.__TONY_CAMERA_REPLAY_BRIDGE__;
      const snapshot = bridge?.replay?.currentSnapshot?.() ?? null;
      return {
        overlayVisible: document.getElementById("goalPresentationOverlay")?.classList.contains("show") ?? false,
        replayFlag: document.getElementById("goalPresentationReplayFlag")?.textContent ?? "",
        replayTick: snapshot?.tick ?? null,
        replayScore: snapshot?.match?.score ? [...snapshot.match.score] : null,
        frozen: Boolean(snapshot && Object.isFrozen(snapshot)),
      };
    });
    expect(replayEvidence.overlayVisible).toBe(false);
    expect(replayEvidence.replayFlag).toBe("REPLAY AVAILABLE");
    expect(replayEvidence.frozen).toBe(true);
    expect(replayEvidence.replayScore?.[0]).toBe(expectedScore);
    incidentEvidence.push(replayEvidence);
    await finishGoalSequence(page);
  }

  expect(incidentEvidence[1].replayTick).toBeGreaterThan(incidentEvidence[0].replayTick);
  expect(incidentEvidence[1].replayScore).toEqual([2, 0]);
  const history = await page.evaluate(() => window.__TONY_GOAL_PRESENTATION__.diagnostics().timelineHistory);
  expect(history.map((entry) => entry.phase).filter((phase) => (
    ["native-highlight", "goal-card", "score-card", "replay"].includes(phase)
  )).slice(-4)).toEqual([
    "native-highlight", "goal-card", "score-card", "replay",
  ]);
  expect(runtimeErrors).toEqual([]);
});

test("authoritative clock reaches Full Time and play-again starts a clean match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop Full Time lifecycle is sufficient");
  await installEngineRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page);

  const ended = await page.evaluate(() => {
    const runtime = window.__TONY_E2E_BROWSER_RUNTIME__;
    for (let index = 0; index < 12_000 && runtime.snapshot.match.state !== "ended"; index += 1) {
      runtime.advanceForE2E(1);
    }
    return {
      state: runtime.snapshot.match.state,
      time: runtime.snapshot.match.time,
      score: [...runtime.snapshot.match.score],
      stats: runtime.snapshot.match.stats,
    };
  });
  await renderTwoFrames(page);
  expect(ended.state).toBe("ended");
  expect(ended.time).toBe(0);
  await expect(page.locator("#matchState")).toHaveText("FULL TIME");
  await expect(page.locator("#resultOverlay")).toHaveClass(/show/);
  await expect(page.locator("#finalHome")).toHaveText(String(ended.score[0]));
  await expect(page.locator("#finalAway")).toHaveText(String(ended.score[1]));

  await clickById(page, "playAgainButton");
  await page.waitForFunction(() => window.__TONY_DEBUG__?.diagnostics?.().state === "playing");
  const restarted = await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(2));
  expect(restarted.match.state).toBe("playing");
  expect(restarted.match.score).toEqual([0, 0]);
  expect(restarted.match.time).toBeGreaterThan(0);
  await expect(page.locator("#resultOverlay")).not.toHaveClass(/show/);
  expect(runtimeErrors).toEqual([]);
});

test("forced Canvas preserves complete HUD/radar/stat and error parity at every viewport", async ({ page }, testInfo) => {
  await installEngineRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page, "?visualTest=1&renderer=canvas&skipIntro=1&goalTest=1");
  await page.evaluate(() => window.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(240));
  await renderTwoFrames(page);

  const evidence = await page.evaluate(() => {
    const diagnostics = window.__TONY_DEBUG__.diagnostics();
    return {
      renderer: diagnostics.renderer,
      canvas: diagnostics.canvasMatch,
      score: [document.getElementById("homeScore")?.textContent, document.getElementById("awayScore")?.textContent],
      clock: document.getElementById("gameClock")?.textContent ?? "",
      matchState: document.getElementById("matchState")?.textContent ?? "",
      stamina: document.getElementById("staminaText")?.textContent ?? "",
      radarVisible: Boolean(document.getElementById("radarCanvas")?.getClientRects().length),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(evidence.renderer).toBe("canvas");
  expect(evidence.canvas.active).toBe(true);
  expect(evidence.canvas.status).toBe("ready");
  expect(evidence.canvas.lastFacts.tick).toBeGreaterThan(0);
  expect(evidence.score).toEqual(["0", "0"]);
  expect(evidence.clock).toMatch(/^\d{2}:\d{2}$/);
  expect(evidence.matchState).toBe("LIVE");
  expect(evidence.stamina).toMatch(/^\d+%$/);
  expect(evidence.radarVisible).toBe(true);
  expect(evidence.overflow).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("#possessionStat")).toHaveText(/^\d+%$/);
  await expect(page.locator("#passStat")).toHaveText(/^\d+%$/);
  await expect(page.locator("#homeShots")).toHaveText(/^\d+$/);
  await expect(page.locator("#awayShots")).toHaveText(/^\d+$/);
  expect(runtimeErrors).toEqual([]);
});
