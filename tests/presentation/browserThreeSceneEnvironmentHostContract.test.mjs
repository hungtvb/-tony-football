import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hostSourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentHost.js", import.meta.url);
const factorySourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js", import.meta.url);
const entrySourceUrl = new URL("../../browser-entry.js", import.meta.url);
const gameSourceUrl = new URL("../../game.js", import.meta.url);

test("browser Three scene host owns renderer, environment and validated profile inside presentation", async () => {
  const source = await readFile(hostSourceUrl, "utf8");
  for (const dependency of [
    'from "three"',
    "EffectComposer.js",
    "RoomEnvironment.js",
    "ThreeSceneEnvironmentProfile.js",
    "environmentRoot",
    'owner: "clean-host"',
  ]) assert.equal(source.includes(dependency), true, `missing ${dependency}`);
  assert.equal(source.includes("disposeObject(scene)"), false);
  assert.equal(source.includes("disposeObject(environmentRoot)"), true);
  for (const forbidden of [
    "MatchEngine",
    "BrowserRuntimeComposition",
    "GameCommandType",
    "playerViews",
    "ballView",
    "cameraController",
    "replayController",
  ]) assert.equal(source.includes(forbidden), false, `scene host must not absorb ${forbidden}`);
});

test("browser factory always selects the clean host and entry exposes only a narrow port bridge", async () => {
  const factory = await readFile(factorySourceUrl, "utf8");
  const entry = await readFile(entrySourceUrl, "utf8");
  assert.match(factory, /createBrowserThreeSceneEnvironmentHost/);
  assert.doesNotMatch(factory, /LegacyAdoptedThreeSceneHost|legacyThreeSceneSnapshot/);
  assert.match(entry, /__TONY_THREE_SCENE_BRIDGE__/);
  assert.doesNotMatch(entry, /installLegacyThreeSceneTracking|EffectComposer|from "three"/);
});

test("game composition no longer constructs the Three environment", async () => {
  const source = await readFile(gameSourceUrl, "utf8");
  for (const forbidden of [
    "new THREE.WebGLRenderer",
    "new EffectComposer",
    "new RoomEnvironment",
    "createPitch3D",
    "createGrass3D",
    "createStadium3D",
    "createAtmosphere3D",
    "createGoals3D",
  ]) assert.equal(source.includes(forbidden), false, `game.js must not own ${forbidden}`);
  assert.match(source, /__TONY_THREE_SCENE_BRIDGE__/);
  assert.match(source, /onPresentationReady:\s*init3D/);
});
