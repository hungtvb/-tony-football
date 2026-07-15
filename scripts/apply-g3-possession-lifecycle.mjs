import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { captureEligibility, dribbleAnchor } from "./src/game/gameplay/BallControl.js";',
  'import { captureEligibility, dribbleAnchor } from "./src/game/gameplay/BallControl.js";\nimport { beginReceiving, controlPossession, createPossessionLifecycle, releasePossession, settleLoose } from "./src/game/gameplay/PossessionLifecycle.js";',
  "possession lifecycle imports",
);

replaceOnce(
  'const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, height: 0, vz: 0, curve: 0, radius: 9, owner: null, lastTouch: null, lock: 0, trail: [], pendingPass: null, angle: 0, spin: 0 };',
  'const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, height: 0, vz: 0, curve: 0, radius: 9, owner: null, lastTouch: null, lock: 0, trail: [], pendingPass: null, angle: 0, spin: 0, possession: createPossessionLifecycle() };',
  "ball lifecycle state",
);

replaceOnce(
  '  function setOwner(player) {',
  '  function possessionId(player) { return player ? `${player.team}:${player.index}` : null; }\n\n  function setOwner(player, touchOutcome = "clean") {',
  "owner transition signature",
);

replaceOnce(
  '    ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;ball.height=0;ball.vz=0;ball.curve=0;player.controlBoost=.28;',
  '    ball.possession=beginReceiving(ball.possession,possessionId(player));ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;ball.height=0;ball.vz=0;ball.curve=0;ball.possession=controlPossession(ball.possession,possessionId(player),touchOutcome);player.controlBoost=.28;',
  "controlled transition",
);

replaceOnce(
  '    const n = normalize(dx, dy); ball.owner = null; ball.lastTouch = player; ball.lock = type === "shot" ? .13 : type === "loft" ? .3 : .2;',
  '    const n = normalize(dx, dy); ball.possession=releasePossession(ball.possession,type,possessionId(player));ball.owner = null; ball.lastTouch = player; ball.lock = type === "shot" ? .13 : type === "loft" ? .3 : .2;',
  "release transition",
);

replaceOnce(
  '      ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;',
  '      ball.possession=releasePossession(ball.possession,"tackle",possessionId(opponent));ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;',
  "tackle transition",
);

replaceOnce(
  '    game.score[team] += 1; game.flash = 1; game.shake = 18; gameFeel.addImpulse(gameFeel.config.feedback.goalImpulse,game.score[0]*31+game.score[1]*47); ball.owner = null; game.goalScorer = scorer; goalSound();',
  '    game.score[team] += 1; game.flash = 1; game.shake = 18; gameFeel.addImpulse(gameFeel.config.feedback.goalImpulse,game.score[0]*31+game.score[1]*47); ball.possession=releasePossession(ball.possession,"goal",possessionId(ball.owner));ball.owner = null; game.goalScorer = scorer; goalSound();',
  "goal transition",
);

replaceOnce(
  '    ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.height=0;ball.vz=0;ball.curve=0;ball.owner = null; ball.lastTouch = null; ball.lock = .8; ball.pendingPass = null; ball.angle = 0; ball.spin = 0;',
  '    ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.height=0;ball.vz=0;ball.curve=0;ball.owner = null; ball.lastTouch = null; ball.lock = .8; ball.pendingPass = null; ball.angle = 0; ball.spin = 0; ball.possession=createPossessionLifecycle();',
  "kickoff reset",
);

replaceOnce(
  '    if (ball.lock > 0) ball.lock -= dt;',
  '    if (ball.lock > 0) ball.lock -= dt; else if(!ball.owner&&ball.possession.state==="released") ball.possession=settleLoose(ball.possession);',
  "release settle",
);

await writeFile(path, source);
console.log("Applied G3 possession lifecycle integration");
