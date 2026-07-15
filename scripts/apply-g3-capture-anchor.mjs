import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { locomotionConfig } from "./src/game/config/locomotionConfig.js";',
  'import { locomotionConfig } from "./src/game/config/locomotionConfig.js";\nimport { ballControlConfig } from "./src/game/config/ballControlConfig.js";\nimport { captureEligibility, dribbleAnchor } from "./src/game/gameplay/BallControl.js";',
  "ball control imports",
);

replaceOnce(
  '      const owner=ball.owner;ball.height=0;ball.vz=0;const closeControl=owner===game.selected&&!owner.sprinting;const speed=Math.hypot(owner.vx,owner.vy);const touch=Math.sin(owner.stepPhase);if(Math.abs(touch)>.82)owner.dribbleSide=touch>0?1:-1;const lead=owner.radius+(closeControl?7:12)+clamp(speed/110,0,2.8)*Math.max(0,touch);const lateral=(speed>35?owner.dribbleSide:0)*(closeControl?2.3:3.8);const targetX=owner.x+owner.dirX*lead-owner.dirY*lateral;const targetY=owner.y+owner.dirY*lead+owner.dirX*lateral;const follow=1-Math.exp(-dt*(closeControl?28:20));ball.x=lerp(ball.x,targetX,follow);ball.y=lerp(ball.y,targetY,follow);ball.vx=owner.vx;ball.vy=owner.vy;',
  '      const owner=ball.owner;ball.height=0;ball.vz=0;const precision=owner===game.selected&&!owner.sprinting;const speed=Math.hypot(owner.vx,owner.vy);const touch=Math.sin(owner.stepPhase);if(Math.abs(touch)>.82)owner.dribbleSide=touch>0?1:-1;const mode=owner.sprinting?"sprint":precision?"precision":"normal";const anchor=dribbleAnchor({owner,mode,stepPhase:owner.stepPhase,config:ballControlConfig.dribble});const follow=1-Math.exp(-dt*anchor.followRate);ball.x=lerp(ball.x,anchor.x,follow);ball.y=lerp(ball.y,anchor.y,follow);ball.vx=owner.vx;ball.vy=owner.vy;',
  "dribble anchor integration",
);

replaceOnce(
  '          if (player.cooldown > 0 || player === ball.lastTouch && Math.hypot(ball.vx, ball.vy) > 550) continue;\n          const catchRadius=player.role==="GK"?38:28;if(ball.height>(player.role==="GK"?2.8:1.05))continue;const d=distance(player,ball);if(d<catchRadius&&d<best){pickup=player;best=d;}',
  '          const d=distance(player,ball);const eligibility=captureEligibility({distance:d,ballHeight:ball.height,ballSpeed:Math.hypot(ball.vx,ball.vy),locked:ball.lock>0,playerCooldown:player.cooldown,isGoalkeeper:player.role==="GK",isLastTouch:player===ball.lastTouch,config:ballControlConfig.capture});if(eligibility.eligible&&d<best){pickup=player;best=d;}',
  "capture eligibility integration",
);

await writeFile(path, source);
console.log("Applied G3 capture and dribble-anchor integration");
