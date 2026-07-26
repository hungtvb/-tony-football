import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";
import { gameplayConfig } from "./src/game/config/gameplayConfig.js";
import { cameraHudConfig } from "./src/game/config/cameraHudConfig.js";
import { createBrowserPresentationFeedbackAdapter } from "./src/game/presentation/BrowserPresentationFeedbackAdapter.js";
import { createDeferredCompatibilityKickPublisher } from "./src/game/presentation/CompatibilityKickEventPayload.js";
import { locomotionConfig } from "./src/game/config/locomotionConfig.js";
import { ballControlConfig } from "./src/game/config/ballControlConfig.js";
import { captureEligibility, classifyFirstTouch, dribbleAnchor, firstTouchScore, resolveFirstTouch } from "./src/game/gameplay/BallControl.js";
import { beginReceiving, controlPossession, createPossessionLifecycle, releasePossession, settleLoose } from "./src/game/gameplay/PossessionLifecycle.js";
import { canvasHeading, chooseSprintTransitionResponse, chooseTurnResponse, dampVelocity, stepFacing, stepStamina, stepTowardTarget, stepVelocity, webGLHeading } from "./src/game/gameplay/PlayerLocomotion.js";
import { GameCommandType } from "./src/game/engine/GameCommands.js";
import { GameEventType, createGameEvent } from "./src/game/engine/GameEvents.js";
import { FO4_CONTROLS } from "./src/game/input/FO4Controls.js";
import { ApplicationActionType } from "./src/game/application/ApplicationActions.js";
import { BrowserBootstrapComposition } from "./src/game/application/BrowserBootstrapComposition.js";
import { BrowserRuntimeComposition } from "./src/game/application/BrowserRuntimeComposition.js";
import { publishGameEvent } from "./src/game/presentation/BrowserGameEventBridge.js";
import { CompatibilitySnapshotAdapter, compatibilityPlayerId } from "./src/game/presentation/CompatibilitySnapshotAdapter.js";

