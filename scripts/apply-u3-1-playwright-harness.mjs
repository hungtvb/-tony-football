import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let game = await readFile("game.js", "utf8");
game = replaceOnce(
  game,
  '  const lowPowerDevice = matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);',
  '  const visualTestMode = new URLSearchParams(location.search).get("visualTest") === "1";\n  const lowPowerDevice = visualTestMode || matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);',
  "visual test runtime mode",
);
game = replaceOnce(
  game,
  '    loadPlayerAsset();\n    return true;',
  '    if (!visualTestMode) loadPlayerAsset();\n    else setAssetStatus("ready","VISUAL TEST · WEBGL","Lightweight deterministic browser validation");\n    return true;',
  "skip asynchronous model loading in visual tests",
);
game = replaceOnce(
  game,
  `  document.addEventListener("contextmenu", (event) => event.preventDefault());\n\n  init3D(); createTeams(); updateUI(); simulationLoop.start();`,
  `  document.addEventListener("contextmenu", (event) => event.preventDefault());\n\n  function applyDebugScenario(name = "normal-play") {\n    if (game.state !== "playing") startMatch();\n    game.replay.active = false; game.replay.frames.length = 0; ui.replayBadge.classList.remove("show");\n    ball.owner = null; ball.vx = 0; ball.vy = 0; ball.height = 0; ball.vz = 0; ball.lock = 0;\n    const selected = game.selected || players.find((player) => player.team === HOME && player.role !== "GK");\n    if (selected) { selected.stamina = 100; game.selected = selected; }\n    if (name === "lower-left-camera") { ball.x = FIELD.left + 45; ball.y = FIELD.bottom - 42; ball.vx = -260; ball.vy = 170; }\n    else if (name === "lower-right-camera") { ball.x = FIELD.right - 45; ball.y = FIELD.bottom - 42; ball.vx = 260; ball.vy = 170; }\n    else if (name === "radar-crowded") {\n      players.forEach((player, index) => { player.x = W / 2 + (index % 4 - 1.5) * 42; player.y = H / 2 + (Math.floor(index / 4) - 1) * 38; });\n      ball.x = W / 2; ball.y = H / 2; announce("RADAR VISIBILITY CHECK");\n    } else if (name === "low-stamina") {\n      if (selected) selected.stamina = 18; ball.x = selected?.x ?? W / 2; ball.y = selected?.y ?? H / 2;\n    } else if (name === "replay") {\n      game.replay.frames = Array.from({ length: 24 }, (_, index) => ({\n        ball: { x: 430 + index * 10, y: 350, height: 0, angle: 0, vx: 150, vy: 0, trail: [] },\n        players: players.map((player) => ({ x: player.x, y: player.y, vx: 0, vy: 0, dirX: player.dirX, dirY: player.dirY, stepPhase: player.stepPhase, anim: "idle", animTime: 0, animDuration: 1, animPower: 0 })),\n      }));\n      game.replay.active = true; game.replay.elapsed = 0; ui.replayBadge.textContent = "● INSTANT REPLAY"; ui.replayBadge.classList.add("show");\n    }\n    updateCamera(1 / 60); updateUI();\n    if (name !== "normal-play") {\n      game.state = "paused";\n      ui.pause.classList.remove("show");\n      input.keys.clear();\n    }\n  }\n\n  window.__TONY_DEBUG__ = {\n    ready: false,\n    applyScenario: applyDebugScenario,\n    diagnostics: () => ({\n      camera: { ...game.camera },\n      ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },\n      state: game.state,\n      replay: game.replay.active,\n      renderer: use3D ? "webgl" : "canvas",\n      visualTestMode,\n      selectedStamina: game.selected?.stamina ?? null,\n    }),\n  };\n\n  init3D(); createTeams(); updateUI(); simulationLoop.start();\n  const debugScenario = new URLSearchParams(location.search).get("debugScenario");\n  if (debugScenario) applyDebugScenario(debugScenario);\n  window.__TONY_DEBUG__.ready = true;`,
  "debug scenario harness",
);
await writeFile("game.js", game);

let index = await readFile("index.html", "utf8");
index = replaceOnce(
  index,
  '{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"}}',
  '{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}',
  "local Three.js import map",
);
await writeFile("index.html", index);

let packageJson = JSON.parse(await readFile("package.json", "utf8"));
packageJson.scripts["test:e2e"] = "playwright test";
packageJson.scripts["test:e2e:report"] = "playwright show-report";
packageJson.devDependencies = { ...(packageJson.devDependencies || {}), "@playwright/test": "1.54.1" };
await writeFile("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
