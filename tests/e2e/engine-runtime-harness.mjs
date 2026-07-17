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
    const patched = source
      .replace(
        '[690, 205, "FW", "TONY", 10, 92]',
        '[1050, 350, "FW", "TONY", 10, 92]',
      )
      .replace(
        '[1110, 350, "GK", "NOVA", 1, 87]',
        '[1110, 230, "GK", "NOVA", 1, 87]',
      );
    if (patched === source || !patched.includes('[1050, 350, "FW", "TONY"')) {
      throw new Error("Could not install deterministic natural-goal formations");
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
    const patched = withController.replace(
      "  });\n}",
      "  });\n  globalThis.__TONY_E2E_REPLAY_CONTROLLER__ = controller;\n  return controller;\n}",
    );
    if (patched === source || !patched.includes("__TONY_E2E_REPLAY_CONTROLLER__")) {
      throw new Error("Could not expose the isolated replay controller diagnostics");
    }
    await route.fulfill({ response, body: patched });
  });

  await exposeBrowserRuntime(page, `  shootNaturalGoalForE2E(playerId = "home-4") {
    const ownerChanged = this.#engine.setPossession(playerId, { reason: "e2e-natural-shot" });
    if (!ownerChanged && this.snapshot.ball.ownerId !== playerId) return false;
    this.dispatch({
      type: "ball:shoot",
      payload: {
        playerId,
        power: 1,
        direction: { x: 1, y: 1 },
        modifiers: {},
      },
      source: "human",
      sequence: 0,
      targetTick: null,
    });
    return true;
  }`);
}
