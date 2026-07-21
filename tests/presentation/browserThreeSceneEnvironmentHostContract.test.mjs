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
  for (const dependency of ['from "three"', "EffectComposer.js", "RoomEnvironment.js", "ThreeSceneEnvironmentProfile.js", "environmentRoot", 'owner: "clean-host"']) assert.equal(source.includes(dependency), true, `missing ${dependency}`);
  assert.equal(source.includes("disposeObject(scene)"), false);
  assert.equal(source.includes("disposeObject(environmentRoot)"), true);
  for (const forbidden of ["MatchEngine", "BrowserRuntimeComposition", "GameCommandType", "playerViews", "ballView", "cameraController", "replayController"]) assert.equal(source.includes(forbidden), false, `scene host must not absorb ${forbidden}`);
});

test("browser entry keeps the clean host narrow and registers Canvas plus camera replay owners", async () => {
  const factory = await readFile(factorySourceUrl, "utf8");
  const entry = await readFile(entrySourceUrl, "utf8");
  assert.equal(factory.includes("createBrowserThreeSceneEnvironmentHost"), true);
  assert.equal(factory.includes("LegacyAdoptedThreeSceneHost"), false);
  assert.equal(entry.includes("__TONY_THREE_SCENE_BRIDGE__"), true);
  assert.equal(entry.includes("__TONY_CANVAS_MATCH_BRIDGE__"), true);
  assert.equal(entry.includes("__TONY_CAMERA_REPLAY_BRIDGE__"), true);
  assert.equal(entry.includes("createCanvasMatchRenderer"), true);
  assert.equal(entry.includes("createSnapshotCameraReplayAdapter"), true);
  assert.equal(entry.includes('./generated/game.js?v=23.0.0'), true);
  assert.equal(entry.includes("installLegacyThreeSceneTracking"), false);
  assert.equal(entry.includes("EffectComposer"), false);
  assert.equal(entry.includes('from "three"'), false);
});

test("generated game no longer constructs the Three environment, match Canvas or camera replay authority while canonical source remains reviewable", async () => {
  const canonicalSource = await readFile(canonicalGameSourceUrl, "utf8");
  const generatedSource = await readFile(generatedGameSourceUrl, "utf8");
  assert.equal(canonicalSource.includes("new THREE.WebGLRenderer"), true);
  const forbidden = ["new THREE.WebGLRenderer", "new EffectComposer", "new RoomEnvironment", "createPitch3D", "createGrass3D", "createStadium3D", "createAtmosphere3D", "createGoals3D", "renderFallback2D", "drawFallbackPlayerDetail", 'canvas.getContext("2d")', "createSnapshotCameraController", "createSnapshotReplayController", "game.replay.update(", "game.replay.record(", "recordReplaySnapshot"];
  for (const token of forbidden) assert.equal(generatedSource.includes(token), false, `generated/game.js must not own ${token}`);
  assert.equal(generatedSource.includes('from "../src/'), true);
  assert.equal(generatedSource.includes('from "./src/'), false);
  assert.equal(generatedSource.includes("__TONY_THREE_SCENE_BRIDGE__"), true);
  assert.equal(generatedSource.includes("__TONY_CANVAS_MATCH_BRIDGE__"), true);
  assert.equal(generatedSource.includes("__TONY_CAMERA_REPLAY_BRIDGE__"), true);
  assert.equal(generatedSource.includes("onPresentationReady: init3D"), true);
});
