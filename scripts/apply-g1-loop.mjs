import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../game.js", import.meta.url);
let source = await readFile(path, "utf8");

const importAnchor = 'import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";';
const addedImports = `${importAnchor}\nimport { createSimulationLoop } from "./src/game/core/SimulationLoop.js";\nimport { gameplayConfig } from "./src/game/config/gameplayConfig.js";`;

if (!source.includes('createSimulationLoop } from "./src/game/core/SimulationLoop.js"')) {
  if (!source.includes(importAnchor)) throw new Error("G1 migration aborted: import anchor not found");
  source = source.replace(importAnchor, addedImports);
}

const oldLoop = `  function loop(now) {
    const dt = Math.min(.033, (now - game.lastTime) / 1000 || .016); game.lastTime = now; update(dt); render(now);
    if (game.messageTimer > 0) game.messageTimer -= dt;
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI(); requestAnimationFrame(loop);
  }`;

const newLoop = `  function simulationStep(dt) {
    update(dt);
    if (game.messageTimer > 0) game.messageTimer -= dt;
  }

  function renderFrame(_alpha, now) {
    render(now);
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI();
  }

  const simulationLoop = createSimulationLoop({
    update: simulationStep,
    render: renderFrame,
    clockOptions: gameplayConfig.simulation,
  });`;

if (!source.includes("const simulationLoop = createSimulationLoop")) {
  if (!source.includes(oldLoop)) throw new Error("G1 migration aborted: legacy loop anchor not found");
  source = source.replace(oldLoop, newLoop);
}

const oldStart = "  init3D(); createTeams(); updateUI(); requestAnimationFrame(loop);";
const newStart = "  init3D(); createTeams(); updateUI(); simulationLoop.start();";

if (!source.includes("simulationLoop.start();")) {
  if (!source.includes(oldStart)) throw new Error("G1 migration aborted: startup anchor not found");
  source = source.replace(oldStart, newStart);
}

await writeFile(path, source);
console.log("Applied guarded G1 fixed simulation loop migration to game.js");
