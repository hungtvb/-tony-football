import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREPARED_MARKERS = Object.freeze([
  "let threeScenePort = null;",
  "onPresentationReady: init3D,",
  "window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.()",
]);

const LEGACY_MARKERS = Object.freeze([
  "new THREE.WebGLRenderer",
  "new EffectComposer(",
  "new RoomEnvironment(",
]);

export function classifyTon80GameSource(source) {
  const preparedCount = PREPARED_MARKERS.filter((marker) => source.includes(marker)).length;
  const legacyCount = LEGACY_MARKERS.filter((marker) => source.includes(marker)).length;

  if (preparedCount === PREPARED_MARKERS.length && legacyCount === 0) return "prepared";
  if (preparedCount === 0 && legacyCount === LEGACY_MARKERS.length) return "legacy";
  return "inconsistent";
}

function runStep(run, command, args, cwd) {
  const result = run(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

export function prepareTon80Game({ cwd = process.cwd(), run = spawnSync } = {}) {
  const gamePath = resolve(cwd, "game.js");
  const initialState = classifyTon80GameSource(readFileSync(gamePath, "utf8"));

  if (initialState === "prepared") {
    console.log("TON-80 game artifact already prepared");
    return Object.freeze({ state: "prepared", changed: false });
  }
  if (initialState !== "legacy") {
    throw new Error("TON-80 game artifact is partially migrated; refusing to overwrite an inconsistent source");
  }

  runStep(run, "python3", ["scripts/ton-80-migrate-game.py"], cwd);
  runStep(run, process.execPath, ["scripts/normalize-ton80-game.mjs"], cwd);

  const finalState = classifyTon80GameSource(readFileSync(gamePath, "utf8"));
  if (finalState !== "prepared") {
    throw new Error(`TON-80 game artifact preparation ended in unexpected state: ${finalState}`);
  }

  console.log("TON-80 clean-host game artifact prepared");
  return Object.freeze({ state: "prepared", changed: true });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    prepareTon80Game();
  } catch (error) {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  }
}
