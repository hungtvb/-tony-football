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

test("browser entry keeps the clean host narrow and registers final presentation owners", async () => {
  const factory = await readFile(factorySourceUrl, "utf8");
  const entry = await readFile(entrySourceUrl, "utf8");
  assert.equal(factory.includes("createBrowserThreeSceneEnvironmentHost"), true);
  assert.equal(factory.includes("LegacyAdoptedThreeSceneHost"), false);
  for (const contract of ["__TONY_THREE_SCENE_BRIDGE__", "__TONY_CANVAS_MATCH_BRIDGE__", "__TONY_CAMERA_REPLAY_BRIDGE__", "__TONY_COMPATIBILITY_PRESENTATION_PORT__", "createCanvasMatchRenderer", "createSnapshotCameraReplayAdapter", "createBrowserEffectsViewAdapter", './generated/game.js?v=25.0.0']) assert.equal(entry.includes(contract), true, `browser entry must retain ${contract}`);
  assert.equal(entry.includes("installLegacyThreeSceneTracking"), false);
  assert.equal(entry.includes("EffectComposer"), false);
  assert.equal(entry.includes('from "three"'), false);
});

test("canonical and generated runtimes retain only the outward compatibility presentation port", async () => {
  const canonicalSource = await readFile(canonicalGameSourceUrl, "utf8");
  const generatedSource = await readFile(generatedGameSourceUrl, "utf8");
  const forbidden = ["new THREE.WebGLRenderer", "new EffectComposer", "new RoomEnvironment", "createPitch3D", "createGrass3D", "createStadium3D", "createAtmosphere3D", "createGoals3D", "renderFallback2D", "drawFallbackPlayerDetail", 'canvas.getContext("2d")', "createSnapshotCameraController", "createSnapshotReplayController", "game.replay.update(", "game.replay.record(", "game.replay.start(", "game.replay.loadFrames(", "game.replay.syncElapsed(", "cameraReplayBridge.project(", "recordReplaySnapshot", "function updateUI(", "function tone("];
  for (const source of [canonicalSource, generatedSource]) for (const token of forbidden) assert.equal(source.includes(token), false, `runtime must not own ${token}`);
  assert.equal(generatedSource.includes('from "../src/'), true);
  assert.equal(generatedSource.includes('from "./src/'), false);
  for (const contract of ["__TONY_COMPATIBILITY_PRESENTATION_PORT__", "__TONY_CAMERA_REPLAY_BRIDGE__", "getPresentationFrameFacts"]) assert.equal(generatedSource.includes(contract), true, `generated runtime must retain ${contract}`);
  for (const legacyBridge of ["__TONY_THREE_SCENE_BRIDGE__", "__TONY_CANVAS_MATCH_BRIDGE__", "__TONY_SETTINGS_EFFECTS_BRIDGE__"]) assert.equal(generatedSource.includes(legacyBridge), false, `generated runtime must not consume ${legacyBridge}`);
  assert.equal(generatedSource.includes("onPresentationReady: init3D"), false);
});
