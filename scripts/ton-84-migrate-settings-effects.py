from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once('import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";\n', '', 'contextual particle import')
replace_once('  const contextualParticles = createContextualParticlePolicy({ lowPowerDevice, reducedMotion });\n', '', 'contextual particle owner')
replace_once(
    '  const cameraReplayBridge = window.__TONY_CAMERA_REPLAY_BRIDGE__;\n  if (!cameraReplayBridge) throw new Error("Snapshot camera/replay bridge is unavailable");',
    '  const cameraReplayBridge = window.__TONY_CAMERA_REPLAY_BRIDGE__;\n  if (!cameraReplayBridge) throw new Error("Snapshot camera/replay bridge is unavailable");\n  const settingsEffectsBridge = window.__TONY_SETTINGS_EFFECTS_BRIDGE__;\n  if (!settingsEffectsBridge) throw new Error("Browser settings/effects bridge is unavailable");',
    'settings/effects bridge binding',
)
replace_once('    shake: 0, flash: 0, messageTimer: 0, kickOffTimer: 0, particles: [], lastTime: performance.now(), sound: true,', '    shake: 0, flash: 0, messageTimer: 0, kickOffTimer: 0, lastTime: performance.now(), sound: true,', 'particle state removal')
replace_once('    game.particles.length = 0; game.flash = 0; game.goalSequence = null; game.goalScorer = null;', '    settingsEffectsBridge.effects.reset(); game.flash = 0; game.goalSequence = null; game.goalScorer = null;', 'effect reset ownership')
replace_once(
    '    const visualSpeed=Math.hypot(ball.vx,ball.vy);const trailLimit=gameFeel.trailPointCount(visualSpeed);ball.trail.unshift({ x: ball.x, y: ball.y, height:ball.height }); while(ball.trail.length>trailLimit)ball.trail.pop();',
    '    const visualSpeed=Math.hypot(ball.vx,ball.vy);ball.trail=settingsEffectsBridge.effects.recordTrail({ x: ball.x, y: ball.y, height:ball.height },{speed:visualSpeed});',
    'trail history ownership',
)
replace_once(
    '''  function spawnParticle(x, y, color, energy = 1) {
    if (game.particles.length >= gameFeel.particleBudget()) return;
    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });
  }

  function spawnContextParticles(x,y,energy=1){
    const burst=contextualParticles.burst({energy,weather:game.weather,pitchStyle:game.pitchStyle});
    for(let i=0;i<burst.count;i+=1)spawnParticle(x,y,burst.colors[i%burst.colors.length],burst.energy);
  }

  function updateParticles(dt) {
    for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 90 * dt; particle.vx *= Math.pow(.4, dt); particle.life -= dt; }
    game.particles = game.particles.filter((particle) => particle.life > 0);
  }
''',
    '',
    'legacy particle owner functions',
)
replace_once('    updateInput(); updateParticles(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);', '    updateInput(); settingsEffectsBridge.effects.update(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);', 'presentation effect update')
replace_once('    updateInput(); updateParticles(dt); updateLegacyReplay(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);', '    updateInput(); settingsEffectsBridge.effects.update(dt); updateLegacyReplay(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);', 'legacy effect update')
replace_once('ballTrailView=createBallTrail3D(THREE,{maxPoints:gameFeel.config.ball.trailMaxPoints})', 'ballTrailView=createBallTrail3D(THREE,{maxPoints:settingsEffectsBridge.effects.diagnostics().trailCapacity})', 'trail view capacity')
replace_once(
    '''  function updateParticleView() {
    const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(gameFeel.particleBudget(),game.particles.length);
    for(let i=0;i<count;i+=1){const p=game.particles[i];const j=i*3;positions[j]=worldX(p.x);positions[j+1]=.35+Math.max(0,(p.max-p.life))*1.8;positions[j+2]=worldZ(p.y);const color=new THREE.Color(p.color);colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}
    particleView.geometry.setDrawRange(0,count);particleView.geometry.attributes.position.needsUpdate=true;particleView.geometry.attributes.color.needsUpdate=true;
  }''',
    '''  function updateParticleView(effectProjection) {
    const particles=effectProjection.particles;const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(settingsEffectsBridge.effects.diagnostics().budget,particles.length);
    for(let i=0;i<count;i+=1){const p=particles[i];const j=i*3;positions[j]=worldX(p.x);positions[j+1]=.35+Math.max(0,(p.max-p.life))*1.8;positions[j+2]=worldZ(p.y);const color=new THREE.Color(p.color);colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}
    particleView.geometry.setDrawRange(0,count);particleView.geometry.attributes.position.needsUpdate=true;particleView.geometry.attributes.color.needsUpdate=true;
  }''',
    'particle view consumer',
)
replace_once(
    'ballTrailView?.update(renderTrail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index,count,speed)=>gameFeel.trailOpacity(index,count,speed)}); updateParticleView(); updateAtmosphere3D(now);',
    'const projectedTrail=settingsEffectsBridge.effects.projectTrail(renderTrail,{speed:visualSpeed});ballTrailView?.update(projectedTrail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index)=>projectedTrail[index]?.opacity??0}); updateParticleView(settingsEffectsBridge.effects.snapshot()); updateAtmosphere3D(now);',
    'webgl effects projection',
)
replace_once(
    'const selectedPose=renderState.players.find((player)=>player.id===snapshot.match.selectedPlayerId);if(input.actionStart&&selectedPose&&snapshot.ball.ownerId===snapshot.match.selectedPlayerId){chargeView.visible=true;chargeView.position.set(worldX(selectedPose.x),7.5,worldZ(selectedPose.y));chargeView.quaternion.copy(camera3D.quaternion);const fill=chargeView.userData.fill;fill.scale.x=Math.max(.02,input.actionCharge);fill.position.x=-2.4+2.4*input.actionCharge;fill.material.color.set(input.actionCharge>.82?0xff5b45:0xffcf58);}else chargeView.visible=false;',
    'const selectedPose=renderState.players.find((player)=>player.id===snapshot.match.selectedPlayerId);const charge=settingsEffectsBridge.effects.projectCharge({active:Boolean(input.actionStart&&selectedPose&&snapshot.ball.ownerId===snapshot.match.selectedPlayerId),power:input.actionCharge,player:selectedPose});if(charge.active){chargeView.visible=true;chargeView.position.set(worldX(charge.player.x),7.5,worldZ(charge.player.y));chargeView.quaternion.copy(camera3D.quaternion);const fill=chargeView.userData.fill;fill.scale.x=Math.max(.02,charge.power);fill.position.x=-2.4+2.4*charge.power;fill.material.color.set(charge.color);}else chargeView.visible=false;',
    'webgl charge projection',
)
for label in ['canvas3d particle consumer', 'canvas2d particle consumer']:
    replace_once('for(const particle of game.particles){ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;ctx.fillRect(particle.x,particle.y,particle.size,particle.size);}', 'for(const particle of settingsEffectsBridge.effects.snapshot().particles){ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;ctx.fillRect(particle.x,particle.y,particle.size,particle.size);}', label)
