import { expect, test } from "./fixtures.mjs";
import { installEngineRuntimeHarness, installNaturalGoalRuntimeHarness } from "./engine-runtime-harness.mjs";

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
  await page.waitForFunction(() => window.__TONY_E2E_BROWSER_RUNTIME__?.snapshot?.match?.kickoffTimer === 0);
}

async function renderTwoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function installWallClockGoalObserver(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById("goalPresentationOverlay");
    const homeScore = document.getElementById("homeScore");
    if (!overlay || !homeScore) throw new Error("Goal presentation DOM is unavailable");
    const events = [];
    let previousKey = null;
    const capture = () => {
      const event = Object.freeze({
        at: performance.now(),
        visible: overlay.classList.contains("show"),
        stage: overlay.dataset.stage ?? null,
        homeScore: homeScore.textContent ?? "",
        awayScore: document.getElementById("awayScore")?.textContent ?? "",
      });
      const key = JSON.stringify([event.visible, event.stage, event.homeScore, event.awayScore]);
      if (key === previousKey) return;
      previousKey = key;
      events.push(event);
    };
    const observer = new MutationObserver(capture);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-stage"],
      childList: true,
      subtree: true,
      characterData: true,
    });
    globalThis.__TONY_WALL_CLOCK_GOAL_EVENTS__ = events;
    globalThis.__TONY_WALL_CLOCK_GOAL_OBSERVER__?.disconnect?.();
    globalThis.__TONY_WALL_CLOCK_GOAL_OBSERVER__ = observer;
    capture();
  });
}

async function shootTowardRightGoal(page) {
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(520);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ArrowRight");
}

async function awaitNaturalGoalPresentation(page, expectedScore, fromIndex) {
  await shootTowardRightGoal(page);
  await expect.poll(() => page.evaluate(() => (
    Number(document.getElementById("homeScore")?.textContent ?? 0)
  )), { timeout: 30_000, intervals: [100, 250, 500] }).toBe(expectedScore);
  await page.waitForFunction(({ expected, start }) => {
    const events = (globalThis.__TONY_WALL_CLOCK_GOAL_EVENTS__ ?? []).slice(start);
    const goalIndex = events.findIndex((event) => (
      event.visible && event.stage === "goal" && Number(event.homeScore) === expected
    ));
    const scoreIndex = events.findIndex((event, index) => (
      index > goalIndex && event.visible && event.stage === "score" && Number(event.homeScore) === expected
    ));
    const hiddenIndex = events.findIndex((event, index) => index > scoreIndex && !event.visible);
    return goalIndex >= 0 && scoreIndex > goalIndex && hiddenIndex > scoreIndex;
  }, { expected: expectedScore, start: fromIndex }, { timeout: 30_000 });
  const evidence = await page.evaluate(({ expected, start }) => {
    const events = (globalThis.__TONY_WALL_CLOCK_GOAL_EVENTS__ ?? []).slice(start);
    const goalIndex = events.findIndex((event) => (
      event.visible && event.stage === "goal" && Number(event.homeScore) === expected
    ));
    const scoreIndex = events.findIndex((event, index) => (
      index > goalIndex && event.visible && event.stage === "score" && Number(event.homeScore) === expected
    ));
    const hiddenIndex = events.findIndex((event, index) => index > scoreIndex && !event.visible);
    const replay = globalThis.__TONY_CAMERA_REPLAY_BRIDGE__?.replay?.currentSnapshot?.() ?? null;
    return {
      events,
      goalVisibleMilliseconds: events[scoreIndex].at - events[goalIndex].at,
      scoreVisibleMilliseconds: events[hiddenIndex].at - events[scoreIndex].at,
      replay: replay ? { tick: replay.tick, score: [...replay.match.score] } : null,
      replayFrozen: Boolean(replay && Object.isFrozen(replay)),
    };
  }, { expected: expectedScore, start: fromIndex });
  expect(evidence.goalVisibleMilliseconds).toBeGreaterThanOrEqual(250);
  expect(evidence.goalVisibleMilliseconds).toBeLessThanOrEqual(8_000);
  expect(evidence.scoreVisibleMilliseconds).toBeGreaterThanOrEqual(250);
  expect(evidence.scoreVisibleMilliseconds).toBeLessThanOrEqual(8_000);
  expect(evidence.replayFrozen).toBe(true);
  expect(evidence.replay.score).toEqual([expectedScore, 0]);
  return evidence;
}

