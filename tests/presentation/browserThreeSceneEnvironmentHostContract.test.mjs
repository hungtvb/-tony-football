import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hostSourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentHost.js", import.meta.url);
const factorySourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js", import.meta.url);
const entrySourceUrl = new URL("../../browser-entry.js", import.meta.url);
const canonicalGameSourceUrl = new URL("../../game.js", import.meta.url);
const generatedGameSourceUrl = new URL("../../generated/game.js", import.meta.url);

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
  assert.match(entry, /\.\/generated\/game\.js\?v=21\.0\.0/);
  assert.doesNotMatch(entry, /installLegacyThreeSceneTracking|EffectComposer|from "three"/);
});

test("generated game composition no longer constructs the Three environment while canonical source remains reviewable", async () => {
  const [canonicalSource, generatedSource] = await Promise.all([
    readFile(canonicalGameSourceUrl, "utf8"),
    readFile(generatedGameSourceUrl, "utf8"),
  ]);
  assert.match(canonicalSource, /new THREE\.WebGLRenderer/);
  for (const forbidden of [
    "new THREE.WebGLRenderer",
    "new EffectComposer",
    "new RoomEnvironment",
    "createPitch3D",
    "createGrass3D",
    "createStadium3D",
    "createAtmosphere3D",
    "createGoals3D",
  ]) assert.equal(generatedSource.includes(forbidden), false, `generated/game.js must not own ${forbidden}`);
  assert.match(generatedSource, /from "\.\.\/src\//);
  assert.doesNotMatch(generatedSource, /from "\.\/src\//);
  assert.match(generatedSource, /__TONY_THREE_SCENE_BRIDGE__/);
  assert.match(generatedSource, /onPresentationReady:\s*init3D/);
});
