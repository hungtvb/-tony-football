import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserSettingsAdapter } from "../../src/game/presentation/BrowserSettingsAdapter.js";

class Node { constructor(dataset = {}) { this.dataset = dataset; this.listeners = new Map(); this.classList = { toggle() {} }; } addEventListener(type, fn) { this.listeners.set(type, fn); } removeEventListener(type) { this.listeners.delete(type); } click() { this.listeners.get("click")?.(); } setAttribute() {} }
function fixture() { const pitch = new Node({ pitch: "classic" }); const sound = new Node(); const document = { querySelectorAll: (selector) => selector === "[data-pitch]" ? [pitch] : [], getElementById: (id) => id === "soundButton" ? sound : null }; return { pitch, sound, document }; }

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
