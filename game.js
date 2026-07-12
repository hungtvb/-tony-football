import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

(() => {
  const canvas = document.querySelector("#gameCanvas");
  const radar = document.querySelector("#radarCanvas");
  const rctx = radar.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const FIELD = { left: 48, right: 1152, top: 42, bottom: 658, goalTop: 265, goalBottom: 435 };
  const MATCH_SECONDS = 150;
  const HOME = 0;
  const AWAY = 1;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const length = (x, y) => Math.hypot(x, y) || 1;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const normalize = (x, y) => { const l = length(x, y); return { x: x / l, y: y / l }; };
  const WORLD_SCALE = .1;
  const playerViews = new Map();
  let renderer3D; let composer3D; let scene3D; let camera3D; let ballView; let particleView; let chargeView; let screenFx; let ctx; let use3D = true; let crowdView; let pitchView; let grassView; let rainView;
  let playerAsset = null;
  const ledViews = []; const goalNetViews = [];
  const lowPowerDevice = matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const cameraTarget = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  const wetPitchColor = new THREE.Color(0xb7d8c8); const dryPitchColor = new THREE.Color(0xffffff);

  function seededNoise(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }


  const ui = {
    homeScore: $("homeScore"), awayScore: $("awayScore"), gameClock: $("gameClock"), matchState: $("matchState"),
    start: $("startOverlay"), pause: $("pauseOverlay"), result: $("resultOverlay"), commentary: $("commentary"),
    staminaBar: $("staminaBar"), staminaText: $("staminaText"), playerName: $("playerName"),
    playerNumber: $("playerNumber"), playerRating: $("playerRating"), possessionStat: $("possessionStat"),
    possessionBar: $("possessionBar"), homeShots: $("homeShots"), awayShots: $("awayShots"), passStat: $("passStat"),
    replayBadge: $("replayBadge")
  };

  const formations = {
    home: [
      [90, 350, "GK", "KAI", 1, 86], [270, 205, "DF", "MINH", 4, 87], [270, 495, "DF", "NAM", 5, 86],
      [500, 350, "MF", "HÙNG", 8, 90], [690, 205, "FW", "TONY", 10, 92], [690, 495, "FW", "PHÚC", 11, 89]
    ],
    away: [
      [1110, 350, "GK", "NOVA", 1, 87], [930, 205, "DF", "VEX", 3, 88], [930, 495, "DF", "ZERO", 5, 87],
      [700, 350, "MF", "ECHO", 8, 91], [520, 205, "FW", "BLAZE", 9, 92], [520, 495, "FW", "RUSH", 11, 90]
    ]
  };

  class Player {
    constructor(team, spec, index) {
      [this.baseX, this.baseY, this.role, this.name, this.number, this.rating] = spec;
      this.team = team; this.index = index; this.x = this.baseX; this.y = this.baseY;
      this.vx = 0; this.vy = 0; this.dirX = team === HOME ? 1 : -1; this.dirY = 0;
      this.radius = this.role === "GK" ? 20 : 17; this.stamina = 100; this.cooldown = 0;
      this.anim = "idle"; this.animTime = 0; this.animDuration = 1; this.animPower = 0; this.stepPhase = index * 1.7;
      this.sprinting = false; this.diveCooldown = 0; this.controlBoost = 0; this.motionYaw = Math.atan2(this.dirX, this.dirY);
      this.turnLean = 0; this.strideBlend = 0; this.dribbleSide = index % 2 ? 1 : -1;
    }
  }

  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, height: 0, vz: 0, curve: 0, radius: 9, owner: null, lastTouch: null, lock: 0, trail: [], pendingPass: null, angle: 0, spin: 0 };
  const game = {
    state: "menu", difficulty: "pro", ai: 1, time: MATCH_SECONDS, score: [0, 0], selected: null,
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    shake: 0, flash: 0, messageTimer: 0, kickOffTimer: 0, particles: [], lastTime: performance.now(), sound: true,
    camera: { x: W / 2, y: H / 2, zoom: 1, targetZoom: 1 }, cameraMode: "broadcast", cameraNotice: 0,
    replay: { buffer: [], frames: [], active: false, elapsed: 0, duration: 3.05, accumulator: 0 },
    goalSequence: null, goalScorer: null, weather: "rain"
  };
  let players = [];
  const input = { keys: new Set(), moveX: 0, moveY: 0, magnitude: 0, aimX: 1, aimY: 0, shootStart: 0, shootCharge: 0, marking: false };

  function createTeams() {
    for (const view of playerViews.values()) scene3D?.remove(view.root);
    playerViews.clear();
    players = [
      ...formations.home.map((spec, index) => new Player(HOME, spec, index)),
      ...formations.away.map((spec, index) => new Player(AWAY, spec, index))
    ];
    if (scene3D) players.forEach(createPlayerView);
    game.selected = players[4];
  }

  function resetMatch() {
    createTeams();
    game.time = MATCH_SECONDS; game.score = [0, 0]; game.stats = { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 };
    game.particles.length = 0; game.flash = 0; game.goalSequence = null; game.goalScorer = null;
    game.replay.buffer.length = 0; game.replay.frames.length = 0; game.replay.active = false; game.replay.elapsed = 0; game.replay.accumulator = 0;
    ui.replayBadge.classList.remove("show"); kickoff(HOME); updateUI();
  }

  function kickoff(team) {
    players.forEach((player) => {
      player.x = player.baseX; player.y = player.baseY; player.vx = player.vy = 0; player.stamina = Math.max(55, player.stamina);
      player.anim = "idle"; player.animTime = 0; player.sprinting = false; player.diveCooldown = 0; player.controlBoost = 0;
      player.motionYaw=Math.atan2(player.dirX,player.dirY);player.turnLean=0;player.strideBlend=0;
    });
    const taker = team === HOME ? players[4] : players[10];
    taker.x = W / 2 + (team === HOME ? -26 : 26); taker.y = H / 2;
    ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.height=0;ball.vz=0;ball.curve=0;ball.owner = null; ball.lastTouch = null; ball.lock = .8; ball.pendingPass = null; ball.angle = 0; ball.spin = 0;
    game.selected = team === HOME ? taker : closestPlayer(HOME, ball, false);
    game.kickOffTimer = 1.25; announce(team === HOME ? "Tony FC giao bóng!" : "Neon United giao bóng!");
  }

  function startMatch() {
    resetMatch(); game.state = "playing"; ui.start.classList.remove("show"); ui.pause.classList.remove("show"); ui.result.classList.remove("show");
    ui.matchState.textContent = "LIVE"; whistle();
  }

  function togglePause(force) {
    if (game.state !== "playing" && game.state !== "paused") return;
    const pause = typeof force === "boolean" ? force : game.state === "playing";
    game.state = pause ? "paused" : "playing"; ui.pause.classList.toggle("show", pause); ui.matchState.textContent = pause ? "TẠM DỪNG" : "LIVE";
  }

  function endMatch() {
    game.state = "ended"; ui.result.classList.add("show"); ui.matchState.textContent = "FULL TIME"; whistle(true);
    $("finalHome").textContent = game.score[HOME]; $("finalAway").textContent = game.score[AWAY];
    const diff = game.score[HOME] - game.score[AWAY];
    $("resultTitle").textContent = diff > 0 ? "CHIẾN THẮNG!" : diff < 0 ? "CHƯA ĐỦ!" : "HÒA KỊCH TÍNH";
    $("resultDetail").textContent = diff > 0 ? "Tony FC đã làm chủ sân đấu." : diff < 0 ? "Chỉ còn một chút nữa. Đá lại nào!" : "Hai đội bất phân thắng bại.";
  }

  function closestPlayer(team, target, includeKeeper = true) {
    let best = null; let bestDistance = Infinity;
    for (const player of players) {
      if (player.team !== team || (!includeKeeper && player.role === "GK")) continue;
      const d = distance(player, target);
      if (d < bestDistance) { best = player; bestDistance = d; }
    }
    return best;
  }

  function isAttacking() { return ball.owner?.team === HOME; }

  function switchPlayer() {
    if (ball.owner?.team === HOME) { game.selected = ball.owner; return; }
    const target=ball.owner?.team===AWAY?ball.owner:{x:ball.x+ball.vx*.2,y:ball.y+ball.vy*.2};
    const candidates=players.filter((player)=>player.team===HOME&&player.role!=="GK"&&player!==game.selected).map((player)=>{const toTarget=normalize(target.x-player.x,target.y-player.y);const intent=input.magnitude>.12?toTarget.x*input.aimX+toTarget.y*input.aimY:0;const rolePenalty=player.role==="FW"&&target.x<W*.52?35:0;return{player,score:distance(player,target)-intent*55+rolePenalty};}).sort((a,b)=>a.score-b.score);
    game.selected=candidates[0]?.player||closestPlayer(HOME,target,false);
    tone(520, .035, "sine", .025);
  }

  function setOwner(player) {
    if (ball.pendingPass && player.team === ball.pendingPass.team) {
      if (player.team === HOME) game.stats.completed += 1;
      ball.pendingPass = null;
    } else if (ball.pendingPass && player.team !== ball.pendingPass.team) ball.pendingPass = null;
    ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;ball.height=0;ball.vz=0;ball.curve=0;player.controlBoost=.28;
    triggerAnimation(player, "receive", .2);
    if (player.team === HOME && player.role !== "GK") game.selected = player;
  }

  function triggerAnimation(player, name, duration, power = 0) {
    player.anim = name; player.animTime = duration; player.animDuration = duration; player.animPower = power;
  }

  function releaseBall(player, dx, dy, speed, type) {
    const n = normalize(dx, dy); ball.owner = null; ball.lastTouch = player; ball.lock = type === "shot" ? .13 : type === "loft" ? .3 : .2;
    ball.x = player.x + n.x * (player.radius + 10); ball.y = player.y + n.y * (player.radius + 10);
    ball.vx = n.x * speed + player.vx * .25; ball.vy = n.y * speed + player.vy * .25;
    ball.height=0;ball.vz=type==="loft"?10.8:type==="shot"?1.8:0;ball.curve=type==="shot"?clamp(n.y*1.45,-1.05,1.05):0;ball.spin = (player.team === HOME ? 1 : -1) * speed * .012;
    player.cooldown = .18; kickSound(type === "shot" ? .9 : .55);
    triggerAnimation(player, type === "shot" ? "shoot" : "pass", type === "shot" ? .34 : type === "loft" ? .3 : .24, clamp((speed - 400) / 650, 0, 1));
    for (let i = 0; i < (type === "shot" ? 9 : 4); i += 1) spawnParticle(ball.x, ball.y, type === "shot" ? "#f5d067" : "#f4f7f5", 1.2);
  }

  function passBall(player) {
    if (ball.owner !== player) { tackle(player); return; }
    const teammates = players.filter((p) => p.team === player.team && p !== player && p.role !== "GK");
    const hasIntent=player===game.selected&&input.magnitude>.12;const facing=hasIntent?normalize(input.aimX,input.aimY):normalize(player.dirX||(player.team===HOME?1:-1),player.dirY);
    let target = teammates[0]; let best = -Infinity;
    for (const candidate of teammates) {
      const dx = candidate.x - player.x; const dy = candidate.y - player.y; const d = length(dx, dy);
      const forward = (dx / d) * facing.x + (dy / d) * facing.y;
      const attack = player.team === HOME ? dx : -dx;
      const lane=Math.abs((candidate.y-player.y)/d);const risk=passingLaneRisk(player,candidate,player.team);const score=forward*360+attack*.18-d*.2-lane*18-risk*170;
      if (score > best) { target = candidate; best = score; }
    }
    const leadX = target.x + target.vx * .18; const leadY = target.y + target.vy * .18;
    const d = distance(player, target); releaseBall(player, leadX - player.x, leadY - player.y, clamp(430 + d * .35, 480, 650), "pass");
    if (player.team === HOME) game.stats.passes += 1;
    ball.pendingPass = { team: player.team, timer: 1.8 }; announce(`${player.name} chuyền bóng!`);
  }

  function throughBall(player) {
    if (ball.owner !== player) return;
    const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const aligned=dx/d*facing.x+dy/d*facing.y;const progress=dx*attackDirection;const score=aligned*310+progress*.42-d*.12;if(score>best){best=score;target=candidate;}}
    if(!target)return;const runX=target.vx*.58+attackDirection*58;const runY=target.vy*.58;const d=distance(player,target);releaseBall(player,target.x+runX-player.x,target.y+runY-player.y,clamp(540+d*.42,580,760),"pass");
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.1};announce(`${player.name} chọc khe vào khoảng trống!`);
  }

  function loftBall(player) {
    if(ball.owner!==player)return;const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const wide=Math.abs(dy);const aligned=dx/d*facing.x+dy/d*facing.y;const score=aligned*240+dx*attackDirection*.25+wide*.12-d*.08;if(score>best){best=score;target=candidate;}}
    if(!target)return;releaseBall(player,target.x+target.vx*.32-player.x,target.y+target.vy*.32-player.y,clamp(610+distance(player,target)*.3,650,820),"loft");
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.2};announce(`${player.name} tạt bóng!`);
  }

  function shootBall(player, charge = .5) {
    if (ball.owner !== player) { tackle(player); return; }
    const targetX = player.team === HOME ? FIELD.right + 45 : FIELD.left - 45;
    const keeper = players.find((p) => p.team !== player.team && p.role === "GK");
    const openY = keeper.y < H / 2 ? FIELD.goalBottom - 34 : FIELD.goalTop + 34;
    const userAim=player===game.selected&&player.team===HOME&&input.magnitude>.12;const directedY=userAim?H/2+input.aimY*145:player.y+player.dirY*120;
    const aimY = clamp(lerp(openY,directedY,userAim ? .62 : .28)+(Math.random()-.5)*(userAim?16:34/game.ai),FIELD.goalTop+22,FIELD.goalBottom-22);
    const power = clamp(charge, .15, 1); releaseBall(player, targetX - player.x, aimY - player.y, 620 + power * 430, "shot");
    game.stats.shots[player.team] += 1; announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);
  }

  function tackle(player) {
    if (player.cooldown > 0) return;
    const opponent = ball.owner && ball.owner.team !== player.team ? ball.owner : closestPlayer(player.team === HOME ? AWAY : HOME, player);
    if (!opponent || distance(player, opponent) > 48) return;
    player.cooldown = .7; triggerAnimation(player, "tackle", .38); const chance = .48 + (player.rating - opponent.rating) * .012;
    for (let i = 0; i < 5; i += 1) spawnParticle(player.x + player.dirX * 14, player.y + player.dirY * 14, i % 2 ? "#b7cf75" : "#5d8a49", .5);
    if (ball.owner === opponent && Math.random() < chance) {
      ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;
      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; announce(`${player.name} đoạt bóng!`); kickSound(.3);
    }
  }

  function slideTackle(player) {
    if(player.cooldown>0)return;const previous=player.cooldown;tackle(player);if(player.cooldown===previous)return;
    player.cooldown=1.05;player.vx+=player.dirX*105;player.vy+=player.dirY*105;triggerAnimation(player,"tackle",.52,1);announce(`${player.name} soạc bóng!`);
  }

  function updateInput() {
    let x = 0; let y = 0;
    if (input.keys.has("ArrowLeft")) x -= 1;
    if (input.keys.has("ArrowRight")) x += 1;
    if (input.keys.has("ArrowUp")) y -= 1;
    if (input.keys.has("ArrowDown")) y += 1;
    const raw=Math.hypot(x,y);
    if(raw<.1){input.moveX=0;input.moveY=0;input.magnitude=0;}else{const direction=normalize(x,y);input.moveX=direction.x;input.moveY=direction.y;input.magnitude=1;input.aimX=direction.x;input.aimY=direction.y;}
    if (input.shootStart) input.shootCharge = clamp((performance.now() - input.shootStart) / 900, 0, 1);
  }

  function moveToward(player, tx, ty, speed, dt) {
    const dx = tx - player.x; const dy = ty - player.y; const n = normalize(dx, dy);
    const wantedX = n.x * speed; const wantedY = n.y * speed; const response = 1 - Math.exp(-dt * 8);
    player.vx = lerp(player.vx, wantedX, response); player.vy = lerp(player.vy, wantedY, response);
    if (Math.hypot(dx, dy) < 8) { player.vx *= .7; player.vy *= .7; }
    if (Math.abs(player.vx) + Math.abs(player.vy) > 4) { const dir = normalize(player.vx, player.vy); player.dirX = dir.x; player.dirY = dir.y; }
  }

  function passingLaneRisk(from,to,team) {
    const dx=to.x-from.x;const dy=to.y-from.y;const lengthSq=dx*dx+dy*dy||1;let risk=0;
    for(const defender of players){if(defender.team===team)continue;const t=clamp(((defender.x-from.x)*dx+(defender.y-from.y)*dy)/lengthSq,0,1);const laneX=from.x+dx*t;const laneY=from.y+dy*t;const gap=Math.hypot(defender.x-laneX,defender.y-laneY);if(gap<58)risk=Math.max(risk,(58-gap)/58*(.45+t*.55));}
    return risk;
  }

  function projectedGoalY(team) {
    const goalX=team===HOME?FIELD.left:FIELD.right;const towardGoal=team===HOME?ball.vx<0:ball.vx>0;if(!towardGoal||Math.abs(ball.vx)<30)return ball.y;const time=clamp((goalX-ball.x)/ball.vx,0,1.4);return ball.y+ball.vy*time+ball.curve*Math.hypot(ball.vx,ball.vy)*time*time*.08;
  }

  function updateUser(player, dt) {
    const attacking=isAttacking();const sprinting=input.keys.has("KeyE");
    const precision=false;const marking=!attacking&&input.keys.has("KeyS");let controlX=input.aimX;let controlY=input.aimY;let controlMagnitude=input.magnitude;let markTarget=null;
    if(marking){markTarget=ball.owner?.team===AWAY?ball.owner:closestPlayer(AWAY,ball,false);if(markTarget){const dx=markTarget.x-player.x;const dy=markTarget.y-player.y;const d=Math.hypot(dx,dy);const toward=normalize(dx,dy);if(d>46){const mixed=normalize(toward.x+input.moveX*.65,toward.y+input.moveY*.65);controlX=mixed.x;controlY=mixed.y;controlMagnitude=clamp(.58+(d-46)/150,0,1);}else if(input.magnitude>.08){controlX=input.aimX;controlY=input.aimY;controlMagnitude=input.magnitude*.62;}else controlMagnitude=0;}}
    const hasMove=controlMagnitude>.03;
    const boost = sprinting && !precision && player.stamina > 2 ? 1.42 : 1;
    player.sprinting = sprinting && !precision && player.stamina > 2 && hasMove;
    player.controlBoost=Math.max(0,player.controlBoost-dt);const speed=(marking?158:precision?132:205)*boost*controlMagnitude;
    if (hasMove) {
      const current=normalize(player.vx||controlX,player.vy||controlY);const turnDot=current.x*controlX+current.y*controlY;const response=(marking?14:precision?18:player.controlBoost>0?16:turnDot<-.15?8:12);const turnGrip=clamp(.72+(turnDot+1)*.14,.72,1);player.vx=lerp(player.vx,controlX*speed*turnGrip,1-Math.exp(-dt*response));player.vy=lerp(player.vy,controlY*speed*turnGrip,1-Math.exp(-dt*response));
      const face=marking&&markTarget?normalize(markTarget.x-player.x,markTarget.y-player.y):{x:controlX,y:controlY};player.dirX=lerp(player.dirX,face.x,1-Math.exp(-dt*18));player.dirY=lerp(player.dirY,face.y,1-Math.exp(-dt*18));const facing=normalize(player.dirX,player.dirY);player.dirX=facing.x;player.dirY=facing.y;
      player.stamina=clamp(player.stamina-dt*(player.sprinting?11*input.magnitude:precision ? .35 : 1.1),0,100);
    } else { player.vx*=Math.pow(.0018,dt);player.vy*=Math.pow(.0018,dt);player.stamina=clamp(player.stamina+dt*(precision?6.2:5),0,100); }
  }

  function updateAI(player, dt) {
    const team = player.team; const attackDirection = team === HOME ? 1 : -1; const ownGoalX = team === HOME ? FIELD.left : FIELD.right;
    const hasBall = ball.owner === player;
    const teamChaser = closestPlayer(team, ball, player.role === "GK");
    const aiSpeed = 168 * (team === AWAY ? game.ai : .96);

    if (player.role === "GK") {
      const gx=team===HOME?82:1118;const danger=team===HOME?ball.x<330:ball.x>870;const projectedY=clamp(projectedGoalY(team),FIELD.goalTop+18,FIELD.goalBottom-18);const shotIncoming=!ball.owner&&(team===HOME?ball.vx<0:ball.vx>0)&&Math.hypot(ball.vx,ball.vy)>360;
      if(shotIncoming&&danger&&Math.abs(projectedY-player.y)>24&&Math.abs(projectedY-player.y)<155&&player.diveCooldown<=0&&ball.height<3.1){
        triggerAnimation(player,"dive",.5,Math.sign(projectedY-player.y));player.diveCooldown=1.05;
      }
      const stepX=shotIncoming?(team===HOME?104:1096):gx;const targetY=shotIncoming?projectedY:clamp(ball.y,FIELD.goalTop+25,FIELD.goalBottom-25);moveToward(player,danger?stepX:gx,targetY,aiSpeed*(shotIncoming?1.04:.78),dt);
      if (hasBall && player.cooldown <= 0) {
        const target = players.find((p) => p.team === team && p.role === "DF");
        releaseBall(player, target.x - player.x, target.y - player.y, 520, "pass"); player.cooldown = 1;
      }
      return;
    }

    if (hasBall) {
      const goalX = team === HOME ? FIELD.right : FIELD.left;
      const distGoal = Math.abs(goalX - player.x);
      if (distGoal < 300 && Math.abs(player.y - H / 2) < 210 && player.cooldown <= 0 && Math.random() < dt * 2.2 * game.ai) {
        shootBall(player, .58 + Math.random() * .38); return;
      }
      const pressure = players.some((p) => p.team !== team && distance(p, player) < 85);
      if(pressure&&Math.random()<dt*.85*game.ai){const runners=players.filter((p)=>p.team===team&&p!==player&&p.role!=="GK").sort((a,b)=>passingLaneRisk(player,a,team)-passingLaneRisk(player,b,team));if(runners[0]&&passingLaneRisk(player,runners[0],team)<.48&&Math.random()<.42)throughBall(player);else passBall(player);return;}
      const weave = Math.sin(performance.now() * .0017 + player.index) * 105;
      moveToward(player, goalX, clamp(H / 2 + weave, 130, H - 130), aiSpeed * 1.03, dt); return;
    }

    const shouldChase = teamChaser === player && (!ball.owner || ball.owner.team !== team);
    if (shouldChase) { moveToward(player, ball.x, ball.y, aiSpeed * 1.08, dt); return; }

    let tx = player.baseX + (ball.x - W / 2) * .26; let ty = player.baseY + (ball.y - H / 2) * .2;
    if(ball.owner?.team===team){const owner=ball.owner;const laneSide=player.index%2?1:-1;tx+=attackDirection*(player.role==="FW"?145:player.role==="MF"?78:28);ty+=laneSide*(player.role==="FW"?42:24);if(player.role==="FW"&&Math.abs(player.y-owner.y)<54)ty+=laneSide*48;}
    if(ball.owner?.team!==team){tx=lerp(tx,ownGoalX,player.role==="DF"?.2:.07);if(player.role==="DF")ty=lerp(ty,H/2,.08);}
    moveToward(player, clamp(tx, FIELD.left + 45, FIELD.right - 45), clamp(ty, FIELD.top + 45, FIELD.bottom - 45), aiSpeed * .82, dt);
  }

  function keepPlayerInBounds(player) {
    const pad = player.radius + 5;
    player.x = clamp(player.x, FIELD.left + pad, FIELD.right - pad);
    player.y = clamp(player.y, FIELD.top + pad, FIELD.bottom - pad);
    if (player.role === "GK") {
      player.x = player.team === HOME ? clamp(player.x, FIELD.left + 15, 190) : clamp(player.x, 1010, FIELD.right - 15);
      player.y = clamp(player.y, FIELD.goalTop - 35, FIELD.goalBottom + 35);
    }
  }

  function resolvePlayerCollisions() {
    for (let i = 0; i < players.length; i += 1) for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i]; const b = players[j]; const dx = b.x - a.x; const dy = b.y - a.y; const d = length(dx, dy); const min = a.radius + b.radius + 3;
      if (d < min) { const push = (min - d) * .5; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
    }
  }

  function updateBall(dt) {
    ball.angle += ball.spin * dt; ball.spin *= Math.pow(.55, dt);ball.curve*=Math.pow(.3,dt);
    if (ball.lock > 0) ball.lock -= dt;
    if (ball.pendingPass) { ball.pendingPass.timer -= dt; if (ball.pendingPass.timer <= 0) ball.pendingPass = null; }
    if (ball.owner) {
      const owner=ball.owner;ball.height=0;ball.vz=0;const closeControl=owner===game.selected&&!owner.sprinting;const speed=Math.hypot(owner.vx,owner.vy);const touch=Math.sin(owner.stepPhase);if(Math.abs(touch)>.82)owner.dribbleSide=touch>0?1:-1;const lead=owner.radius+(closeControl?7:12)+clamp(speed/110,0,2.8)*Math.max(0,touch);const lateral=(speed>35?owner.dribbleSide:0)*(closeControl?2.3:3.8);const targetX=owner.x+owner.dirX*lead-owner.dirY*lateral;const targetY=owner.y+owner.dirY*lead+owner.dirX*lateral;const follow=1-Math.exp(-dt*(closeControl?28:20));ball.x=lerp(ball.x,targetX,follow);ball.y=lerp(ball.y,targetY,follow);ball.vx=owner.vx;ball.vy=owner.vy;
      ball.angle += Math.hypot(owner.vx, owner.vy) * dt * .035;
      game.stats.possession[owner.team] += dt;
    } else {
      const speed=Math.hypot(ball.vx,ball.vy);if(speed>20&&Math.abs(ball.curve)>.005){const turn=ball.curve*dt;const cos=Math.cos(turn),sin=Math.sin(turn);const vx=ball.vx;ball.vx=vx*cos-ball.vy*sin;ball.vy=vx*sin+ball.vy*cos;}ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.height+=ball.vz*dt;ball.vz-=22*dt;if(ball.height<0){ball.height=0;if(Math.abs(ball.vz)>3.5)ball.vz=-ball.vz*.34;else ball.vz=0;}const friction=Math.pow(game.weather==="rain"?.36:.22,dt);ball.vx*=friction;ball.vy*=friction;
      if (Math.hypot(ball.vx, ball.vy) < 4) ball.vx = ball.vy = 0;
      if (ball.lock <= 0) {
        let pickup=null;let best=Infinity;
        for (const player of players) {
          if (player.cooldown > 0 || player === ball.lastTouch && Math.hypot(ball.vx, ball.vy) > 550) continue;
          const catchRadius=player.role==="GK"?38:28;if(ball.height>(player.role==="GK"?2.8:1.05))continue;const d=distance(player,ball);if(d<catchRadius&&d<best){pickup=player;best=d;}
        }
        if (pickup) setOwner(pickup);
      }
    }

    ball.trail.unshift({ x: ball.x, y: ball.y, height:ball.height }); if (ball.trail.length > 8) ball.trail.pop();
    const inGoalMouth = ball.y > FIELD.goalTop && ball.y < FIELD.goalBottom;
    if(inGoalMouth&&ball.height<3.25&&ball.x>FIELD.right+20){goal(HOME);return;}
    if(inGoalMouth&&ball.height<3.25&&ball.x<FIELD.left-20){goal(AWAY);return;}
    if(inGoalMouth&&ball.height>=3.25&&ball.x>FIELD.right-ball.radius){ball.x=FIELD.right-ball.radius;ball.vx=-Math.abs(ball.vx)*.58;ball.vz*=.72;}
    if(inGoalMouth&&ball.height>=3.25&&ball.x<FIELD.left+ball.radius){ball.x=FIELD.left+ball.radius;ball.vx=Math.abs(ball.vx)*.58;ball.vz*=.72;}
    if (ball.y < FIELD.top + ball.radius) { ball.y = FIELD.top + ball.radius; ball.vy = Math.abs(ball.vy) * .74; }
    if (ball.y > FIELD.bottom - ball.radius) { ball.y = FIELD.bottom - ball.radius; ball.vy = -Math.abs(ball.vy) * .74; }
    if (!inGoalMouth && ball.x < FIELD.left + ball.radius) { ball.x = FIELD.left + ball.radius; ball.vx = Math.abs(ball.vx) * .74; }
    if (!inGoalMouth && ball.x > FIELD.right - ball.radius) { ball.x = FIELD.right - ball.radius; ball.vx = -Math.abs(ball.vx) * .74; }
  }

  function goal(team) {
    if (game.goalSequence) return;
    const scorer = ball.lastTouch?.team === team ? ball.lastTouch : closestPlayer(team, ball);
    game.score[team] += 1; game.flash = 1; game.shake = 18; ball.owner = null; game.goalScorer = scorer; goalSound();
    game.replay.frames = [...game.replay.buffer, captureReplayFrame()]; game.replay.active = game.replay.frames.length > 8; game.replay.elapsed = 0;
    game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: 3.65 };
    for (const player of players) if (player.team === team) triggerAnimation(player, "celebrate", 3.65, player === scorer ? 1 : .65);
    for (let i = 0; i < 80; i += 1) spawnParticle(team === HOME ? FIELD.right : FIELD.left, H / 2, team === HOME ? "#e1bb58" : "#47c9d4", 3.5);
    announce(team === HOME ? "GOOOOAL! TONY FC GHI BÀN!" : "Neon United ghi bàn!"); updateUI(team);
    ui.replayBadge.textContent = "● INSTANT REPLAY"; ui.replayBadge.classList.toggle("show", game.replay.active);
  }

  function captureReplayFrame() {
    return {
      ball: { x: ball.x, y: ball.y, height:ball.height, angle: ball.angle },
      players: players.map((player) => ({ x: player.x, y: player.y, vx: player.vx, vy: player.vy, dirX: player.dirX, dirY: player.dirY, stepPhase: player.stepPhase, anim: player.anim, animTime: player.animTime, animDuration: player.animDuration, animPower: player.animPower }))
    };
  }

  function recordReplay(dt) {
    game.replay.accumulator += dt;
    if (game.replay.accumulator < 1 / 15) return;
    game.replay.accumulator %= 1 / 15; game.replay.buffer.push(captureReplayFrame());
    if (game.replay.buffer.length > 66) game.replay.buffer.shift();
  }

  function updateReplay(dt) {
    if (!game.replay.active) return;
    game.replay.elapsed += dt;
    if (game.replay.elapsed >= game.replay.duration) {
      game.replay.active = false; ui.replayBadge.classList.remove("show");
    }
  }

  function currentReplayFrame() {
    if (!game.replay.active || !game.replay.frames.length) return null;
    const progress = clamp(game.replay.elapsed / game.replay.duration, 0, .999);
    return game.replay.frames[Math.floor(progress * game.replay.frames.length)];
  }

  function spawnParticle(x, y, color, energy = 1) {
    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });
  }

  function updateParticles(dt) {
    for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 90 * dt; particle.vx *= Math.pow(.4, dt); particle.life -= dt; }
    game.particles = game.particles.filter((particle) => particle.life > 0);
  }

  function updateCamera(dt) {
    const camera = game.camera;
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    camera.targetZoom = game.state === "playing" ? clamp(1.025 + ballSpeed / 9000, 1.025, 1.075) : 1;
    const follow = game.state === "playing" ? .085 : 0;
    const desiredX = lerp(W / 2, ball.x, follow);
    const desiredY = lerp(H / 2, ball.y, follow);
    const ease = 1 - Math.exp(-dt * 3.4);
    camera.x = lerp(camera.x, desiredX, ease);
    camera.y = lerp(camera.y, desiredY, ease);
    camera.zoom = lerp(camera.zoom, camera.targetZoom, 1 - Math.exp(-dt * 2.8));
    const halfW = W / (camera.zoom * 2); const halfH = H / (camera.zoom * 2);
    camera.x = clamp(camera.x, halfW, W - halfW); camera.y = clamp(camera.y, halfH, H - halfH);
  }

  function update(dt) {
    updateInput(); updateParticles(dt); updateCamera(dt); updateReplay(dt); game.flash = Math.max(0, game.flash - dt * 1.3); game.shake *= Math.pow(.04, dt);
    game.cameraNotice = Math.max(0, game.cameraNotice - dt);
    if (game.state !== "playing") return;
    for (const player of players) {
      player.animTime = Math.max(0, player.animTime - dt);
      if (player.animTime === 0) { player.anim = "idle"; player.animPower = 0; }
    }
    if (game.goalSequence) {
      game.goalSequence.timer -= dt;
      if (game.goalSequence.timer <= 0) { const nextTeam = game.goalSequence.nextTeam; game.goalSequence = null; game.replay.active = false; ui.replayBadge.classList.remove("show"); kickoff(nextTeam); }
      return;
    }
    if (game.kickOffTimer > 0) { game.kickOffTimer -= dt; return; }
    game.time -= dt; if (game.time <= 0) { game.time = 0; endMatch(); return; }

    for (const player of players) {
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.diveCooldown = Math.max(0, player.diveCooldown - dt);
      if (player === game.selected) updateUser(player, dt); else updateAI(player, dt);
      if (player !== game.selected) player.sprinting = Math.hypot(player.vx, player.vy) > 185;
      updateMotionState(player,dt);
      player.stepPhase += dt * (.035 * Math.hypot(player.vx, player.vy) + 2.2);
      player.x += player.vx * dt; player.y += player.vy * dt; keepPlayerInBounds(player);
    }
    resolvePlayerCollisions(); updateBall(dt); if (!game.goalSequence) recordReplay(dt);
    if (!ball.owner || ball.owner.team !== HOME) {
      const nearest = closestPlayer(HOME, ball, false); if (game.selected && distance(game.selected, ball) > distance(nearest, ball) + 145) game.selected = nearest;
    }
  }

  function updateMotionState(player,dt) {
    const speed=Math.hypot(player.vx,player.vy);const moving=speed>18;const target=moving?Math.atan2(player.vx,player.vy):player.motionYaw;const delta=Math.atan2(Math.sin(target-player.motionYaw),Math.cos(target-player.motionYaw));
    player.motionYaw=smoothAngle(player.motionYaw,target,1-Math.exp(-dt*(player.sprinting?7.5:10.5)));player.turnLean=lerp(player.turnLean,clamp(delta*1.35,-.72,.72),1-Math.exp(-dt*9));player.strideBlend=lerp(player.strideBlend,moving?clamp(speed/205,0,1.35):0,1-Math.exp(-dt*(moving?10:7)));
  }

  function worldX(value) { return (value - W / 2) * WORLD_SCALE; }
  function worldZ(value) { return (value - H / 2) * WORLD_SCALE; }

  function init3D() {
    try {
      renderer3D = new THREE.WebGLRenderer({ canvas, antialias: lowPowerDevice, alpha: false, powerPreference: "high-performance" });
    } catch (error) {
      use3D = false; ctx = canvas.getContext("2d"); ui.commentary.textContent = "WebGL không khả dụng · Đang chạy chế độ tương thích 2D"; return false;
    }
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1.1 : 2));
    renderer3D.setSize(W, H, false); renderer3D.shadowMap.enabled = !lowPowerDevice; renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer3D.outputColorSpace = THREE.SRGBColorSpace; renderer3D.toneMapping = THREE.ACESFilmicToneMapping; renderer3D.toneMappingExposure = 1.12;

    scene3D = new THREE.Scene(); scene3D.background = new THREE.Color(0x050a09); scene3D.fog = new THREE.FogExp2(0x07110e, .011);
    camera3D = new THREE.PerspectiveCamera(lowPowerDevice?43:39, W / H, .1, 260); camera3D.position.set(0, lowPowerDevice?54:45, lowPowerDevice?63:52); camera3D.lookAt(0, 0, 0);
    if(!lowPowerDevice){const pmrem=new THREE.PMREMGenerator(renderer3D);const environment=new RoomEnvironment();scene3D.environment=pmrem.fromScene(environment,.04).texture;scene3D.environmentIntensity=.62;environment.dispose();pmrem.dispose();}

    const hemisphere = new THREE.HemisphereLight(0xcfffe7, 0x06120d, 1.45); scene3D.add(hemisphere);
    const flood = new THREE.DirectionalLight(0xffffff, 3.4); flood.position.set(-28, 62, 30); flood.castShadow = true;
    flood.shadow.mapSize.set(lowPowerDevice ? 512 : 2048, lowPowerDevice ? 512 : 2048); flood.shadow.camera.left = -72; flood.shadow.camera.right = 72; flood.shadow.camera.top = 50; flood.shadow.camera.bottom = -50;
    flood.shadow.bias = -.00035; scene3D.add(flood);
    const rim = new THREE.DirectionalLight(0x70dcff, 1.4); rim.position.set(48, 25, -35); scene3D.add(rim);

    createPitch3D(); createGrass3D(); createStadium3D(); createGoals3D(); createAtmosphere3D(); createBall3D(); createParticleView(); createChargeView();
    if(!lowPowerDevice){composer3D=new EffectComposer(renderer3D);composer3D.setPixelRatio(Math.min(window.devicePixelRatio||1,2));composer3D.setSize(W,H);composer3D.addPass(new RenderPass(scene3D,camera3D));const ssao=new SSAOPass(scene3D,camera3D,W,H,24);ssao.kernelRadius=10;ssao.minDistance=.002;ssao.maxDistance=.12;composer3D.addPass(ssao);const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.16,.48,.88);composer3D.addPass(bloom);composer3D.addPass(new SMAAPass(W*(window.devicePixelRatio||1),H*(window.devicePixelRatio||1)));composer3D.addPass(new OutputPass());}
    screenFx = document.createElement("div"); screenFx.className = "screen-fx"; screenFx.innerHTML = "<span>GOAL!</span>";
    canvas.parentElement.appendChild(screenFx);
    loadPlayerAsset();
    return true;
  }

  function loadPlayerAsset() {
    const loader=new GLTFLoader();Promise.all([loader.loadAsync("assets/models/football-character.glb?v=8.1.0"),loader.loadAsync("assets/models/football-player.glb?v=8.0.0")]).then(([character,motion])=>{playerAsset={scene:character.scene,animations:motion.animations};players.forEach(upgradePlayerView);ui.commentary.textContent="PLAYER RIG 8.1 ONLINE · FULL KIT";}).catch(()=>{ui.commentary.textContent="Không tải được player rig · Đang dùng model dự phòng";});
  }

  function createPitchTexture3D() {
    const textureCanvas = document.createElement("canvas"); textureCanvas.width = W; textureCanvas.height = H;
    const paint = textureCanvas.getContext("2d"); paint.fillStyle = "#07100d"; paint.fillRect(0, 0, W, H);
    const grass = paint.createLinearGradient(0, FIELD.top, 0, FIELD.bottom); grass.addColorStop(0, "#0b7547"); grass.addColorStop(.5, "#087044"); grass.addColorStop(1, "#075d39");
    paint.fillStyle = grass; paint.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    const stripe = (FIELD.right - FIELD.left) / 16;
    for (let i = 0; i < 16; i += 1) { paint.fillStyle = i % 2 ? "rgba(255,255,255,.035)" : "rgba(0,20,8,.05)"; paint.fillRect(FIELD.left + i * stripe, FIELD.top, stripe, FIELD.bottom - FIELD.top); }
    for (let i = 0; i < 2600; i += 1) {
      const x = FIELD.left + seededNoise(i * 2.17) * (FIELD.right - FIELD.left); const y = FIELD.top + seededNoise(i * 5.43 + 9) * (FIELD.bottom - FIELD.top);
      paint.fillStyle = seededNoise(i * 8.1) > .48 ? "rgba(255,255,220,.035)" : "rgba(0,20,8,.04)"; paint.fillRect(x, y, 1, 2);
    }
    paint.strokeStyle = "rgba(245,250,247,.94)"; paint.lineWidth = 3; paint.lineCap = "round";
    paint.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    paint.beginPath(); paint.moveTo(W / 2, FIELD.top); paint.lineTo(W / 2, FIELD.bottom); paint.stroke();
    paint.beginPath(); paint.arc(W / 2, H / 2, 83, 0, Math.PI * 2); paint.stroke(); paint.fillStyle = "white"; paint.beginPath(); paint.arc(W / 2, H / 2, 5, 0, Math.PI * 2); paint.fill();
    paint.strokeRect(FIELD.left, 175, 180, 350); paint.strokeRect(FIELD.left, 267, 83, 166); paint.strokeRect(FIELD.right - 180, 175, 180, 350); paint.strokeRect(FIELD.right - 83, 267, 83, 166);
    const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(lowPowerDevice?4:16, renderer3D.capabilities.getMaxAnisotropy()); return texture;
  }

  function createPitch3D() {
    pitchView = new THREE.Mesh(new THREE.PlaneGeometry(W * WORLD_SCALE, H * WORLD_SCALE), new THREE.MeshStandardMaterial({ map: createPitchTexture3D(), roughness: .94, metalness: 0 }));
    pitchView.rotation.x = -Math.PI / 2; pitchView.receiveShadow = true; scene3D.add(pitchView);
    const base = new THREE.Mesh(new THREE.BoxGeometry(124, 1.2, 74), new THREE.MeshStandardMaterial({ color: 0x06130e, roughness: 1 })); base.position.y = -.7; base.receiveShadow = true; scene3D.add(base);
  }

  function createGrass3D() {
    const count=lowPowerDevice?220:1800; const bladeGeometry=new THREE.PlaneGeometry(.055,.42); bladeGeometry.translate(0,.21,0); const bladeMaterial=new THREE.MeshStandardMaterial({color:0x15915b,roughness:.88,side:THREE.DoubleSide}); grassView=new THREE.InstancedMesh(bladeGeometry,bladeMaterial,count); const dummy=new THREE.Object3D();
    for(let i=0;i<count;i+=1){dummy.position.set(worldX(FIELD.left+seededNoise(i*2.13)*(FIELD.right-FIELD.left)),.015,worldZ(FIELD.top+seededNoise(i*5.71+3)*(FIELD.bottom-FIELD.top)));dummy.rotation.y=seededNoise(i*9.37)*Math.PI;const size=.65+seededNoise(i*4.43)*.7;dummy.scale.set(size,size,size);dummy.updateMatrix();grassView.setMatrixAt(i,dummy.matrix);} grassView.receiveShadow=true;grassView.frustumCulled=false;scene3D.add(grassView);
  }

  function createAtmosphere3D() {
    const drops=lowPowerDevice?180:820;const positions=new Float32Array(drops*2*3);const speeds=new Float32Array(drops);
    for(let i=0;i<drops;i+=1){const x=-67+seededNoise(i*3.17)*134;const y=2+seededNoise(i*7.43)*47;const z=-39+seededNoise(i*11.2)*78;const j=i*6;positions[j]=x;positions[j+1]=y;positions[j+2]=z;positions[j+3]=x-.1;positions[j+4]=y-.9;positions[j+5]=z+.14;speeds[i]=.65+seededNoise(i*13.7)*.85;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));rainView=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xbfe9f2,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending}));rainView.userData.speeds=speeds;scene3D.add(rainView);
  }

  function createStadium3D() {
    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x111918, roughness: .82, metalness: .12 });
    const stands = [[0, 4, -41, 126, 8, 12], [-67, 4, 0, 10, 8, 78], [67, 4, 0, 10, 8, 78], [0, 2, 40, 126, 4, 9]];
    for (const [x,y,z,w,h,d] of stands) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), standMaterial); mesh.position.set(x,y,z); mesh.receiveShadow = true; scene3D.add(mesh); }
    const crowdPositions = []; const crowdColors = [];
    const crowdCount = lowPowerDevice ? 320 : 1200;
    for (let i = 0; i < crowdCount; i += 1) {
      const edge = i % 4; const row = 1 + Math.floor(seededNoise(i * 8.3) * 4); let x; let z;
      if (edge < 2) { x = -61 + seededNoise(i * 2.8) * 122; z = edge === 0 ? -36 - row * 1.4 : 36 + row * .9; }
      else { x = edge === 2 ? -61 - row * 1.3 : 61 + row * 1.3; z = -33 + seededNoise(i * 4.7) * 66; }
      crowdPositions.push(x, 1.6 + row * .75 + seededNoise(i) * .7, z);
      const roll = seededNoise(i * 12.7); const color = new THREE.Color(roll > .93 ? 0xe1bb58 : roll > .86 ? 0x47c9d4 : 0x9ca9a3); crowdColors.push(color.r, color.g, color.b);
    }
    const crowdGeometry = new THREE.BufferGeometry(); crowdGeometry.setAttribute("position", new THREE.Float32BufferAttribute(crowdPositions, 3)); crowdGeometry.setAttribute("color", new THREE.Float32BufferAttribute(crowdColors, 3));
    crowdView = new THREE.Points(crowdGeometry, new THREE.PointsMaterial({ size: .34, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: .9 })); scene3D.add(crowdView);
    createLedBoard3D(0, -35.1, "TONY FOOTBALL MAX", 0xe1bb58); createLedBoard3D(0, 35.2, "PLAY BEAUTIFUL · PLAY TONY", 0x47c9d4);
    for (const x of [-49, 49]) for (const z of [-36, 36]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(.28, .38, 21, 8), new THREE.MeshStandardMaterial({ color: 0x59615e, metalness: .8, roughness: .35 })); mast.position.set(x, 10, z); scene3D.add(mast);
      const lamp = new THREE.PointLight(0xe8fff5, 20, 70, 2); lamp.position.set(x, 20, z); scene3D.add(lamp);
      const beam=new THREE.Mesh(new THREE.ConeGeometry(8,28,16,1,true),new THREE.MeshBasicMaterial({color:0xbdebdc,transparent:true,opacity:lowPowerDevice ? .018 : .035,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));beam.position.set(x,6,z);beam.rotation.z=Math.PI;scene3D.add(beam);
    }
  }

  function createLedBoard3D(x, z, text, color) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(35, 1.7, .45), new THREE.MeshStandardMaterial({ color: 0x030706, emissive: color, emissiveIntensity: .32, metalness: .35, roughness: .35 })); board.position.set(x, 1.1, z); scene3D.add(board);
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 1024; labelCanvas.height = 64; const paint = labelCanvas.getContext("2d"); paint.fillStyle = "#050908"; paint.fillRect(0,0,1024,64); paint.fillStyle = `#${color.toString(16).padStart(6,"0")}`; paint.font = "700 28px Inter"; paint.textAlign = "center"; paint.textBaseline = "middle"; paint.fillText(text,512,34);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(34.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(labelCanvas), toneMapped: false, transparent: true })); label.position.set(x, 1.1, z + (z > 0 ? -.24 : .24)); label.rotation.y = z > 0 ? Math.PI : 0; scene3D.add(label); ledViews.push({ board, label });
  }

  function createGoals3D() {
    createGoal3D(worldX(FIELD.left), -1); createGoal3D(worldX(FIELD.right), 1);
  }

  function createGoal3D(x, side) {
    const goal = new THREE.Group(); goal.position.x = x; const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: .28, metalness: .28 });
    const postGeometry = new THREE.CylinderGeometry(.12, .12, 3.5, 10); const crossGeometry = new THREE.CylinderGeometry(.12, .12, 17, 10); crossGeometry.rotateX(Math.PI / 2);
    for (const z of [-8.5, 8.5]) { const post = new THREE.Mesh(postGeometry, postMaterial); post.position.set(0, 1.75, z); post.castShadow = true; goal.add(post); }
    const cross = new THREE.Mesh(crossGeometry, postMaterial); cross.position.set(0, 3.5, 0); goal.add(cross);
    const netMaterial = new THREE.LineBasicMaterial({ color: 0xbfd1c8, transparent: true, opacity: .34 }); const netVertices = [];
    for (let z = -8.5; z <= 8.5; z += 1.7) netVertices.push(0,0,z,side*3,0,z, 0,3.5,z,side*3,2.8,z);
    for (let y = 0; y <= 3.5; y += .7) netVertices.push(0,y,-8.5,side*3,y*.8,-8.5, 0,y,8.5,side*3,y*.8,8.5, side*3,y*.8,-8.5,side*3,y*.8,8.5);
    const netGeometry = new THREE.BufferGeometry(); netGeometry.setAttribute("position", new THREE.Float32BufferAttribute(netVertices, 3)); const net=new THREE.LineSegments(netGeometry, netMaterial); goal.add(net); goalNetViews.push(net); scene3D.add(goal);
  }

  function createLabelSprite(player, accent) {
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 256; labelCanvas.height = 64; const paint = labelCanvas.getContext("2d");
    paint.fillStyle = "rgba(4,8,7,.86)"; paint.roundRect(4,6,248,50,12); paint.fill(); paint.strokeStyle = accent; paint.lineWidth = 3; paint.stroke(); paint.fillStyle = "white"; paint.font = "700 27px Inter"; paint.textAlign = "center"; paint.textBaseline = "middle"; paint.fillText(`${player.number} · ${player.name}`,128,32);
    const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthTest: false, toneMapped: false }); const sprite = new THREE.Sprite(material); sprite.scale.set(5.2,1.3,1); sprite.position.y = 7; return sprite;
  }

  function limb(material, length, radius = .22, endMaterial = null, isLeg = false, bootMaterial = null) {
    const pivot = new THREE.Group(); const upperLength = length * .52; const lowerLength = length - upperLength;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .9, upperLength, lowPowerDevice ? 6 : 10), material); upper.position.y = -upperLength / 2; upper.castShadow = true; pivot.add(upper);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * .92, lowPowerDevice ? 6 : 10, 6), endMaterial || material); joint.position.y = -upperLength; pivot.add(joint);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * .86, radius * .7, lowerLength, lowPowerDevice ? 6 : 10), endMaterial || material); lower.position.y = -upperLength - lowerLength / 2; lower.castShadow = true; pivot.add(lower);
    if (isLeg) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.6, .34, .86), bootMaterial); boot.position.set(0, -length - .12, .23); boot.castShadow = true; pivot.add(boot);
      const studs = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.35, .08, .58), bootMaterial); studs.position.set(0, -length - .32, .2); pivot.add(studs);
    }
    return pivot;
  }

  function createSquadNumber(player, color) {
    const numberCanvas = document.createElement("canvas"); numberCanvas.width = 128; numberCanvas.height = 128; const paint = numberCanvas.getContext("2d");
    paint.clearRect(0,0,128,128); paint.fillStyle = color; paint.strokeStyle = "rgba(0,0,0,.38)"; paint.lineWidth = 8; paint.font = "800 90px Barlow Condensed"; paint.textAlign = "center"; paint.textBaseline = "middle"; paint.strokeText(player.number,64,68); paint.fillText(player.number,64,68);
    const texture = new THREE.CanvasTexture(numberCanvas); texture.colorSpace = THREE.SRGBColorSpace; const material = new THREE.MeshBasicMaterial({ map:texture, transparent:true, toneMapped:false, depthWrite:false, side:THREE.DoubleSide });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(.72,.88),material); front.position.set(0,3.48,1.005);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(.92,1.06),material); back.position.set(0,3.5,-1.005); back.rotation.y=Math.PI; return [front,back];
  }

  function addHairStyle(body, player, hairMaterial) {
    const style = (player.index + player.team * 2) % 4; const segments = lowPowerDevice ? 8 : 14;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.74,segments,7,0,Math.PI*2,0,Math.PI*(style===1 ? .35 : .48)),hairMaterial); cap.position.y=5.55; cap.scale.set(style===2?1.08:1,style===1 ? .72 : 1,1); body.add(cap);
    if(style===2){for(let i=0;i<5;i+=1){const curl=new THREE.Mesh(new THREE.SphereGeometry(.22,7,5),hairMaterial);curl.position.set((i-2)*.25,5.98-Math.abs(i-2)*.04,.02+Math.abs(i-2)*.05);body.add(curl);}}
    if(style===3){const top=new THREE.Mesh(new THREE.BoxGeometry(.92,.42,1.05,2,1,2),hairMaterial);top.position.set(0,5.92,0);top.rotation.z=.08;body.add(top);}
  }

  function createPlayerView(player) {
    const home = player.team === HOME; const keeper = player.role === "GK"; const accent = home ? "#e1bb58" : "#47c9d4";
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    const jerseyColor = keeper ? (home ? 0x8a62dd : 0xed6757) : (home ? 0xe1bb58 : 0x34b8c7); const jersey = lowPowerDevice?new THREE.MeshStandardMaterial({color:jerseyColor,roughness:.62,metalness:.02}):new THREE.MeshPhysicalMaterial({color:jerseyColor,roughness:.48,metalness:.01,sheen:1,sheenColor:new THREE.Color(home?0xffe4a3:0xbaf7ff),sheenRoughness:.7,clearcoat:.08,clearcoatRoughness:.72});
    const skinTones=[0xd89d78,0xb97958,0x8f5a3d,0xe5b08b]; const skin = lowPowerDevice?new THREE.MeshStandardMaterial({color:skinTones[(player.index+player.team)%skinTones.length],roughness:.78}):new THREE.MeshPhysicalMaterial({color:skinTones[(player.index+player.team)%skinTones.length],roughness:.62,clearcoat:.06,clearcoatRoughness:.8});
    const dark = new THREE.MeshStandardMaterial({ color: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35), roughness:.72 }); const sock = new THREE.MeshStandardMaterial({color:home?0xe9d58f:0xb8eff3,roughness:.82});
    const boot = new THREE.MeshStandardMaterial({color:(player.index%3===0?0xf25b48:player.index%3===1?0xe8e9e6:0x171a1a),roughness:.38,metalness:.12}); const hairMaterial=new THREE.MeshStandardMaterial({color:[0x231914,0x38241b,0x111413,0x5a351f][(player.index+player.team)%4],roughness:.92});
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.82,1.08,2.45,lowPowerDevice?8:12),jersey); torso.position.y=3.48; torso.scale.z=.88; torso.castShadow=true; body.add(torso);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.48,.09,6,16),dark); collar.rotation.x=Math.PI/2; collar.position.y=4.72; body.add(collar);
    const chestBand = new THREE.Mesh(new THREE.BoxGeometry(1.72,.18,1.78),new THREE.MeshStandardMaterial({color:home?0x161b19:0xe4f5f3,roughness:.65})); chestBand.position.y=3.88; chestBand.castShadow=true; body.add(chestBand);
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.78,.78,1.2),dark); shorts.position.y=2.02; shorts.castShadow=true; body.add(shorts);
    const waist = new THREE.Mesh(new THREE.BoxGeometry(1.82,.16,1.22),jersey); waist.position.y=2.42; body.add(waist);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.72,lowPowerDevice?10:18,lowPowerDevice?8:14),skin); head.position.y=5.35; head.scale.set(.93,1.08,.96); head.castShadow=true; body.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.31,.37,.48,10),skin); neck.position.y=4.82; neck.castShadow=true; body.add(neck); addHairStyle(body,player,hairMaterial);
    if(!lowPowerDevice){const faceDark=new THREE.MeshBasicMaterial({color:0x201814});for(const x of [-.24,.24]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,7,5),faceDark);eye.position.set(x,5.48,.69);body.add(eye);}const nose=new THREE.Mesh(new THREE.ConeGeometry(.07,.2,7),skin);nose.rotation.x=Math.PI/2;nose.position.set(0,5.27,.75);body.add(nose);const mouth=new THREE.Mesh(new THREE.BoxGeometry(.25,.035,.035),new THREE.MeshBasicMaterial({color:0x6e342f}));mouth.position.set(0,5.08,.7);body.add(mouth);}
    const leftLeg = limb(skin,1.9,.27,sock,true,boot); const rightLeg = limb(skin,1.9,.27,sock,true,boot); leftLeg.position.set(-.48,1.75,0); rightLeg.position.set(.48,1.75,0); body.add(leftLeg,rightLeg);
    const leftArm = limb(jersey,1.58,.22,skin); const rightArm = limb(jersey,1.58,.22,skin); leftArm.position.set(-1,4.42,0); rightArm.position.set(1,4.42,0); leftArm.rotation.z=-.24; rightArm.rotation.z=.24; body.add(leftArm,rightArm);
    if (keeper) { const gloveMat = new THREE.MeshStandardMaterial({ color:0xf5f7f6, roughness:.4 }); for (const arm of [leftArm,rightArm]) { const glove = new THREE.Mesh(new THREE.BoxGeometry(.42,.38,.32),gloveMat); glove.position.y=-1.62; glove.rotation.z=.12; arm.add(glove); } }
    const numbers=createSquadNumber(player,home?"#101413":"#f0fbfa"); body.add(...numbers);
    const marker = new THREE.Mesh(new THREE.TorusGeometry(1.7,.09,8,36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent:true, opacity:.92, toneMapped:false })); marker.rotation.x = Math.PI/2; marker.position.y = .08; root.add(marker);
    const label = createLabelSprite(player, accent); root.add(label); scene3D.add(root); playerViews.set(player,{root,body,torso,head,leftLeg,rightLeg,leftArm,rightArm,marker,label}); if(playerAsset)upgradePlayerView(player);
  }

  function addFootballKit(model,player) {
    const home=player.team===HOME;const keeper=player.role==="GK";const jerseyColor=keeper?(home?0x7650d6:0xe65348):(home?0xe1bb58:0x32b8c8);const shortsColor=keeper?0x20212c:(home?0x171b1a:0x082e35);const sockColor=home?0xe8d486:0xb7edf2;
    const jersey=new THREE.MeshPhysicalMaterial({color:jerseyColor,roughness:.5,sheen:1,sheenColor:new THREE.Color(home?0xffe9ae:0xc4fbff),sheenRoughness:.72});const shorts=new THREE.MeshStandardMaterial({color:shortsColor,roughness:.7});const socks=new THREE.MeshStandardMaterial({color:sockColor,roughness:.78});const boots=new THREE.MeshStandardMaterial({color:player.index%3===0?0xe64f3f:player.index%3===1?0xe7e9e7:0x141716,roughness:.38,metalness:.08});
    const attach=(boneName,geometry,material,position)=>{const bone=model.getObjectByName(boneName);if(!bone)return null;const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.castShadow=true;bone.add(mesh);return mesh;};
    attach("spine_01",new THREE.CylinderGeometry(.28,.34,.5,16),jersey,new THREE.Vector3(0,.2,0));attach("upperarm_l",new THREE.CylinderGeometry(.115,.13,.22,12),jersey,new THREE.Vector3(0,.1,0));attach("upperarm_r",new THREE.CylinderGeometry(.115,.13,.22,12),jersey,new THREE.Vector3(0,.1,0));attach("pelvis",new THREE.BoxGeometry(.57,.3,.34),shorts,new THREE.Vector3(0,.08,0));
    for(const side of ["l","r"]){attach(`calf_${side}`,new THREE.CylinderGeometry(.095,.12,.29,12),socks,new THREE.Vector3(0,.3,0));attach(`foot_${side}`,new THREE.BoxGeometry(.17,.29,.13),boots,new THREE.Vector3(0,.08,.015));}
    const head=model.getObjectByName("Head");if(head){const hair=new THREE.Mesh(new THREE.SphereGeometry(.115,14,7,0,Math.PI*2,0,Math.PI*.48),new THREE.MeshStandardMaterial({color:[0x231914,0x38241b,0x111413,0x5a351f][(player.index+player.team)%4],roughness:.9}));hair.position.y=.055;hair.scale.set(1,1,.93);hair.castShadow=true;head.add(hair);}
    return{head,spine:model.getObjectByName("spine_03"),leftThigh:model.getObjectByName("thigh_l"),rightThigh:model.getObjectByName("thigh_r"),rightCalf:model.getObjectByName("calf_r"),leftArm:model.getObjectByName("upperarm_l"),rightArm:model.getObjectByName("upperarm_r")};
  }

  function upgradePlayerView(player) {
    const view=playerViews.get(player);if(!view||view.rig||!playerAsset)return;const model=cloneSkeleton(playerAsset.scene);model.scale.setScalar(3.28);model.rotation.y=Math.PI;
    model.traverse((node)=>{if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;const source=Array.isArray(node.material)?node.material:[node.material];const mapped=source.map((material)=>{const clone=material.clone();clone.roughness=Math.max(.5,clone.roughness||.5);return clone;});node.material=Array.isArray(node.material)?mapped:mapped[0];});
    const bones=addFootballKit(model,player);const mixer=new THREE.AnimationMixer(model);const actions={};for(const clip of playerAsset.animations)actions[clip.name]=mixer.clipAction(clip);view.body.visible=false;view.root.add(model);view.rig={model,mixer,actions,state:"",lastTime:performance.now(),active:null,yaw:Math.atan2(player.dirX,player.dirY),...bones};
    const numbers=createSquadNumber(player,player.team===HOME?"#101413":"#f0fbfa");for(const number of numbers){number.position.y+=.05;view.root.add(number);}switchRigAnimation(view,"Idle_Loop",true);
  }

  function switchRigAnimation(view,state,immediate=false) {
    const rig=view.rig;if(!rig||rig.state===state)return;const next=rig.actions[state]||rig.actions.Idle_Loop;if(!next)return;const looping=state.endsWith("_Loop")||state==="Dance_Loop";const fade=immediate?0:(looping ? .32 : .16);next.reset();next.enabled=true;next.setLoop(looping?THREE.LoopRepeat:THREE.LoopOnce,looping?Infinity:1);next.clampWhenFinished=!looping;next.fadeIn(fade).play();if(rig.active&&rig.active!==next)rig.active.fadeOut(fade);rig.active=next;rig.state=state;
  }

  function rigAnimationState(player,speed,current) {
    if(player.anim==="celebrate")return"Dance_Loop";if(player.anim==="tackle"||player.anim==="dive")return"Roll";if(player.anim==="receive")return"Hit_Chest";if(current==="Sprint_Loop"&&speed>178)return current;if(speed>218)return"Sprint_Loop";if(current==="Jog_Fwd_Loop"&&speed>18)return current;if(speed>26)return"Jog_Fwd_Loop";return"Idle_Loop";
  }

  function smoothAngle(current,target,ease) {return current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*ease;}

  function updateRigPlayer(player,pose,view,now,speed) {
    const rig=view.rig;const dt=Math.min(.05,(now-rig.lastTime)/1000);rig.lastTime=now;const ballDirection=normalize(ball.x-pose.x,ball.y-pose.y);const moving=speed>42;const desired=moving?(pose.motionYaw??Math.atan2(pose.vx||pose.dirX,pose.vy||pose.dirY)):Math.atan2(ballDirection.x,ballDirection.y);rig.yaw=smoothAngle(rig.yaw,desired,1-Math.exp(-dt*(pose.sprinting?8:11)));view.root.position.set(worldX(pose.x),0,worldZ(pose.y));view.root.rotation.y=rig.yaw;rig.model.rotation.z=lerp(rig.model.rotation.z,-(pose.turnLean||0)*.14,1-Math.exp(-dt*12));
    switchRigAnimation(view,rigAnimationState(pose,speed,rig.state));if(rig.active)rig.active.timeScale=rig.state==="Sprint_Loop"?clamp(speed/225,.82,1.42):rig.state==="Jog_Fwd_Loop"?clamp(speed/160,.78,1.34):1;rig.mixer.update(dt);
    const actionProgress=pose.animDuration?1-pose.animTime/pose.animDuration:1;const wave=pose.animTime>0?Math.sin(clamp(actionProgress,0,1)*Math.PI):0;if((pose.anim==="shoot"||pose.anim==="pass")&&rig.rightThigh){const power=pose.anim==="shoot"?1.2:.76;rig.rightThigh.rotation.x-=power*wave;if(rig.rightCalf)rig.rightCalf.rotation.x+=wave*.62;if(rig.leftArm)rig.leftArm.rotation.x-=wave*.34;if(rig.rightArm)rig.rightArm.rotation.x+=wave*.42;}
    if(ball.owner===player&&speed>35){const footWave=Math.sin(pose.stepPhase);const foot=footWave>0?rig.rightThigh:rig.leftThigh;if(foot)foot.rotation.x-=Math.abs(footWave)*.13*clamp(speed/180,.35,1);}
    if(rig.head){const ballYaw=Math.atan2(ballDirection.x,ballDirection.y);const look=Math.atan2(Math.sin(ballYaw-rig.yaw),Math.cos(ballYaw-rig.yaw));rig.head.rotation.y+=clamp(look,-.68,.68)*.62;}if(rig.spine){const ballYaw=Math.atan2(ballDirection.x,ballDirection.y);const look=Math.atan2(Math.sin(ballYaw-rig.yaw),Math.cos(ballYaw-rig.yaw));if(speed<75)rig.spine.rotation.y+=clamp(look,-.28,.28)*.22;rig.spine.rotation.z-=(pose.turnLean||0)*.1;rig.spine.rotation.x-=clamp(speed/320,0,.12);}
    view.marker.visible=!game.replay.active&&player===game.selected;if(view.marker.visible){const pulse=1+Math.sin(now*.006)*.08;view.marker.scale.setScalar(pulse);view.marker.material.color.set(!isAttacking()&&input.keys.has("KeyS")?0x47c9d4:0xffd86b);}view.label.visible=!game.replay.active&&(player===game.selected||speed<10);
  }

  function createBall3D() {
    ballView = new THREE.Group(); const white = new THREE.Mesh(new THREE.SphereGeometry(.82,20,16), new THREE.MeshStandardMaterial({ color:0xf6f7f5,roughness:.32,metalness:.05 })); white.castShadow=true; ballView.add(white);
    const patchMaterial = new THREE.MeshStandardMaterial({color:0x151c19,roughness:.45}); const patchGeometry = new THREE.SphereGeometry(.18,8,6);
    for (const [x,y,z] of [[0,.81,0],[0,-.81,0],[.81,0,0],[-.81,0,0],[0,0,.81],[0,0,-.81]]) { const patch=new THREE.Mesh(patchGeometry,patchMaterial); patch.position.set(x,y,z); ballView.add(patch); }
    scene3D.add(ballView);
  }

  function createParticleView() {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(900),3)); geometry.setAttribute("color",new THREE.BufferAttribute(new Float32Array(900),3)); geometry.setDrawRange(0,0);
    particleView = new THREE.Points(geometry,new THREE.PointsMaterial({size:.42,vertexColors:true,transparent:true,opacity:.88,depthWrite:false})); scene3D.add(particleView);
  }

  function createChargeView() {
    chargeView = new THREE.Group(); const bg=new THREE.Mesh(new THREE.BoxGeometry(5,.22,.28),new THREE.MeshBasicMaterial({color:0x080b0a,transparent:true,opacity:.8})); const fill=new THREE.Mesh(new THREE.BoxGeometry(4.8,.24,.3),new THREE.MeshBasicMaterial({color:0xffcf58,toneMapped:false})); fill.position.y=.02; fill.userData.baseWidth=4.8; chargeView.add(bg,fill); chargeView.userData.fill=fill; chargeView.visible=false; scene3D.add(chargeView);
  }

  function updatePlayerView(player, now, pose = player) {
    const view=playerViews.get(player); if(!view)return; const speed=Math.hypot(pose.vx,pose.vy); const running=speed>30; const stride=running?Math.sin(pose.stepPhase)*clamp(speed/185,.35,1.25):0;
    if(view.rig){updateRigPlayer(player,pose,view,now,speed);return;}
    const progress=pose.animDuration?1-pose.animTime/pose.animDuration:1; const wave=pose.animTime>0?Math.sin(clamp(progress,0,1)*Math.PI):0; const kick=(pose.anim==="shoot"||pose.anim==="pass")?wave:0; const tackle=pose.anim==="tackle"?wave:0; const dive=pose.anim==="dive"?wave:0; const celebrate=pose.anim==="celebrate"?Math.sin(now*.012)*.12+1:0;
    const sprintLean=running?clamp(speed/310,0,.16):0; view.root.position.set(worldX(pose.x),0,worldZ(pose.y)); view.root.rotation.y=pose.motionYaw??Math.atan2(pose.dirX,pose.dirY); view.body.position.y=celebrate?Math.abs(Math.sin(now*.009))*pose.animPower*.65:(running?Math.abs(Math.sin(pose.stepPhase))*.12:0); view.body.rotation.z=dive*pose.animPower*.9+stride*.025-(pose.turnLean||0)*.16; view.body.rotation.x=tackle*.6-sprintLean-kick*.08;
    view.torso.rotation.z=running?-stride*.035:0; view.torso.rotation.x=running ? .045 : 0; view.head.rotation.y=running?Math.sin(pose.stepPhase*.5)*.055:Math.sin(now*.0015+player.index)*.025; view.head.rotation.x=kick*-.1+celebrate*.04;
    view.leftLeg.rotation.x=stride*.72-tackle*1.05; view.rightLeg.rotation.x=-stride*.72-kick*(pose.anim==="shoot"?1.45:1.05); view.leftArm.rotation.x=celebrate?2.65+Math.sin(now*.01)*.24:-stride*.62-kick*.45; view.rightArm.rotation.x=celebrate?2.65-Math.sin(now*.01)*.24:stride*.62+kick*.72;
    view.leftArm.rotation.z=celebrate?-.72:-.24; view.rightArm.rotation.z=celebrate ? .72 : .24;
    view.marker.visible=!game.replay.active&&player===game.selected; if(view.marker.visible){const pulse=1+Math.sin(now*.006)*.08;view.marker.scale.setScalar(pulse);view.marker.material.color.set(!isAttacking()&&input.keys.has("KeyS")?0x47c9d4:0xffd86b);} view.label.visible=!game.replay.active&&(player===game.selected||speed<10);
  }

  function updateParticleView() {
    const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(300,game.particles.length);
    for(let i=0;i<count;i+=1){const p=game.particles[i];const j=i*3;positions[j]=worldX(p.x);positions[j+1]=.35+Math.max(0,(p.max-p.life))*1.8;positions[j+2]=worldZ(p.y);const color=new THREE.Color(p.color);colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}
    particleView.geometry.setDrawRange(0,count);particleView.geometry.attributes.position.needsUpdate=true;particleView.geometry.attributes.color.needsUpdate=true;
  }

  function updateAtmosphere3D(now) {
    const raining=game.weather==="rain";rainView.visible=raining;const wetEase=.04;pitchView.material.roughness=lerp(pitchView.material.roughness,raining ? .42 : .94,wetEase);pitchView.material.metalness=lerp(pitchView.material.metalness,raining ? .08 : 0,wetEase);pitchView.material.color.lerp(raining?wetPitchColor:dryPitchColor,wetEase);
    if(raining){const last=rainView.userData.lastTime||now;const dt=Math.min(.05,(now-last)/1000);rainView.userData.lastTime=now;const positions=rainView.geometry.attributes.position.array;const speeds=rainView.userData.speeds;for(let i=0;i<speeds.length;i+=1){const j=i*6;const fall=speeds[i]*30*dt;positions[j]-=2.6*dt;positions[j+3]-=2.6*dt;positions[j+1]-=fall;positions[j+4]-=fall;if(positions[j+1]<.5){positions[j+1]=48;positions[j+4]=47.1;}if(positions[j]<-70){positions[j]+=140;positions[j+3]+=140;}}rainView.geometry.attributes.position.needsUpdate=true;}else rainView.userData.lastTime=now;
    for(const net of goalNetViews){const impact=game.goalSequence?Math.sin((3.65-game.goalSequence.timer)*22)*Math.exp(-(3.65-game.goalSequence.timer)*1.8):0;net.scale.x=1+Math.abs(impact)*.13;net.material.opacity=.34+Math.abs(impact)*.36;}
  }

  function render3D(now) {
    const replayFrame=currentReplayFrame(); const renderBall=replayFrame?.ball||ball;
    players.forEach((player,index)=>updatePlayerView(player,now,replayFrame?.players[index]||player));
    ballView.position.set(worldX(renderBall.x),.86+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); updateParticleView(); updateAtmosphere3D(now);
    if(input.shootStart&&ball.owner===game.selected){chargeView.visible=true;chargeView.position.set(worldX(game.selected.x),7.5,worldZ(game.selected.y));chargeView.quaternion.copy(camera3D.quaternion);const fill=chargeView.userData.fill;fill.scale.x=Math.max(.02,input.shootCharge);fill.position.x=-2.4+2.4*input.shootCharge;fill.material.color.set(input.shootCharge>.82?0xff5b45:0xffcf58);}else chargeView.visible=false;
    const targetX=worldX(lerp(W/2,renderBall.x,replayFrame?1:.34));const targetZ=worldZ(lerp(H/2,renderBall.y,replayFrame?1:.18));
    if(replayFrame){const scoringRight=game.goalSequence?.team===HOME;cameraTarget.set(targetX+(scoringRight?-16:16),13,clamp(targetZ+22,-19,19));cameraLook.set(targetX,1.2,targetZ);}
    else if(game.goalSequence){const scorer=game.goalScorer||ball;cameraTarget.set(worldX(scorer.x)-9,8.5,worldZ(scorer.y)+12);cameraLook.set(worldX(scorer.x),2.4,worldZ(scorer.y));}
    else if(game.cameraMode==="tactical"){cameraTarget.set(targetX,lowPowerDevice?66:60,30+targetZ*.05);cameraLook.set(targetX,0,targetZ);}
    else if(game.cameraMode==="close"){cameraTarget.set(targetX-11,lowPowerDevice?26:20,lowPowerDevice?38:31+targetZ*.18);cameraLook.set(targetX,1.2,targetZ);}
    else{cameraTarget.set(targetX,(lowPowerDevice?52:44)+Math.min(5,Math.hypot(ball.vx,ball.vy)*.004),(lowPowerDevice?62:52)+targetZ*.08);cameraLook.set(targetX,.7,targetZ);}
    camera3D.position.lerp(cameraTarget,replayFrame ? .12 : .055);if(game.shake>.5){camera3D.position.x+=(Math.random()-.5)*game.shake*.018;camera3D.position.y+=(Math.random()-.5)*game.shake*.012;}camera3D.lookAt(cameraLook);
    const stadiumPulse=game.goalSequence?1+Math.sin(now*.018)*.45:1; if(crowdView){crowdView.material.size=(lowPowerDevice ? .3 : .34)*stadiumPulse;crowdView.material.opacity=game.goalSequence ? .98 : .88;} for(const led of ledViews){led.board.material.emissiveIntensity=game.goalSequence ? .75+.3*Math.sin(now*.022) : .32;led.label.material.opacity=game.goalSequence ? .8+.2*Math.sin(now*.018) : 1;}
    screenFx.style.opacity=String(clamp(game.flash,0,1)); screenFx.classList.toggle("active",game.flash>.02); if(composer3D)composer3D.render();else renderer3D.render(scene3D,camera3D); drawRadar();
  }

  function drawFallbackPlayerDetail(player,pose,replayFrame) {
    const selected=!replayFrame&&player===game.selected; const home=player.team===HOME; const keeper=player.role==="GK"; const speed=Math.hypot(pose.vx,pose.vy); const stride=speed>30?Math.sin(pose.stepPhase)*6:0; const skinTones=["#d89d78","#b97958","#8f5a3d","#e5b08b"]; const skin=skinTones[(player.index+player.team)%4]; const jersey=keeper?(home?"#8a62dd":"#ed6757"):(home?"#e1bb58":"#47c9d4"); const shorts=keeper?"#20212c":(home?"#171b1a":"#092e35"); const sock=home?"#e9d58f":"#b8eff3";
    ctx.save();ctx.translate(pose.x,pose.y+(speed>30?Math.abs(Math.sin(pose.stepPhase))*-2:0));ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(5,17,23,9,0,0,Math.PI*2);ctx.fill();
    if(selected){ctx.strokeStyle=!isAttacking()&&input.keys.has("KeyS")?"#47c9d4":"#ffdb6d";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,13,28,14,0,0,Math.PI*2);ctx.stroke();}
    ctx.rotate(Math.atan2(pose.dirY,pose.dirX)+Math.PI/2);ctx.lineCap="round";
    ctx.strokeStyle=sock;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(-7+stride,25);ctx.moveTo(6,10);ctx.lineTo(7-stride,25);ctx.stroke();ctx.strokeStyle="#191c1b";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-10+stride,26);ctx.lineTo(-5+stride,26);ctx.moveTo(3-stride,26);ctx.lineTo(10-stride,26);ctx.stroke();
    ctx.fillStyle=shorts;ctx.beginPath();ctx.roundRect(-11,4,22,12,4);ctx.fill();ctx.fillStyle=jersey;ctx.beginPath();ctx.roundRect(-13,-15,26,22,7);ctx.fill();ctx.fillStyle=home?"#161b19":"#e4f5f3";ctx.fillRect(-12,-5,24,3);
    ctx.strokeStyle=jersey;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-11,-9);ctx.lineTo(-18-stride*.35,3);ctx.moveTo(11,-9);ctx.lineTo(18+stride*.35,3);ctx.stroke();ctx.strokeStyle=skin;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-18-stride*.35,3);ctx.lineTo(-20-stride*.35,9);ctx.moveTo(18+stride*.35,3);ctx.lineTo(20+stride*.35,9);ctx.stroke();
    ctx.fillStyle=skin;ctx.fillRect(-3,-19,6,6);ctx.beginPath();ctx.ellipse(0,-23,8,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=["#231914","#38241b","#111413","#5a351f"][(player.index+player.team)%4];ctx.beginPath();ctx.arc(0,-26,8,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle=home?"#101413":"#f0fbfa";ctx.font="800 11px Barlow Condensed";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(player.number,0,-1);ctx.restore();
  }

  function renderFallback2D(now) {
    const replayFrame=currentReplayFrame(); const fallbackBall=replayFrame?.ball||ball;
    ctx.clearRect(0,0,W,H); ctx.fillStyle="#075d39"; ctx.fillRect(0,0,W,H);
    for(let i=0;i<14;i+=1){ctx.fillStyle=i%2?"rgba(255,255,255,.025)":"rgba(0,20,8,.04)";ctx.fillRect(FIELD.left+i*(FIELD.right-FIELD.left)/14,FIELD.top,(FIELD.right-FIELD.left)/14,FIELD.bottom-FIELD.top);}
    ctx.strokeStyle="rgba(245,250,247,.88)";ctx.lineWidth=3;ctx.strokeRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);ctx.beginPath();ctx.moveTo(W/2,FIELD.top);ctx.lineTo(W/2,FIELD.bottom);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,83,0,Math.PI*2);ctx.stroke();
    const fallbackPlayers=players.map((player,index)=>({base:player,pose:replayFrame?.players[index]||player})).sort((a,b)=>a.pose.y-b.pose.y);
    for(const {base:player,pose} of fallbackPlayers)drawFallbackPlayerDetail(player,pose,replayFrame);
    ctx.fillStyle="white";ctx.beginPath();ctx.arc(fallbackBall.x,fallbackBall.y,ball.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#17201d";ctx.lineWidth=2;ctx.stroke();
    for(const particle of game.particles){ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;ctx.fillRect(particle.x,particle.y,particle.size,particle.size);}ctx.globalAlpha=1;
    if(game.weather==="rain"){ctx.fillStyle="rgba(135,190,196,.055)";ctx.fillRect(0,0,W,H);ctx.strokeStyle="rgba(195,235,242,.32)";ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<(lowPowerDevice?60:140);i+=1){const x=(seededNoise(i*3.7)*W+now*.11)%W;const y=(seededNoise(i*8.9)*H+now*.34*(.7+seededNoise(i)))%H;ctx.moveTo(x,y);ctx.lineTo(x-5,y+17);}ctx.stroke();}
    if(input.shootStart&&ball.owner===game.selected){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(game.selected.x-31,game.selected.y-50,62,8);ctx.fillStyle=input.shootCharge>.82?"#ff5b45":"#ffcf58";ctx.fillRect(game.selected.x-30,game.selected.y-49,60*input.shootCharge,6);}
    if(game.flash>0){ctx.fillStyle=`rgba(255,225,126,${game.flash*.16})`;ctx.fillRect(0,0,W,H);ctx.fillStyle=`rgba(255,255,255,${game.flash})`;ctx.font="800 96px Barlow Condensed";ctx.textAlign="center";ctx.fillText("GOAL!",W/2,145);}drawRadar();
  }

  function drawPitch() {
    const stadium = ctx.createRadialGradient(W / 2, H / 2, 130, W / 2, H / 2, 720);
    stadium.addColorStop(0, "#16241f"); stadium.addColorStop(.7, "#0a1110"); stadium.addColorStop(1, "#030706");
    ctx.fillStyle = stadium; ctx.fillRect(0, 0, W, H);

    drawStadiumCrowd();
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#075d39"; ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top); ctx.restore();
    ctx.drawImage(pitchTexture, 0, 0);

    const flood = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 620);
    flood.addColorStop(0, "rgba(190,255,221,.12)"); flood.addColorStop(.62, "rgba(75,190,125,.035)"); flood.addColorStop(1, "rgba(0,0,0,.24)");
    ctx.fillStyle = flood; ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

    ctx.strokeStyle = "rgba(242,251,246,.9)"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.shadowColor = "rgba(215,255,230,.22)"; ctx.shadowBlur = 3;
    ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    ctx.beginPath(); ctx.moveTo(W / 2, FIELD.top); ctx.lineTo(W / 2, FIELD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 83, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(235,246,239,.85)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2); ctx.fill();
    drawBox(FIELD.left, 175, 180, 350, 1); drawBox(FIELD.right, 175, -180, 350, -1);
    drawGoal(FIELD.left, FIELD.goalTop, -30, FIELD.goalBottom - FIELD.goalTop); drawGoal(FIELD.right, FIELD.goalTop, 30, FIELD.goalBottom - FIELD.goalTop);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2;
    [[FIELD.left, FIELD.top, 0, Math.PI/2],[FIELD.right, FIELD.top, Math.PI/2, Math.PI],[FIELD.right,FIELD.bottom,Math.PI,Math.PI*1.5],[FIELD.left,FIELD.bottom,Math.PI*1.5,Math.PI*2]].forEach(([x,y,s,e]) => { ctx.beginPath(); ctx.arc(x,y,18,s,e); ctx.stroke(); });
    ctx.shadowBlur = 0;
  }

  function drawStadiumCrowd() {
    if (!stadiumTextureReady) {
      stx.fillStyle = "#111817"; stx.fillRect(0, 0, W, FIELD.top - 7); stx.fillRect(0, FIELD.bottom + 7, W, H - FIELD.bottom);
      stx.fillRect(0, 0, FIELD.left - 7, H); stx.fillRect(FIELD.right + 7, 0, W - FIELD.right, H);
      for (let i = 0; i < 280; i += 1) {
        const edge = i % 4; const t = seededNoise(i * 3.19); const lane = 7 + seededNoise(i * 9.71) * 23;
        let x; let y;
        if (edge < 2) { x = t * W; y = edge === 0 ? lane : H - lane; }
        else { x = edge === 2 ? lane : W - lane; y = t * H; }
        const colorRoll = seededNoise(i * 14.2);
        stx.fillStyle = colorRoll > .94 ? "rgba(225,187,88,.65)" : colorRoll > .88 ? "rgba(71,201,212,.55)" : "rgba(225,235,230,.22)";
        stx.fillRect(x, y, 2.2, 2.2);
      }
      drawLedBoard(stx, FIELD.left + 70, 15, 265, "TONY FOOTBALL MAX", "#e1bb58");
      drawLedBoard(stx, W / 2 - 132, H - 32, 265, "PLAY BEAUTIFUL · PLAY TONY", "#47c9d4");
      drawLedBoard(stx, FIELD.right - 335, 15, 265, "NEON NIGHT LEAGUE", "#47c9d4");
      stadiumTextureReady = true;
    }
    ctx.drawImage(stadiumTexture, 0, 0);
  }

  function drawLedBoard(target, x, y, width, text, color) {
    target.fillStyle = "#060908"; target.fillRect(x, y, width, 18); target.strokeStyle = "rgba(255,255,255,.12)"; target.strokeRect(x, y, width, 18);
    target.shadowColor = color; target.shadowBlur = 7; target.fillStyle = color; target.font = "700 9px Inter"; target.textAlign = "center"; target.textBaseline = "middle";
    target.fillText(text, x + width / 2, y + 9.5); target.shadowBlur = 0;
  }

  function drawBox(x, y, width, height, side) {
    ctx.strokeRect(side === 1 ? x : x + width, y, Math.abs(width), height);
    ctx.strokeRect(side === 1 ? x : x + width * .46, y + 92, Math.abs(width) * .46, height - 184);
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x + side * 125, H / 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + side * 125, H / 2, 72, side === 1 ? -Math.PI/2 : Math.PI/2, side === 1 ? Math.PI/2 : Math.PI*1.5); ctx.stroke();
  }

  function drawGoal(x, y, depth, height) {
    const front = x; const back = x + depth;
    ctx.save(); ctx.strokeStyle = "rgba(242,248,245,.92)"; ctx.lineWidth = 2.5; ctx.shadowColor = "rgba(255,255,255,.4)"; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(front, y); ctx.lineTo(back, y + 7); ctx.lineTo(back, y + height - 7); ctx.lineTo(front, y + height); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(228,241,235,.3)"; ctx.lineWidth = 1;
    for (let py = y + 9; py < y + height; py += 11) { ctx.beginPath(); ctx.moveTo(front, py); ctx.lineTo(back, py + (py < y + height / 2 ? 5 : -5)); ctx.stroke(); }
    for (let k = 1; k < 4; k += 1) { const gx = lerp(front, back, k / 4); ctx.beginPath(); ctx.moveTo(gx, y + 3); ctx.lineTo(gx, y + height - 3); ctx.stroke(); }
    ctx.restore();
  }

  function drawPlayer(player, now) {
    const selected = player === game.selected; const home = player.team === HOME; const speed = Math.hypot(player.vx, player.vy); const running = speed > 30;
    const actionProgress = player.animDuration ? 1 - player.animTime / player.animDuration : 1;
    const actionWave = player.animTime > 0 ? Math.sin(clamp(actionProgress, 0, 1) * Math.PI) : 0;
    const charging = selected && input.shootStart && ball.owner === player;
    const kickPose = player.anim === "shoot" || player.anim === "pass" ? actionWave : 0;
    const tacklePose = player.anim === "tackle" ? actionWave : 0;
    const receivePose = player.anim === "receive" ? actionWave : 0;
    const divePose = player.anim === "dive" ? actionWave : 0;
    ctx.save(); ctx.translate(player.x, player.y);
    ctx.fillStyle = `rgba(0,0,0,${.3 - divePose * .1})`; ctx.beginPath(); ctx.ellipse(5 + divePose * 8, 14, player.radius + 9 + divePose * 8, player.radius * (.52 - divePose * .12), 0, 0, Math.PI * 2); ctx.fill();
    if (selected) {
      const pulse = 1 + Math.sin(now * .006) * .07; ctx.strokeStyle = "#ffda70"; ctx.lineWidth = 3; ctx.shadowColor = "#ffcf52"; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.ellipse(0, 11, 27 * pulse, 13 * pulse, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffda70"; ctx.beginPath(); ctx.moveTo(-6, -42); ctx.lineTo(6, -42); ctx.lineTo(0, -32); ctx.closePath(); ctx.fill();
    }
    const strideScale = clamp(speed / 170, .45, 1.3); const stride = running ? Math.sin(player.stepPhase) * 5.5 * strideScale : 0;
    const bob = running ? Math.abs(Math.sin(player.stepPhase)) * -1.8 : 0;
    const angle = Math.atan2(player.dirY, player.dirX) + Math.PI / 2;
    if (divePose) ctx.rotate(player.animPower * divePose * .72);
    ctx.rotate(angle); ctx.translate(0, bob - kickPose * 1.5); ctx.scale(1 + receivePose * .06, 1 - receivePose * .08);
    const keeper = player.role === "GK";
    const jersey = keeper ? (home ? "#8a62dd" : "#ed6757") : (home ? "#e2b64d" : "#36b8c6");
    const jerseyLight = keeper ? (home ? "#c7a7ff" : "#ffb0a5") : (home ? "#ffe59a" : "#9cf4f4");
    const shorts = keeper ? "#20212c" : (home ? "#171b1a" : "#092e35");
    const legReach = (player.anim === "shoot" ? 42 : 30) * kickPose;
    const tackleReach = 34 * tacklePose;
    const windup = charging ? input.shootCharge * 9 : 0;
    ctx.strokeStyle = home ? "#e6c36a" : "#66d9e3"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(-6 + stride * .45, 19 - tackleReach * .45); ctx.moveTo(5, 9); ctx.lineTo(6 - stride * .45, 19 - legReach * .5 + windup); ctx.stroke();
    ctx.strokeStyle = "#121817"; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(-6 + stride * .45, 18 - tackleReach * .45); ctx.lineTo(-7 + stride * (1 - tacklePose), 25 - tackleReach);
    ctx.moveTo(6 - stride * .45, 18 - legReach * .5 + windup); ctx.lineTo(7 - stride * (1 - kickPose), 25 - legReach + windup); ctx.stroke();
    ctx.fillStyle = shorts; ctx.beginPath(); ctx.roundRect(-10, 5, 20, 12, 4); ctx.fill();
    const body = ctx.createLinearGradient(-12, -10, 12, 11); body.addColorStop(0, jerseyLight); body.addColorStop(.4, jersey); body.addColorStop(1, keeper ? "#3b315d" : (home ? "#a97b20" : "#16727d"));
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-12, -13, 24, 22, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.38)"; ctx.lineWidth = 1.3; ctx.stroke();
    const armSwing = stride * .32; ctx.strokeStyle = jersey; ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(-10, -7); ctx.lineTo(-16 - armSwing - divePose * 8, 1 - kickPose * 5);
    ctx.moveTo(10, -7); ctx.lineTo(16 + armSwing + divePose * 8, 1 + kickPose * 3); ctx.stroke();
    if (keeper) { ctx.fillStyle = "#f4f6f5"; ctx.beginPath(); ctx.arc(-17 - armSwing - divePose * 8, 1 - kickPose * 5, 3.2, 0, Math.PI * 2); ctx.arc(17 + armSwing + divePose * 8, 1 + kickPose * 3, 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#d89d78"; ctx.beginPath(); ctx.arc(0, -20, 7.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#241b18"; ctx.beginPath(); ctx.arc(0, -22.5, 7, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 10px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(player.number, 0, -2);
    ctx.restore();
    ctx.save(); ctx.translate(player.x, player.y); ctx.fillStyle = "rgba(5,8,8,.84)"; ctx.beginPath(); ctx.roundRect(-25, 31, 50, 13, 3); ctx.fill();
    ctx.strokeStyle = home ? "rgba(225,187,88,.7)" : "rgba(71,201,212,.7)"; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = "white"; ctx.font = "700 8px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(player.name, 0, 37.5);
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    for (let i = ball.trail.length - 1; i >= 0; i -= 1) { const point = ball.trail[i]; ctx.globalAlpha = (1 - i / ball.trail.length) * .08; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(point.x, point.y, ball.radius * (1 - i / 12), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.beginPath(); ctx.ellipse(ball.x + 5, ball.y + 9, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    const ballShade = ctx.createRadialGradient(-3, -4, 1, 0, 0, ball.radius + 2); ballShade.addColorStop(0, "#fff"); ballShade.addColorStop(.65, "#eef2ef"); ballShade.addColorStop(1, "#87908b");
    ctx.fillStyle = ballShade; ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#17201d"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#17201d"; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i += 1) { const angle = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(angle) * 6, Math.sin(angle) * 6, 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawEffects() {
    for (const player of players) {
      if ((player.anim === "shoot" || player.anim === "pass") && player.animTime > 0) {
        const progress = 1 - player.animTime / player.animDuration; const wave = Math.sin(progress * Math.PI);
        if (wave > .62) {
          const fx = player.x + player.dirX * 27; const fy = player.y + player.dirY * 27;
          ctx.strokeStyle = `rgba(255,240,180,${(wave - .62) * 1.8})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 8 + wave * 8, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (!player.sprinting || Math.hypot(player.vx, player.vy) < 220) continue;
      const direction = normalize(player.vx, player.vy); const alpha = clamp((Math.hypot(player.vx, player.vy) - 190) / 150, 0, .34);
      ctx.save(); ctx.strokeStyle = player.team === HOME ? `rgba(255,220,120,${alpha})` : `rgba(115,235,245,${alpha})`; ctx.lineWidth = 2; ctx.lineCap = "round";
      for (let i = 0; i < 3; i += 1) {
        const side = (i - 1) * 9; const sideX = -direction.y * side; const sideY = direction.x * side; const length = 18 + i * 6;
        ctx.beginPath(); ctx.moveTo(player.x - direction.x * 15 + sideX, player.y - direction.y * 15 + sideY); ctx.lineTo(player.x - direction.x * (15 + length) + sideX, player.y - direction.y * (15 + length) + sideY); ctx.stroke();
      }
      ctx.restore();
    }
    for (const particle of game.particles) { ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); }
    ctx.globalAlpha = 1;
    if (input.shootStart && ball.owner === game.selected) {
      const x = game.selected.x; const y = game.selected.y - 44; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - 31, y, 62, 8);
      const grad = ctx.createLinearGradient(x - 30, 0, x + 30, 0); grad.addColorStop(0, "#e1bb58"); grad.addColorStop(1, input.shootCharge > .82 ? "#ff5b45" : "#ffdc78");
      ctx.fillStyle = grad; ctx.fillRect(x - 30, y + 1, 60 * input.shootCharge, 6);
    }
  }

  function drawScreenEffects() {
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H * .78);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(.76, "rgba(0,0,0,.04)"); vignette.addColorStop(1, "rgba(0,0,0,.43)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    const topLight = ctx.createLinearGradient(0, 0, 0, 135); topLight.addColorStop(0, "rgba(210,255,233,.08)"); topLight.addColorStop(1, "rgba(210,255,233,0)"); ctx.fillStyle = topLight; ctx.fillRect(0, 0, W, 135);
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255,225,126,${game.flash * .16})`; ctx.fillRect(0,0,W,H); ctx.shadowColor = "#e1bb58"; ctx.shadowBlur = 28;
      ctx.fillStyle = `rgba(255,255,255,${game.flash})`; ctx.font = "800 104px Barlow Condensed"; ctx.textAlign = "center"; ctx.fillText("GOAL!", W/2, 150); ctx.shadowBlur = 0;
    }
  }

  function render(now) {
    if (use3D) render3D(now); else renderFallback2D(now);
  }

  function drawRadar() {
    const rw = radar.width; const rh = radar.height; rctx.clearRect(0,0,rw,rh); rctx.fillStyle = "#073522"; rctx.fillRect(0,0,rw,rh);
    rctx.strokeStyle = "rgba(255,255,255,.42)"; rctx.lineWidth = 1; rctx.strokeRect(5,5,rw-10,rh-10); rctx.beginPath(); rctx.moveTo(rw/2,5); rctx.lineTo(rw/2,rh-5); rctx.stroke();
    for (const player of players) { rctx.fillStyle = player.team === HOME ? "#e1bb58" : "#47c9d4"; rctx.beginPath(); rctx.arc(player.x/W*rw,player.y/H*rh,player===game.selected?4:2.7,0,Math.PI*2); rctx.fill(); }
    rctx.fillStyle = "white"; rctx.beginPath(); rctx.arc(ball.x/W*rw,ball.y/H*rh,2.2,0,Math.PI*2); rctx.fill();
  }

  function updateUI(scoringTeam = null) {
    const elapsed = MATCH_SECONDS - game.time; const matchMinute = Math.min(90, Math.floor(elapsed / MATCH_SECONDS * 90)); const seconds = Math.floor((elapsed / MATCH_SECONDS * 90 - matchMinute) * 60);
    ui.gameClock.textContent = `${String(matchMinute).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
    ui.homeScore.textContent = game.score[HOME]; ui.awayScore.textContent = game.score[AWAY];
    const player = game.selected; if (player) {
      ui.playerName.textContent = player.name; ui.playerNumber.textContent = player.number; ui.playerRating.textContent = player.rating;
      ui.staminaBar.style.width = `${player.stamina}%`; ui.staminaText.textContent = `${Math.round(player.stamina)}%`;
      ui.staminaBar.style.background = player.stamina < 25 ? "#e95e4e" : "linear-gradient(90deg,#b78a2f,#ffdc78)";
    }
    const totalPossession = game.stats.possession[0] + game.stats.possession[1]; const homePossession = totalPossession ? Math.round(game.stats.possession[0] / totalPossession * 100) : 50;
    ui.possessionStat.textContent = `${homePossession}%`; ui.possessionBar.style.width = `${homePossession}%`;
    ui.homeShots.textContent = game.stats.shots[HOME]; ui.awayShots.textContent = game.stats.shots[AWAY];
    ui.passStat.textContent = `${game.stats.passes ? Math.round(game.stats.completed / game.stats.passes * 100) : 0}%`;
    if (scoringTeam !== null) {
      const score = scoringTeam === HOME ? ui.homeScore : ui.awayScore;
      score.classList.add("score-pop"); setTimeout(() => score.classList.remove("score-pop"), 420);
    }
  }

  function announce(message) { ui.commentary.textContent = message; game.messageTimer = 3; }

  function cycleCamera() {
    const modes = ["broadcast", "close", "tactical"]; const labels = { broadcast: "BROADCAST", close: "CLOSE ACTION", tactical: "TACTICAL" };
    game.cameraMode = modes[(modes.indexOf(game.cameraMode) + 1) % modes.length]; game.cameraNotice = 1.6;
    ui.replayBadge.textContent = `CAMERA · ${labels[game.cameraMode]}`; ui.replayBadge.classList.add("show"); tone(460,.04,"sine",.018);
  }

  function cycleWeather() {
    game.weather=game.weather==="rain"?"clear":"rain";game.cameraNotice=1.8;ui.replayBadge.textContent=game.weather==="rain"?"WEATHER · RAIN":"WEATHER · CLEAR";ui.replayBadge.classList.add("show");announce(game.weather==="rain"?"Mưa bắt đầu — mặt sân đang trơn hơn!":"Trời quang — tốc độ trận đấu trở lại tối đa.");tone(game.weather==="rain"?330:560,.06,"sine",.02);
  }

  let audioContext = null;
  function ensureAudio() { if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
  function tone(frequency, duration, type = "sine", volume = .04, delay = 0) {
    if (!game.sound) return; ensureAudio(); const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
    osc.type = type; osc.frequency.value = frequency; gain.gain.setValueAtTime(volume, audioContext.currentTime + delay); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + delay + duration);
    osc.connect(gain).connect(audioContext.destination); osc.start(audioContext.currentTime + delay); osc.stop(audioContext.currentTime + delay + duration);
  }
  function kickSound(power) { tone(110 + power * 90, .08, "triangle", .035 + power * .025); }
  function whistle(long = false) { tone(1450, long ? .5 : .25, "sine", .03); tone(1750, long ? .42 : .18, "sine", .02, .08); }
  function goalSound() { [392,523,659,784].forEach((note,index) => tone(note,.42,"square",.025,index*.09)); }

  function loop(now) {
    const dt = Math.min(.033, (now - game.lastTime) / 1000 || .016); game.lastTime = now; update(dt); render(now);
    if (game.messageTimer > 0) game.messageTimer -= dt;
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI(); requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
    if (event.repeat && ["KeyS","KeyW","KeyD","KeyA","KeyC","KeyV","Escape"].includes(event.code)) return;
    input.keys.add(event.code);
    if (event.code === "Escape") togglePause();
    if (game.state !== "playing") return;
    if (event.code === "KeyS" && isAttacking()) passBall(game.selected);
    if (event.code === "KeyW") { if(isAttacking())throughBall(game.selected);else switchPlayer(); }
    if (event.code === "KeyD") { if(isAttacking()&&ball.owner===game.selected){input.shootStart=performance.now();input.shootCharge=0;}else if(!isAttacking())tackle(game.selected); }
    if (event.code === "KeyA") { if(isAttacking())loftBall(game.selected);else slideTackle(game.selected); }
    if (event.code === "KeyC") cycleCamera();
    if (event.code === "KeyV") cycleWeather();
  }
  function onKeyUp(event) {
    input.keys.delete(event.code);
    if (event.code === "KeyD" && input.shootStart) { if(ball.owner===game.selected)shootBall(game.selected,input.shootCharge);input.shootStart=0;input.shootCharge=0; }
  }

  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-difficulty]").forEach((item) => item.classList.remove("active")); button.classList.add("active");
    game.difficulty = button.dataset.difficulty; game.ai = { rookie: .78, pro: 1, legend: 1.18 }[game.difficulty]; tone(620,.05,"sine",.025);
  }));
  $("playButton").addEventListener("click", startMatch);
  $("pauseButton").addEventListener("click", () => togglePause());
  $("resumeButton").addEventListener("click", () => togglePause(false));
  $("restartButton").addEventListener("click", startMatch);
  $("playAgainButton").addEventListener("click", startMatch);
  $("soundButton").addEventListener("click", () => { game.sound = !game.sound; $("soundButton").textContent = game.sound ? "♪" : "×"; if(game.sound) tone(600,.08); });
  window.addEventListener("keydown", onKeyDown, { passive: false }); window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { input.keys.clear(); input.marking=false; input.shootStart=0; input.shootCharge=0; if(game.state === "playing") togglePause(true); });
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  init3D(); createTeams(); updateUI(); requestAnimationFrame(loop);
})();
