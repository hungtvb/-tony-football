import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { gameplayConfig } from "./src/game/config/gameplayConfig.js";',
  'import { gameplayConfig } from "./src/game/config/gameplayConfig.js";\nimport { createGameFeelController } from "./src/game/presentation/GameFeelController.js";',
  "game-feel import",
);

replaceOnce(
  '  let players = [];',
  '  const gameFeel = createGameFeelController();\n  let players = [];',
  "controller initialization",
);

replaceOnce(
  '    game.stats.shots[player.team] += 1; announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);',
  '    game.stats.shots[player.team] += 1; const shotImpulse=gameFeel.shotImpulse(power); if(shotImpulse>0){gameFeel.addImpulse(shotImpulse,game.stats.shots[HOME]+game.stats.shots[AWAY]);game.flash=Math.max(game.flash,shotImpulse*.5);} announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);',
  "strong-shot feedback",
);

replaceOnce(
  '      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; announce(`${player.name} đoạt bóng!`); kickSound(.3);',
  '      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; gameFeel.addImpulse(gameFeel.config.feedback.tackleImpulse,player.index+game.stats.shots[0]*13); announce(`${player.name} đoạt bóng!`); kickSound(.3);',
  "tackle feedback",
);

replaceOnce(
  '    game.score[team] += 1; game.flash = 1; game.shake = 18; ball.owner = null; game.goalScorer = scorer; goalSound();',
  '    game.score[team] += 1; game.flash = 1; game.shake = 18; gameFeel.addImpulse(gameFeel.config.feedback.goalImpulse,game.score[0]*31+game.score[1]*47); ball.owner = null; game.goalScorer = scorer; goalSound();',
  "goal feedback",
);

replaceOnce(
  '    const ease = 1 - Math.exp(-dt * 3.4);',
  '    const ease = gameFeel.cameraEase(dt,game.replay.active);',
  "2D camera easing",
);

replaceOnce(
  '    updateInput(); updateParticles(dt); updateCamera(dt); updateReplay(dt); game.flash = Math.max(0, game.flash - dt * 1.3); game.shake *= Math.pow(.04, dt);',
  '    updateInput(); updateParticles(dt); updateCamera(dt); updateReplay(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);',
  "game-feel update",
);

replaceOnce(
  '    camera3D.position.lerp(cameraTarget,replayFrame ? .12 : .055);if(game.shake>.5){camera3D.position.x+=(Math.random()-.5)*game.shake*.018;camera3D.position.y+=(Math.random()-.5)*game.shake*.012;}camera3D.lookAt(cameraLook);',
  '    const cameraDt=Math.min(.05,Math.max(0,(render3D.lastNow?now-render3D.lastNow:16.667)/1000));render3D.lastNow=now;camera3D.position.lerp(cameraTarget,gameFeel.cameraEase(cameraDt,Boolean(replayFrame)));const feelOffset=gameFeel.sampleCameraOffset(now);camera3D.position.x+=feelOffset.x*.42+feelOffset.z*.12;camera3D.position.y+=feelOffset.y*.28;camera3D.position.z+=feelOffset.z*.28;camera3D.lookAt(cameraLook);',
  "3D camera feedback",
);

await writeFile(path, source);
console.log("Applied U2 game-feel integration to game.js");
