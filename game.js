"use strict";

(() => {
  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
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

  const ui = {
    homeScore: $("homeScore"), awayScore: $("awayScore"), gameClock: $("gameClock"), matchState: $("matchState"),
    start: $("startOverlay"), pause: $("pauseOverlay"), result: $("resultOverlay"), commentary: $("commentary"),
    staminaBar: $("staminaBar"), staminaText: $("staminaText"), playerName: $("playerName"),
    playerNumber: $("playerNumber"), playerRating: $("playerRating"), possessionStat: $("possessionStat"),
    possessionBar: $("possessionBar"), homeShots: $("homeShots"), awayShots: $("awayShots"), passStat: $("passStat")
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
    }
  }

  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, radius: 9, owner: null, lastTouch: null, lock: 0, trail: [], pendingPass: null };
  const game = {
    state: "menu", difficulty: "pro", ai: 1, time: MATCH_SECONDS, score: [0, 0], selected: null,
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    shake: 0, flash: 0, messageTimer: 0, kickOffTimer: 0, particles: [], lastTime: performance.now(), sound: true
  };
  let players = [];
  const input = { keys: new Set(), moveX: 0, moveY: 0, touchX: 0, touchY: 0, shootStart: 0, shootCharge: 0 };

  function createTeams() {
    players = [
      ...formations.home.map((spec, index) => new Player(HOME, spec, index)),
      ...formations.away.map((spec, index) => new Player(AWAY, spec, index))
    ];
    game.selected = players[4];
  }

  function resetMatch() {
    createTeams();
    game.time = MATCH_SECONDS; game.score = [0, 0]; game.stats = { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 };
    game.particles.length = 0; game.flash = 0; kickoff(HOME); updateUI(true);
  }

  function kickoff(team) {
    players.forEach((player) => {
      player.x = player.baseX; player.y = player.baseY; player.vx = player.vy = 0; player.stamina = Math.max(55, player.stamina);
    });
    const taker = team === HOME ? players[4] : players[10];
    taker.x = W / 2 + (team === HOME ? -26 : 26); taker.y = H / 2;
    ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.owner = null; ball.lastTouch = null; ball.lock = .8; ball.pendingPass = null;
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

  function switchPlayer() {
    if (ball.owner?.team === HOME) { game.selected = ball.owner; return; }
    const candidates = players.filter((player) => player.team === HOME && player.role !== "GK").sort((a, b) => distance(a, ball) - distance(b, ball));
    game.selected = candidates.find((player) => player !== game.selected) || candidates[0];
    tone(520, .035, "sine", .025);
  }

  function setOwner(player) {
    if (ball.pendingPass && player.team === ball.pendingPass.team) {
      if (player.team === HOME) game.stats.completed += 1;
      ball.pendingPass = null;
    } else if (ball.pendingPass && player.team !== ball.pendingPass.team) ball.pendingPass = null;
    ball.owner = player; ball.lastTouch = player; ball.vx = ball.vy = 0;
    if (player.team === HOME && player.role !== "GK") game.selected = player;
  }

  function releaseBall(player, dx, dy, speed, type) {
    const n = normalize(dx, dy); ball.owner = null; ball.lastTouch = player; ball.lock = type === "shot" ? .13 : .2;
    ball.x = player.x + n.x * (player.radius + 10); ball.y = player.y + n.y * (player.radius + 10);
    ball.vx = n.x * speed + player.vx * .25; ball.vy = n.y * speed + player.vy * .25;
    player.cooldown = .18; kickSound(type === "shot" ? .9 : .55);
    for (let i = 0; i < (type === "shot" ? 9 : 4); i += 1) spawnParticle(ball.x, ball.y, type === "shot" ? "#f5d067" : "#f4f7f5", 1.2);
  }

  function passBall(player) {
    if (ball.owner !== player) { tackle(player); return; }
    const teammates = players.filter((p) => p.team === player.team && p !== player && p.role !== "GK");
    const facing = normalize(player.dirX || (player.team === HOME ? 1 : -1), player.dirY);
    let target = teammates[0]; let best = -Infinity;
    for (const candidate of teammates) {
      const dx = candidate.x - player.x; const dy = candidate.y - player.y; const d = length(dx, dy);
      const forward = (dx / d) * facing.x + (dy / d) * facing.y;
      const attack = player.team === HOME ? dx : -dx;
      const score = forward * 220 + attack * .25 - d * .18;
      if (score > best) { target = candidate; best = score; }
    }
    const leadX = target.x + target.vx * .18; const leadY = target.y + target.vy * .18;
    const d = distance(player, target); releaseBall(player, leadX - player.x, leadY - player.y, clamp(430 + d * .35, 480, 650), "pass");
    if (player.team === HOME) game.stats.passes += 1;
    ball.pendingPass = { team: player.team, timer: 1.8 }; announce(`${player.name} chọc khe!`);
  }

  function shootBall(player, charge = .5) {
    if (ball.owner !== player) { tackle(player); return; }
    const targetX = player.team === HOME ? FIELD.right + 45 : FIELD.left - 45;
    const keeper = players.find((p) => p.team !== player.team && p.role === "GK");
    const openY = keeper.y < H / 2 ? FIELD.goalBottom - 34 : FIELD.goalTop + 34;
    const aimY = lerp(openY, player.y + player.dirY * 120, .28) + (Math.random() - .5) * (34 / game.ai);
    const power = clamp(charge, .15, 1); releaseBall(player, targetX - player.x, aimY - player.y, 620 + power * 430, "shot");
    game.stats.shots[player.team] += 1; announce(power > .78 ? `${player.name} tung CÚ SÚT SẤM SÉT!` : `${player.name} dứt điểm!`);
  }

  function tackle(player) {
    if (player.cooldown > 0) return;
    const opponent = ball.owner && ball.owner.team !== player.team ? ball.owner : closestPlayer(player.team === HOME ? AWAY : HOME, player);
    if (!opponent || distance(player, opponent) > 48) return;
    player.cooldown = .7; const chance = .48 + (player.rating - opponent.rating) * .012;
    if (ball.owner === opponent && Math.random() < chance) {
      ball.owner = null; const n = normalize(opponent.x - player.x, opponent.y - player.y); ball.x = opponent.x; ball.y = opponent.y;
      ball.vx = n.x * 250; ball.vy = n.y * 250; ball.lock = .18; ball.lastTouch = player; announce(`${player.name} đoạt bóng!`); kickSound(.3);
    }
  }

  function updateInput() {
    let x = input.touchX; let y = input.touchY;
    if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) x -= 1;
    if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) x += 1;
    if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) y -= 1;
    if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) y += 1;
    const n = length(x, y); input.moveX = n > 1 ? x / n : x; input.moveY = n > 1 ? y / n : y;
    if (input.shootStart) input.shootCharge = clamp((performance.now() - input.shootStart) / 900, 0, 1);
  }

  function moveToward(player, tx, ty, speed, dt) {
    const dx = tx - player.x; const dy = ty - player.y; const n = normalize(dx, dy);
    const wantedX = n.x * speed; const wantedY = n.y * speed; const response = 1 - Math.exp(-dt * 8);
    player.vx = lerp(player.vx, wantedX, response); player.vy = lerp(player.vy, wantedY, response);
    if (Math.hypot(dx, dy) < 8) { player.vx *= .7; player.vy *= .7; }
    if (Math.abs(player.vx) + Math.abs(player.vy) > 4) { const dir = normalize(player.vx, player.vy); player.dirX = dir.x; player.dirY = dir.y; }
  }

  function updateUser(player, dt) {
    const sprinting = input.keys.has("KeyL") || input.keys.has("ShiftLeft") || $("mobileSprint").classList.contains("active");
    const hasMove = Math.abs(input.moveX) + Math.abs(input.moveY) > .05;
    const boost = sprinting && player.stamina > 2 ? 1.42 : 1;
    const speed = 205 * boost;
    if (hasMove) {
      player.vx = lerp(player.vx, input.moveX * speed, 1 - Math.exp(-dt * 12));
      player.vy = lerp(player.vy, input.moveY * speed, 1 - Math.exp(-dt * 12));
      player.dirX = input.moveX; player.dirY = input.moveY;
      player.stamina = clamp(player.stamina - dt * (sprinting ? 12 : 1.2), 0, 100);
    } else { player.vx *= Math.pow(.0008, dt); player.vy *= Math.pow(.0008, dt); player.stamina = clamp(player.stamina + dt * 5, 0, 100); }
  }

  function updateAI(player, dt) {
    const team = player.team; const attackDirection = team === HOME ? 1 : -1; const ownGoalX = team === HOME ? FIELD.left : FIELD.right;
    const hasBall = ball.owner === player;
    const teamChaser = closestPlayer(team, ball, player.role === "GK");
    const aiSpeed = 168 * (team === AWAY ? game.ai : .96);

    if (player.role === "GK") {
      const gx = team === HOME ? 82 : 1118; const danger = team === HOME ? ball.x < 270 : ball.x > 930;
      moveToward(player, danger && !ball.owner ? clamp(ball.x, team === HOME ? 66 : 1040, team === HOME ? 160 : 1134) : gx, clamp(ball.y, FIELD.goalTop + 25, FIELD.goalBottom - 25), aiSpeed * .78, dt);
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
      if (pressure && Math.random() < dt * .85 * game.ai) { passBall(player); return; }
      const weave = Math.sin(performance.now() * .0017 + player.index) * 105;
      moveToward(player, goalX, clamp(H / 2 + weave, 130, H - 130), aiSpeed * 1.03, dt); return;
    }

    const shouldChase = teamChaser === player && (!ball.owner || ball.owner.team !== team);
    if (shouldChase) { moveToward(player, ball.x, ball.y, aiSpeed * 1.08, dt); return; }

    let tx = player.baseX + (ball.x - W / 2) * .26; let ty = player.baseY + (ball.y - H / 2) * .2;
    if (ball.owner?.team === team) { tx += attackDirection * (player.role === "FW" ? 120 : 55); ty += Math.sin(performance.now() * .001 + player.index) * 25; }
    if (ball.owner?.team !== team) tx = lerp(tx, ownGoalX, player.role === "DF" ? .15 : .05);
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
    if (ball.lock > 0) ball.lock -= dt;
    if (ball.pendingPass) { ball.pendingPass.timer -= dt; if (ball.pendingPass.timer <= 0) ball.pendingPass = null; }
    if (ball.owner) {
      const owner = ball.owner; const lead = owner.radius + 11; ball.x = owner.x + owner.dirX * lead; ball.y = owner.y + owner.dirY * lead; ball.vx = owner.vx; ball.vy = owner.vy;
      game.stats.possession[owner.team] += dt;
    } else {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; const friction = Math.pow(.22, dt); ball.vx *= friction; ball.vy *= friction;
      if (Math.hypot(ball.vx, ball.vy) < 4) ball.vx = ball.vy = 0;
      if (ball.lock <= 0) {
        let pickup = null; let best = 29;
        for (const player of players) {
          if (player.cooldown > 0 || player === ball.lastTouch && Math.hypot(ball.vx, ball.vy) > 550) continue;
          const d = distance(player, ball); if (d < best) { pickup = player; best = d; }
        }
        if (pickup) setOwner(pickup);
      }
    }

    ball.trail.unshift({ x: ball.x, y: ball.y }); if (ball.trail.length > 8) ball.trail.pop();
    const inGoalMouth = ball.y > FIELD.goalTop && ball.y < FIELD.goalBottom;
    if (inGoalMouth && ball.x > FIELD.right + 20) { goal(HOME); return; }
    if (inGoalMouth && ball.x < FIELD.left - 20) { goal(AWAY); return; }
    if (ball.y < FIELD.top + ball.radius) { ball.y = FIELD.top + ball.radius; ball.vy = Math.abs(ball.vy) * .74; }
    if (ball.y > FIELD.bottom - ball.radius) { ball.y = FIELD.bottom - ball.radius; ball.vy = -Math.abs(ball.vy) * .74; }
    if (!inGoalMouth && ball.x < FIELD.left + ball.radius) { ball.x = FIELD.left + ball.radius; ball.vx = Math.abs(ball.vx) * .74; }
    if (!inGoalMouth && ball.x > FIELD.right - ball.radius) { ball.x = FIELD.right - ball.radius; ball.vx = -Math.abs(ball.vx) * .74; }
  }

  function goal(team) {
    game.score[team] += 1; game.flash = 1; game.shake = 18; ball.owner = null; goalSound();
    for (let i = 0; i < 80; i += 1) spawnParticle(team === HOME ? FIELD.right : FIELD.left, H / 2, team === HOME ? "#e1bb58" : "#47c9d4", 3.5);
    announce(team === HOME ? "GOOOOAL! TONY FC GHI BÀN!" : "Neon United ghi bàn!"); updateUI(true);
    game.kickOffTimer = 2.1; setTimeout(() => { if (game.state === "playing") kickoff(team === HOME ? AWAY : HOME); }, 1800);
  }

  function spawnParticle(x, y, color, energy = 1) {
    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 150 * energy;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + Math.random() * .7, max: 1.1, color, size: 2 + Math.random() * 4 });
  }

  function updateParticles(dt) {
    for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 90 * dt; particle.vx *= Math.pow(.4, dt); particle.life -= dt; }
    game.particles = game.particles.filter((particle) => particle.life > 0);
  }

  function update(dt) {
    updateInput(); updateParticles(dt); game.flash = Math.max(0, game.flash - dt * 1.3); game.shake *= Math.pow(.04, dt);
    if (game.state !== "playing") return;
    if (game.kickOffTimer > 0) { game.kickOffTimer -= dt; return; }
    game.time -= dt; if (game.time <= 0) { game.time = 0; endMatch(); return; }

    for (const player of players) {
      player.cooldown = Math.max(0, player.cooldown - dt);
      if (player === game.selected) updateUser(player, dt); else updateAI(player, dt);
      player.x += player.vx * dt; player.y += player.vy * dt; keepPlayerInBounds(player);
    }
    resolvePlayerCollisions(); updateBall(dt);
    if (!ball.owner || ball.owner.team !== HOME) {
      const nearest = closestPlayer(HOME, ball, false); if (game.selected && distance(game.selected, ball) > distance(nearest, ball) + 145) game.selected = nearest;
    }
  }

  function drawPitch() {
    ctx.fillStyle = "#075b39"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i += 1) { ctx.fillStyle = i % 2 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.035)"; ctx.fillRect(FIELD.left + i * (FIELD.right - FIELD.left) / 12, FIELD.top, (FIELD.right - FIELD.left) / 12, FIELD.bottom - FIELD.top); }
    const gradient = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 650); gradient.addColorStop(0, "rgba(33,173,102,.14)"); gradient.addColorStop(1, "rgba(0,0,0,.2)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(235,246,239,.78)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    ctx.beginPath(); ctx.moveTo(W / 2, FIELD.top); ctx.lineTo(W / 2, FIELD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 83, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(235,246,239,.85)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2); ctx.fill();
    drawBox(FIELD.left, 175, 180, 350, 1); drawBox(FIELD.right, 175, -180, 350, -1);
    drawGoal(FIELD.left, FIELD.goalTop, -30, FIELD.goalBottom - FIELD.goalTop); drawGoal(FIELD.right, FIELD.goalTop, 30, FIELD.goalBottom - FIELD.goalTop);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2;
    [[FIELD.left, FIELD.top, 0, Math.PI/2],[FIELD.right, FIELD.top, Math.PI/2, Math.PI],[FIELD.right,FIELD.bottom,Math.PI,Math.PI*1.5],[FIELD.left,FIELD.bottom,Math.PI*1.5,Math.PI*2]].forEach(([x,y,s,e]) => { ctx.beginPath(); ctx.arc(x,y,18,s,e); ctx.stroke(); });
  }

  function drawBox(x, y, width, height, side) {
    ctx.strokeRect(side === 1 ? x : x + width, y, Math.abs(width), height);
    ctx.strokeRect(side === 1 ? x : x + width * .46, y + 92, Math.abs(width) * .46, height - 184);
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x + side * 125, H / 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + side * 125, H / 2, 72, side === 1 ? -Math.PI/2 : Math.PI/2, side === 1 ? Math.PI/2 : Math.PI*1.5); ctx.stroke();
  }

  function drawGoal(x, y, depth, height) {
    ctx.save(); ctx.strokeStyle = "rgba(245,249,247,.8)"; ctx.lineWidth = 2; ctx.strokeRect(depth < 0 ? x + depth : x, y, Math.abs(depth), height);
    ctx.globalAlpha = .25;
    for (let py = y + 10; py < y + height; py += 12) { ctx.beginPath(); ctx.moveTo(depth < 0 ? x + depth : x, py); ctx.lineTo(depth < 0 ? x : x + depth, py); ctx.stroke(); }
    ctx.restore();
  }

  function drawPlayer(player, now) {
    const selected = player === game.selected; const home = player.team === HOME; const running = Math.hypot(player.vx, player.vy) > 30;
    ctx.save(); ctx.translate(player.x, player.y);
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(4, 11, player.radius + 8, player.radius * .58, 0, 0, Math.PI * 2); ctx.fill();
    if (selected) {
      const pulse = 1 + Math.sin(now * .006) * .08; ctx.strokeStyle = "#ffda70"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 8, 27 * pulse, 15 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffda70"; ctx.beginPath(); ctx.moveTo(-7, -35); ctx.lineTo(7, -35); ctx.lineTo(0, -25); ctx.closePath(); ctx.fill();
    }
    const bob = running ? Math.sin(now * .014 + player.index) * 2 : 0;
    ctx.translate(0, bob);
    ctx.fillStyle = home ? "#f0c858" : "#45c7d3"; ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = home ? "#fff2bd" : "#b9f6fa"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = home ? "#171a1a" : "#10272a"; ctx.beginPath(); ctx.arc(0, -3, player.radius * .67, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white"; ctx.font = "700 12px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(player.number, 0, -2);
    ctx.fillStyle = "rgba(7,10,10,.78)"; ctx.fillRect(-24, 22, 48, 13); ctx.fillStyle = "white"; ctx.font = "700 8px Inter"; ctx.fillText(player.name, 0, 28.5);
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    for (let i = ball.trail.length - 1; i >= 0; i -= 1) { const point = ball.trail[i]; ctx.globalAlpha = (1 - i / ball.trail.length) * .08; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(point.x, point.y, ball.radius * (1 - i / 12), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(ball.x + 4, ball.y + 8, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f8faf7"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#17201d"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#17201d"; ctx.beginPath(); ctx.arc(ball.x, ball.y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawEffects() {
    for (const particle of game.particles) { ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); }
    ctx.globalAlpha = 1;
    if (input.shootStart && ball.owner === game.selected) {
      const x = game.selected.x; const y = game.selected.y - 44; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - 31, y, 62, 8);
      const grad = ctx.createLinearGradient(x - 30, 0, x + 30, 0); grad.addColorStop(0, "#e1bb58"); grad.addColorStop(1, input.shootCharge > .82 ? "#ff5b45" : "#ffdc78");
      ctx.fillStyle = grad; ctx.fillRect(x - 30, y + 1, 60 * input.shootCharge, 6);
    }
    if (game.flash > 0) { ctx.fillStyle = `rgba(255,225,126,${game.flash * .18})`; ctx.fillRect(0,0,W,H); ctx.fillStyle = `rgba(255,255,255,${game.flash})`; ctx.font = "800 104px Barlow Condensed"; ctx.textAlign = "center"; ctx.fillText("GOAL!", W/2, 150); }
  }

  function render(now) {
    ctx.save(); if (game.shake > .5) ctx.translate((Math.random() - .5) * game.shake, (Math.random() - .5) * game.shake);
    drawPitch(); [...players].sort((a,b) => a.y-b.y).forEach((player) => drawPlayer(player, now)); drawBall(); drawEffects(); ctx.restore();
    drawRadar();
  }

  function drawRadar() {
    const rw = radar.width; const rh = radar.height; rctx.clearRect(0,0,rw,rh); rctx.fillStyle = "#073522"; rctx.fillRect(0,0,rw,rh);
    rctx.strokeStyle = "rgba(255,255,255,.42)"; rctx.lineWidth = 1; rctx.strokeRect(5,5,rw-10,rh-10); rctx.beginPath(); rctx.moveTo(rw/2,5); rctx.lineTo(rw/2,rh-5); rctx.stroke();
    for (const player of players) { rctx.fillStyle = player.team === HOME ? "#e1bb58" : "#47c9d4"; rctx.beginPath(); rctx.arc(player.x/W*rw,player.y/H*rh,player===game.selected?4:2.7,0,Math.PI*2); rctx.fill(); }
    rctx.fillStyle = "white"; rctx.beginPath(); rctx.arc(ball.x/W*rw,ball.y/H*rh,2.2,0,Math.PI*2); rctx.fill();
  }

  function updateUI(force = false) {
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
    if (force) { ui.homeScore.classList.add("score-pop"); setTimeout(() => ui.homeScore.classList.remove("score-pop"), 250); }
  }

  function announce(message) { ui.commentary.textContent = message; game.messageTimer = 3; }

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
    if (game.messageTimer > 0) game.messageTimer -= dt; updateUI(); requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
    if (event.repeat && ["KeyJ","KeyK","Space","Escape"].includes(event.code)) return;
    input.keys.add(event.code);
    if (event.code === "Escape") togglePause();
    if (game.state !== "playing") return;
    if (event.code === "KeyJ") passBall(game.selected);
    if (event.code === "KeyK" && ball.owner === game.selected) { input.shootStart = performance.now(); input.shootCharge = 0; }
    if (event.code === "Space") switchPlayer();
  }
  function onKeyUp(event) {
    input.keys.delete(event.code);
    if (event.code === "KeyK" && input.shootStart) { shootBall(game.selected, input.shootCharge); input.shootStart = 0; input.shootCharge = 0; }
  }

  function setupTouch() {
    const joystick = $("joystick"); const knob = $("joystickKnob"); let pointerId = null;
    const moveJoystick = (event) => {
      const rect = joystick.getBoundingClientRect(); const x = event.clientX - rect.left - rect.width/2; const y = event.clientY - rect.top - rect.height/2; const max = rect.width*.32; const d = Math.hypot(x,y) || 1; const scale = Math.min(1,max/d);
      knob.style.transform = `translate(${x*scale}px,${y*scale}px)`; input.touchX = clamp(x/max,-1,1); input.touchY = clamp(y/max,-1,1);
    };
    joystick.addEventListener("pointerdown", (event) => { pointerId = event.pointerId; joystick.setPointerCapture(pointerId); moveJoystick(event); });
    joystick.addEventListener("pointermove", (event) => { if(event.pointerId===pointerId) moveJoystick(event); });
    const release = (event) => { if(event.pointerId!==pointerId)return; pointerId=null; input.touchX=input.touchY=0; knob.style.transform=""; };
    joystick.addEventListener("pointerup",release); joystick.addEventListener("pointercancel",release);
    bindTouchButton($("mobilePass"), () => passBall(game.selected));
    bindTouchButton($("mobileShoot"), null, () => { if(ball.owner===game.selected){input.shootStart=performance.now();input.shootCharge=0;} }, () => { if(input.shootStart){shootBall(game.selected,input.shootCharge);input.shootStart=0;input.shootCharge=0;} });
    bindTouchButton($("mobileSprint"));
  }

  function bindTouchButton(button, tap, down, up) {
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add("active"); down?.(); tap?.(); });
    const release = () => { button.classList.remove("active"); up?.(); };
    button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release);
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
  window.addEventListener("blur", () => { input.keys.clear(); if(game.state === "playing") togglePause(true); });
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  createTeams(); setupTouch(); updateUI(true); requestAnimationFrame(loop);
})();
