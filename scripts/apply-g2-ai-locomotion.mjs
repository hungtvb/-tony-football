import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepVelocity } from "./src/game/gameplay/PlayerLocomotion.js";',
  'import { chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepTowardTarget, stepVelocity } from "./src/game/gameplay/PlayerLocomotion.js";',
  "AI locomotion import",
);

replaceOnce(
  `  function moveToward(player, tx, ty, speed, dt) {
    const dx = tx - player.x; const dy = ty - player.y; const n = normalize(dx, dy);
    const wantedX = n.x * speed; const wantedY = n.y * speed; const response = 1 - Math.exp(-dt * 8);
    player.vx = lerp(player.vx, wantedX, response); player.vy = lerp(player.vy, wantedY, response);
    if (Math.hypot(dx, dy) < 8) { player.vx *= .7; player.vy *= .7; }
    if (Math.abs(player.vx) + Math.abs(player.vy) > 4) { const dir = normalize(player.vx, player.vy); player.dirX = dir.x; player.dirY = dir.y; }
  }`,
  `  function moveToward(player, tx, ty, speed, dt) {
    const movement=stepTowardTarget({x:player.x,y:player.y,vx:player.vx,vy:player.vy,dirX:player.dirX,dirY:player.dirY,targetX:tx,targetY:ty,speed,dt,config:locomotionConfig.ai});
    player.vx=movement.vx;player.vy=movement.vy;player.dirX=movement.dirX;player.dirY=movement.dirY;
  }`,
  "shared AI moveToward",
);

await writeFile(path, source);
console.log("Applied G2 AI locomotion integration");
