import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const gamePath = "game.js";
let game = await readFile(gamePath, "utf8");

game = replaceOnce(
  game,
  'import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";\nimport { locomotionConfig } from "./src/game/config/locomotionConfig.js";',
  'import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";\nimport { cameraHudConfig } from "./src/game/config/cameraHudConfig.js";\nimport { cameraFrameTarget, cameraZoomForSpeed } from "./src/game/presentation/CameraFraming.js";\nimport { locomotionConfig } from "./src/game/config/locomotionConfig.js";',
  "camera imports",
);

game = replaceOnce(
  game,
  `  function updateCamera(dt) {\n    const camera = game.camera;\n    const ballSpeed = Math.hypot(ball.vx, ball.vy);\n    camera.targetZoom = game.state === "playing" ? clamp(1.025 + ballSpeed / 9000, 1.025, 1.075) : 1;\n    const follow = game.state === "playing" ? .085 : 0;\n    const desiredX = lerp(W / 2, ball.x, follow);\n    const desiredY = lerp(H / 2, ball.y, follow);\n    const ease = gameFeel.cameraEase(dt,game.replay.active);\n    camera.x = lerp(camera.x, desiredX, ease);\n    camera.y = lerp(camera.y, desiredY, ease);\n    camera.zoom = lerp(camera.zoom, camera.targetZoom, 1 - Math.exp(-dt * 2.8));\n    const halfW = W / (camera.zoom * 2); const halfH = H / (camera.zoom * 2);\n    camera.x = clamp(camera.x, halfW, W - halfW); camera.y = clamp(camera.y, halfH, H - halfH);\n  }`,
  `  function updateCamera(dt) {\n    const camera = game.camera;\n    const config = cameraHudConfig.camera;\n    const active = game.state === "playing" || game.state === "paused";\n    const ballSpeed = Math.hypot(ball.vx, ball.vy);\n    camera.targetZoom = active ? cameraZoomForSpeed(ballSpeed, config) : config.baseZoom;\n    const frame = active ? cameraFrameTarget({\n      cameraX: camera.x, cameraY: camera.y, subjectX: ball.x, subjectY: ball.y,\n      velocityX: ball.vx, velocityY: ball.vy, worldWidth: W, worldHeight: H,\n      viewportWidth: W, viewportHeight: H, zoom: camera.targetZoom, config,\n    }) : { x: W / 2, y: H / 2 };\n    const followEase = 1 - Math.exp(-dt * config.followRate);\n    camera.x = lerp(camera.x, frame.x, followEase);\n    camera.y = lerp(camera.y, frame.y, followEase);\n    camera.zoom = lerp(camera.zoom, camera.targetZoom, 1 - Math.exp(-dt * config.zoomRate));\n  }`,
  "camera runtime policy",
);

game = replaceOnce(
  game,
  `    const targetX=worldX(lerp(W/2,renderBall.x,replayFrame?1:.34));const targetZ=worldZ(lerp(H/2,renderBall.y,replayFrame?1:.18));\n    if(replayFrame){const scoringRight=game.goalSequence?.team===HOME;cameraTarget.set(targetX+(scoringRight?-16:16),13,clamp(targetZ+22,-19,19));cameraLook.set(targetX,1.2,targetZ);}\n    else if(game.goalSequence){const scorer=game.goalScorer||ball;cameraTarget.set(worldX(scorer.x)-9,8.5,worldZ(scorer.y)+12);cameraLook.set(worldX(scorer.x),2.4,worldZ(scorer.y));}\n    else if(game.cameraMode==="tactical"){cameraTarget.set(targetX,lowPowerDevice?66:60,30+targetZ*.05);cameraLook.set(targetX,0,targetZ);}\n    else if(game.cameraMode==="close"){cameraTarget.set(targetX-11,lowPowerDevice?26:20,lowPowerDevice?38:31+targetZ*.18);cameraLook.set(targetX,1.2,targetZ);}\n    else{cameraTarget.set(targetX,(lowPowerDevice?52:44)+Math.min(5,Math.hypot(ball.vx,ball.vy)*.004),(lowPowerDevice?62:52)+targetZ*.08);cameraLook.set(targetX,.7,targetZ);}`,
  `    const framedX=replayFrame?renderBall.x:game.camera.x;const framedY=replayFrame?renderBall.y:game.camera.y;\n    const targetX=worldX(framedX);const targetZ=worldZ(framedY);const zoomScale=replayFrame?1:1/Math.max(.01,game.camera.zoom);\n    if(replayFrame){const scoringRight=game.goalSequence?.team===HOME;cameraTarget.set(targetX+(scoringRight?-16:16),13,clamp(targetZ+22,-19,19));cameraLook.set(targetX,1.2,targetZ);}\n    else if(game.goalSequence){const scorer=game.goalScorer||ball;cameraTarget.set(worldX(scorer.x)-9,8.5,worldZ(scorer.y)+12);cameraLook.set(worldX(scorer.x),2.4,worldZ(scorer.y));}\n    else if(game.cameraMode==="tactical"){cameraTarget.set(targetX,(lowPowerDevice?66:60)*zoomScale,30*zoomScale+targetZ*.04);cameraLook.set(targetX,0,targetZ);}\n    else if(game.cameraMode==="close"){cameraTarget.set(targetX-11,(lowPowerDevice?26:20)*zoomScale,(lowPowerDevice?38:31)*zoomScale+targetZ*.14);cameraLook.set(targetX,1.2,targetZ);}\n    else{cameraTarget.set(targetX,(lowPowerDevice?54:47)*zoomScale,(lowPowerDevice?66:57)*zoomScale+targetZ*.06);cameraLook.set(targetX,.7,targetZ);}`,
  "WebGL camera framing",
);

