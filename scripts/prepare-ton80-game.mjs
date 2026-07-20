import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeTon80GameSource } from "./normalize-ton80-game.mjs";

const PREPARED_MARKERS = Object.freeze([
  "let threeScenePort = null;",
  "onPresentationReady: init3D,",
  "window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.()",
  "window.__TONY_CANVAS_MATCH_BRIDGE__?.diagnostics?.()",
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
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
}

export function prepareTon80Game({ cwd = process.cwd(), run = spawnSync } = {}) {
  const sourcePath = resolve(cwd, "game.js");
  const outputPath = resolve(cwd, "generated/game.js");
  const source = readFileSync(sourcePath, "utf8");
  if (classifyTon80GameSource(source) !== "legacy") throw new Error("Tracked game.js must remain the canonical legacy migration input");
  const workdir = mkdtempSync(join(tmpdir(), "ton80-generate-"));
  try {
    copyFileSync(sourcePath, join(workdir, "game.js"));
    runStep(run, "python3", [resolve(cwd, "scripts/ton-81-migrate-model-views.py")], workdir);
    runStep(run, "python3", [resolve(cwd, "scripts/ton-80-migrate-game.py")], workdir);
    runStep(run, "python3", [resolve(cwd, "scripts/ton-82-migrate-canvas.py")], workdir);
    const generated = normalizeTon80GameSource(readFileSync(join(workdir, "game.js"), "utf8"));
    if (classifyTon80GameSource(generated) !== "prepared") throw new Error("TON-82 generation ended in an unexpected state");
    mkdirSync(dirname(outputPath), { recursive: true });
    const previous = (() => { try { return readFileSync(outputPath, "utf8"); } catch { return null; } })();
    writeFileSync(outputPath, generated, "utf8");
    if (readFileSync(sourcePath, "utf8") !== source) throw new Error("TON-82 generation mutated tracked game.js");
    console.log(previous === generated ? "TON-82 generated artifact unchanged" : "TON-82 generated artifact prepared");
    return Object.freeze({ state: "prepared", changed: previous !== generated, outputPath });
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { prepareTon80Game(); } catch (error) {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  }
}