(() => {
  const canvas = document.querySelector("#gameCanvas");
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
  const runtimeParams = new URLSearchParams(location.search);
  const visualTestMode = runtimeParams.get("visualTest") === "1";
  const rendererPreference = runtimeParams.get("renderer");
  const lowPowerDevice = visualTestMode || matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);

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


  const ui = Object.freeze({
    start: $("startOverlay"), pause: $("pauseOverlay"), result: $("resultOverlay"),
    commentary: $("commentary"), replayBadge: $("replayBadge"), matchState: $("matchState"),
  });

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

  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, height: 0, vz: 0, curve: 0, radius: 9, owner: null, lastTouch: null, lock: 0, trail: [], pendingPass: null, angle: 0, spin: 0, possession: createPossessionLifecycle() };
  const cameraReplayBridge = window.__TONY_CAMERA_REPLAY_BRIDGE__;
  if (!cameraReplayBridge) throw new Error("Snapshot camera/replay bridge is unavailable");
  const presentationPort = window.__TONY_COMPATIBILITY_PRESENTATION_PORT__;
  if (!presentationPort) throw new Error("Outward-only compatibility presentation port is unavailable");
  const replayController = cameraReplayBridge.replay;
  const game = {
    state: "menu", difficulty: "pro", ai: 1, time: MATCH_SECONDS, score: [0, 0], selected: null,
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    messageTimer: 0, kickOffTimer: 0, lastTime: performance.now(), sound: true,
    cameraMode: "broadcast", cameraNotice: 0,
    replay: replayController,
    goalSequence: null, goalScorer: null, weather:loadPreference("tfWeather","clear",WEATHER_STYLES),pitchStyle:loadPreference("tfPitch","classic",PITCH_STYLES),ballStyle:loadPreference("tfBall","classic",BALL_STYLES)
  };
  let players = [];
  let browserInput = null;
  const input = {
    moveX: 0, moveY: 0, magnitude: 0, aimX: 1, aimY: 0,
    actionStart: 0, actionCharge: 0, bufferedAction: null, lastMode: "defense"
  };
  const isKeyPressed = (code) => browserInput?.isPressed(code) ?? false;
  let compatibilityTick = 0;
  let compatibilityEventSequence = 0;
  const runtimeComposition = new BrowserRuntimeComposition();
  const compatibilitySnapshots = new CompatibilitySnapshotAdapter({
    mode: runtimeComposition.mode,
    runtimeComposition,
  });
  let legacyGameplayStepCount = 0;

  function publishCompatibilityEvent(type, payload = {}) {
    const event = createGameEvent(type, payload, {
      tick: compatibilityTick,
      sequence: compatibilityEventSequence
    });
    compatibilityEventSequence += 1;
    publishGameEvent(window, event);
    return event;
  }

  function captureCompatibilitySnapshot() {
    return compatibilitySnapshots.capture({
      tick: compatibilityTick,
      state: game.state,
      matchSeconds: MATCH_SECONDS,
      time: game.time,
      difficulty: game.difficulty,
      score: game.score,
      stats: game.stats,
      settings: {
        pitchStyle: game.pitchStyle,
        ballStyle: game.ballStyle,
        weather: game.weather
      },
      replay: game.replay,
      selectedPlayer: game.selected,
      players,
      ball
    });
  }

  function loadPreference(key,fallback,options){try{const value=localStorage.getItem(key);return options[value]?value:fallback;}catch{return fallback;}}
  function savePreference(key,value){try{localStorage.setItem(key,value);}catch{}}

  function createTeams() {
    players = [
      ...formations.home.map((spec, index) => new Player(HOME, spec, index)),
      ...formations.away.map((spec, index) => new Player(AWAY, spec, index))
    ];
    game.selected = players[4];
  }

  function resetMatch() {
    if (game.replay.active) publishCompatibilityEvent(GameEventType.REPLAY_ENDED);
    createTeams();
    game.time = MATCH_SECONDS; game.score = [0, 0]; game.stats = { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 };
    presentationPort.resetEffects(); game.goalSequence = null; game.goalScorer = null;
    game.replay.reset();
    ui.replayBadge.classList.remove("show"); kickoff(HOME);
  }

  function kickoff(team) {
    players.forEach((player) => {
      player.x = player.baseX; player.y = player.baseY; player.vx = player.vy = 0; player.stamina = Math.max(55, player.stamina);
      player.anim = "idle"; player.animTime = 0; player.sprinting = false; player.diveCooldown = 0; player.controlBoost = 0;
      player.motionYaw=Math.atan2(player.dirX,player.dirY);player.turnLean=0;player.strideBlend=0;
    });
    const taker = team === HOME ? players[4] : players[10];
    taker.x = W / 2 + (team === HOME ? -26 : 26); taker.y = H / 2;
    ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.height=0;ball.vz=0;ball.curve=0;ball.owner = null; ball.lastTouch = null; ball.lock = .8; ball.pendingPass = null; ball.angle = 0; ball.spin = 0; ball.possession=createPossessionLifecycle();
    game.selected = team === HOME ? taker : closestPlayer(HOME, ball, false);input.lastMode=team===HOME?"attack":"defense";input.bufferedAction=null;
    game.kickOffTimer = 1.25; announce(team === HOME ? "Tony FC giao bóng!" : "Neon United giao bóng!");
  }

  function startMatch() {
    resetMatch(); game.state = "playing"; ui.start.classList.remove("show"); ui.pause.classList.remove("show"); ui.result.classList.remove("show");
    ui.matchState.textContent = "LIVE";
  }

  function togglePause(force) {
    if (game.state !== "playing" && game.state !== "paused") return;
    const pause = typeof force === "boolean" ? force : game.state === "playing";
    game.state = pause ? "paused" : "playing"; ui.pause.classList.toggle("show", pause); ui.matchState.textContent = pause ? "TẠM DỪNG" : "LIVE";
  }

  function clearActiveInput() {
    browserInput?.reset({ requestPause: false }); input.actionStart = 0; input.actionCharge = 0;
    input.bufferedAction = null; input.moveX = 0; input.moveY = 0; input.magnitude = 0;
  }

  function showMatchSetup({ reset = true } = {}) {
    clearActiveInput();
    if (reset) resetMatch();
    game.state = "menu"; game.replay.stop(); game.goalSequence = null; game.goalScorer = null;
    ui.pause.classList.remove("show"); ui.result.classList.remove("show"); ui.start.classList.add("show");
    ui.replayBadge.classList.remove("show"); ui.matchState.textContent = "SẴN SÀNG";
    announce("Chọn thiết lập rồi bắt đầu trận mới.");
  }

  function showMainMenu() {
    showMatchSetup({ reset: true });
    ui.start.dataset.entry = "main-menu";
    announce("Đã trở về màn hình đầu.");
  }

  function endMatch() {
    game.state = "ended"; ui.matchState.textContent = "FULL TIME";
    publishCompatibilityEvent(GameEventType.MATCH_ENDED, {
      score: game.score.slice(),
      stats: {
        possession: game.stats.possession.slice(),
        shots: game.stats.shots.slice(),
        passes: game.stats.passes,
        completed: game.stats.completed
      }
    });
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
    
  }

  function switchPlayerInDirection(code) {
    if (controlMode() === "attack") return;const directions={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};const direction=directions[code];if(!direction)return;
    const candidates=players.filter((player)=>player.team===HOME&&player.role!=="GK"&&player!==game.selected).map((player)=>{
      const dx=player.x-game.selected.x;const dy=player.y-game.selected.y;const d=length(dx,dy);const alignment=dx/d*direction.x+dy/d*direction.y;
      return{player,score:alignment*360-d*.22-distance(player,ball)*.06};
    }).sort((a,b)=>b.score-a.score);
    if(candidates[0]?.score>20){game.selected=candidates[0].player;}
  }

  function possessionId(player) { return player ? `${player.team}:${player.index}` : null; }

  function setOwner(player, touchOutcome = "clean", retainedVelocity = null) {
    if (ball.pendingPass && player.team === ball.pendingPass.team) {
      if (player.team === HOME) game.stats.completed += 1;
      ball.pendingPass = null;
    } else if (ball.pendingPass && player.team !== ball.pendingPass.team) ball.pendingPass = null;
    ball.possession=beginReceiving(ball.possession,possessionId(player));ball.owner = player; ball.lastTouch = player; ball.vx=retainedVelocity?.vx||0;ball.vy=retainedVelocity?.vy||0;ball.height=0;ball.vz=0;ball.curve=0;ball.possession=controlPossession(ball.possession,possessionId(player),touchOutcome);player.controlBoost=.28;
    triggerAnimation(player, "receive", .2);
    if (player.team === HOME && player.role !== "GK") game.selected = player;
    if(player===game.selected&&input.bufferedAction&&performance.now()<=input.bufferedAction.expires){const buffered=input.bufferedAction;input.bufferedAction=null;executeAttackAction(buffered.code,buffered.charge,buffered.modifiers);}
  }

  function triggerAnimation(player, name, duration, power = 0) {
    player.anim = name; player.animTime = duration; player.animDuration = duration; player.animPower = power;
  }

  function releaseBall(player, dx, dy, speed, type, feedback = {}) {
    const {
      commandType,
      power,
      style,
      targetId = null,
      aimY = null,
      ...presentation
    } = feedback;
    const n = normalize(dx, dy); ball.possession=releasePossession(ball.possession,type,possessionId(player));ball.owner = null; ball.lastTouch = player; ball.lock = type === "shot" ? .13 : type === "loft" ? .3 : .2;
    ball.x = player.x + n.x * (player.radius + 10); ball.y = player.y + n.y * (player.radius + 10);
    ball.vx = n.x * speed + player.vx * .25; ball.vy = n.y * speed + player.vy * .25;
    ball.height=0;ball.vz=type==="loft"?10.8:type==="shot"?1.8:0;ball.curve=type==="shot"?clamp(n.y*1.45,-1.05,1.05):0;ball.spin = (player.team === HOME ? 1 : -1) * speed * .012;
    player.cooldown = .18;
    triggerAnimation(player, type === "shot" ? "shoot" : "pass", type === "shot" ? .34 : type === "loft" ? .3 : .24, clamp((speed - 400) / 650, 0, 1));
    return createDeferredCompatibilityKickPublisher({
      publish: (payload) => publishCompatibilityEvent(GameEventType.BALL_KICKED, payload),
      getBallState: () => ball,
      commandType,
      playerId: compatibilityPlayerId(player),
      targetId,
      power,
      speed,
      style,
      aimY,
      presentation: {
        audioPower: type === "shot" ? .9 : .55,
        particleCount: type === "shot" ? 9 : 4,
        particleColor: type === "shot" ? "#f5d067" : "#f4f7f5",
        particleEnergy: 1.2,
        ...presentation
      }
    });
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
    const d = distance(player, target); const power=lerp(.82,1.16,clamp(charge,.08,1));const publishKickEvent=releaseBall(player, leadX - player.x, leadY - player.y, clamp((430 + d * .35)*power, 440, 760), "pass", { commandType: GameCommandType.SHORT_PASS, power: clamp(charge, 0, 1), style: oneTwo ? "one-two" : "short", targetId: compatibilityPlayerId(target) });publishKickEvent();
    if(oneTwo){const runDirection=normalize((player.team===HOME?1:-1)*.9+input.aimX*.45,input.aimY*.55);player.vx=runDirection.x*225;player.vy=runDirection.y*225;player.controlBoost=.7;announce(`${player.name} bật tường và băng lên!`);}
    if (player.team === HOME) game.stats.passes += 1;
    ball.pendingPass = { team: player.team, timer: 1.8 }; announce(oneTwo?`${player.name} bật tường và băng lên!`:`${player.name} chuyền bóng!`);
  }

  function throughBall(player, charge=.45, chipped=false) {
    if (ball.owner !== player) return;
    const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const aligned=dx/d*facing.x+dy/d*facing.y;const progress=dx*attackDirection;const score=aligned*310+progress*.42-d*.12;if(score>best){best=score;target=candidate;}}
    if(!target)return;const runX=target.vx*.58+attackDirection*58;const runY=target.vy*.58;const d=distance(player,target);const power=lerp(.84,1.18,clamp(charge,.08,1));const publishKickEvent=releaseBall(player,target.x+runX-player.x,target.y+runY-player.y,clamp((540+d*.42)*power,540,900),chipped?"loft":"pass", { commandType: GameCommandType.THROUGH_BALL, power: clamp(charge, 0, 1), style: chipped ? "chipped-through" : "through", targetId: compatibilityPlayerId(target) });if(chipped){ball.vz=8.6+charge*4.2;ball.height=.12;}publishKickEvent();
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.1};announce(`${player.name} chọc khe vào khoảng trống!`);
  }

  function loftBall(player, charge=.45) {
    if(ball.owner!==player)return;const attackDirection=player.team===HOME?1:-1;const facing=input.magnitude>.12?normalize(input.aimX,input.aimY):{x:attackDirection,y:0};
    const teammates=players.filter((candidate)=>candidate.team===player.team&&candidate!==player&&candidate.role!=="GK");let target=null;let best=-Infinity;
    for(const candidate of teammates){const dx=candidate.x-player.x;const dy=candidate.y-player.y;const d=length(dx,dy);const wide=Math.abs(dy);const aligned=dx/d*facing.x+dy/d*facing.y;const score=aligned*240+dx*attackDirection*.25+wide*.12-d*.08;if(score>best){best=score;target=candidate;}}
    if(!target)return;const power=lerp(.82,1.18,clamp(charge,.08,1));const publishKickEvent=releaseBall(player,target.x+target.vx*.32-player.x,target.y+target.vy*.32-player.y,clamp((610+distance(player,target)*.3)*power,580,940),"loft", { commandType: GameCommandType.LOFTED_PASS, power: clamp(charge, 0, 1), style: "loft", targetId: compatibilityPlayerId(target) });ball.vz*=lerp(.82,1.14,charge);publishKickEvent();
    if(player.team===HOME)game.stats.passes+=1;ball.pendingPass={team:player.team,timer:2.2};announce(`${player.name} tạt bóng!`);
  }

  function shootBall(player, charge = .5, style="power") {
    if (ball.owner !== player) return;
    const targetX = player.team === HOME ? FIELD.right + 45 : FIELD.left - 45;
    const keeper = players.find((p) => p.team !== player.team && p.role === "GK");
    const openY = keeper.y < H / 2 ? FIELD.goalBottom - 34 : FIELD.goalTop + 34;
    const userAim=player===game.selected&&player.team===HOME&&input.magnitude>.12;const directedY=userAim?H/2+input.aimY*145:player.y+player.dirY*120;
    const aimY = clamp(lerp(openY,directedY,userAim ? .62 : .28)+(Math.random()-.5)*(userAim?16:34/game.ai),FIELD.goalTop+22,FIELD.goalBottom-22);
    const power = clamp(charge, .15, 1); const publishKickEvent=releaseBall(player, targetX - player.x, aimY - player.y, style==="chip"?500+power*220:style==="finesse"?570+power*300:620+power*430, "shot", { commandType: GameCommandType.SHOOT, power, style, targetId: keeper ? compatibilityPlayerId(keeper) : null, aimY, contextEnergy: .55 + power * 1.2, contextX: player.x + player.dirX * 18, contextY: player.y + player.dirY * 18 });
    if(style==="chip"){ball.vz=10.5+power*4.5;ball.curve=0;}else if(style==="finesse"){ball.curve=clamp((aimY-H/2)/105,-1.65,1.65);ball.vz=2.6;}publishKickEvent();
    game.stats.shots[player.team] += 1; announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);
  }

  function tackle(player) {
    if (player.cooldown > 0) return;
    const opponent = ball.owner && ball.owner.team !== player.team ? ball.owner : closestPlayer(player.team === HOME ? AWAY : HOME, player);
    if (!opponent || distance(player, opponent) > 48) return;
    player.cooldown = .7; triggerAnimation(player, "tackle", .38); const chance = .48 + (player.rating - opponent.rating) * .012;
    const success = ball.owner === opponent && Math.random() < chance;
    if (success) {
      ball.possession=releasePossession(ball.possession,"tackle",possessionId(opponent));ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;
      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; announce(`${player.name} đoạt bóng!`);
    }
    publishCompatibilityEvent(GameEventType.TACKLE_RESOLVED, {
      playerId: compatibilityPlayerId(player),
      opponentId: compatibilityPlayerId(opponent),
      success,
      x: player.x + player.dirX * 14,
      y: player.y + player.dirY * 14,
      contextEnergy: .8,
      audioPower: .3
    });
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

  function executeAttackAction(code,charge,modifiers={}) {
    const player=game.selected;if(ball.owner!==player){input.bufferedAction={code,charge,modifiers,expires:performance.now()+280};return;}
    if(code===FO4_CONTROLS.shortPass)passBall(player,charge,modifiers.q);
    else if(code===FO4_CONTROLS.throughBall)throughBall(player,charge,modifiers.q);
    else if(code===FO4_CONTROLS.loftPass)loftBall(player,charge);
    else if(code===FO4_CONTROLS.shoot)shootBall(player,charge,modifiers.q?"chip":modifiers.z?"finesse":"power");
  }

  function updateInput() {
    const charge = browserInput?.activeCharge ?? null;
    input.actionStart = charge ? Math.max(charge.startedAt, Number.EPSILON) : 0;
    input.actionCharge = charge?.power ?? 0;
  }

  function moveToward(player, tx, ty, speed, dt) {
    const movement=stepTowardTarget({x:player.x,y:player.y,vx:player.vx,vy:player.vy,dirX:player.dirX,dirY:player.dirY,targetX:tx,targetY:ty,speed,dt,config:locomotionConfig.ai});
    player.vx=movement.vx;player.vy=movement.vy;player.dirX=movement.dirX;player.dirY=movement.dirY;
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
    const attacking=isAttacking();const sprinting=isKeyPressed(FO4_CONTROLS.sprint);
    const precision=isKeyPressed(FO4_CONTROLS.shield);const marking=!attacking&&isKeyPressed(FO4_CONTROLS.shoot);let controlX=input.aimX;let controlY=input.aimY;let controlMagnitude=input.magnitude;let markTarget=null;
    if(marking){markTarget=ball.owner?.team===AWAY?ball.owner:closestPlayer(AWAY,ball,false);if(markTarget){const dx=markTarget.x-player.x;const dy=markTarget.y-player.y;const d=Math.hypot(dx,dy);const toward=normalize(dx,dy);if(d>46){const mixed=normalize(toward.x+input.moveX*.65,toward.y+input.moveY*.65);controlX=mixed.x;controlY=mixed.y;controlMagnitude=clamp(.58+(d-46)/150,0,1);}else if(input.magnitude>.08){controlX=input.aimX;controlY=input.aimY;controlMagnitude=input.magnitude*.62;}else controlMagnitude=0;}}
    const controlledLocomotion=locomotionConfig.controlled;const hasMove=controlMagnitude>controlledLocomotion.minimumMoveMagnitude;
    if(precision&&!attacking){markTarget=ball.owner?.team===AWAY?ball.owner:closestPlayer(AWAY,ball,false);if(markTarget){const face=normalize(markTarget.x-player.x,markTarget.y-player.y);player.dirX=lerp(player.dirX,face.x,1-Math.exp(-dt*20));player.dirY=lerp(player.dirY,face.y,1-Math.exp(-dt*20));}}
    const wasSprinting=player.sprinting;const canSprint=sprinting&&!precision&&player.stamina>controlledLocomotion.sprintStaminaThreshold;const boost=canSprint?controlledLocomotion.sprintMultiplier:1;
    player.sprinting=canSprint&&hasMove;player.controlBoost=Math.max(0,player.controlBoost-dt);const baseSpeed=marking?controlledLocomotion.markingSpeed:precision?controlledLocomotion.precisionSpeed:controlledLocomotion.baseSpeed;const speed=baseSpeed*boost*controlMagnitude;
    if(hasMove){
      const turn=chooseTurnResponse({currentX:player.vx||controlX,currentY:player.vy||controlY,desiredX:controlX,desiredY:controlY,config:controlledLocomotion,boosted:player.controlBoost>0});const baseResponse=marking?controlledLocomotion.markingResponse:precision?controlledLocomotion.precisionResponse:turn.response;const response=chooseSprintTransitionResponse({wasSprinting,sprinting:player.sprinting,baseResponse,config:controlledLocomotion});const velocity=stepVelocity({vx:player.vx,vy:player.vy,desiredX:controlX,desiredY:controlY,targetSpeed:speed,dt,response,turnGrip:turn.turnGrip});player.vx=velocity.vx;player.vy=velocity.vy;
      const face=marking&&markTarget?normalize(markTarget.x-player.x,markTarget.y-player.y):{x:controlX,y:controlY};const facing=stepFacing({dirX:player.dirX,dirY:player.dirY,targetX:face.x,targetY:face.y,dt,response:controlledLocomotion.facingResponse});player.dirX=facing.dirX;player.dirY=facing.dirY;
    }else{const velocity=dampVelocity({vx:player.vx,vy:player.vy,dt,damping:controlledLocomotion.stopDamping});player.vx=velocity.vx;player.vy=velocity.vy;}
    player.stamina=stepStamina({stamina:player.stamina,moving:hasMove,sprinting:player.sprinting,precision,magnitude:input.magnitude,dt,config:controlledLocomotion});
  }

  function updateAI(player, dt) {
    const team = player.team; const attackDirection = team === HOME ? 1 : -1; const ownGoalX = team === HOME ? FIELD.left : FIELD.right;
    const hasBall = ball.owner === player;
    const teamChaser = closestPlayer(team, ball, player.role === "GK");
    const aiSpeed = 168 * (team === AWAY ? game.ai : .96);

    if (player.role === "GK") {
      if(team===HOME&&controlMode()==="defense"&&isKeyPressed(FO4_CONTROLS.throughBall)){moveToward(player,ball.x,ball.y,aiSpeed*1.34,dt);return;}
      const gx=team===HOME?82:1118;const danger=team===HOME?ball.x<330:ball.x>870;const projectedY=clamp(projectedGoalY(team),FIELD.goalTop+18,FIELD.goalBottom-18);const shotIncoming=!ball.owner&&(team===HOME?ball.vx<0:ball.vx>0)&&Math.hypot(ball.vx,ball.vy)>360;
      if(shotIncoming&&danger&&Math.abs(projectedY-player.y)>24&&Math.abs(projectedY-player.y)<155&&player.diveCooldown<=0&&ball.height<3.1){
        triggerAnimation(player,"dive",.5,Math.sign(projectedY-player.y));player.diveCooldown=1.05;
      }
      const stepX=shotIncoming?(team===HOME?104:1096):gx;const targetY=shotIncoming?projectedY:clamp(ball.y,FIELD.goalTop+25,FIELD.goalBottom-25);moveToward(player,danger?stepX:gx,targetY,aiSpeed*(shotIncoming?1.04:.78),dt);
      if (hasBall && player.cooldown <= 0) {
        const target = players.find((p) => p.team === team && p.role === "DF");
        releaseBall(player, target.x - player.x, target.y - player.y, 520, "pass", { commandType: GameCommandType.SHORT_PASS, power: .35, style: "short", targetId: compatibilityPlayerId(target) })(); player.cooldown = 1;
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
    const teammatePress=team===HOME&&controlMode()==="defense"&&isKeyPressed(FO4_CONTROLS.teammateRun)&&player===pressSupport;
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
    if (ball.lock > 0) ball.lock -= dt; else if(!ball.owner&&ball.possession.state==="released") ball.possession=settleLoose(ball.possession);
    if (ball.pendingPass) { ball.pendingPass.timer -= dt; if (ball.pendingPass.timer <= 0) ball.pendingPass = null; }
    if (ball.owner) {
      const owner=ball.owner;ball.height=0;ball.vz=0;const precision=owner===game.selected&&!owner.sprinting;const speed=Math.hypot(owner.vx,owner.vy);const touch=Math.sin(owner.stepPhase);if(Math.abs(touch)>.82)owner.dribbleSide=touch>0?1:-1;const mode=owner.sprinting?"sprint":precision?"precision":"normal";const anchor=dribbleAnchor({owner,mode,stepPhase:owner.stepPhase,config:ballControlConfig.dribble});const follow=1-Math.exp(-dt*anchor.followRate);ball.x=lerp(ball.x,anchor.x,follow);ball.y=lerp(ball.y,anchor.y,follow);ball.vx=owner.vx;ball.vy=owner.vy;
      ball.angle += Math.hypot(owner.vx, owner.vy) * dt * .035;
      game.stats.possession[owner.team] += dt;
    } else {
      const speed=Math.hypot(ball.vx,ball.vy);if(speed>20&&Math.abs(ball.curve)>.005){const turn=ball.curve*dt;const cos=Math.cos(turn),sin=Math.sin(turn);const vx=ball.vx;ball.vx=vx*cos-ball.vy*sin;ball.vy=vx*sin+ball.vy*cos;}ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.height+=ball.vz*dt;ball.vz-=22*dt;if(ball.height<0){ball.height=0;if(Math.abs(ball.vz)>3.5)ball.vz=-ball.vz*.34;else ball.vz=0;}const friction=Math.pow(game.weather==="rain"?.36:.22,dt);ball.vx*=friction;ball.vy*=friction;
      if (Math.hypot(ball.vx, ball.vy) < 4) ball.vx = ball.vy = 0;
      if (ball.lock <= 0) {
        let pickup=null;let best=Infinity;
        for (const player of players) {
          const d=distance(player,ball);const eligibility=captureEligibility({distance:d,ballHeight:ball.height,ballSpeed:Math.hypot(ball.vx,ball.vy),locked:ball.lock>0,playerCooldown:player.cooldown,isGoalkeeper:player.role==="GK",isLastTouch:player===ball.lastTouch,config:ballControlConfig.capture});if(eligibility.eligible&&d<best){pickup=player;best=d;}
        }
        if (pickup) {
          const ballSpeed=Math.hypot(ball.vx,ball.vy);const precision=pickup===game.selected&&isKeyPressed(FO4_CONTROLS.shield);const score=firstTouchScore({ballSpeed,incomingX:ball.vx,incomingY:ball.vy,facingX:pickup.dirX,facingY:pickup.dirY,ballHeight:ball.height,playerSpeed:Math.hypot(pickup.vx,pickup.vy),rating:pickup.rating,precision,sprinting:pickup.sprinting,config:ballControlConfig.firstTouch,captureConfig:ballControlConfig.capture});const outcome=classifyFirstTouch(score,ballControlConfig.firstTouch);const touch=resolveFirstTouch({outcome,ballX:ball.x,ballY:ball.y,ballVx:ball.vx,ballVy:ball.vy,receiver:pickup});
          ball.x=touch.x;ball.y=touch.y;ball.vx=touch.vx;ball.vy=touch.vy;ball.lock=Math.max(ball.lock,touch.lock);
          if(touch.controls)setOwner(pickup,outcome,outcome==="cushioned"?{vx:touch.vx,vy:touch.vy}:null);else{ball.owner=null;ball.lastTouch=pickup;ball.possession=releasePossession(beginReceiving(ball.possession,possessionId(pickup)),outcome,possessionId(pickup));pickup.cooldown=Math.max(pickup.cooldown,touch.lock);triggerAnimation(pickup,"receive",outcome==="heavy"?.26:.18);}
        }
      }
    }

    const visualSpeed=Math.hypot(ball.vx,ball.vy);ball.trail=presentationPort.recordBallTrail({ x: ball.x, y: ball.y, height:ball.height },{speed:visualSpeed});
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
    game.score[team] += 1; ball.possession=releasePossession(ball.possession,"goal",possessionId(ball.owner));ball.owner = null; game.goalScorer = scorer;
    // Engine snapshots exclusively activate and advance replay.
    const goalDuration=3.65; game.goalSequence = { team, nextTeam: team === HOME ? AWAY : HOME, timer: goalDuration, duration: goalDuration };
    for (const player of players) if (player.team === team) triggerAnimation(player, "celebrate", goalDuration, player === scorer ? 1 : .65);
    announce(team === HOME ? "GOOOOAL! TONY FC GHI BÀN!" : "Neon United ghi bàn!");
    ui.replayBadge.textContent = "● INSTANT REPLAY"; ui.replayBadge.classList.toggle("show", game.replay.active);
    publishCompatibilityEvent(GameEventType.SCORE_CHANGED, {
      team,
      scorerId: compatibilityPlayerId(scorer),
      score: game.score.slice(),
      replayAvailable: game.replay.active,
      x: team === HOME ? FIELD.right : FIELD.left,
      y: H / 2,
      particleCount: 80,
      particleColor: team === HOME ? "#e1bb58" : "#47c9d4",
      particleEnergy: 3.5
    });
    if (game.replay.active) publishCompatibilityEvent(GameEventType.REPLAY_STARTED);
  }

  function updateLegacyReplay() {
    // Replay phase and progress are immutable engine snapshot facts.
    return false;
  }

function updatePresentation(dt) {
    updateInput(); presentationPort.stepEffects(dt);
    game.cameraNotice = Math.max(0, game.cameraNotice - dt);
  }

  function updateLegacyGameplay(dt) {
    legacyGameplayStepCount += 1;
    updateInput(); presentationPort.stepEffects(dt); updateLegacyReplay(dt);
    game.cameraNotice = Math.max(0, game.cameraNotice - dt);
    if (game.state !== "playing") return;
    for (const player of players) {
      player.animTime = Math.max(0, player.animTime - dt);
      if (player.animTime === 0) { player.anim = "idle"; player.animPower = 0; }
    }
    if (game.goalSequence) {
      game.goalSequence.timer -= dt;
      if (game.goalSequence.timer <= 0) { const nextTeam = game.goalSequence.nextTeam; game.goalSequence = null; game.replay.stop(); ui.replayBadge.classList.remove("show"); kickoff(nextTeam); }
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
    resolvePlayerCollisions(); updateBall(dt);
    if (!ball.owner || ball.owner.team !== HOME) {
      const nearest = closestPlayer(HOME, ball, false); if (game.selected && distance(game.selected, ball) > distance(nearest, ball) + 145) game.selected = nearest;
    }
  }

  function updateMotionState(player,dt) {
    const speed=Math.hypot(player.vx,player.vy);const moving=speed>18;const target=moving?Math.atan2(player.vx,player.vy):player.motionYaw;const delta=Math.atan2(Math.sin(target-player.motionYaw),Math.cos(target-player.motionYaw));
    player.motionYaw=smoothAngle(player.motionYaw,target,1-Math.exp(-dt*(player.sprinting?7.5:10.5)));player.turnLean=lerp(player.turnLean,clamp(delta*1.35,-.72,.72),1-Math.exp(-dt*9));player.strideBlend=lerp(player.strideBlend,moving?clamp(speed/205,0,1.35):0,1-Math.exp(-dt*(moving?10:7)));
  }

function announce(message) { ui.commentary.textContent = message; game.messageTimer = 3; }

  function cycleCamera() {
    const modes = ["broadcast", "close", "tactical"]; const labels = { broadcast: "BROADCAST", close: "CLOSE ACTION", tactical: "TACTICAL" };
    game.cameraMode = modes[(modes.indexOf(game.cameraMode) + 1) % modes.length]; game.cameraNotice = 1.6;
    ui.replayBadge.textContent = `CAMERA · ${labels[game.cameraMode]}`; ui.replayBadge.classList.add("show"); 
  }

  function cycleWeather() {
    presentationPort.setSetting("weather",game.weather==="rain"?"clear":"rain");game.cameraNotice=1.8;ui.replayBadge.textContent=game.weather==="rain"?"WEATHER · RAIN":"WEATHER · CLEAR";ui.replayBadge.classList.add("show");announce(game.weather==="rain"?"Mưa bắt đầu — mặt sân đang trơn hơn!":"Trời quang — tốc độ trận đấu trở lại tối đa.");
  }

  function createPresentationFeedback() {
    return createBrowserPresentationFeedbackAdapter({
      target: window,
      getSnapshot: () => compatibilitySnapshots.snapshot,
      onParticles: (facts) => presentationPort.emitParticles(facts),
      onContextParticles: (facts) => presentationPort.emitContextParticles({ ...facts, weather: game.weather, pitchStyle: game.pitchStyle })
    });
  }

function simulationStep(dt) {
    compatibilityTick += 1;
    updatePresentation(dt);
    if (game.messageTimer > 0) game.messageTimer -= dt;
    captureCompatibilitySnapshot();
  }

  function renderFrame() {
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
  }

  const simulationLoop = createSimulationLoop({
    update: simulationStep,
    render: renderFrame,
    clockOptions: gameplayConfig.simulation,
  });

  // Isolated legacy migration helper. Deployed browser composition never references it.
  function applyCompatibilityCommand(command) {
    if (command.type === GameCommandType.MOVE) {
      input.moveX = command.payload.x; input.moveY = command.payload.y; input.magnitude = Math.hypot(input.moveX, input.moveY);
      if (input.magnitude > .1) { input.aimX = input.moveX; input.aimY = input.moveY; }
      return;
    }
    if (command.type === GameCommandType.SWITCH_PLAYER) switchPlayer();
    else if (command.type === GameCommandType.SWITCH_PLAYER_DIRECTION) {
      const { x, y } = command.payload.direction;
      const code = Math.abs(x) > Math.abs(y) ? (x < 0 ? "ArrowLeft" : "ArrowRight") : (y < 0 ? "ArrowUp" : "ArrowDown");
      switchPlayerInDirection(code);
    } else if (command.type === GameCommandType.TACKLE) tackle(game.selected);
    else if (command.type === GameCommandType.SLIDE_TACKLE) slideTackle(game.selected);
    else if (command.type === GameCommandType.TRIGGER_TEAMMATE_RUN) triggerTeammateRun();
    else if ([GameCommandType.SHORT_PASS,GameCommandType.THROUGH_BALL,GameCommandType.LOFTED_PASS,GameCommandType.SHOOT].includes(command.type)) {
      const actionCode = {
        [GameCommandType.SHORT_PASS]: FO4_CONTROLS.shortPass,
        [GameCommandType.THROUGH_BALL]: FO4_CONTROLS.throughBall,
        [GameCommandType.LOFTED_PASS]: FO4_CONTROLS.loftPass,
        [GameCommandType.SHOOT]: FO4_CONTROLS.shoot
      }[command.type];
      const modifiers = command.payload.modifiers ?? {};
      executeAttackAction(actionCode, command.payload.power, {
        q: Boolean(modifiers.oneTwo || modifiers.chip),
        z: Boolean(modifiers.finesse)
      });
    } else if (command.type === GameCommandType.START_MATCH) {
      startMatch(); publishCompatibilityEvent(GameEventType.MATCH_STARTED);
    } else if (command.type === GameCommandType.RESTART_MATCH) {
      startMatch(); publishCompatibilityEvent(GameEventType.MATCH_RESTARTED);
    } else if (command.type === GameCommandType.PAUSE_MATCH) {
      togglePause(true); publishCompatibilityEvent(GameEventType.MATCH_PAUSED);
    } else if (command.type === GameCommandType.RESUME_MATCH) {
      togglePause(false); publishCompatibilityEvent(GameEventType.MATCH_RESUMED);
    }
  }

  const browserBootstrap = new BrowserBootstrapComposition({
    target: window,
    document,
    runtimeComposition,
    simulationLoop,
    snapshotAdapter: compatibilitySnapshots,
    onNavigation: (action) => {
      if (action.type === ApplicationActionType.OPEN_MATCH_SETUP) showMatchSetup({ reset: true });
      if (action.type === ApplicationActionType.OPEN_MAIN_MENU) showMainMenu();
    },
    onCameraCycle: cycleCamera,
    getCompatibilityControlMode: controlMode,
    getCompatibilityMatchState: () => game.state,
    createPresentationFeedback,
    getPresentationFrameFacts: () => Object.freeze({
      cameraMode: game.cameraMode,
      goalScorerId: game.goalScorer ? compatibilityPlayerId(game.goalScorer) : null,
    }),
  });
  browserInput = browserBootstrap.inputAdapter;

  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-difficulty]").forEach((item) => item.classList.remove("active")); button.classList.add("active");
    game.difficulty = button.dataset.difficulty; game.ai = { rookie: .78, pro: 1, legend: 1.18 }[game.difficulty]; 
  }));
  presentationPort.configureSettings({
    values: { pitch: game.pitchStyle, ball: game.ballStyle, weather: game.weather, sound: game.sound },
    allowed: { pitch: Object.keys(PITCH_STYLES), ball: Object.keys(BALL_STYLES), weather: Object.keys(WEATHER_STYLES) },
    apply: {
      pitch: ({ value }) => { game.pitchStyle=value; applyPitchStyle(); },
      ball: ({ value }) => { game.ballStyle=value; applyBallStyle(); },
      weather: ({ value }) => { game.weather=value; applyPitchStyle(); },
      sound: ({ value }) => { game.sound=value; },
    },
  });
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  function applyDebugScenario(name = "normal-play") {
    if (game.state !== "playing") startMatch();
    game.replay.reset(); ui.replayBadge.classList.remove("show");
    ball.owner = null; ball.vx = 0; ball.vy = 0; ball.height = 0; ball.vz = 0; ball.lock = 0;
    const selected = game.selected || players.find((player) => player.team === HOME && player.role !== "GK");
    if (selected) { selected.stamina = 100; game.selected = selected; }
    if (name === "lower-left-camera") { ball.x = FIELD.left + 45; ball.y = FIELD.bottom - 42; ball.vx = -260; ball.vy = 170; }
    else if (name === "lower-right-camera") { ball.x = FIELD.right - 45; ball.y = FIELD.bottom - 42; ball.vx = 260; ball.vy = 170; }
    else if (name === "radar-crowded") {
      players.forEach((player, index) => { player.x = W / 2 + (index % 4 - 1.5) * 42; player.y = H / 2 + (Math.floor(index / 4) - 1) * 38; });
      ball.x = W / 2; ball.y = H / 2; announce("RADAR VISIBILITY CHECK");
    } else if (name === "low-stamina") {
      if (selected) selected.stamina = 18; ball.x = selected?.x ?? W / 2; ball.y = selected?.y ?? H / 2;
    } else if (name === "replay") {
      const baseSnapshot = captureCompatibilitySnapshot();
      void baseSnapshot;
      // Debug scenarios cannot inject or activate presentation replay.
      ui.replayBadge.textContent = "● INSTANT REPLAY"; ui.replayBadge.classList.add("show");
    }
    captureCompatibilitySnapshot();
    if (name !== "normal-play") {
      game.state = "paused";
      ui.pause.classList.remove("show");
      browserInput.reset({ requestPause: false });
    }
  }

  window.__TONY_DEBUG__ = {
    ready: false,
    applyScenario: applyDebugScenario,
    emitGameEvent: (type, payload = {}) => publishCompatibilityEvent(type, payload),
    diagnostics: () => ({
      cameraReplay: cameraReplayBridge.diagnostics(),
      settingsEffects: presentationPort.diagnostics(),
      ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
      state: game.state,
      replay: game.replay.active,
      renderer: rendererPreference === "canvas" ? "canvas" : "webgl",
      visualTestMode,
      legacyGameplayStepCount,
      selectedStamina: game.selected?.stamina ?? null,
      engineSnapshot: compatibilitySnapshots.snapshot,
      renderState: compatibilitySnapshots.snapshot ? {
        selectedPlayerId: compatibilitySnapshots.snapshot.match.selectedPlayerId,
        selectedX: compatibilitySnapshots.snapshot.players.find((player) => player.id === compatibilitySnapshots.snapshot.match.selectedPlayerId)?.x ?? null
      } : null,
      snapshot: compatibilitySnapshots.snapshot ? {
        tick: compatibilitySnapshots.snapshot.tick,
        selectedPlayerId: compatibilitySnapshots.snapshot.match.selectedPlayerId,
        score: [...compatibilitySnapshots.snapshot.match.score]
      } : null,
    }),
  };

  createTeams(); browserBootstrap.start();
  const debugScenario = new URLSearchParams(location.search).get("debugScenario");
  if (debugScenario) applyDebugScenario(debugScenario);
  window.__TONY_DEBUG__.ready = true;
})();

