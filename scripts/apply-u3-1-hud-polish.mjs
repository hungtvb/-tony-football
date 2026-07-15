import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const path = "game.js";
let source = await readFile(path, "utf8");

source = replaceOnce(
  source,
  '    replayBadge: $("replayBadge"),controlsMode:$("controlsMode"),controlsCard:$("controlsCard"),assetStatus:$("assetStatus")',
  '    replayBadge: $("replayBadge"),controlsMode:$("controlsMode"),controlsCard:$("controlsCard"),assetStatus:$("assetStatus"),playerCard:document.querySelector(".hud-player-card")',
  "player card UI binding",
);

source = replaceOnce(
  source,
  '    goalSequence: null, goalScorer: null, weather:loadPreference("tfWeather","clear",WEATHER_STYLES),pitchStyle:loadPreference("tfPitch","classic",PITCH_STYLES),ballStyle:loadPreference("tfBall","classic",BALL_STYLES)',
  '    goalSequence: null, goalScorer: null, hud: { selectedKey: "", playerChangeTimer: null }, weather:loadPreference("tfWeather","clear",WEATHER_STYLES),pitchStyle:loadPreference("tfPitch","classic",PITCH_STYLES),ballStyle:loadPreference("tfBall","classic",BALL_STYLES)',
  "HUD state",
);

source = replaceOnce(
  source,
  `    const player = game.selected; if (player) {\n      ui.playerName.textContent = player.name; ui.playerNumber.textContent = player.number; ui.playerRating.textContent = player.rating;\n      ui.staminaBar.style.width = \`${'${player.stamina}'}%\`; ui.staminaText.textContent = \`${'${Math.round(player.stamina)}'}%\`;\n      ui.staminaBar.style.background = player.stamina < 25 ? "#e95e4e" : "linear-gradient(90deg,#b78a2f,#ffdc78)";\n    }`,
  `    const player = game.selected; if (player) {\n      const selectedKey=\`${'${player.team}:${player.index}'}\`;\n      if(game.hud.selectedKey&&game.hud.selectedKey!==selectedKey&&ui.playerCard){\n        ui.playerCard.classList.remove("player-change");void ui.playerCard.offsetWidth;ui.playerCard.classList.add("player-change");\n        clearTimeout(game.hud.playerChangeTimer);game.hud.playerChangeTimer=setTimeout(()=>ui.playerCard?.classList.remove("player-change"),320);\n      }\n      game.hud.selectedKey=selectedKey;\n      ui.playerName.textContent = player.name; ui.playerNumber.textContent = player.number; ui.playerRating.textContent = player.rating;\n      ui.staminaBar.style.width = \`${'${player.stamina}'}%\`; ui.staminaText.textContent = \`${'${Math.round(player.stamina)}'}%\`;\n      const lowStamina=player.stamina<25;ui.playerCard?.classList.toggle("low-stamina",lowStamina);\n      ui.staminaBar.style.background = lowStamina ? "linear-gradient(90deg,#b63f35,#ff8c78)" : "linear-gradient(90deg,#b78a2f,#ffdc78)";\n    }\n    const onboardingElapsed=MATCH_SECONDS-game.time;const hintsActive=Boolean(input.actionStart||input.magnitude>.05||game.state!=="playing");\n    ui.controlsCard?.classList.toggle("hints-dimmed",onboardingElapsed>18&&!hintsActive);\n    ui.controlsCard?.classList.toggle("hints-active",hintsActive);`,
  "HUD runtime states",
);

await writeFile(path, source);
console.log("Applied U3.1 HUD polish integration");
