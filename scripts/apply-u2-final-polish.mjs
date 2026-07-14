import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { createAudioFeedbackController } from "./src/game/presentation/AudioFeedbackController.js";',
  'import { createAudioFeedbackController } from "./src/game/presentation/AudioFeedbackController.js";\nimport { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";',
  "particle policy import",
);

replaceOnce(
  '  const audioFeedback = createAudioFeedbackController();',
  '  const audioFeedback = createAudioFeedbackController();\n  const contextualParticles = createContextualParticlePolicy({ lowPowerDevice, reducedMotion });',
  "particle policy init",
);

replaceOnce(
  '  function spawnParticle(x, y, color, energy = 1) {\n    if (game.particles.length >= gameFeel.particleBudget()) return;\n    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;\n    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });\n  }',
  '  function spawnParticle(x, y, color, energy = 1) {\n    if (game.particles.length >= gameFeel.particleBudget()) return;\n    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;\n    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });\n  }\n\n  function spawnContextParticles(x,y,energy=1){\n    const burst=contextualParticles.burst({energy,weather:game.weather,pitchStyle:game.pitchStyle});\n    for(let i=0;i<burst.count;i+=1)spawnParticle(x,y,burst.colors[i%burst.colors.length],burst.energy);\n  }',
  "context particle helper",
);

replaceOnce(
  '    game.stats.shots[player.team] += 1; const shotImpulse=gameFeel.shotImpulse(power); if(shotImpulse>0){gameFeel.addImpulse(shotImpulse,game.stats.shots[HOME]+game.stats.shots[AWAY]);game.flash=Math.max(game.flash,shotImpulse*.5);} announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);',
  '    game.stats.shots[player.team] += 1; spawnContextParticles(player.x+player.dirX*18,player.y+player.dirY*18,.55+power*1.2); const shotImpulse=gameFeel.shotImpulse(power); if(shotImpulse>0){gameFeel.addImpulse(shotImpulse,game.stats.shots[HOME]+game.stats.shots[AWAY]);game.flash=Math.max(game.flash,shotImpulse*.5);} announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);',
  "shot contextual particles",
);

replaceOnce(
  '    for (let i = 0; i < 5; i += 1) spawnParticle(player.x + player.dirX * 14, player.y + player.dirY * 14, i % 2 ? "#b7cf75" : "#5d8a49", .5);',
  '    spawnContextParticles(player.x+player.dirX*14,player.y+player.dirY*14,.8);',
  "tackle contextual particles",
);

replaceOnce(
  '    game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: 3.65 };',
  '    game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: reducedMotion ? 3.15 : 3.65 };',
  "reduced motion goal timing",
);

replaceOnce(
  '    const stadiumPulse=game.goalSequence?1+Math.sin(now*.018)*.45:1;',
  '    const stadiumPulse=game.goalSequence?(reducedMotion?1.08:1+Math.sin(now*.018)*.45):1;',
  "goal pulse reduced motion",
);

await writeFile(path, source);
console.log("Applied U2 contextual particles and final goal polish");
