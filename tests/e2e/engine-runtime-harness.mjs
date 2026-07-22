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

const ADVANCE_ONLY_METHOD = `  advanceForE2E(steps, deltaSeconds = 1 / 60) {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new RangeError("E2E runtime steps must be a non-negative integer");
    }
    for (let index = 0; index < steps; index += 1) this.step(deltaSeconds);
    return this.snapshot;
  }`;

// Presentation-only fixture retained for existing projection tests. It is not
// valid evidence for headless gameplay, natural scoring, or replay acceptance.
export async function installEngineRuntimeHarness(page) {
  await exposeBrowserRuntime(page, `  recordGoalForE2E(team, options = {}) {
    return this.#engine.recordGoal(team, options);
  }

${ADVANCE_ONLY_METHOD}`);
}

export async function installNaturalGoalRuntimeHarness(page) {
  // Clock stepping is exposed only to finish an already naturally-scored
  // incident deterministically on software-rendered CI. It cannot mutate score.
  await exposeBrowserRuntime(page, ADVANCE_ONLY_METHOD);
  await page.route("**/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const originalAwayFormation = `    away: [
      [1110, 350, "GK", "NOVA", 1, 87], [930, 205, "DF", "VEX", 3, 88], [930, 495, "DF", "ZERO", 5, 87],
      [700, 350, "MF", "ECHO", 8, 91], [520, 205, "FW", "BLAZE", 9, 92], [520, 495, "FW", "RUSH", 11, 90]
    ]`;
    const deterministicAwayFormation = `    away: [
      [360, 80, "DF", "NOVA", 1, 87], [390, 80, "DF", "VEX", 3, 88], [420, 80, "DF", "ZERO", 5, 87],
      [360, 620, "MF", "ECHO", 8, 91], [390, 620, "FW", "BLAZE", 9, 92], [420, 620, "FW", "RUSH", 11, 90]
    ]`;
    const patched = source
      .replace(
        '[690, 205, "FW", "TONY", 10, 92]',
        '[574, 350, "FW", "TONY", 10, 92]',
      )
      .replace(originalAwayFormation, deterministicAwayFormation);
    if (
      patched === source
      || !patched.includes('[574, 350, "FW", "TONY"')
      || !patched.includes('[360, 80, "DF", "NOVA"')
      || patched.includes(originalAwayFormation)
    ) {
      throw new Error("Could not install the deterministic command-driven goal formation");
    }
    await route.fulfill({ response, body: patched });
  });
}
