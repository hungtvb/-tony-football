import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  '  function audioNow() { return audioContext?.currentTime ?? performance.now() / 1000; }',
  '  function audioNow() { return performance.now() / 1000; }',
  "single audio clock domain",
);

replaceOnce(
  '    game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: reducedMotion ? 3.15 : 3.65 };\n    for (const player of players) if (player.team === team) triggerAnimation(player, "celebrate", 3.65, player === scorer ? 1 : .65);',
  '    const goalDuration=reducedMotion?3.15:3.65; game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: goalDuration, duration: goalDuration };\n    for (const player of players) if (player.team === team) triggerAnimation(player, "celebrate", goalDuration, player === scorer ? 1 : .65);',
  "shared goal duration",
);

replaceOnce(
  '      ball: { x: ball.x, y: ball.y, height:ball.height, angle: ball.angle },',
  '      ball: { x: ball.x, y: ball.y, height:ball.height, angle: ball.angle, vx: ball.vx, vy: ball.vy, trail: ball.trail.map((point)=>({x:point.x,y:point.y,height:point.height})) },',
  "replay ball presentation snapshot",
);

replaceOnce(
  '    for(const net of goalNetViews){const impact=game.goalSequence?Math.sin((3.65-game.goalSequence.timer)*22)*Math.exp(-(3.65-game.goalSequence.timer)*1.8):0;net.scale.x=1+Math.abs(impact)*.13;net.material.opacity=.34+Math.abs(impact)*.36;}',
  '    for(const net of goalNetViews){const elapsed=game.goalSequence?game.goalSequence.duration-game.goalSequence.timer:0;const impact=game.goalSequence?Math.sin(elapsed*22)*Math.exp(-elapsed*1.8):0;net.scale.x=1+Math.abs(impact)*.13;net.material.opacity=.34+Math.abs(impact)*.36;}',
  "goal net shared duration",
);

replaceOnce(
  '    ballView.position.set(worldX(renderBall.x),.58+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); const visualSpeed=Math.hypot(ball.vx,ball.vy);ballTrailView?.update(ball.trail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index,count,speed)=>gameFeel.trailOpacity(index,count,speed)}); updateParticleView(); updateAtmosphere3D(now);',
  '    ballView.position.set(worldX(renderBall.x),.58+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); const renderTrail=replayFrame?.ball.trail||ball.trail;const visualSpeed=Math.hypot(renderBall.vx||0,renderBall.vy||0);ballTrailView?.update(renderTrail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index,count,speed)=>gameFeel.trailOpacity(index,count,speed)}); updateParticleView(); updateAtmosphere3D(now);',
  "replay-aware WebGL trail",
);

await writeFile(path, source);
console.log("Applied U2 review fixes safely");
