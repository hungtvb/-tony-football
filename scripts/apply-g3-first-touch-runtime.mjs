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
  'import { captureEligibility, classifyFirstTouch, dribbleAnchor, firstTouchScore, resolveFirstTouch } from "./src/game/gameplay/BallControl.js";',
  "first-touch imports",
);

replaceOnce(
  '        if (pickup) setOwner(pickup);',
  '        if (pickup) {\n          const ballSpeed=Math.hypot(ball.vx,ball.vy);const precision=pickup===game.selected&&input.keys.has(FO4_CONTROLS.shield);const score=firstTouchScore({ballSpeed,incomingX:ball.vx,incomingY:ball.vy,facingX:pickup.dirX,facingY:pickup.dirY,ballHeight:ball.height,playerSpeed:Math.hypot(pickup.vx,pickup.vy),rating:pickup.rating,precision,sprinting:pickup.sprinting,config:ballControlConfig.firstTouch,captureConfig:ballControlConfig.capture});const outcome=classifyFirstTouch(score,ballControlConfig.firstTouch);const touch=resolveFirstTouch({outcome,ballX:ball.x,ballY:ball.y,ballVx:ball.vx,ballVy:ball.vy,receiver:pickup});\n          ball.x=touch.x;ball.y=touch.y;ball.vx=touch.vx;ball.vy=touch.vy;ball.lock=Math.max(ball.lock,touch.lock);\n          if(touch.controls)setOwner(pickup,outcome);else{ball.owner=null;ball.lastTouch=pickup;ball.possession=releasePossession(beginReceiving(ball.possession,possessionId(pickup)),outcome,possessionId(pickup));pickup.cooldown=Math.max(pickup.cooldown,touch.lock);triggerAnimation(pickup,"receive",outcome==="heavy"?.26:.18);}\n        }',
  "first-touch pickup outcome",
);

await writeFile(path, source);
console.log("Applied G3 first-touch runtime integration");
