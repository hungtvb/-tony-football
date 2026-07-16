export async function installEngineRuntimeHarness(page) {
  await page.route("**/src/game/application/BrowserMatchRuntime.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const withRuntimeHandle = source.replace(
      "    this.#publishEvent = publishEvent;",
      "    this.#publishEvent = publishEvent;\n    globalThis.__TONY_E2E_BROWSER_RUNTIME__ = this;",
    );
    const patched = withRuntimeHandle.replace(
      "  step(deltaSeconds) {",
      `  recordGoalForE2E(team, options = {}) {
    return this.#engine.recordGoal(team, options);
  }

  advanceForE2E(steps, deltaSeconds = 1 / 60) {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new RangeError("E2E runtime steps must be a non-negative integer");
    }
    for (let index = 0; index < steps; index += 1) this.step(deltaSeconds);
    return this.snapshot;
  }

  step(deltaSeconds) {`,
    );
    if (patched === source || !patched.includes("recordGoalForE2E")) {
      throw new Error("Could not install the isolated BrowserMatchRuntime E2E harness");
    }
    await route.fulfill({ response, body: patched });
  });
}
