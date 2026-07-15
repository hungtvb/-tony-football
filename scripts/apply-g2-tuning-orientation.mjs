import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepTowardTarget, stepVelocity } from "./src/game/gameplay/PlayerLocomotion.js";',
  'import { canvasHeading, chooseSprintTransitionResponse, chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepTowardTarget, stepVelocity, webGLHeading } from "./src/game/gameplay/PlayerLocomotion.js";',
  "locomotion helper imports",
);

replaceOnce(
  '    const canSprint=sprinting&&!precision&&player.stamina>controlledLocomotion.sprintStaminaThreshold;const boost=canSprint?controlledLocomotion.sprintMultiplier:1;\n    player.sprinting=canSprint&&hasMove;player.controlBoost=Math.max(0,player.controlBoost-dt);const baseSpeed=marking?controlledLocomotion.markingSpeed:precision?controlledLocomotion.precisionSpeed:controlledLocomotion.baseSpeed;const speed=baseSpeed*boost*controlMagnitude;',
  '    const wasSprinting=player.sprinting;const canSprint=sprinting&&!precision&&player.stamina>controlledLocomotion.sprintStaminaThreshold;const boost=canSprint?controlledLocomotion.sprintMultiplier:1;\n    player.sprinting=canSprint&&hasMove;player.controlBoost=Math.max(0,player.controlBoost-dt);const baseSpeed=marking?controlledLocomotion.markingSpeed:precision?controlledLocomotion.precisionSpeed:controlledLocomotion.baseSpeed;const speed=baseSpeed*boost*controlMagnitude;',
  "capture sprint transition",
);

replaceOnce(
  '      const turn=chooseTurnResponse({currentX:player.vx||controlX,currentY:player.vy||controlY,desiredX:controlX,desiredY:controlY,config:controlledLocomotion,boosted:player.controlBoost>0});const response=marking?controlledLocomotion.markingResponse:precision?controlledLocomotion.precisionResponse:turn.response;const velocity=stepVelocity({vx:player.vx,vy:player.vy,desiredX:controlX,desiredY:controlY,targetSpeed:speed,dt,response,turnGrip:turn.turnGrip});player.vx=velocity.vx;player.vy=velocity.vy;',
  '      const turn=chooseTurnResponse({currentX:player.vx||controlX,currentY:player.vy||controlY,desiredX:controlX,desiredY:controlY,config:controlledLocomotion,boosted:player.controlBoost>0});const baseResponse=marking?controlledLocomotion.markingResponse:precision?controlledLocomotion.precisionResponse:turn.response;const response=chooseSprintTransitionResponse({wasSprinting,sprinting:player.sprinting,baseResponse,config:controlledLocomotion});const velocity=stepVelocity({vx:player.vx,vy:player.vy,desiredX:controlX,desiredY:controlY,targetSpeed:speed,dt,response,turnGrip:turn.turnGrip});player.vx=velocity.vx;player.vy=velocity.vy;',
  "sprint transition response",
);

replaceOnce(
  'view.root.rotation.y=pose.motionYaw??Math.atan2(pose.dirX,pose.dirY);',
  'view.root.rotation.y=pose.motionYaw??webGLHeading(pose.dirX,pose.dirY);',
  "WebGL heading adapter",
);

replaceOnce(
  'ctx.rotate(Math.atan2(pose.dirY,pose.dirX)+Math.PI/2);',
  'ctx.rotate(canvasHeading(pose.dirX,pose.dirY));',
  "Canvas heading adapter",
);

replaceOnce(
  'const angle = Math.atan2(player.dirY, player.dirX) + Math.PI / 2;',
  'const angle = canvasHeading(player.dirX, player.dirY);',
  "legacy Canvas heading adapter",
);

await writeFile(path, source);
console.log("Applied G2 tuning and renderer heading integration");