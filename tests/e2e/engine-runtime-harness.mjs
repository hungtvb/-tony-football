async function exposeBrowserRuntime(page, methods) {
  await page.route("**/src/game/application/BrowserMatchRuntime.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const withRuntimeHandle = source.replace(
      "    this.#publishEvent = publishEvent;",
      "    this.#publishEvent = publishEvent;\n    globalThis.__TONY_E2E_BROWSER_RUNTIME__ = this;",
    );
    const patched = withRuntimeHandle.replace(
      "  step(deltaSeconds) {",
      `${methods}\n\n  step(deltaSeconds) {`,
    );
    if (patched === source || !patched.includes("__TONY_E2E_BROWSER_RUNTIME__")) {
      throw new Error("Could not install the isolated BrowserMatchRuntime E2E harness");
    }
    await route.fulfill({ response, body: patched });
  });
}

export async function installEngineRuntimeHarness(page) {
  await exposeBrowserRuntime(page, `  recordGoalForE2E(team, options = {}) {
    return this.#engine.recordGoal(team, options);
  }

  advanceForE2E(steps, deltaSeconds = 1 / 60) {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new RangeError("E2E runtime steps must be a non-negative integer");
    }
    for (let index = 0; index < steps; index += 1) this.step(deltaSeconds);
    return this.snapshot;
  }`);
}

export async function installNaturalGoalRuntimeHarness(page) {
  await page.route("**/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const originalAwayFormation = `    away: [
      [1110, 350, "GK", "NOVA", 1, 87], [930, 205, "DF", "VEX", 3, 88], [930, 495, "DF", "ZERO", 5, 87],
      [700, 350, "MF", "ECHO", 8, 91], [520, 205, "FW", "BLAZE", 9, 92], [520, 495, "FW", "RUSH", 11, 90]
    ]`;
    const deterministicAwayFormation = `    away: [
      [400, 80, "DF", "NOVA", 1, 87], [420, 80, "DF", "VEX", 3, 88], [440, 80, "DF", "ZERO", 5, 87],
      [400, 620, "MF", "ECHO", 8, 91], [420, 620, "FW", "BLAZE", 9, 92], [440, 620, "FW", "RUSH", 11, 90]
    ]`;
    const patched = source
      .replace(
        '[690, 205, "FW", "TONY", 10, 92]',
        '[1050, 350, "FW", "TONY", 10, 92]',
      )
      .replace(originalAwayFormation, deterministicAwayFormation);
    if (
      patched === source
      || !patched.includes('[1050, 350, "FW", "TONY"')
      || !patched.includes('[400, 80, "DF", "NOVA"')
      || patched.includes(originalAwayFormation)
    ) {
      throw new Error("Could not install deterministic natural-goal formations");
    }
    await route.fulfill({ response, body: patched });
  });

  await page.route("**/src/game/engine/MatchEngine.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const patched = source.replace(
      "  recordGoal(team, { scorerId = null } = {}) {",
      `  placePlayerForE2E(playerId, x, y) {
    const player = findPlayer(this.#state, playerId);
    if (!player || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    player.x = x;
    player.y = y;
    player.baseX = x;
    player.baseY = y;
    player.vx = 0;
    player.vy = 0;
    player.dirX = player.team === HOME_TEAM ? 1 : -1;
    player.dirY = 0;
    return true;
  }

  recordGoal(team, { scorerId = null } = {}) {`,
    );
    if (patched === source || !patched.includes("placePlayerForE2E")) {
      throw new Error("Could not install isolated natural-shot positioning");
    }
    await route.fulfill({ response, body: patched });
  });

  await page.route("**/src/game/presentation/SnapshotReplayController.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const withController = source.replace(
      "  return Object.freeze({",
      "  const controller = Object.freeze({",
    );
    const withRenderEvidence = withController.replace(
      "    currentSnapshot() {\n      if (!active",
      "    currentSnapshot() {\n      if (active) globalThis.__TONY_E2E_REPLAY_RENDER_READS__ = (globalThis.__TONY_E2E_REPLAY_RENDER_READS__ ?? 0) + 1;\n      if (!active",
    );
    const patched = withRenderEvidence.replace(
      "  });\n}",
      "  });\n  globalThis.__TONY_E2E_REPLAY_CONTROLLER__ = controller;\n  globalThis.__TONY_E2E_REPLAY_RENDER_READS__ = 0;\n  return controller;\n}",
    );
    if (
      patched === source
      || !patched.includes("__TONY_E2E_REPLAY_CONTROLLER__")
      || !patched.includes("__TONY_E2E_REPLAY_RENDER_READS__")
    ) {
      throw new Error("Could not expose the isolated replay controller diagnostics");
    }
    await route.fulfill({ response, body: patched });
  });

  await exposeBrowserRuntime(page, `  shootNaturalGoalForE2E(playerId = "home-4") {
    if (!this.#engine.placePlayerForE2E(playerId, 1100, 350)) return false;
    const ownerChanged = this.#engine.setPossession(playerId, { reason: "e2e-natural-shot" });
    if (!ownerChanged && this.snapshot.ball.ownerId !== playerId) return false;
    this.dispatch({
      type: "ball:shoot",
      payload: {
        playerId,
        power: 1,
        direction: { x: 1, y: 0 },
        modifiers: {},
      },
      source: "human",
      sequence: 0,
      targetTick: null,
    });
    return true;
  }`);
}