async function recoverHomePossessionAfterAwayKickoff(page) {
  await page.waitForFunction(() => {
    const snapshot = globalThis.__TONY_E2E_BROWSER_RUNTIME__?.snapshot;
    return snapshot?.match?.goalSequence === null
      && snapshot?.match?.kickoffTimer === 0
      && snapshot?.ball?.ownerId?.startsWith("away-");
  }, null, { timeout: 15_000 });

  // While defending, KeyS is the public switch command. Five switches return
  // to the original home outfield selection before the fixed tackle sequence.
  for (let index = 0; index < 5; index += 1) await page.keyboard.press("KeyS");
  await page.evaluate(() => globalThis.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(2));

  for (const movementMilliseconds of [120, 180, 240]) {
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(movementMilliseconds);
    await page.keyboard.press("Space");
    await page.waitForTimeout(760);
    await page.keyboard.up("ArrowRight");
    await page.evaluate(() => globalThis.__TONY_E2E_BROWSER_RUNTIME__.advanceForE2E(45));
    const recovered = await page.evaluate(() => (
      globalThis.__TONY_E2E_BROWSER_RUNTIME__.snapshot.ball.ownerId?.startsWith("home-") ?? false
    ));
    if (recovered) break;
  }

  await expect.poll(() => page.evaluate(() => (
    globalThis.__TONY_E2E_BROWSER_RUNTIME__.snapshot.ball.ownerId?.startsWith("home-") ?? false
  )), { timeout: 10_000, intervals: [100, 250, 500] }).toBe(true);

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
  await installNaturalGoalRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page);
  await page.waitForFunction(() => {
    const snapshot = window.__TONY_E2E_BROWSER_RUNTIME__?.snapshot;
    return snapshot?.ball?.ownerId === snapshot?.match?.selectedPlayerId;
  });

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
  expect(Math.abs(attack.selectedX - initial.selectedX)).toBeGreaterThan(10);
  expect(attack.possession[0] + attack.possession[1]).toBeGreaterThan(initial.possession[0] + initial.possession[1]);
  expect(attack.commandTypes).toEqual(expect.arrayContaining([
    "player:move", "player:set-sprint", "team:trigger-run", "ball:short-pass",
    "ball:through-pass", "ball:shoot",
  ]));
  expect(attack.frozenCommands).toBe(true);
  expect(attack.radar).not.toBe(initial.radar);
  expect(attack.stamina).toMatch(/^\d+%$/);
  expect(attack.clock).toMatch(/^\d{2}:\d{2}$/);

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

test("two natural goal incidents expose bounded real-time cards without leaking the first incident", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one desktop two-goal presentation chronology is sufficient");
  await installNaturalGoalRuntimeHarness(page);
  const runtimeErrors = captureRuntimeErrors(page);
  await openAndStart(page);
  await installWallClockGoalObserver(page);
  await page.waitForFunction(() => {
    const snapshot = globalThis.__TONY_E2E_BROWSER_RUNTIME__?.snapshot;
    return snapshot?.ball?.ownerId === snapshot?.match?.selectedPlayerId;
  });

  const incidentEvidence = [];
  let eventStart = await page.evaluate(() => globalThis.__TONY_WALL_CLOCK_GOAL_EVENTS__.length);
  incidentEvidence.push(await awaitNaturalGoalPresentation(page, 1, eventStart));
  await finishGoalSequence(page);
  await recoverHomePossessionAfterAwayKickoff(page);

  eventStart = await page.evaluate(() => globalThis.__TONY_WALL_CLOCK_GOAL_EVENTS__.length);
  incidentEvidence.push(await awaitNaturalGoalPresentation(page, 2, eventStart));

  expect(incidentEvidence[1].replay.tick).toBeGreaterThan(incidentEvidence[0].replay.tick);
  expect(incidentEvidence[0].replay.score).toEqual([1, 0]);
  expect(incidentEvidence[1].replay.score).toEqual([2, 0]);
  const chronology = await page.evaluate(() => ({
    phases: globalThis.__TONY_GOAL_PRESENTATION__.diagnostics().timelineHistory.map((entry) => entry.phase),
    commandTypes: (globalThis.__TONY_E2E_COMMAND_LOG__ ?? []).map((entry) => entry.type),
    frozenCommands: (globalThis.__TONY_E2E_COMMAND_LOG__ ?? []).every(Object.isFrozen),
  }));
  expect(chronology.phases.filter((phase) => phase === "goal-card")).toHaveLength(2);
  expect(chronology.phases.filter((phase) => phase === "score-card")).toHaveLength(2);
  expect(chronology.phases.filter((phase) => phase === "replay")).toHaveLength(2);
  expect(chronology.commandTypes.filter((type) => type === "ball:shoot").length).toBeGreaterThanOrEqual(2);
  expect(chronology.commandTypes).toContain("player:tackle");
  expect(chronology.commandTypes).toContain("player:switch");
  expect(chronology.frozenCommands).toBe(true);
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
