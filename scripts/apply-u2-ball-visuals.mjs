import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  "  const gameFeel = createGameFeelController();",
  '  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;\n  const gameFeel = createGameFeelController({ lowPowerDevice, reducedMotion });',
  "controller device options",
);

replaceOnce(
  "  function spawnParticle(x, y, color, energy = 1) {\n    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;\n    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });\n  }",
  "  function spawnParticle(x, y, color, energy = 1) {\n    if (game.particles.length >= gameFeel.particleBudget()) return;\n    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;\n    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });\n  }",
  "particle budget",
);

replaceOnce(
  "    ball.trail.unshift({ x: ball.x, y: ball.y, height:ball.height }); if (ball.trail.length > 8) ball.trail.pop();",
  "    const visualSpeed=Math.hypot(ball.vx,ball.vy);const trailLimit=gameFeel.trailPointCount(visualSpeed);ball.trail.unshift({ x: ball.x, y: ball.y, height:ball.height }); while(ball.trail.length>trailLimit)ball.trail.pop();",
  "dynamic trail length",
);

replaceOnce(
  '    for (let i = ball.trail.length - 1; i >= 0; i -= 1) { const point = ball.trail[i]; ctx.globalAlpha = (1 - i / ball.trail.length) * .08; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(point.x, point.y, ball.radius * (1 - i / 12), 0, Math.PI * 2); ctx.fill(); }\n    ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.beginPath(); ctx.ellipse(ball.x + 5, ball.y + 9, 12, 5, 0, 0, Math.PI * 2); ctx.fill();',
  '    const visualSpeed=Math.hypot(ball.vx,ball.vy);for(let i=ball.trail.length-1;i>=0;i-=1){const point=ball.trail[i];ctx.globalAlpha=gameFeel.trailOpacity(i,ball.trail.length,visualSpeed);ctx.fillStyle="white";ctx.beginPath();ctx.arc(point.x,point.y,Math.max(1.5,ball.radius*(1-i/(ball.trail.length+4))),0,Math.PI*2);ctx.fill();}\n    const shadow=gameFeel.ballShadow(ball.height||0);ctx.globalAlpha=shadow.opacity;ctx.fillStyle="black";ctx.beginPath();ctx.ellipse(ball.x+5,ball.y+9,12*shadow.scale,5*shadow.scale,0,0,Math.PI*2);ctx.fill();',
  "2D trail and shadow",
);

replaceOnce(
  "    const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(300,game.particles.length);",
  "    const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(gameFeel.particleBudget(),game.particles.length);",
  "3D particle budget",
);

await writeFile(path, source);
console.log("Applied U2 ball visuals and particle budgets to game.js");
