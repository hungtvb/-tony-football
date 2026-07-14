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
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";
import { gameplayConfig } from "./src/game/config/gameplayConfig.js";
import { createGameFeelController } from "./src/game/presentation/GameFeelController.js";
import { createBallTrail3D } from "./src/game/presentation/BallTrail3D.js";
import { createAudioFeedbackController } from "./src/game/presentation/AudioFeedbackController.js";
import { createContextualParticlePolicy } from "./src/game/presentation/ContextualParticlePolicy.js";

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
  let renderer3D; let composer3D; let scene3D; let camera3D; let ballView; let ballTrailView; let particleView; let chargeView; let screenFx; let ctx; let use3D = true; let crowdView; let pitchView; let grassView; let rainView;let hemisphereLight;let floodLight;let rimLight;
  let playerAsset = null;
  const ledViews = []; const goalNetViews = [];const stadiumLightViews=[];
  const lowPowerDevice = matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const cameraTarget = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  const wetPitchColor = new THREE.Color(0xb7d8c8); const dryPitchColor = new THREE.Color(0xffffff);

  const PITCH_STYLES = {
    classic:{top:"#0b7547",mid:"#087044",bottom:"#075d39",outside:"#07100d",grass:0x15915b,tint:0xffffff,wet:0xb7d8c8},
    elite:{top:"#11915b",mid:"#0b8351",bottom:"#086b43",outside:"#07140f",grass:0x20a869,tint:0xf2fff8,wet:0xa8d8c4},
    dry:{top:"#8b9c4d",mid:"#74883e",bottom:"#637537",outside:"#16170d",grass:0x879d4c,tint:0xfff1cc,wet:0xb8c39a},
    midnight:{top:"#075943",mid:"#064b38",bottom:"#043d2e",outside:"#030c09",grass:0x08795a,tint:0xc4e9dc,wet:0x86b8a9}
  };
  const BALL_STYLES = {
    classic:{base:0xf3f4ef,patch:0x17201d,stroke:"#59635e"},
    volt:{base:0xdff44a,patch:0x172019,stroke:"#5b681b"},
    crimson:{base:0xf2f3f1,patch:0xc92832,stroke:"#7c3439"}
  };
  const WEATHER_STYLES={clear:true,rain:true};

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
    replayBadge: $("replayBadge"),controlsMode:$("controlsMode"),controlsCard:$("controlsCard"),assetStatus:$("assetStatus")
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
    goalSequence: null, goalScorer: null, weather:loadPreference("tfWeather","clear",WEATHER_STYLES),pitchStyle:loadPreference("tfPitch","classic",PITCH_STYLES),ballStyle:loadPreference("tfBall","classic",BALL_STYLES)
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gameFeel = createGameFeelController({ lowPowerDevice, reducedMotion });
  const audioFeedback = createAudioFeedbackController();
  const contextualParticles = createContextualParticlePolicy({ lowPowerDevice, reducedMotion });
  let players = [];
  const FO4_CONTROLS = Object.freeze({
    sprint:"KeyE", shortPass:"KeyS", throughBall:"KeyW", shoot:"KeyD", loftPass:"KeyA",
    teammateRun:"KeyQ", finesse:"KeyZ", shield:"KeyC", tackle:"Space", camera:"KeyB"
  });
  const input = {
    keys: new Set(), moveX: 0, moveY: 0, magnitude: 0, aimX: 1, aimY: 0,
    actionCode: null, actionStart: 0, actionCharge: 0, actionModifiers: null,
    bufferedAction: null, lastMode: "defense", qTapStart: 0, qConsumed: false
  };

  function loadPreference(key,fallback,options){try{const value=localStorage.getItem(key);return options[value]?value:fallback;}catch{return fallback;}}
  function savePreference(key,value){try{localStorage.setItem(key,value);}catch{}}

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
    game.selected = team === HOME ? taker : closestPlayer(HOME, ball, false);input.lastMode=team===HOME?"attack":"defense";input.bufferedAction=null;
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

  function isAttacking() { return controlMode() === "attack"; }

  function controlMode() {
    if (ball.owner) input.lastMode = ball.owner.team === HOME ? "attack" : "defense";
    return input.lastMode;
  }

  function switchPlayer() {
    if (ball.owner?.team === HOME) { game.selected = ball.owner; return; }
    const target=ball.owner?.team===AWAY?ball.owner:{x:ball.x+ball.vx*.2,y:ball.y+ball.vy*.2};
    const candidates=players.filter((player)=>player.team===HOME&&player.role!=="GK"&&player!==game.selected).map((player)=>{const toTarget=normalize(target.x-player.x,target.y-player.y);const intent=input.magnitude>.12?toTarget.x*input.aimX+toTarget.y*input.aimY:0;const rolePenalty=player.role==="FW"&&target.x<W*.52?35:0;return{player,score:distance(player,target)-intent*55+rolePenalty};}).sort((a,b)=>a.score-b.score);
    game.selected=candidates[0]?.player||closestPlayer(HOME,target,false);
    tone(520, .035, "sine", .025);
  }

  function switchPlayerInDirection(code) {
    if (controlMode() === "attack") return;const directions={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};const direction=directions[code];if(!direction)return;
    const candidates=players.filter((player)=>player.team===HOME&&player.role!=="GK"&&player!==game.selected).map((player)=>{
      const dx=player.x-game.selected.x;const dy=player.y-game.selected.y;const d=length(dx,dy);const alignment=dx/d*direction.x+dy/d*direction.y;
      return{player,score:alignment*360-d*.22-distance(player,ball)*.06};
    }).sort((a,b)=>b.score-a.score);
    if(candidates[0]?.score>20){game.selected=candidates[0].player;tone(610,.035,"sine",.025);}
  }

  function setOwner(player) {
    if (ball.pendingPass && player.team === ball.pendingPass.team) {
      if (player.team === HOME) game.stats.completed += 1;
      ball.pendingPass = null;
    } else if (ball.pendingPass && player.team !== ball.pendingPass.team) ball.pendingPass = null;
    ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;ball.height=0;ball.vz=0;ball.curve=0;player.controlBoost=.28;
    triggerAnimation(player, "receive", .2);
    if (player.team === HOME && player.role !== "GK") game.selected = player;
    if(player===game.selected&&input.bufferedAction&&performance.now()<=input.bufferedAction.expires){const buffered=input.bufferedAction;input.bufferedAction=null;executeAttackAction(buffered.code,buffered.charge,buffered.modifiers);}
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

  function passBall(player, charge=.35, oneTwo=false) {
    if (ball.owner !== player) return;
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
    const d = distance(player, target); const power=lerp(.82,1.16,clamp(charge,.08,1));releaseBall(player, leadX - player.x, leadY - player.y, clamp((430 + d * .35)*power, 440, 760), "pass");
    if(oneTwo){const runDirection=normalize((player.team===HOME?1:-1)*.9+input.aimX*.45,input.aimY*.55);player.vx=runDirection.x*225;player.vy=runDirection.y*225;player.controlBoost=.7;announce(`${player.name} bật tường và băng lên!`);}
    if (player.team === HOME) game.stats.passes += 1;
    ball.pendingPass = { team: player.team, timer: 1.8 }; announce(oneTwo?`${player.name} bật tường và băng lên!`:`${player.name} chuyền bóng!`);
  }

  function throughBall(player, charge=.45, chipped=false) {
    if (ball.owner !== player) return;
    const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const aligned=dx/d*facing.x+dy/d*facing.y;const progress=dx*attackDirection;const score=aligned*310+progress*.42-d*.12;if(score>best){best=score;target=candidate;}}
    if(!target)return;const runX=target.vx*.58+attackDirection*58;const runY=target.vy*.58;const d=distance(player,target);const power=lerp(.84,1.18,clamp(charge,.08,1));releaseBall(player,target.x+runX-player.x,target.y+runY-player.y,clamp((540+d*.42)*power,540,900),chipped?"loft":"pass");if(chipped){ball.vz=8.6+charge*4.2;ball.height=.12;}
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.1};announce(`${player.name} chọc khe vào khoảng trống!`);
  }

  function loftBall(player, charge=.45) {
    if(ball.owner!==player)return;const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const wide=Math.abs(dy);const aligned=dx/d*facing.x+dy/d*facing.y;const score=aligned*240+dx*attackDirection*.25+wide*.12-d*.08;if(score>best){best=score;target=candidate;}}
    if(!target)return;const power=lerp(.82,1.18,clamp(charge,.08,1));releaseBall(player,target.x+target.vx*.32-player.x,target.y+target.vy*.32-player.y,clamp((610+distance(player,target)*.3)*power,580,940),"loft");ball.vz*=lerp(.82,1.14,charge);
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.2};announce(`${player.name} tạt bóng!`);
  }

  function shootBall(player, charge = .5, style="power") {
    if (ball.owner !== player) return;
    const targetX = player.team === HOME ? FIELD.right + 45 : FIELD.left - 45;
    const keeper = players.find((p) => p.team !== player.team && p.role === "GK");
    const openY = keeper.y < H / 2 ? FIELD.goalBottom - 34 : FIELD.goalTop + 34;
    const userAim=player===game.selected&&player.team===HOME&&input.magnitude>.12;const directedY=userAim?H/2+input.aimY*145:player.y+player.dirY*120;
    const aimY = clamp(lerp(openY,directedY,userAim ? .62 : .28)+(Math.random()-.5)*(userAim?16:34/game.ai),FIELD.goalTop+22,FIELD.goalBottom-22);
    const power = clamp(charge, .15, 1); releaseBall(player, targetX - player.x, aimY - player.y, style==="chip"?500+power*220:style==="finesse"?570+power*300:620+power*430, "shot");
    if(style==="chip"){ball.vz=10.5+power*4.5;ball.curve=0;}else if(style==="finesse"){ball.curve=clamp((aimY-H/2)/105,-1.65,1.65);ball.vz=2.6;}
    game.stats.shots[player.team] += 1; spawnContextParticles(player.x+player.dirX*18,player.y+player.dirY*18,.55+power*1.2); const shotImpulse=gameFeel.shotImpulse(power); if(shotImpulse>0){gameFeel.addImpulse(shotImpulse,game.stats.shots[HOME]+game.stats.shots[AWAY]);game.flash=Math.max(game.flash,shotImpulse*.5);} announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);
  }

  function tackle(player) {
    if (player.cooldown > 0) return;
    const opponent = ball.owner && ball.owner.team !== player.team ? ball.owner : closestPlayer(player.team === HOME ? AWAY : HOME, player);
    if (!opponent || distance(player, opponent) > 48) return;
    player.cooldown = .7; triggerAnimation(player, "tackle", .38); const chance = .48 + (player.rating - opponent.rating) * .012;
    spawnContextParticles(player.x+player.dirX*14,player.y+player.dirY*14,.8);
    if (ball.owner === opponent && Math.random() < chance) {
      ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;
      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; gameFeel.addImpulse(gameFeel.config.feedback.tackleImpulse,player.index+game.stats.shots[0]*13); announce(`${player.name} đoạt bóng!`); kickSound(.3);
    }
  }

  function slideTackle(player) {
    if(player.cooldown>0)return;const previous=player.cooldown;tackle(player);if(player.cooldown===previous)return;
    player.cooldown=1.05;player.vx+=player.dirX*105;player.vy+=player.dirY*105;triggerAnimation(player,"tackle",.52,1);announce(`${player.name} soạc bóng!`);
  }

  function triggerTeammateRun() {
    if(ball.owner!==game.selected)return;const owner=game.selected;const direction=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:1,y:0};
    const runner=players.filter((player)=>player.team===HOME&&player!==owner&&player.role!=="GK").map((player)=>{const dx=player.x-owner.x;const dy=player.y-owner.y;const d=length(dx,dy);return{player,score:dx/d*direction.x+dy/d*direction.y-d/1200};}).sort((a,b)=>b.score-a.score)[0]?.player;
    if(!runner)return;runner.vx=lerp(runner.vx,direction.x*220,.72);runner.vy=lerp(runner.vy,direction.y*220,.72);runner.controlBoost=.75;announce(`${runner.name} bắt đầu chạy chỗ!`);
  }

  function beginAttackAction(code) {
    if(input.actionStart)return;const q=input.keys.has(FO4_CONTROLS.teammateRun);if(q)input.qConsumed=true;input.actionCode=code;input.actionStart=performance.now();input.actionCharge=0;input.actionModifiers={q,z:input.keys.has(FO4_CONTROLS.finesse)};
  }

  function executeAttackAction(code,charge,modifiers={}) {
    const player=game.selected;if(ball.owner!==player){input.bufferedAction={code,charge,modifiers,expires:performance.now()+280};return;}
    if(code===FO4_CONTROLS.shortPass)passBall(player,charge,modifiers.q);
    else if(code===FO4_CONTROLS.throughBall)throughBall(player,charge,modifiers.q);
    else if(code===FO4_CONTROLS.loftPass)loftBall(player,charge);
    else if(code===FO4_CONTROLS.shoot)shootBall(player,charge,modifiers.q?"chip":modifiers.z?"finesse":"power");
  }

  function finishAttackAction(code) {
    if(input.actionCode!==code||!input.actionStart)return;const charge=Math.max(.08,input.actionCharge);const modifiers=input.actionModifiers||{};input.actionCode=null;input.actionStart=0;input.actionCharge=0;input.actionModifiers=null;executeAttackAction(code,charge,modifiers);
  }

  function updateInput() {
    let x = 0; let y = 0;
    if (input.keys.has("ArrowLeft")) x -= 1;
    if (input.keys.has("ArrowRight")) x += 1;
    if (input.keys.has("ArrowUp")) y -= 1;
    if (input.keys.has("ArrowDown")) y += 1;
    const raw=Math.hypot(x,y);
    if(raw<.1){input.moveX=0;input.moveY=0;input.magnitude=0;}else{const direction=normalize(x,y);input.moveX=direction.x;input.moveY=direction.y;input.magnitude=1;input.aimX=direction.x;input.aimY=direction.y;}
    if (input.actionStart) input.actionCharge = clamp((performance.now() - input.actionStart) / 900, 0, 1);
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
    const attacking=isAttacking();const sprinting=input.keys.has(FO4_CONTROLS.sprint);
    const precision=input.keys.has(FO4_CONTROLS.shield);const marking=!attacking&&input.keys.has(FO4_CONTROLS.shoot);let controlX=input.aimX;let controlY=input.aimY;let controlMagnitude=input.magnitude;let markTarget=null;
    if(marking){markTarget=ball.owner?.team===AWAY?ball.owner:closestPlayer(AWAY,ball,false);if(markTarget){const dx=markTarget.x-player.x;const dy=markTarget.y-player.y;const d=Math.hypot(dx,dy);const toward=normalize(dx,dy);if(d>46){const mixed=normalize(toward.x+input.moveX*.65,toward.y+input.moveY*.65);controlX=mixed.x;controlY=mixed.y;controlMagnitude=clamp(.58+(d-46)/150,0,1);}else if(input.magnitude>.08){controlX=input.aimX;controlY=input.aimY;controlMagnitude=input.magnitude*.62;}else controlMagnitude=0;}}
    const hasMove=controlMagnitude>.03;
    if(precision&&!attacking){markTarget=ball.owner?.team===AWAY?ball.owner:closestPlayer(AWAY,ball,false);if(markTarget){const face=normalize(markTarget.x-player.x,markTarget.y-player.y);player.dirX=lerp(player.dirX,face.x,1-Math.exp(-dt*20));player.dirY=lerp(player.dirY,face.y,1-Math.exp(-dt*20));}}
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
      if(team===HOME&&controlMode()==="defense"&&input.keys.has(FO4_CONTROLS.throughBall)){moveToward(player,ball.x,ball.y,aiSpeed*1.34,dt);return;}
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

    const pressSupport=team===HOME?players.filter((candidate)=>candidate.team===HOME&&candidate.role!=="GK"&&candidate!==game.selected).sort((a,b)=>distance(a,ball)-distance(b,ball))[0]:null;
    const teammatePress=team===HOME&&controlMode()==="defense"&&input.keys.has(FO4_CONTROLS.teammateRun)&&player===pressSupport;
    const shouldChase = (teamChaser === player||teammatePress) && (!ball.owner || ball.owner.team !== team);
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

    const visualSpeed=Math.hypot(ball.vx,ball.vy);const trailLimit=gameFeel.trailPointCount(visualSpeed);ball.trail.unshift({ x: ball.x, y: ball.y, height:ball.height }); while(ball.trail.length>trailLimit)ball.trail.pop();
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
    game.score[team] += 1; game.flash = 1; game.shake = 18; gameFeel.addImpulse(gameFeel.config.feedback.goalImpulse,game.score[0]*31+game.score[1]*47); ball.owner = null; game.goalScorer = scorer; goalSound();
    game.replay.frames = [...game.replay.buffer, captureReplayFrame()]; game.replay.active = game.replay.frames.length > 8; game.replay.elapsed = 0;
    game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: reducedMotion ? 3.15 : 3.65 };
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

  function updateCamera(dt) {
    const camera = game.camera;
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    camera.targetZoom = game.state === "playing" ? clamp(1.025 + ballSpeed / 9000, 1.025, 1.075) : 1;
    const follow = game.state === "playing" ? .085 : 0;
    const desiredX = lerp(W / 2, ball.x, follow);
    const desiredY = lerp(H / 2, ball.y, follow);
    const ease = gameFeel.cameraEase(dt,game.replay.active);
    camera.x = lerp(camera.x, desiredX, ease);
    camera.y = lerp(camera.y, desiredY, ease);
    camera.zoom = lerp(camera.zoom, camera.targetZoom, 1 - Math.exp(-dt * 2.8));
    const halfW = W / (camera.zoom * 2); const halfH = H / (camera.zoom * 2);
    camera.x = clamp(camera.x, halfW, W - halfW); camera.y = clamp(camera.y, halfH, H - halfH);
  }

  function update(dt) {
    updateInput(); updateParticles(dt); updateCamera(dt); updateReplay(dt); gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);
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
      use3D = false; ctx = canvas.getContext("2d");setAssetStatus("warning","WEBGL · 2D FALLBACK",error?.message||"WebGL renderer unavailable");ui.commentary.textContent = "WebGL không khả dụng · Đang chạy chế độ tương thích 2D"; return false;
    }
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1.1 : 2));
    renderer3D.setSize(W, H, false); renderer3D.shadowMap.enabled = !lowPowerDevice; renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer3D.outputColorSpace = THREE.SRGBColorSpace; renderer3D.toneMapping = THREE.ACESFilmicToneMapping; renderer3D.toneMappingExposure = 1.12;

    scene3D = new THREE.Scene(); scene3D.background = new THREE.Color(0x050a09); scene3D.fog = new THREE.FogExp2(0x07110e, .011);
    camera3D = new THREE.PerspectiveCamera(lowPowerDevice?43:39, W / H, .1, 260); camera3D.position.set(0, lowPowerDevice?54:45, lowPowerDevice?63:52); camera3D.lookAt(0, 0, 0);
    if(!lowPowerDevice){const pmrem=new THREE.PMREMGenerator(renderer3D);const environment=new RoomEnvironment();scene3D.environment=pmrem.fromScene(environment,.04).texture;scene3D.environmentIntensity=.62;environment.dispose();pmrem.dispose();}

    hemisphereLight = new THREE.HemisphereLight(0xcfffe7, 0x06120d, 1.45); scene3D.add(hemisphereLight);
    floodLight = new THREE.DirectionalLight(0xffffff, 3.4); floodLight.position.set(-28, 62, 30); floodLight.castShadow = true;
    floodLight.shadow.mapSize.set(lowPowerDevice ? 512 : 2048, lowPowerDevice ? 512 : 2048); floodLight.shadow.camera.left = -72; floodLight.shadow.camera.right = 72; floodLight.shadow.camera.top = 50; floodLight.shadow.camera.bottom = -50;
    floodLight.shadow.bias = -.00035; scene3D.add(floodLight);
    rimLight = new THREE.DirectionalLight(0x70dcff, 1.4); rimLight.position.set(48, 25, -35); scene3D.add(rimLight);

    createPitch3D(); createGrass3D(); createStadium3D(); createGoals3D(); createAtmosphere3D(); createBall3D(); ballTrailView=createBallTrail3D(THREE,{maxPoints:gameFeel.config.ball.trailMaxPoints});scene3D.add(ballTrailView.line); createParticleView(); createChargeView();applyStadiumLighting();
    if(!lowPowerDevice){composer3D=new EffectComposer(renderer3D);composer3D.setPixelRatio(Math.min(window.devicePixelRatio||1,2));composer3D.setSize(W,H);composer3D.addPass(new RenderPass(scene3D,camera3D));const ssao=new SSAOPass(scene3D,camera3D,W,H,24);ssao.kernelRadius=10;ssao.minDistance=.002;ssao.maxDistance=.12;composer3D.addPass(ssao);const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.16,.48,.88);composer3D.addPass(bloom);composer3D.addPass(new SMAAPass(W*(window.devicePixelRatio||1),H*(window.devicePixelRatio||1)));composer3D.addPass(new OutputPass());}
    screenFx = document.createElement("div"); screenFx.className = "screen-fx"; screenFx.innerHTML = "<span>GOAL!</span>";
    canvas.parentElement.appendChild(screenFx);
    loadPlayerAsset();
    return true;
  }

  function setAssetStatus(state,label,detail="") {
    window.__playerAssetStatus={state,label,detail,updatedAt:new Date().toISOString()};if(!ui.assetStatus)return;ui.assetStatus.className=`asset-status ${state}`;ui.assetStatus.textContent=label;ui.assetStatus.title=detail;
  }

  async function loadGLBWithRetry(loader,url,label) {
    let lastError;for(let attempt=0;attempt<2;attempt+=1){const source=attempt===0?url:`${url}${url.includes("?")?"&":"?"}retry=1`;try{return await Promise.race([loader.loadAsync(source),new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timeout after 10s`)),10000))]);}catch(error){lastError=error;console.warn(`[PlayerAsset] ${label} attempt ${attempt+1} failed`,error);}}
    throw lastError||new Error(`${label} failed`);
  }

  function installPlayerAnimations(animations) {
    if(!playerAsset||!animations.length)return;playerAsset.animations=animations;for(const view of playerViews.values()){const rig=view.rig;if(!rig)continue;rig.actions={};for(const clip of animations)rig.actions[clip.name]=rig.mixer.clipAction(clip,rig.model);rig.state="";rig.active=null;switchRigAnimation(view,"Idle_Loop",true);}
  }

  async function loadPlayerAsset() {
    const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);setAssetStatus("loading","MODEL · LOADING","Đang tải football-character-v2.glb");
    try{
      const character=await loadGLBWithRetry(loader,"assets/models/football-character-v2.glb?v=16.0.0","character");playerAsset={scene:character.scene,animations:[]};players.forEach(upgradePlayerView);setAssetStatus("ready","MODEL · READY","Character đã tải; animation đang tải nền");ui.commentary.textContent="PLAYER MODEL 19.0 ONLINE · LOADING MOTION";
    }catch(error){console.error("[PlayerAsset] Character failed; procedural fallback remains active",error);setAssetStatus("error","MODEL · FALLBACK",error?.message||String(error));ui.commentary.textContent="Không tải được model 3D · Đang dùng cầu thủ procedural";return;}
    try{
      const motion=await loadGLBWithRetry(loader,"assets/models/football-animations-v2.glb?v=16.0.0","animations");installPlayerAnimations(motion.animations||[]);setAssetStatus("ready","PLAYER RIG · READY",`${motion.animations?.length||0} animation clips`);ui.commentary.textContent=`PLAYER RIG 19.0 ONLINE · ${motion.animations?.length||0} CLIPS`;
    }catch(error){console.error("[PlayerAsset] Animation failed; static model remains active",error);setAssetStatus("warning","MODEL READY · BASIC MOTION",error?.message||String(error));ui.commentary.textContent="Model 3D đã tải · Animation fallback đang hoạt động";}
  }

  function createPitchTexture3D() {
    const theme=PITCH_STYLES[game.pitchStyle]||PITCH_STYLES.classic;
    const textureCanvas = document.createElement("canvas"); textureCanvas.width = W; textureCanvas.height = H;
    const paint = textureCanvas.getContext("2d"); paint.fillStyle = theme.outside; paint.fillRect(0, 0, W, H);
    const grass = paint.createLinearGradient(0, FIELD.top, 0, FIELD.bottom); grass.addColorStop(0, theme.top); grass.addColorStop(.5, theme.mid); grass.addColorStop(1, theme.bottom);
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
    const theme=PITCH_STYLES[game.pitchStyle]||PITCH_STYLES.classic;dryPitchColor.set(theme.tint);wetPitchColor.set(theme.wet);
    pitchView = new THREE.Mesh(new THREE.PlaneGeometry(W * WORLD_SCALE, H * WORLD_SCALE), new THREE.MeshStandardMaterial({ map: createPitchTexture3D(), roughness: .94, metalness: 0 }));
    pitchView.rotation.x = -Math.PI / 2; pitchView.receiveShadow = true; scene3D.add(pitchView);
    const base = new THREE.Mesh(new THREE.BoxGeometry(124, 1.2, 74), new THREE.MeshStandardMaterial({ color: 0x06130e, roughness: 1 })); base.position.y = -.7; base.receiveShadow = true; scene3D.add(base);
    createPitchDetails3D();
  }

  function createPitchDetails3D() {
    const poleMaterial=new THREE.MeshStandardMaterial({color:0xe9efec,metalness:.62,roughness:.32});const flagColors=[0xe1bb58,0x47c9d4,0x47c9d4,0xe1bb58];const corners=[[-55.2,-30.8],[-55.2,30.8],[55.2,-30.8],[55.2,30.8]];
    corners.forEach(([x,z],index)=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.65,8),poleMaterial);pole.position.set(x,.82,z);pole.castShadow=true;scene3D.add(pole);const flag=new THREE.Mesh(new THREE.PlaneGeometry(.72,.45),new THREE.MeshStandardMaterial({color:flagColors[index],side:THREE.DoubleSide,roughness:.55}));flag.position.set(x+(x<0?.36:-.36),1.42,z);flag.rotation.y=x<0?0:Math.PI;scene3D.add(flag);});
    const canopyMaterial=new THREE.MeshPhysicalMaterial({color:0x8fb9ad,transparent:true,opacity:.2,roughness:.22,metalness:.25,side:THREE.DoubleSide});const seatMaterial=new THREE.MeshStandardMaterial({color:0x1b2927,roughness:.75});
    for(const side of [-1,1]){const group=new THREE.Group();const canopy=new THREE.Mesh(new THREE.BoxGeometry(15,.12,3.4),canopyMaterial);canopy.position.y=2.15;canopy.rotation.x=side*.2;group.add(canopy);for(let i=-3;i<=3;i+=1){const seat=new THREE.Mesh(new THREE.BoxGeometry(1.15,.65,.82),seatMaterial);seat.position.set(i*1.65,.45,0);group.add(seat);}group.position.set(0,0,side*35.1);scene3D.add(group);}
  }

  function createGrass3D() {
    const theme=PITCH_STYLES[game.pitchStyle]||PITCH_STYLES.classic;const count=lowPowerDevice?220:1800; const bladeGeometry=new THREE.PlaneGeometry(.055,.42); bladeGeometry.translate(0,.21,0); const bladeMaterial=new THREE.MeshStandardMaterial({color:theme.grass,roughness:.88,side:THREE.DoubleSide}); grassView=new THREE.InstancedMesh(bladeGeometry,bladeMaterial,count); const dummy=new THREE.Object3D();
    for(let i=0;i<count;i+=1){dummy.position.set(worldX(FIELD.left+seededNoise(i*2.13)*(FIELD.right-FIELD.left)),.015,worldZ(FIELD.top+seededNoise(i*5.71+3)*(FIELD.bottom-FIELD.top)));dummy.rotation.y=seededNoise(i*9.37)*Math.PI;const size=.65+seededNoise(i*4.43)*.7;dummy.scale.set(size,size,size);dummy.updateMatrix();grassView.setMatrixAt(i,dummy.matrix);} grassView.receiveShadow=true;grassView.frustumCulled=false;scene3D.add(grassView);
  }

  function createAtmosphere3D() {
    const drops=lowPowerDevice?180:820;const positions=new Float32Array(drops*2*3);const speeds=new Float32Array(drops);
    for(let i=0;i<drops;i+=1){const x=-67+seededNoise(i*3.17)*134;const y=2+seededNoise(i*7.43)*47;const z=-39+seededNoise(i*11.2)*78;const j=i*6;positions[j]=x;positions[j+1]=y;positions[j+2]=z;positions[j+3]=x-.1;positions[j+4]=y-.9;positions[j+5]=z+.14;speeds[i]=.65+seededNoise(i*13.7)*.85;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));rainView=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xbfe9f2,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending}));rainView.userData.speeds=speeds;scene3D.add(rainView);
  }

  function createStadium3D() {
    const standMaterial=new THREE.MeshStandardMaterial({color:0x111918,roughness:.82,metalness:.12});const tierMaterials=[standMaterial,new THREE.MeshStandardMaterial({color:0x17201f,roughness:.78,metalness:.16}),new THREE.MeshStandardMaterial({color:0x1b2524,roughness:.75,metalness:.18})];
    for(let tier=0;tier<3;tier+=1){const y=1.6+tier*2.3;const longDepth=4.2+tier*1.2;for(const zSide of [-1,1]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(128,2.1,longDepth),tierMaterials[tier]);mesh.position.set(0,y,zSide*(38.2+tier*3.1));mesh.receiveShadow=true;scene3D.add(mesh);}for(const xSide of [-1,1]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(longDepth,2.1,76),tierMaterials[tier]);mesh.position.set(xSide*(64.5+tier*3.1),y,0);mesh.receiveShadow=true;scene3D.add(mesh);}}
    const roofMaterial=new THREE.MeshPhysicalMaterial({color:0x1a2425,roughness:.35,metalness:.62,clearcoat:.35,clearcoatRoughness:.5});const roofPieces=[[0,9.8,-47,136,.5,11],[0,9.8,47,136,.5,11],[-73,9.8,0,10,.5,84],[73,9.8,0,10,.5,84]];for(const [x,y,z,w,h,d] of roofPieces){const roof=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),roofMaterial);roof.position.set(x,y,z);roof.castShadow=true;scene3D.add(roof);}
    if(!lowPowerDevice){const beamMaterial=new THREE.MeshStandardMaterial({color:0x53605d,metalness:.8,roughness:.28});for(let i=-5;i<=5;i+=1){for(const z of [-43,43]){const beam=new THREE.Mesh(new THREE.BoxGeometry(.24,6.5,.24),beamMaterial);beam.position.set(i*11,7,z);scene3D.add(beam);}}for(let i=-2;i<=2;i+=1){for(const x of [-68,68]){const beam=new THREE.Mesh(new THREE.BoxGeometry(.24,6.5,.24),beamMaterial);beam.position.set(x,7,i*14);scene3D.add(beam);}}}
    const tunnel=new THREE.Mesh(new THREE.BoxGeometry(11,4.2,5.5),new THREE.MeshStandardMaterial({color:0x030606,roughness:.94}));tunnel.position.set(0,2.1,39);scene3D.add(tunnel);
    const crowdPositions = []; const crowdColors = [];
    const crowdCount = lowPowerDevice ? 360 : 1900;
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
      const lamp = new THREE.PointLight(0xe8fff5, 20, 70, 2); lamp.position.set(x, 20, z); scene3D.add(lamp);stadiumLightViews.push(lamp);
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

  function createRigSquadNumber(player, color, spine) {
    if (!spine) return [];
    const numberCanvas = document.createElement("canvas"); numberCanvas.width = 128; numberCanvas.height = 128; const paint = numberCanvas.getContext("2d");
    paint.clearRect(0,0,128,128); paint.fillStyle=color; paint.strokeStyle="rgba(0,0,0,.5)"; paint.lineWidth=9; paint.font="800 92px Barlow Condensed"; paint.textAlign="center"; paint.textBaseline="middle"; paint.strokeText(player.number,64,68); paint.fillText(player.number,64,68);
    const texture=new THREE.CanvasTexture(numberCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer3D?.capabilities?.getMaxAnisotropy?.()||1;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false,side:THREE.DoubleSide});
    const front=new THREE.Mesh(new THREE.PlaneGeometry(.205,.25),material);front.position.set(0,.035,.157);front.renderOrder=3;
    const back=new THREE.Mesh(new THREE.PlaneGeometry(.245,.29),material);back.position.set(0,.035,-.157);back.rotation.y=Math.PI;back.renderOrder=3;
    spine.add(front,back);return[front,back];
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

  function shaderColor(value) {
    const color=new THREE.Color(value);return`vec3(${color.r.toFixed(5)},${color.g.toFixed(5)},${color.b.toFixed(5)})`;
  }

  function createIntegratedKitMaterial(source,player,palette,skinColor) {
    const hairColors=[0x231914,0x38241b,0x111413,0x5a351f];const hairColor=hairColors[(player.index+player.team)%hairColors.length];const bootColor=player.index%3===0?0xe64f3f:player.index%3===1?0xe7e9e7:0x141716;const keeper=player.role==="GK";
    const material=source.clone();material.map=null;material.aoMap=null;material.metalnessMap=null;material.roughnessMap=null;material.color.set(0xffffff);material.roughness=.68;material.metalness=0;material.normalScale?.set(.52,.52);
    const colors={skin:shaderColor(skinColor),hair:shaderColor(hairColor),jersey:shaderColor(palette.jersey),jerseyLight:shaderColor(palette.jerseyLight),shorts:shaderColor(palette.shorts),socks:shaderColor(palette.socks),trim:shaderColor(palette.trim),boots:shaderColor(bootColor)};
    material.onBeforeCompile=(shader)=>{
      shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vKitPosition;").replace("#include <begin_vertex>","#include <begin_vertex>\nvKitPosition = position;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vKitPosition;").replace("#include <map_fragment>",`#include <map_fragment>
        float kitY=vKitPosition.y;float kitX=abs(vKitPosition.x);vec3 kitColor=${colors.skin};
        if(kitY < -.85) kitColor=${colors.boots};
        else if(kitY < -.54) kitColor=${colors.socks};
        if(kitY > -.06 && kitY < .20 && kitX < .27) kitColor=${colors.shorts};
        bool kitTorso=kitY > .15 && kitY < .69 && kitX < .245;
        bool kitSleeve=kitY > .48 && kitY < .70 && kitX >= .18 && kitX < .50;
        if(kitTorso || kitSleeve) kitColor=${colors.jersey};
        if(kitTorso && kitY > .42 && kitY < .47) kitColor=${colors.trim};
        if(kitSleeve && kitX > .445) kitColor=${colors.trim};
        if(kitTorso && kitY > .63 && kitX < .16) kitColor=${colors.jerseyLight};
        ${keeper?`if(kitX > .74 && kitY > .53 && kitY < .65) kitColor=${colors.trim};`:""}
        float hairLine=.895+.014*sin(vKitPosition.x*38.0)+.010*cos(vKitPosition.z*34.0);
        if(kitY > hairLine) kitColor=${colors.hair};
        diffuseColor.rgb=kitColor;`);
    };
    material.customProgramCacheKey=()=>`football-kit-v3-${player.team}-${player.role}-${player.index%4}`;material.needsUpdate=true;return material;
  }

  function applyIntegratedFootballKit(model,player) {
    const home=player.team===HOME;const keeper=player.role==="GK";const skinTones=[0xd89d78,0xb97958,0x8f5a3d,0xe5b08b];const skinColor=skinTones[(player.index+player.team)%skinTones.length];
    const palette=keeper
      ?{jersey:home?0x7650d6:0xe65348,jerseyLight:home?0xbca4ff:0xffa096,shorts:0x20212c,socks:home?0xbca4ff:0xffa096,trim:0xf5f7f6}
      :home
        ?{jersey:0xe1bb58,jerseyLight:0xffe9ae,shorts:0x171b1a,socks:0xe8d486,trim:0x161b19}
        :{jersey:0x32b8c8,jerseyLight:0xc4fbff,shorts:0x082e35,socks:0xb7edf2,trim:0xf0fbfa};
    model.traverse((node)=>{if(!node.isMesh||node.name!=="SuperHero_Male")return;const source=Array.isArray(node.material)?node.material:[node.material];const integrated=source.map((material)=>createIntegratedKitMaterial(material,player,palette,skinColor));node.material=Array.isArray(node.material)?integrated:integrated[0];});
    const head=model.getObjectByName("Head");
    const numberSpine=model.getObjectByName("spine_02");createRigSquadNumber(player,home&&!keeper?"#101413":"#f0fbfa",numberSpine);
    return{head,spine:model.getObjectByName("spine_03"),pelvis:model.getObjectByName("pelvis"),leftThigh:model.getObjectByName("thigh_l"),rightThigh:model.getObjectByName("thigh_r"),leftCalf:model.getObjectByName("calf_l"),rightCalf:model.getObjectByName("calf_r"),leftFoot:model.getObjectByName("foot_l"),rightFoot:model.getObjectByName("foot_r"),leftArm:model.getObjectByName("upperarm_l"),rightArm:model.getObjectByName("upperarm_r")};
  }

  function upgradePlayerView(player) {
    const view=playerViews.get(player);if(!view||view.rig||!playerAsset)return;const model=cloneSkeleton(playerAsset.scene);model.scale.set(2.96,3.28,2.96);model.rotation.y=0;
    model.traverse((node)=>{if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;const source=Array.isArray(node.material)?node.material:[node.material];const mapped=source.map((material)=>{const clone=material.clone();clone.roughness=Math.max(.5,clone.roughness||.5);return clone;});node.material=Array.isArray(node.material)?mapped:mapped[0];});
    const bones=applyIntegratedFootballKit(model,player);const mixer=new THREE.AnimationMixer(model);const actions={};for(const clip of playerAsset.animations)actions[clip.name]=mixer.clipAction(clip);view.body.visible=false;view.root.add(model);view.rig={model,mixer,actions,state:"",lastTime:performance.now(),active:null,yaw:Math.atan2(player.dirX,player.dirY),...bones};
    switchRigAnimation(view,"Idle_Loop",true);
  }

  function switchRigAnimation(view,state,immediate=false) {
    const rig=view.rig;if(!rig||rig.state===state)return;const next=rig.actions[state]||rig.actions.Idle_Loop;if(!next)return;const looping=state.endsWith("_Loop")||state==="Dance_Loop";const fade=immediate?0:(looping ? .32 : .16);next.reset();next.enabled=true;next.setLoop(looping?THREE.LoopRepeat:THREE.LoopOnce,looping?Infinity:1);next.clampWhenFinished=!looping;next.fadeIn(fade).play();if(rig.active&&rig.active!==next)rig.active.fadeOut(fade);rig.active=next;rig.state=state;
  }

  function rigAnimationState(player,speed,current) {
    if(player.anim==="celebrate")return"Dance_Loop";if(player.anim==="dive")return"Roll";if(player.anim==="tackle"||player.anim==="receive")return"Idle_Loop";if(current==="Sprint_Loop"&&speed>178)return current;if(speed>218)return"Sprint_Loop";if(current==="Jog_Fwd_Loop"&&speed>18)return current;if(speed>26)return"Jog_Fwd_Loop";return"Idle_Loop";
  }

  function smoothAngle(current,target,ease) {return current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*ease;}

  function motionPulse(progress,start=0,end=1) {if(progress<=start||progress>=end)return 0;return Math.sin((progress-start)/(end-start)*Math.PI);}

  function applyFootballActionPose(rig,pose,progress,dt) {
    if(!rig.active)return;const shoot=pose.anim==="shoot";const pass=pose.anim==="pass";const receive=pose.anim==="receive";const tackle=pose.anim==="tackle";let bodyPitch=0;let bodyRoll=-(pose.turnLean||0)*.14;let bodyDrop=0;
    if(shoot){const windup=motionPulse(progress,0,.5);const strike=motionPulse(progress,.24,1);if(rig.rightThigh)rig.rightThigh.rotation.x+=windup*.68-strike*1.36;if(rig.rightCalf)rig.rightCalf.rotation.x+=windup*.92+strike*.48;if(rig.rightFoot)rig.rightFoot.rotation.x-=strike*.28;if(rig.leftThigh)rig.leftThigh.rotation.x-=strike*.16;if(rig.pelvis)rig.pelvis.rotation.y+=strike*.2;if(rig.spine){rig.spine.rotation.y-=strike*.28;rig.spine.rotation.x-=strike*.1;}if(rig.leftArm)rig.leftArm.rotation.x-=strike*.42;if(rig.rightArm)rig.rightArm.rotation.x+=strike*.56;bodyPitch=-strike*.1;bodyRoll-=strike*.08;}
    if(pass){const open=motionPulse(progress,0,.58);const contact=motionPulse(progress,.2,1);if(rig.rightThigh){rig.rightThigh.rotation.x+=open*.28-contact*.72;rig.rightThigh.rotation.z+=contact*.2;}if(rig.rightCalf)rig.rightCalf.rotation.x+=open*.42+contact*.26;if(rig.rightFoot)rig.rightFoot.rotation.y+=contact*.32;if(rig.pelvis)rig.pelvis.rotation.y+=contact*.12;if(rig.spine)rig.spine.rotation.y-=contact*.15;if(rig.leftArm)rig.leftArm.rotation.x-=contact*.24;if(rig.rightArm)rig.rightArm.rotation.x+=contact*.28;bodyPitch=-contact*.04;}
    if(receive){const cushion=motionPulse(progress,.04,.92);if(rig.rightThigh)rig.rightThigh.rotation.x-=cushion*.36;if(rig.rightCalf)rig.rightCalf.rotation.x+=cushion*.48;if(rig.rightFoot)rig.rightFoot.rotation.x-=cushion*.2;if(rig.spine)rig.spine.rotation.x+=cushion*.08;bodyDrop=-cushion*.05;}
    if(tackle){const slide=motionPulse(progress,0,1);const side=pose.animPower<0?-1:1;if(rig.leftThigh)rig.leftThigh.rotation.x-=slide*.88;if(rig.rightThigh)rig.rightThigh.rotation.x-=slide*1.2;if(rig.leftCalf)rig.leftCalf.rotation.x+=slide*.3;if(rig.rightCalf)rig.rightCalf.rotation.x+=slide*.14;if(rig.leftArm)rig.leftArm.rotation.x-=slide*.58;if(rig.rightArm)rig.rightArm.rotation.x+=slide*.42;bodyPitch=slide*.22;bodyRoll+=side*slide*.72;bodyDrop=-slide*.32;}
    rig.model.rotation.x=lerp(rig.model.rotation.x,bodyPitch,1-Math.exp(-dt*18));rig.model.rotation.z=lerp(rig.model.rotation.z,bodyRoll,1-Math.exp(-dt*18));rig.model.position.y=lerp(rig.model.position.y,bodyDrop,1-Math.exp(-dt*20));
  }

  function updateRigPlayer(player,pose,view,now,speed) {
    const rig=view.rig;const dt=Math.min(.05,(now-rig.lastTime)/1000);rig.lastTime=now;const ballDirection=normalize(ball.x-pose.x,ball.y-pose.y);const ballYaw=Math.atan2(ballDirection.x,ballDirection.y);const movementYaw=pose.motionYaw??Math.atan2(pose.vx||pose.dirX,pose.vy||pose.dirY);const engaged=player===game.selected&&controlMode()==="defense"&&(input.keys.has(FO4_CONTROLS.shoot)||input.keys.has(FO4_CONTROLS.shield));const moving=speed>42;let desired=moving?movementYaw:ballYaw;if(engaged)desired=Math.atan2(pose.dirX,pose.dirY);else if(moving&&ball.owner?.team!==player.team&&speed<125)desired=smoothAngle(movementYaw,ballYaw,.24);rig.yaw=smoothAngle(rig.yaw,desired,1-Math.exp(-dt*(pose.sprinting?8:11)));view.root.position.set(worldX(pose.x),0,worldZ(pose.y));view.root.rotation.y=rig.yaw;
    switchRigAnimation(view,rigAnimationState(pose,speed,rig.state));if(rig.active)rig.active.timeScale=rig.state==="Sprint_Loop"?clamp(speed/225,.82,1.42):rig.state==="Jog_Fwd_Loop"?clamp(speed/160,.78,1.34):1;rig.mixer.update(dt);
    const actionProgress=pose.animDuration?clamp(1-pose.animTime/pose.animDuration,0,1):1;applyFootballActionPose(rig,pose,actionProgress,dt);
    if(rig.active&&ball.owner===player&&speed>35){const footWave=Math.sin(pose.stepPhase);const foot=footWave>0?rig.rightThigh:rig.leftThigh;if(foot)foot.rotation.x-=Math.abs(footWave)*.13*clamp(speed/180,.35,1);}
    if(rig.active&&rig.head){const look=Math.atan2(Math.sin(ballYaw-rig.yaw),Math.cos(ballYaw-rig.yaw));rig.head.rotation.y+=clamp(look,-.68,.68)*.62;}if(rig.active&&rig.spine){const look=Math.atan2(Math.sin(ballYaw-rig.yaw),Math.cos(ballYaw-rig.yaw));if(speed<75)rig.spine.rotation.y+=clamp(look,-.28,.28)*.22;rig.spine.rotation.z-=(pose.turnLean||0)*.1;rig.spine.rotation.x-=clamp(speed/320,0,.12);}
    view.marker.visible=!game.replay.active&&player===game.selected;if(view.marker.visible){const pulse=1+Math.sin(now*.006)*.08;view.marker.scale.setScalar(pulse);view.marker.material.color.set(!isAttacking()&&(input.keys.has(FO4_CONTROLS.shoot)||input.keys.has(FO4_CONTROLS.shield))?0x47c9d4:0xffd86b);}view.label.visible=!game.replay.active&&(player===game.selected||speed<10);
  }

  function cssColor(value) {return`#${value.toString(16).padStart(6,"0")}`;}

  function createBallSurfaceTextures(style) {
    const width=768;const height=384;const colorCanvas=document.createElement("canvas");const bumpCanvas=document.createElement("canvas");colorCanvas.width=bumpCanvas.width=width;colorCanvas.height=bumpCanvas.height=height;const paint=colorCanvas.getContext("2d");const bump=bumpCanvas.getContext("2d");
    paint.fillStyle=cssColor(style.base);paint.fillRect(0,0,width,height);bump.fillStyle="#d8d8d8";bump.fillRect(0,0,width,height);
    const drawSeams=(target,color,lineWidth)=>{target.strokeStyle=color;target.lineWidth=lineWidth;target.lineCap="round";target.lineJoin="round";
      for(let i=0;i<6;i+=1){const x=(i+.5)*width/6;target.beginPath();target.moveTo(x-22,0);target.bezierCurveTo(x+42,height*.24,x-40,height*.74,x+20,height);target.stroke();}
      for(let row=1;row<4;row+=1){const y=row*height/4;target.beginPath();target.moveTo(0,y+12);target.bezierCurveTo(width*.24,y-26,width*.72,y+24,width,y-10);target.stroke();}
    };
    drawSeams(paint,style.stroke,3.4);drawSeams(bump,"#444",7);
    paint.fillStyle=cssColor(style.patch);paint.globalAlpha=.96;
    const panels=[[92,76,-.18],[244,205,.22],[392,98,-.12],[548,270,.18],[685,146,-.2],[78,326,.14],[444,332,-.15]];
    for(const [x,y,rotation] of panels){paint.save();paint.translate(x,y);paint.rotate(rotation);paint.beginPath();paint.moveTo(-28,-8);paint.quadraticCurveTo(-2,-28,30,-14);paint.lineTo(18,13);paint.quadraticCurveTo(-4,26,-31,10);paint.closePath();paint.fill();paint.restore();}
    paint.globalAlpha=.34;paint.fillStyle="#ffffff";paint.fillRect(0,0,width,3);paint.globalAlpha=1;
    const map=new THREE.CanvasTexture(colorCanvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=THREE.RepeatWrapping;map.anisotropy=renderer3D?.capabilities?.getMaxAnisotropy?.()||1;
    const bumpMap=new THREE.CanvasTexture(bumpCanvas);bumpMap.wrapS=THREE.RepeatWrapping;bumpMap.anisotropy=map.anisotropy;return{map,bumpMap};
  }

  function applyBallSurface(material,style) {
    material.map?.dispose();material.bumpMap?.dispose();const textures=createBallSurfaceTextures(style);material.map=textures.map;material.bumpMap=textures.bumpMap;material.color.set(0xffffff);material.needsUpdate=true;
  }

  function createBall3D() {
    const style=BALL_STYLES[game.ballStyle]||BALL_STYLES.classic;ballView=new THREE.Group();const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.58,metalness:0,clearcoat:.16,clearcoatRoughness:.7,bumpScale:.035});applyBallSurface(material,style);
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.56,48,32),material);mesh.castShadow=true;mesh.receiveShadow=true;ballView.add(mesh);ballView.userData={mesh,material};scene3D.add(ballView);
  }

  function applyPitchStyle() {
    const theme=PITCH_STYLES[game.pitchStyle]||PITCH_STYLES.classic;dryPitchColor.set(theme.tint);wetPitchColor.set(theme.wet);if(pitchView){pitchView.material.map?.dispose();pitchView.material.map=createPitchTexture3D();pitchView.material.needsUpdate=true;}if(grassView)grassView.material.color.set(theme.grass);applyStadiumLighting();
  }

  function applyStadiumLighting() {
    if(!scene3D)return;const night=game.pitchStyle==="midnight";scene3D.background.set(night?0x020708:0x07100d);scene3D.fog.color.set(night?0x030908:0x07110e);if(renderer3D)renderer3D.toneMappingExposure=night?1.22:1.12;if(hemisphereLight)hemisphereLight.intensity=night?1.05:1.45;if(floodLight)floodLight.intensity=night?4.35:3.4;if(rimLight)rimLight.intensity=night?1.85:1.4;for(const lamp of stadiumLightViews)lamp.intensity=night?30:20;
  }

  function applyBallStyle() {
    const style=BALL_STYLES[game.ballStyle]||BALL_STYLES.classic;if(!ballView)return;if(ballView.userData.material)applyBallSurface(ballView.userData.material,style);
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
    view.marker.visible=!game.replay.active&&player===game.selected; if(view.marker.visible){const pulse=1+Math.sin(now*.006)*.08;view.marker.scale.setScalar(pulse);view.marker.material.color.set(!isAttacking()&&(input.keys.has(FO4_CONTROLS.shoot)||input.keys.has(FO4_CONTROLS.shield))?0x47c9d4:0xffd86b);} view.label.visible=!game.replay.active&&(player===game.selected||speed<10);
  }

  function updateParticleView() {
    const positions=particleView.geometry.attributes.position.array; const colors=particleView.geometry.attributes.color.array; const count=Math.min(gameFeel.particleBudget(),game.particles.length);
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
    ballView.position.set(worldX(renderBall.x),.58+(renderBall.height||0),worldZ(renderBall.y)); ballView.rotation.set(renderBall.angle*.7,renderBall.angle,renderBall.angle*.35); const visualSpeed=Math.hypot(ball.vx,ball.vy);ballTrailView?.update(ball.trail,{worldX,worldZ,speed:visualSpeed,opacityForIndex:(index,count,speed)=>gameFeel.trailOpacity(index,count,speed)}); updateParticleView(); updateAtmosphere3D(now);
    if(input.actionStart&&ball.owner===game.selected){chargeView.visible=true;chargeView.position.set(worldX(game.selected.x),7.5,worldZ(game.selected.y));chargeView.quaternion.copy(camera3D.quaternion);const fill=chargeView.userData.fill;fill.scale.x=Math.max(.02,input.actionCharge);fill.position.x=-2.4+2.4*input.actionCharge;fill.material.color.set(input.actionCharge>.82?0xff5b45:0xffcf58);}else chargeView.visible=false;
    const targetX=worldX(lerp(W/2,renderBall.x,replayFrame?1:.34));const targetZ=worldZ(lerp(H/2,renderBall.y,replayFrame?1:.18));
    if(replayFrame){const scoringRight=game.goalSequence?.team===HOME;cameraTarget.set(targetX+(scoringRight?-16:16),13,clamp(targetZ+22,-19,19));cameraLook.set(targetX,1.2,targetZ);}
    else if(game.goalSequence){const scorer=game.goalScorer||ball;cameraTarget.set(worldX(scorer.x)-9,8.5,worldZ(scorer.y)+12);cameraLook.set(worldX(scorer.x),2.4,worldZ(scorer.y));}
    else if(game.cameraMode==="tactical"){cameraTarget.set(targetX,lowPowerDevice?66:60,30+targetZ*.05);cameraLook.set(targetX,0,targetZ);}
    else if(game.cameraMode==="close"){cameraTarget.set(targetX-11,lowPowerDevice?26:20,lowPowerDevice?38:31+targetZ*.18);cameraLook.set(targetX,1.2,targetZ);}
    else{cameraTarget.set(targetX,(lowPowerDevice?52:44)+Math.min(5,Math.hypot(ball.vx,ball.vy)*.004),(lowPowerDevice?62:52)+targetZ*.08);cameraLook.set(targetX,.7,targetZ);}
    const cameraDt=Math.min(.05,Math.max(0,(render3D.lastNow?now-render3D.lastNow:16.667)/1000));render3D.lastNow=now;camera3D.position.lerp(cameraTarget,gameFeel.cameraEase(cameraDt,Boolean(replayFrame)));const feelOffset=gameFeel.sampleCameraOffset(now);camera3D.position.x+=feelOffset.x*.42+feelOffset.z*.12;camera3D.position.y+=feelOffset.y*.28;camera3D.position.z+=feelOffset.z*.28;camera3D.lookAt(cameraLook);
    const stadiumPulse=game.goalSequence?(reducedMotion?1.08:1+Math.sin(now*.018)*.45):1; if(crowdView){crowdView.material.size=(lowPowerDevice ? .3 : .34)*stadiumPulse;crowdView.material.opacity=game.goalSequence ? .98 : .88;} for(const led of ledViews){led.board.material.emissiveIntensity=game.goalSequence ? .75+.3*Math.sin(now*.022) : .32;led.label.material.opacity=game.goalSequence ? .8+.2*Math.sin(now*.018) : 1;}
    screenFx.style.opacity=String(clamp(game.flash,0,1)); screenFx.classList.toggle("active",game.flash>.02); if(composer3D)composer3D.render();else renderer3D.render(scene3D,camera3D); drawRadar();
  }

  function drawFallbackPlayerDetail(player,pose,replayFrame) {
    const selected=!replayFrame&&player===game.selected; const home=player.team===HOME; const keeper=player.role==="GK"; const speed=Math.hypot(pose.vx,pose.vy); const stride=speed>30?Math.sin(pose.stepPhase)*6:0; const skinTones=["#d89d78","#b97958","#8f5a3d","#e5b08b"]; const skin=skinTones[(player.index+player.team)%4]; const jersey=keeper?(home?"#8a62dd":"#ed6757"):(home?"#e1bb58":"#47c9d4"); const shorts=keeper?"#20212c":(home?"#171b1a":"#092e35"); const sock=home?"#e9d58f":"#b8eff3";
    ctx.save();ctx.translate(pose.x,pose.y+(speed>30?Math.abs(Math.sin(pose.stepPhase))*-2:0));ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(5,17,23,9,0,0,Math.PI*2);ctx.fill();
    if(selected){ctx.strokeStyle=!isAttacking()&&(input.keys.has(FO4_CONTROLS.shoot)||input.keys.has(FO4_CONTROLS.shield))?"#47c9d4":"#ffdb6d";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,13,28,14,0,0,Math.PI*2);ctx.stroke();}
    ctx.rotate(Math.atan2(pose.dirY,pose.dirX)+Math.PI/2);ctx.lineCap="round";
    ctx.strokeStyle=sock;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(-7+stride,25);ctx.moveTo(6,10);ctx.lineTo(7-stride,25);ctx.stroke();ctx.strokeStyle="#191c1b";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-10+stride,26);ctx.lineTo(-5+stride,26);ctx.moveTo(3-stride,26);ctx.lineTo(10-stride,26);ctx.stroke();
    ctx.fillStyle=shorts;ctx.beginPath();ctx.roundRect(-11,4,22,12,4);ctx.fill();ctx.fillStyle=jersey;ctx.beginPath();ctx.roundRect(-13,-15,26,22,7);ctx.fill();ctx.fillStyle=home?"#161b19":"#e4f5f3";ctx.fillRect(-12,-5,24,3);
    ctx.strokeStyle=jersey;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-11,-9);ctx.lineTo(-18-stride*.35,3);ctx.moveTo(11,-9);ctx.lineTo(18+stride*.35,3);ctx.stroke();ctx.strokeStyle=skin;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-18-stride*.35,3);ctx.lineTo(-20-stride*.35,9);ctx.moveTo(18+stride*.35,3);ctx.lineTo(20+stride*.35,9);ctx.stroke();
    ctx.fillStyle=skin;ctx.fillRect(-3,-19,6,6);ctx.beginPath();ctx.ellipse(0,-23,8,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=["#231914","#38241b","#111413","#5a351f"][(player.index+player.team)%4];ctx.beginPath();ctx.arc(0,-26,8,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle=home?"#101413":"#f0fbfa";ctx.font="800 11px Barlow Condensed";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(player.number,0,-1);ctx.restore();
  }

  function renderFallback2D(now) {
    const replayFrame=currentReplayFrame(); const fallbackBall=replayFrame?.ball||ball;
    const pitchTheme=PITCH_STYLES[game.pitchStyle]||PITCH_STYLES.classic;const ballTheme=BALL_STYLES[game.ballStyle]||BALL_STYLES.classic;ctx.clearRect(0,0,W,H);ctx.fillStyle=pitchTheme.outside;ctx.fillRect(0,0,W,H);ctx.fillStyle=pitchTheme.mid;ctx.fillRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);for(let i=0;i<90;i+=1){const edge=i%4;const x=edge<2?seededNoise(i*3.1)*W:(edge===2?18:W-18);const y=edge<2?(edge===0?18:H-18):seededNoise(i*5.7)*H;ctx.fillStyle=i%9===0?"rgba(225,187,88,.65)":i%7===0?"rgba(71,201,212,.55)":"rgba(218,229,223,.24)";ctx.fillRect(x,y,2.4,2.4);}
    for(let i=0;i<14;i+=1){ctx.fillStyle=i%2?"rgba(255,255,255,.025)":"rgba(0,20,8,.04)";ctx.fillRect(FIELD.left+i*(FIELD.right-FIELD.left)/14,FIELD.top,(FIELD.right-FIELD.left)/14,FIELD.bottom-FIELD.top);}
    ctx.strokeStyle="rgba(245,250,247,.88)";ctx.lineWidth=3;ctx.strokeRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);ctx.beginPath();ctx.moveTo(W/2,FIELD.top);ctx.lineTo(W/2,FIELD.bottom);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,83,0,Math.PI*2);ctx.stroke();for(const [x,y,s] of [[FIELD.left,FIELD.top,1],[FIELD.right,FIELD.top,-1],[FIELD.left,FIELD.bottom,1],[FIELD.right,FIELD.bottom,-1]]){ctx.strokeStyle="#eef3f0";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-18*(y<H/2?1:-1));ctx.stroke();ctx.fillStyle=s>0?"#e1bb58":"#47c9d4";ctx.beginPath();ctx.moveTo(x,y-18*(y<H/2?1:-1));ctx.lineTo(x+s*12,y-13*(y<H/2?1:-1));ctx.lineTo(x,y-8*(y<H/2?1:-1));ctx.fill();}
    const fallbackPlayers=players.map((player,index)=>({base:player,pose:replayFrame?.players[index]||player})).sort((a,b)=>a.pose.y-b.pose.y);
    for(const {base:player,pose} of fallbackPlayers)drawFallbackPlayerDetail(player,pose,replayFrame);
    ctx.fillStyle=`#${ballTheme.base.toString(16).padStart(6,"0")}`;ctx.beginPath();ctx.arc(fallbackBall.x,fallbackBall.y,ball.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ballTheme.stroke;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=`#${ballTheme.patch.toString(16).padStart(6,"0")}`;ctx.beginPath();ctx.arc(fallbackBall.x-2.5,fallbackBall.y-2.5,3.1,0,Math.PI*2);ctx.fill();
    for(const particle of game.particles){ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;ctx.fillRect(particle.x,particle.y,particle.size,particle.size);}ctx.globalAlpha=1;
    if(game.weather==="rain"){ctx.fillStyle="rgba(135,190,196,.055)";ctx.fillRect(0,0,W,H);ctx.strokeStyle="rgba(195,235,242,.32)";ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<(lowPowerDevice?60:140);i+=1){const x=(seededNoise(i*3.7)*W+now*.11)%W;const y=(seededNoise(i*8.9)*H+now*.34*(.7+seededNoise(i)))%H;ctx.moveTo(x,y);ctx.lineTo(x-5,y+17);}ctx.stroke();}
    if(input.actionStart&&ball.owner===game.selected){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(game.selected.x-31,game.selected.y-50,62,8);ctx.fillStyle=input.actionCharge>.82?"#ff5b45":"#ffcf58";ctx.fillRect(game.selected.x-30,game.selected.y-49,60*input.actionCharge,6);}
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
    const charging = selected && input.actionStart && ball.owner === player;
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
    const windup = charging ? input.actionCharge * 9 : 0;
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
    const style=BALL_STYLES[game.ballStyle]||BALL_STYLES.classic;
    ctx.save();
    const visualSpeed=Math.hypot(ball.vx,ball.vy);for(let i=ball.trail.length-1;i>=0;i-=1){const point=ball.trail[i];ctx.globalAlpha=gameFeel.trailOpacity(i,ball.trail.length,visualSpeed);ctx.fillStyle="white";ctx.beginPath();ctx.arc(point.x,point.y,Math.max(1.5,ball.radius*(1-i/(ball.trail.length+4))),0,Math.PI*2);ctx.fill();}
    const shadow=gameFeel.ballShadow(ball.height||0);ctx.globalAlpha=shadow.opacity;ctx.fillStyle="black";ctx.beginPath();ctx.ellipse(ball.x+5,ball.y+9,12*shadow.scale,5*shadow.scale,0,0,Math.PI*2);ctx.fill();
    ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    const ballShade=ctx.createRadialGradient(-3,-4,1,0,0,ball.radius+2);ballShade.addColorStop(0,"#fff");ballShade.addColorStop(.56,cssColor(style.base));ballShade.addColorStop(1,"#747d78");
    ctx.fillStyle=ballShade;ctx.beginPath();ctx.arc(0,0,ball.radius,0,Math.PI*2);ctx.fill();ctx.save();ctx.clip();ctx.strokeStyle=style.stroke;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,-3);ctx.bezierCurveTo(-3,-8,3,-8,11,-2);ctx.moveTo(-9,6);ctx.bezierCurveTo(-2,1,4,2,10,7);ctx.moveTo(-4,-11);ctx.bezierCurveTo(1,-4,-1,4,4,11);ctx.stroke();ctx.fillStyle=cssColor(style.patch);for(const [x,y,r] of [[-4,-4,.2],[5,2,-.25],[-2,7,.1]]){ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.beginPath();ctx.moveTo(-3,-1);ctx.quadraticCurveTo(0,-4,4,-2);ctx.lineTo(2,2);ctx.quadraticCurveTo(-1,4,-4,1);ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();ctx.strokeStyle=style.stroke;ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,ball.radius,0,Math.PI*2);ctx.stroke();
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
    if (input.actionStart && ball.owner === game.selected) {
      const x = game.selected.x; const y = game.selected.y - 44; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - 31, y, 62, 8);
      const grad = ctx.createLinearGradient(x - 30, 0, x + 30, 0); grad.addColorStop(0, "#e1bb58"); grad.addColorStop(1, input.actionCharge > .82 ? "#ff5b45" : "#ffdc78");
      ctx.fillStyle = grad; ctx.fillRect(x - 30, y + 1, 60 * input.actionCharge, 6);
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
    const mode=controlMode();if(ui.controlsMode?.dataset.mode!==mode){ui.controlsMode.dataset.mode=mode;ui.controlsMode.textContent=mode==="attack"?"TẤN CÔNG":"PHÒNG THỦ";ui.controlsCard?.classList.toggle("defense",mode==="defense");document.querySelectorAll("[data-attack][data-defense]").forEach((label)=>{label.textContent=label.dataset[mode];});}
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
  function audioNow() { return audioContext?.currentTime ?? performance.now() / 1000; }
  function kickSound(power) { if(!audioFeedback.canPlay("kick",audioNow()))return;const profile=audioFeedback.kickProfile(power);tone(profile.frequency,profile.duration,"triangle",profile.volume); }
  function whistle(long = false) { if(!audioFeedback.canPlay("whistle",audioNow()))return;tone(1450,long?.5:.25,"sine",.03);tone(1750,long?.42:.18,"sine",.02,.08); }
  function goalSound() { if(!audioFeedback.canPlay("goal",audioNow()))return;[392,523,659,784].forEach((note,index)=>tone(note,.42,"square",.025,index*.09)); }

  function simulationStep(dt) {
    update(dt);
    if (game.messageTimer > 0) game.messageTimer -= dt;
  }

  function renderFrame(_alpha, now) {
    render(now);
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI();
  }

  const simulationLoop = createSimulationLoop({
    update: simulationStep,
    render: renderFrame,
    clockOptions: gameplayConfig.simulation,
  });

  function onKeyDown(event) {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
    if (event.repeat && [FO4_CONTROLS.shortPass,FO4_CONTROLS.throughBall,FO4_CONTROLS.shoot,FO4_CONTROLS.loftPass,FO4_CONTROLS.teammateRun,FO4_CONTROLS.tackle,FO4_CONTROLS.camera,"Escape"].includes(event.code)) return;
    input.keys.add(event.code);
    if (event.code === "Escape") togglePause();
    if (game.state !== "playing") return;
    if(event.shiftKey&&event.code.startsWith("Arrow")){switchPlayerInDirection(event.code);return;}
    const attacking=isAttacking();
    if(attacking&&[FO4_CONTROLS.shortPass,FO4_CONTROLS.throughBall,FO4_CONTROLS.shoot,FO4_CONTROLS.loftPass].includes(event.code))beginAttackAction(event.code);
    if(!attacking&&event.code===FO4_CONTROLS.shortPass)switchPlayer();
    if(!attacking&&event.code===FO4_CONTROLS.loftPass)slideTackle(game.selected);
    if(!attacking&&event.code===FO4_CONTROLS.tackle)tackle(game.selected);
    if(attacking&&event.code===FO4_CONTROLS.teammateRun){input.qTapStart=performance.now();input.qConsumed=false;}
    if(event.code===FO4_CONTROLS.camera)cycleCamera();
  }
  function onKeyUp(event) {
    input.keys.delete(event.code);
    if([FO4_CONTROLS.shortPass,FO4_CONTROLS.throughBall,FO4_CONTROLS.shoot,FO4_CONTROLS.loftPass].includes(event.code)){if(controlMode()==="attack")finishAttackAction(event.code);else{input.actionCode=null;input.actionStart=0;input.actionCharge=0;input.actionModifiers=null;}}
    if(event.code===FO4_CONTROLS.teammateRun){if(controlMode()==="attack"&&input.qTapStart&&!input.qConsumed)triggerTeammateRun();input.qTapStart=0;input.qConsumed=false;}
  }

  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-difficulty]").forEach((item) => item.classList.remove("active")); button.classList.add("active");
    game.difficulty = button.dataset.difficulty; game.ai = { rookie: .78, pro: 1, legend: 1.18 }[game.difficulty]; tone(620,.05,"sine",.025);
  }));
  document.querySelectorAll("[data-pitch]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-pitch]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.pitchStyle=button.dataset.pitch;savePreference("tfPitch",game.pitchStyle);applyPitchStyle();tone(520,.04,"sine",.018);}));
  document.querySelectorAll("[data-ball]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-ball]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.ballStyle=button.dataset.ball;savePreference("tfBall",game.ballStyle);applyBallStyle();tone(680,.04,"sine",.018);}));
  document.querySelectorAll("[data-weather]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-weather]").forEach((item)=>item.classList.remove("active"));button.classList.add("active");game.weather=button.dataset.weather;savePreference("tfWeather",game.weather);applyPitchStyle();tone(game.weather==="rain"?330:560,.05,"sine",.018);}));
  document.querySelectorAll("[data-pitch]").forEach((button)=>button.classList.toggle("active",button.dataset.pitch===game.pitchStyle));document.querySelectorAll("[data-ball]").forEach((button)=>button.classList.toggle("active",button.dataset.ball===game.ballStyle));document.querySelectorAll("[data-weather]").forEach((button)=>button.classList.toggle("active",button.dataset.weather===game.weather));
  $("playButton").addEventListener("click", startMatch);
  $("pauseButton").addEventListener("click", () => togglePause());
  $("resumeButton").addEventListener("click", () => togglePause(false));
  $("restartButton").addEventListener("click", startMatch);
  $("playAgainButton").addEventListener("click", startMatch);
  $("soundButton").addEventListener("click", () => { game.sound=!game.sound;$("soundButton").classList.toggle("muted",!game.sound);$("soundButton").setAttribute("aria-label",game.sound?"Tắt âm thanh":"Bật âm thanh");if(game.sound)tone(600,.08); });
  window.addEventListener("keydown", onKeyDown, { passive: false }); window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { input.keys.clear();input.actionCode=null;input.actionStart=0;input.actionCharge=0;input.actionModifiers=null;input.bufferedAction=null;input.qTapStart=0;input.qConsumed=false;if(game.state === "playing") togglePause(true); });
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  init3D(); createTeams(); updateUI(); simulationLoop.start();
})();