game = replaceOnce(
  game,
  `  function drawRadar() {\n    const rw = radar.width; const rh = radar.height; rctx.clearRect(0,0,rw,rh); rctx.fillStyle = "#073522"; rctx.fillRect(0,0,rw,rh);\n    rctx.strokeStyle = "rgba(255,255,255,.42)"; rctx.lineWidth = 1; rctx.strokeRect(5,5,rw-10,rh-10); rctx.beginPath(); rctx.moveTo(rw/2,5); rctx.lineTo(rw/2,rh-5); rctx.stroke();\n    for (const player of players) { rctx.fillStyle = player.team === HOME ? "#e1bb58" : "#47c9d4"; rctx.beginPath(); rctx.arc(player.x/W*rw,player.y/H*rh,player===game.selected?4:2.7,0,Math.PI*2); rctx.fill(); }\n    rctx.fillStyle = "white"; rctx.beginPath(); rctx.arc(ball.x/W*rw,ball.y/H*rh,2.2,0,Math.PI*2); rctx.fill();\n  }`,
  `  function drawRadar() {\n    const config=cameraHudConfig.radar;const rw=radar.width;const rh=radar.height;const pad=config.plotPadding;const plotW=rw-pad*2;const plotH=rh-pad*2;\n    const mapX=(value)=>pad+clamp((value-FIELD.left)/(FIELD.right-FIELD.left),0,1)*plotW;\n    const mapY=(value)=>pad+clamp((value-FIELD.top)/(FIELD.bottom-FIELD.top),0,1)*plotH;\n    rctx.clearRect(0,0,rw,rh);rctx.fillStyle="#062d1e";rctx.fillRect(0,0,rw,rh);\n    rctx.strokeStyle="rgba(236,248,241,.5)";rctx.lineWidth=1;rctx.strokeRect(pad,pad,plotW,plotH);rctx.beginPath();rctx.moveTo(rw/2,pad);rctx.lineTo(rw/2,rh-pad);rctx.stroke();\n    rctx.beginPath();rctx.arc(rw/2,rh/2,Math.min(plotW,plotH)*.13,0,Math.PI*2);rctx.stroke();\n    for(const player of players){const x=mapX(player.x);const y=mapY(player.y);const selected=player===game.selected;const radius=selected?config.selectedRadius:config.playerRadius;rctx.fillStyle=player.team===HOME?"#f0c85d":"#55d5df";rctx.beginPath();rctx.arc(x,y,radius,0,Math.PI*2);rctx.fill();if(selected){rctx.strokeStyle="#fff3bd";rctx.lineWidth=1.7;rctx.beginPath();rctx.arc(x,y,radius+2.2,0,Math.PI*2);rctx.stroke();}}\n    const bx=mapX(ball.x);const by=mapY(ball.y);rctx.fillStyle="#ffffff";rctx.strokeStyle="#101615";rctx.lineWidth=2;rctx.beginPath();rctx.arc(bx,by,config.ballRadius,0,Math.PI*2);rctx.fill();rctx.stroke();\n  }`,
  "radar plot hierarchy",
);

await writeFile(gamePath, game);

const indexPath = "index.html";
let index = await readFile(indexPath, "utf8");
index = replaceOnce(
  index,
  '    <link rel="stylesheet" href="u1-match-experience.css" />',
  '    <link rel="stylesheet" href="u1-match-experience.css" />\n    <link rel="stylesheet" href="u3-camera-hud.css" />',
  "U3 camera HUD stylesheet",
);
await writeFile(indexPath, index);

console.log("Applied U3.1 camera and HUD runtime integration");
