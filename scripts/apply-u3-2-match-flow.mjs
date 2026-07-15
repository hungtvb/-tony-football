import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let index = await readFile("index.html", "utf8");
index = replaceOnce(
  index,
  '    <link rel="stylesheet" href="u3-camera-hud.css" />',
  '    <link rel="stylesheet" href="u3-camera-hud.css" />\n    <link rel="stylesheet" href="u3-match-flow.css" />',
  "match flow stylesheet",
);
index = replaceOnce(
  index,
  '                <button id="resumeButton" class="primary-button">TIẾP TỤC</button>\n                <button id="restartButton" class="secondary-button">CHƠI LẠI</button>',
  '                <div class="pause-actions">\n                  <button id="resumeButton" class="primary-button">TIẾP TỤC</button>\n                  <button id="restartButton" class="secondary-button">CHƠI LẠI</button>\n                  <button id="setupButton" class="tertiary-button">VỀ THIẾT LẬP TRẬN</button>\n                  <button id="mainMenuButton" class="tertiary-button danger">VỀ MÀN HÌNH ĐẦU</button>\n                </div>',
  "pause navigation buttons",
);
await writeFile("index.html", index);

let game = await readFile("game.js", "utf8");
game = replaceOnce(
  game,
  '  function togglePause(force) {\n    if (game.state !== "playing" && game.state !== "paused") return;\n    const pause = typeof force === "boolean" ? force : game.state === "playing";\n    game.state = pause ? "paused" : "playing"; ui.pause.classList.toggle("show", pause); ui.matchState.textContent = pause ? "TẠM DỪNG" : "LIVE";\n  }',
  '  function togglePause(force) {\n    if (game.state !== "playing" && game.state !== "paused") return;\n    const pause = typeof force === "boolean" ? force : game.state === "playing";\n    game.state = pause ? "paused" : "playing"; ui.pause.classList.toggle("show", pause); ui.matchState.textContent = pause ? "TẠM DỪNG" : "LIVE";\n  }\n\n  function clearActiveInput() {\n    input.keys.clear(); input.actionCode = null; input.actionStart = 0; input.actionCharge = 0; input.actionModifiers = null;\n    input.bufferedAction = null; input.qTapStart = 0; input.qConsumed = false; input.moveX = 0; input.moveY = 0; input.magnitude = 0;\n  }\n\n  function showMatchSetup({ reset = true } = {}) {\n    clearActiveInput();\n    if (reset) resetMatch();\n    game.state = "menu"; game.replay.active = false; game.goalSequence = null; game.goalScorer = null;\n    ui.pause.classList.remove("show"); ui.result.classList.remove("show"); ui.start.classList.add("show");\n    ui.replayBadge.classList.remove("show"); ui.matchState.textContent = "SẴN SÀNG";\n    announce("Chọn thiết lập rồi bắt đầu trận mới.");\n  }\n\n  function showMainMenu() {\n    showMatchSetup({ reset: true });\n    ui.start.dataset.entry = "main-menu";\n    announce("Đã trở về màn hình đầu.");\n  }',
  "match flow functions",
);
game = replaceOnce(
  game,
  '  $("resumeButton").addEventListener("click", () => togglePause(false));\n  $("restartButton").addEventListener("click", startMatch);\n  $("playAgainButton").addEventListener("click", startMatch);',
  '  $("resumeButton").addEventListener("click", () => togglePause(false));\n  $("restartButton").addEventListener("click", startMatch);\n  $("setupButton").addEventListener("click", () => showMatchSetup({ reset: true }));\n  $("mainMenuButton").addEventListener("click", showMainMenu);\n  $("playAgainButton").addEventListener("click", startMatch);',
  "match flow event bindings",
);
await writeFile("game.js", game);

console.log("Applied U3.2 match flow integration");
