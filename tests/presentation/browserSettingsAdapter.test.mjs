import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserSettingsAdapter } from "../../src/game/presentation/BrowserSettingsAdapter.js";

class Node { constructor(dataset = {}) { this.dataset = dataset; this.listeners = new Map(); this.classList = { toggle() {} }; } addEventListener(type, fn) { this.listeners.set(type, fn); } removeEventListener(type) { this.listeners.delete(type); } click() { this.listeners.get("click")?.(); } setAttribute() {} }
function fixture() { const pitch = new Node({ pitch: "classic" }); const sound = new Node(); const document = { querySelectorAll: (selector) => selector === "[data-pitch]" ? [pitch] : [], getElementById: (id) => id === "soundButton" ? sound : null }; return { pitch, sound, document }; }
function audioContext({ state = "running", resume, failOscillatorAt = 0 } = {}) {
  let oscillatorCount = 0;
  const context = {
    state, currentTime: 1, destination: {}, closeCount: 0,
    async resume() { if (resume) await resume(context); else context.state = "running"; },
    async close() { context.closeCount += 1; context.state = "closed"; },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } }; },
    createOscillator() {
      oscillatorCount += 1; if (failOscillatorAt === oscillatorCount) throw new Error("oscillator failed");
      return { type: "", frequency: { value: 0 }, startCount: 0, stopCount: 0, connect() { return this; }, disconnect() {}, start() { this.startCount += 1; }, stop() { this.stopCount += 1; } };
    },
    oscillatorCount: () => oscillatorCount,
  };
  return context;
}

test("settings adapter applies only declared user preference commands and removes listeners", () => {
  const { pitch, sound, document } = fixture(); const target = { document }; const calls = [];
  const adapter = createBrowserSettingsAdapter({ target, document, controlBindings: { shoot: "D" }, createAudioContext: () => null });
  adapter.configure({ values: { pitch: "classic", sound: true }, allowed: { pitch: ["classic", "midnight"] }, apply: { pitch: (command) => calls.push(command), sound: (command) => calls.push(command) } });
  assert.equal(adapter.attach(), true); assert.equal(adapter.attach(), false); pitch.click(); sound.click();
  assert.deepEqual(calls.map(({ name, value }) => [name, value]), [["pitch", "classic"], ["sound", false]]);
  assert.equal(adapter.set("pitch", "unknown"), false); assert.equal(adapter.diagnostics().controlBindings.shoot, "D");
  assert.equal(adapter.teardown(), true); assert.equal(pitch.listeners.size, 0); assert.equal(adapter.teardown(), false);
});

test("settings adapter fails closed when another owner is attached", () => {
  const { document } = fixture(); const target = { document }; const first = createBrowserSettingsAdapter({ target, document }); const second = createBrowserSettingsAdapter({ target, document });
  first.attach(); assert.throws(() => second.attach(), /owner already attached/); first.teardown();
});

test("preview audio resumes suspended and interrupted contexts before reporting success", async () => {
  for (const initialState of ["suspended", "interrupted"]) {
    const context = audioContext({ state: initialState }); const adapter = createBrowserSettingsAdapter({ target: {}, createAudioContext: () => context });
    adapter.configure({ values: { sound: true } });
    assert.equal(await adapter.preview("sound", true), true);
    assert.equal(context.state, "running"); assert.equal(adapter.diagnostics().audioHealth, "ready"); assert.equal(adapter.diagnostics().previewCount, 1);
    adapter.teardown();
  }
});

test("rejected resume releases an unhealthy backend for a later retry", async () => {
  const rejected = audioContext({ state: "suspended", resume: async () => { throw new Error("blocked"); } });
  const recovered = audioContext(); const contexts = [rejected, recovered];
  const adapter = createBrowserSettingsAdapter({ target: {}, createAudioContext: () => contexts.shift() ?? null });
  adapter.configure({ values: { sound: true } });
  assert.equal(await adapter.preview("sound", true), false); assert.equal(rejected.closeCount, 1); assert.equal(adapter.diagnostics().audioHealth, "unavailable");
  assert.equal(await adapter.preview("sound", true), true); assert.equal(adapter.diagnostics().audioHealth, "ready"); assert.equal(adapter.diagnostics().previewCount, 1);
  adapter.teardown();
});

test("closed contexts fail closed and allow retry reclaim", async () => {
  const closed = audioContext({ state: "closed" }); const recovered = audioContext(); const contexts = [closed, recovered];
  const adapter = createBrowserSettingsAdapter({ target: {}, createAudioContext: () => contexts.shift() ?? null });
  adapter.configure({ values: { sound: true } });
  assert.equal(await adapter.preview("sound", true), false); assert.equal(adapter.diagnostics().audioHealth, "unavailable");
  assert.equal(await adapter.preview("sound", true), true); assert.equal(adapter.diagnostics().previewCount, 1); adapter.teardown();
});

test("partial multi-tone failure does not retry or duplicate fallback in the same cue", async () => {
  const partial = audioContext({ failOscillatorAt: 2 }); let createCount = 0;
  const adapter = createBrowserSettingsAdapter({
    target: {}, createAudioContext: () => { createCount += 1; return partial; },
    toneProfiles: { sound: { frequencies: [600, 720], duration: 0.08, volume: 0.04 } },
  });
  adapter.configure({ values: { sound: true } });
  assert.equal(await adapter.preview("sound", true), false); assert.equal(partial.oscillatorCount(), 2); assert.equal(createCount, 1);
  assert.equal(adapter.diagnostics().previewCount, 0); assert.equal(adapter.diagnostics().audioFailureCount, 1); adapter.teardown();
});