replace_once(
    'const visualSpeed=Math.hypot(ball.vx,ball.vy);for(let i=ball.trail.length-1;i>=0;i-=1){const point=ball.trail[i];ctx.globalAlpha=gameFeel.trailOpacity(i,ball.trail.length,visualSpeed);ctx.fillStyle="white";ctx.beginPath();ctx.arc(point.x,point.y,Math.max(1.5,ball.radius*(1-i/(ball.trail.length+4))),0,Math.PI*2);ctx.fill();}',
    'const visualSpeed=Math.hypot(ball.vx,ball.vy);const projectedTrail=settingsEffectsBridge.effects.projectTrail(ball.trail,{speed:visualSpeed});for(let i=projectedTrail.length-1;i>=0;i-=1){const point=projectedTrail[i];ctx.globalAlpha=point.opacity;ctx.fillStyle="white";ctx.beginPath();ctx.arc(point.x,point.y,Math.max(1.5,ball.radius*(1-i/(projectedTrail.length+4))),0,Math.PI*2);ctx.fill();}',
    'canvas trail projection',
)
replace_once(
    'if(input.actionStart&&selectedPose&&snapshot.ball.ownerId===snapshot.match.selectedPlayerId){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(selectedPose.x-31,selectedPose.y-50,62,8);ctx.fillStyle=input.actionCharge>.82?"#ff5b45":"#ffcf58";ctx.fillRect(selectedPose.x-30,selectedPose.y-49,60*input.actionCharge,6);}',
    'const charge=settingsEffectsBridge.effects.projectCharge({active:Boolean(input.actionStart&&selectedPose&&snapshot.ball.ownerId===snapshot.match.selectedPlayerId),power:input.actionCharge,player:selectedPose});if(charge.active){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(charge.player.x-31,charge.player.y-50,62,8);ctx.fillStyle=charge.color;ctx.fillRect(charge.player.x-30,charge.player.y-49,60*charge.power,6);}',
    'canvas charge projection',
)
replace_once('game.weather=game.weather==="rain"?"clear":"rain";', 'settingsEffectsBridge.settings.set("weather",game.weather==="rain"?"clear":"rain");', 'weather command')
replace_once(';tone(game.weather==="rain"?330:560,.06,"sine",.02);', ';', 'weather preview tone removal')
replace_once(
    '''      onParticles: ({ x, y, particleCount = 0, particleColor = "#f4f7f5", particleEnergy = 1 }) => {
        for (let index = 0; index < particleCount; index += 1) spawnParticle(x, y, particleColor, particleEnergy);
      },
      onContextParticles: ({ x, y, contextX = x, contextY = y, contextEnergy = 1 }) => {
        spawnContextParticles(contextX, contextY, contextEnergy);
      }''',
    '''      onParticles: (facts) => settingsEffectsBridge.effects.emitParticles(facts),
      onContextParticles: (facts) => settingsEffectsBridge.effects.emitContextParticles({ ...facts, weather: game.weather, pitchStyle: game.pitchStyle })''',
    'feedback effects callbacks',
)
replace_once(
    '''  document.querySelectorAll("[data-pitch]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-pitch]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.pitchStyle=button.dataset.pitch;savePreference("tfPitch",game.pitchStyle);applyPitchStyle();tone(520,.04,"sine",.018);}));
  document.querySelectorAll("[data-ball]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-ball]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.ballStyle=button.dataset.ball;savePreference("tfBall",game.ballStyle);applyBallStyle();tone(680,.04,"sine",.018);}));
  document.querySelectorAll("[data-weather]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-weather]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.weather=button.dataset.weather;savePreference("tfWeather",game.weather);applyPitchStyle();tone(game.weather==="rain"?330:560,.05,"sine",.018);}));
  document.querySelectorAll("[data-pitch]").forEach((button)=>button.classList.toggle("active",button.dataset.pitch===game.pitchStyle));document.querySelectorAll("[data-ball]").forEach((button)=>button.classList.toggle("active",button.dataset.ball===game.ballStyle));document.querySelectorAll("[data-weather]").forEach((button)=>button.classList.toggle("active",button.dataset.weather===game.weather));
  $("soundButton").addEventListener("click", () => { game.sound=!game.sound;$("soundButton").classList.toggle("muted",!game.sound);$("soundButton").setAttribute("aria-label",game.sound?"Tắt âm thanh":"Bật âm thanh");if(game.sound)tone(600,.08); });''',
    '''  settingsEffectsBridge.settings.configure({
    values: { pitch: game.pitchStyle, ball: game.ballStyle, weather: game.weather, sound: game.sound },
    allowed: { pitch: Object.keys(PITCH_STYLES), ball: Object.keys(BALL_STYLES), weather: Object.keys(WEATHER_STYLES) },
    apply: {
      pitch: ({ value }) => { game.pitchStyle=value; applyPitchStyle(); },
      ball: ({ value }) => { game.ballStyle=value; applyBallStyle(); },
      weather: ({ value }) => { game.weather=value; applyPitchStyle(); },
      sound: ({ value }) => { game.sound=value; },
    },
  });''',
    'settings listeners and preview ownership',
)
replace_once('      cameraReplay: cameraReplayBridge.diagnostics(),\n', '      cameraReplay: cameraReplayBridge.diagnostics(),\n      settingsEffects: settingsEffectsBridge.diagnostics(),\n', 'settings/effects diagnostics')

forbidden_tokens = [
    'createContextualParticlePolicy', 'contextualParticles', 'game.particles', 'spawnParticle(', 'spawnContextParticles(', 'updateParticles(',
    'savePreference("tfPitch"', 'savePreference("tfBall"', 'savePreference("tfWeather"',
    'document.querySelectorAll("[data-pitch]").forEach((button)=>button.addEventListener',
    'document.querySelectorAll("[data-ball]").forEach((button)=>button.addEventListener',
    'document.querySelectorAll("[data-weather]").forEach((button)=>button.addEventListener',
    '$("soundButton").addEventListener', 'gameFeel.trailOpacity(', 'gameFeel.trailPointCount(',
]
remaining = []
for line_number, line in enumerate(text.splitlines(), start=1):
    for token in forbidden_tokens:
        if token in line:
            remaining.append(f"{token}@{line_number}: {line.strip()[:220]}")
if remaining:
    raise RuntimeError("forbidden settings/effects ownership remains:\n" + "\n".join(remaining))
if 'window.__TONY_SETTINGS_EFFECTS_BRIDGE__' not in text or 'settingsEffectsBridge.settings.configure' not in text:
    raise RuntimeError("settings/effects bridge or preference commands are missing")

path.write_text(text, encoding="utf-8")
