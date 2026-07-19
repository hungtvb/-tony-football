import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hostSourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentHost.js", import.meta.url);
const factorySourceUrl = new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js", import.meta.url);

test("browser Three scene host owns renderer, composer and environment dependencies inside presentation", async () => {
  const source = await readFile(hostSourceUrl, "utf8");
  for (const dependency of [
    'from "three"',
    "EffectComposer.js",
    "RenderPass.js",
    "SSAOPass.js",
    "UnrealBloomPass.js",
    "SMAAPass.js",
    "OutputPass.js",
    "RoomEnvironment.js",
  ]) {
    assert.equal(source.includes(dependency), true, `missing ${dependency}`);
  }
  for (const forbidden of [
    "MatchEngine",
    "BrowserRuntimeComposition",
    "GameCommandType",
    "playerViews",
    "ballView",
    "cameraController",
    "replayController",
  ]) {
    assert.equal(source.includes(forbidden), false, `scene host must not absorb ${forbidden}`);
  }
});

test("browser adapter factory composes the concrete host through the lifecycle adapter", async () => {
  const source = await readFile(factorySourceUrl, "utf8");
  assert.match(source, /createThreeSceneEnvironmentAdapter/);
  assert.match(source, /createBrowserThreeSceneEnvironmentHost/);
  assert.doesNotMatch(source, /MatchEngine|runtimeComposition|snapshotAdapter/);
});
