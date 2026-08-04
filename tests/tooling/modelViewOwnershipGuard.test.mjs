import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

test("browser entry registers model views before scene rendering", async () => {
  const [entry, bootstrap] = await Promise.all([read("browser-entry.js"), read("src/game/application/BrowserBootstrapComposition.js")]);
  assert.match(entry, /createBrowserModelViewAdapter/); assert.match(entry, /__TONY_MODEL_VIEW_BRIDGE__/); assert.match(entry, /getStablePort: \(\) => sceneFacade\.port/); assert.match(entry, /getScenePort: \(\) => sceneFacade\.port/); assert.match(entry, /isSceneBound: \(\) => sceneFacade\.bound/); assert.match(entry, /exposeBrowserPresentationDiagnostics\(globalThis\.window\.__TONY_DEBUG__, modelViewBridge\)/);
  assert.match(bootstrap, /const activeCharge = this\.#inputAdapter\.activeCharge/); assert.match(bootstrap, /const pressedCodes = this\.#inputAdapter\.pressedCodes/); assert.match(bootstrap, /activeCharge, pressedCodes/);
});

test("Player V3 preserves source maps and uses one integrated body plus explicit hair", async () => {
  const [playerView, adapter, appearance] = await Promise.all([read("src/game/presentation/PlayerModelView.js"), read("src/game/presentation/BrowserModelViewAdapter.js"), read("src/game/presentation/RigFootballKitOverlay.js")]);
  for (const contract of ["classifyPlayerSurface", "tonySourceMapPreserved", "tonySharedTextures", "TonyBootLeft", "TonyBootRight", "appearance: view.appearance"]) assert.equal(playerView.includes(contract), true, `PlayerModelView must retain ${contract}`);
  assert.equal(playerView.includes("material.map = null"), false);
  for (const contract of [
    "TonyPlayerV3IntegratedAppearanceMaterial",
    "TonyRigFootballAppearanceV3",
    "vTonyBodyPosition",
    "tonyPlayerV3VariantIndex",
    "tonyPlayerV3VariantName",
    "tonyPlayerV3KitPattern",
    "player-v3-integrated-body-material",
    "TonyPlayerV3Hair",
    "tonyRigHairGeometry",
    "tonySourceMapPreserved",
    "bootRegionCount",
    "rigidPrimitiveCount",
    "rigFootballKitEvidence",
  ]) assert.equal(appearance.includes(contract), true, `Player V3 appearance must retain ${contract}`);
  for (const removedPrimitive of ["TonyRigJersey", "TonyRigShorts", "TonyRigSockLeft", "TonyRigSockRight", "TonyRigBootLeft", "TonyRigBootRight", "tonyRigBootGeometry", "bone.add(mesh)"]) {
    assert.equal(appearance.includes(removedPrimitive), false, `Player V3 must not restore rigid kit geometry: ${removedPrimitive}`);
  }
  for (const contract of ["integratedBodySurfaceCount", "bootRegionCount", "hairlessPlayers", "distinctVariants", "visibleKitPlayers"]) assert.equal(adapter.includes(contract), true, `BrowserModelViewAdapter must expose ${contract}`);
  assert.match(adapter, /player-v3-integrated-body-material/);
  assert.equal(adapter.includes("footwearNodeCount"), false, "browser acceptance must not treat skeleton foot bones as boot geometry");
});

test("generated runtime cannot retain TON-81 ownership", async () => {
  const generated = await read("generated/game.js");
  for (const forbidden of ["GLTFLoader", "MeshoptDecoder", "cloneSkeleton", "AnimationMixer", "createPlayerView", "upgradePlayerView", "updatePlayerView", "createBall3D", "ballView", "chargeView", "playerViews", "playerAsset", "loadPlayerAsset", "applyIntegratedFootballKit"]) assert.doesNotMatch(generated, new RegExp(forbidden));
  assert.match(generated, /__TONY_MODEL_VIEW_BRIDGE__\?\.diagnostics/); assert.match(generated, /createBallTrail3D/); assert.match(generated, /createParticleView/);
});
