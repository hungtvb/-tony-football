import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserPlayerAssetLoader } from "../../src/game/presentation/BrowserPlayerAssetLoader.js";

test("asset loader publishes character before independently loaded animations", async () => {
  const calls = [];
  const responses = [
    { scene: { name: "character" } },
    { animations: [{ name: "Idle_Loop" }] },
  ];
  const loader = createBrowserPlayerAssetLoader({
    timeoutMilliseconds: 100,
    attempts: 1,
    meshoptDecoder: { supported: true },
    loaderFactory: () => ({
      setMeshoptDecoder(value) { calls.push(["decoder", value.supported]); },
      async loadAsync(url) {
        calls.push(["load", url]);
        return responses.shift();
      },
    }),
  });
  const statuses = [];
  let character = null;
  let animations = null;
  const result = await loader.load({
    onStatus: (status) => statuses.push(status),
    onCharacter: (value) => { character = value; },
    onAnimations: (value) => { animations = value; },
  });
  assert.equal(character.scene.name, "character");
  assert.deepEqual(animations.map((clip) => clip.name), ["Idle_Loop"]);
  assert.equal(result.characterLoaded, true);
  assert.equal(result.animationsLoaded, true);
  assert.deepEqual(statuses.map((status) => status.label), ["MODEL · LOADING", "MODEL · READY", "PLAYER RIG · READY"]);
  assert.deepEqual(calls[0], ["decoder", true]);
});

test("animation failure preserves the loaded character with basic motion", async () => {
  let call = 0;
  const loader = createBrowserPlayerAssetLoader({
    timeoutMilliseconds: 100,
    attempts: 2,
    loaderFactory: () => ({
      setMeshoptDecoder() {},
      async loadAsync() {
        call += 1;
        if (call === 1) return { scene: { name: "character" } };
        throw new Error("animation offline");
      },
    }),
  });
  const statuses = [];
  const result = await loader.load({ onStatus: (status) => statuses.push(status) });
  assert.equal(result.characterLoaded, true);
  assert.equal(result.animationsLoaded, false);
  assert.equal(statuses.at(-1).label, "MODEL READY · BASIC MOTION");
});

test("character failure reports procedural fallback and skips animation loading", async () => {
  let calls = 0;
  const loader = createBrowserPlayerAssetLoader({
    timeoutMilliseconds: 100,
    attempts: 2,
    loaderFactory: () => ({
      setMeshoptDecoder() {},
      async loadAsync() {
        calls += 1;
        throw new Error("character offline");
      },
    }),
  });
  const statuses = [];
  const result = await loader.load({ onStatus: (status) => statuses.push(status) });
  assert.equal(result.characterLoaded, false);
  assert.equal(result.animationsLoaded, false);
  assert.equal(calls, 2);
  assert.equal(statuses.at(-1).label, "MODEL · FALLBACK");
});
