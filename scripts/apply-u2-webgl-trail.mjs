import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { createGameFeelController } from "./src/game/presentation/GameFeelController.js";',
  'import { createGameFeelController } from "./src/game/presentation/GameFeelController.js";\nimport { createBallTrail3D } from "./src/game/presentation/BallTrail3D.js";',
  "trail import",
);

replaceOnce(
  '  let renderer3D; let composer3D; let scene3D; let camera3D; let ballView; let particleView; let chargeView; let screenFx; let ctx; let use3D = true; let crowdView; let pitchView; let grassView; let rainView;let hemisphereLight;let floodLight;let rimLight;',
  '  let renderer3D; let composer3D; let scene3D; let camera3D; let ballView; let ballTrailView; let particleView; let chargeView; let screenFx; let ctx; let use3D = true; let crowdView; let pitchView; let grassView; let rainView;let hemisphereLight;let floodLight;let rimLight;',
  "trail view declaration",
);

replaceOnce(
  '    createPitch3D(); createGrass3D(); createStadium3D(); createGoals3D(); createAtmosphere3D(); createBall3D(); createParticleView(); createChargeView();applyStadiumLighting();',
  '    createPitch3D(); createGrass3D(); createStadium3D(); createGoals3D(); createAtmosphere3D(); createBall3D(); ballTrailView=createBallTrail3D(THREE,{maxPoints:gameFeel.config.ball.trailMaxPoints});scene3D.add(ballTrailView.line); createParticleView(); createChargeView();applyStadiumLighting();',
  "trail initialization",
);

replaceOnce(
  '    ballView.position.set(worldX(renderBall.x),.58+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); updateParticleView(); updateAtmosphere3D(now);',
  '    ballView.position.set(worldX(renderBall.x),.58+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); const visualSpeed=Math.hypot(ball.vx,ball.vy);ballTrailView?.update(ball.trail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index,count,speed)=>gameFeel.trailOpacity(index,count,speed)}); updateParticleView(); updateAtmosphere3D(now);',
  "trail update",
);

await writeFile(path, source);
console.log("Applied U2 WebGL ball trail integration");
