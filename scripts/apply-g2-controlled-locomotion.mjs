import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";',
  'import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";\nimport { locomotionConfig } from "./src/game/config/locomotionConfig.js";\nimport { chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepVelocity } from "./src/game/gameplay/PlayerLocomotion.js";',
  "locomotion imports",
);

replaceOnce(
  '    const hasMove=controlMagnitude>.03;',
  '    const controlledLocomotion=locomotionConfig.controlled;const hasMove=controlMagnitude>controlledLocomotion.minimumMoveMagnitude;',
  "controlled locomotion config",
);

replaceOnce(
  '    const boost = sprinting && !precision && player.stamina > 2 ? 1.42 : 1;\n    player.sprinting = sprinting && !precision && player.stamina > 2 && hasMove;\n    player.controlBoost=Math.max(0,player.controlBoost-dt);const speed=(marking?158:precision?132:205)*boost*controlMagnitude;\n    if (hasMove) {\n      const current=normalize(player.vx||controlX,player.vy||controlY);const turnDot=current.x*controlX+current.y*controlY;const response=(marking?14:precision?18:player.controlBoost>0?16:turnDot<-.15?8:12);const turnGrip=clamp(.72+(turnDot+1)*.14,.72,1);player.vx=lerp(player.vx,controlX*speed*turnGrip,1-Math.exp(-dt*response));player.vy=lerp(player.vy,controlY*speed*turnGrip,1-Math.exp(-dt*response));\n      const face=marking&&markTarget?normalize(markTarget.x-player.x,markTarget.y-player.y):{x:controlX,y:controlY};player.dirX=lerp(player.dirX,face.x,1-Math.exp(-dt*18));player.dirY=lerp(player.dirY,face.y,1-Math.exp(-dt*18));const facing=normalize(player.dirX,player.dirY);player.dirX=facing.x;player.dirY=facing.y;\n      player.stamina=clamp(player.stamina-dt*(player.sprinting?11*input.magnitude:precision ? .35 : 1.1),0,100);\n    } else { player.vx*=Math.pow(.0018,dt);player.vy*=Math.pow(.0018,dt);player.stamina=clamp(player.stamina+dt*(precision?6.2:5),0,100); }',
  '    const canSprint=sprinting&&!precision&&player.stamina>controlledLocomotion.sprintStaminaThreshold;const boost=canSprint?controlledLocomotion.sprintMultiplier:1;\n    player.sprinting=canSprint&&hasMove;player.controlBoost=Math.max(0,player.controlBoost-dt);const baseSpeed=marking?controlledLocomotion.markingSpeed:precision?controlledLocomotion.precisionSpeed:controlledLocomotion.baseSpeed;const speed=baseSpeed*boost*controlMagnitude;\n    if(hasMove){\n      const turn=chooseTurnResponse({currentX:player.vx||controlX,currentY:player.vy||controlY,desiredX:controlX,desiredY:controlY,config:controlledLocomotion,boosted:player.controlBoost>0});const response=marking?controlledLocomotion.markingResponse:precision?controlledLocomotion.precisionResponse:turn.response;const velocity=stepVelocity({vx:player.vx,vy:player.vy,desiredX:controlX,desiredY:controlY,targetSpeed:speed,dt,response,turnGrip:turn.turnGrip});player.vx=velocity.vx;player.vy=velocity.vy;\n      const face=marking&&markTarget?normalize(markTarget.x-player.x,markTarget.y-player.y):{x:controlX,y:controlY};const facing=stepFacing({dirX:player.dirX,dirY:player.dirY,targetX:face.x,targetY:face.y,dt,response:controlledLocomotion.facingResponse});player.dirX=facing.dirX;player.dirY=facing.dirY;\n    }else{const velocity=dampVelocity({vx:player.vx,vy:player.vy,dt,damping:controlledLocomotion.stopDamping});player.vx=velocity.vx;player.vy=velocity.vy;}\n    player.stamina=stepStamina({stamina:player.stamina,moving:hasMove,sprinting:player.sprinting,precision,magnitude:input.magnitude,dt,config:controlledLocomotion});',
  "controlled locomotion body",
);

await writeFile(path, source);
console.log("Applied G2 controlled locomotion integration");
