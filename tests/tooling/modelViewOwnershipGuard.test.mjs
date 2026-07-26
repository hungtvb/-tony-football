import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

test("browser entry registers model views before scene rendering", async () => {
  const [entry, bootstrap] = await Promise.all([read("browser-entry.js"), read("src/game/application/BrowserBootstrapComposition.js")]);
  assert.match(entry, /createBrowserModelViewAdapter/);
  assert.match(entry, /__TONY_MODEL_VIEW_BRIDGE__/);
  assert.match(entry, /getStablePort: \(\) => sceneFacade\.port/);
  assert.match(entry, /getScenePort: \(\) => sceneFacade\.port/);
  assert.match(entry, /isSceneBound: \(\) => sceneFacade\.bound/);
  assert.equal(entry.includes("exposeBrowserPresentationDiagnostics(globalThis.window.__TONY_DEBUG__, modelViewBridge, { threeScene: sceneBridge, canvasMatch: canvasMatchBridge, cameraReplay: cameraReplayBridge })"), true);
  for (const contract of ["threeScene: bridges.threeScene?.diagnostics?.()", "canvasMatch: bridges.canvasMatch?.diagnostics?.()", "cameraReplay: bridges.cameraReplay?.diagnostics?.()"]) assert.equal(entry.includes(contract), true, `browser diagnostics must retain ${contract}`);
  assert.match(bootstrap, /const activeCharge = this\.#inputAdapter\.activeCharge/);
  assert.match(bootstrap, /const pressedCodes = this\.#inputAdapter\.pressedCodes/);
  assert.match(bootstrap, /activeCharge, pressedCodes/);
});

test("player appearance preserves source maps and requires explicit rig kit and boot meshes", async () => {
  const [playerView, adapter, overlay] = await Promise.all([read("src/game/presentation/PlayerModelView.js"), read("src/game/presentation/BrowserModelViewAdapter.js"), read("src/game/presentation/RigFootballKitOverlay.js")]);
  for (const contract of ["classifyPlayerSurface", "tonySourceMapPreserved", "tonySharedTextures", "TonyBootLeft", "TonyBootRight", "appearance: view.appearance"]) assert.equal(playerView.includes(contract), true, `PlayerModelView must retain ${contract}`);
  assert.equal(playerView.includes("material.map = null"), false);
  for (const contract of ["TonyRigJersey", "TonyRigShorts", "TonyRigSockLeft", "TonyRigSockRight", "TonyRigBootLeft", "TonyRigBootRight", "tonyRigBootGeometry", "rigFootballKitEvidence"]) assert.equal(overlay.includes(contract), true, `RigFootballKitOverlay must retain ${contract}`);
  assert.match(adapter, /ensureRigFootballKitOverlay/);
  assert.match(adapter, /visibleKitPlayers/);
  assert.match(adapter, /bootGeometryCount/);
  assert.match(adapter, /rigKitInstalled/);
  assert.equal(adapter.includes("footwearNodeCount"), false, "browser acceptance must not treat skeleton foot bones as boot geometry");
});

test("generated runtime cannot retain TON-81 model or effect-view ownership", async () => {
  const generated = await read("generated/game.js");
  for (const forbidden of ["GLTFLoader", "MeshoptDecoder", "cloneSkeleton", "AnimationMixer", "createPlayerView", "upgradePlayerView", "updatePlayerView", "createBall3D", "ballView", "chargeView", "playerViews", "playerAsset", "loadPlayerAsset", "applyIntegratedFootballKit", "__TONY_MODEL_VIEW_BRIDGE__", "createBallTrail3D", "createParticleView"]) assert.doesNotMatch(generated, new RegExp(forbidden));
  assert.match(generated, /__TONY_COMPATIBILITY_PRESENTATION_PORT__/);
});
