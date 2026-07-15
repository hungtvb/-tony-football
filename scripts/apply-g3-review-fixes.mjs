import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  '  function setOwner(player, touchOutcome = "clean") {',
  '  function setOwner(player, touchOutcome = "clean", retainedVelocity = null) {',
  "setOwner retained velocity signature",
);

replaceOnce(
  '    ball.possession=beginReceiving(ball.possession,possessionId(player));ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;ball.height=0;ball.vz=0;ball.curve=0;ball.possession=controlPossession(ball.possession,possessionId(player),touchOutcome);player.controlBoost=.28;',
  '    ball.possession=beginReceiving(ball.possession,possessionId(player));ball.owner = player; ball.lastTouch = player; ball.vx=retainedVelocity?.vx||0;ball.vy=retainedVelocity?.vy||0;ball.height=0;ball.vz=0;ball.curve=0;ball.possession=controlPossession(ball.possession,possessionId(player),touchOutcome);player.controlBoost=.28;',
  "preserve cushioned velocity",
);

replaceOnce(
  '          if(touch.controls)setOwner(pickup,outcome);else{ball.owner=null;ball.lastTouch=pickup;ball.possession=releasePossession(beginReceiving(ball.possession,possessionId(pickup)),outcome,possessionId(pickup));pickup.cooldown=Math.max(pickup.cooldown,touch.lock);triggerAnimation(pickup,"receive",outcome==="heavy"?.26:.18);}',
  '          if(touch.controls)setOwner(pickup,outcome,outcome==="cushioned"?{vx:touch.vx,vy:touch.vy}:null);else{ball.owner=null;ball.lastTouch=pickup;ball.possession=releasePossession(beginReceiving(ball.possession,possessionId(pickup)),outcome,possessionId(pickup));pickup.cooldown=Math.max(pickup.cooldown,touch.lock);triggerAnimation(pickup,"receive",outcome==="heavy"?.26:.18);}',
  "pass cushioned velocity into owner transition",
);

replaceOnce(
  '      ball: { x: ball.x, y: ball.y, height:ball.height, angle: ball.angle, vx: ball.vx, vy: ball.vy, trail: ball.trail.map((point)=>({x:point.x,y:point.y,height:point.height})) },',
  '      ball: { x: ball.x, y: ball.y, height:ball.height, angle: ball.angle, vx: ball.vx, vy: ball.vy, ownerId: possessionId(ball.owner), possession: { ...ball.possession }, trail: ball.trail.map((point)=>({x:point.x,y:point.y,height:point.height})) },',
  "replay possession snapshot",
);

await writeFile(path, source);
console.log("Applied G3 review fixes");
