import { ballControlConfig } from "../config/ballControlConfig.js";
import { releasePossession } from "../gameplay/PossessionLifecycle.js";
import { GameCommandType } from "./GameCommands.js";
import { HOME_TEAM, findPlayer } from "./MatchState.js";
import { createFieldBounds } from "./PlayerMovementSystem.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function commandDirection(command, player) {
  const direction = command.payload.direction;
  if (direction && Math.hypot(direction.x, direction.y) > 0.12) {
    return normalize(direction.x, direction.y, player.dirX, player.dirY);
  }
  return normalize(player.dirX, player.dirY, player.team === HOME_TEAM ? 1 : -1, 0);
}

function passingLaneRisk(state, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  let risk = 0;
  for (const defender of state.players) {
    if (defender.team === from.team) continue;
    const amount = clamp(
      ((defender.x - from.x) * dx + (defender.y - from.y) * dy) / lengthSquared,
      0,
      1
    );
    const laneX = from.x + dx * amount;
    const laneY = from.y + dy * amount;
    const gap = Math.hypot(defender.x - laneX, defender.y - laneY);
    if (gap < 58) risk = Math.max(risk, (58 - gap) / 58 * (0.45 + amount * 0.55));
  }
  return risk;
}

function triggerKickAnimation(player, type, speed) {
  player.cooldown = 0.18;
  player.anim = type === "shot" ? "shoot" : "pass";
  player.animDuration = type === "shot" ? 0.34 : type === "loft" ? 0.3 : 0.24;
  player.animTime = player.animDuration;
  player.animPower = clamp((speed - 400) / 650, 0, 1);
}

function releaseBall(state, player, dx, dy, speed, type, config) {
  const direction = normalize(dx, dy, player.dirX, player.dirY);
  const { ball } = state;
  ball.possession = releasePossession(ball.possession, type, player.id);
  ball.ownerId = null;
  ball.lastTouchId = player.id;
  ball.lock = type === "shot"
    ? config.release.shotLock
    : type === "loft"
      ? config.release.loftPassLock
      : config.release.passLock;
  ball.x = player.x + direction.x * (player.radius + 10);
  ball.y = player.y + direction.y * (player.radius + 10);
  ball.vx = direction.x * speed + player.vx * 0.25;
  ball.vy = direction.y * speed + player.vy * 0.25;
  ball.height = 0;
  ball.vz = type === "loft" ? 10.8 : type === "shot" ? 1.8 : 0;
  ball.curve = type === "shot" ? clamp(direction.y * 1.45, -1.05, 1.05) : 0;
  ball.spin = (player.team === HOME_TEAM ? 1 : -1) * speed * 0.012;
  triggerKickAnimation(player, type, speed);
  return direction;
}

function shortPass(state, player, command, config) {
  const facing = commandDirection(command, player);
  const teammates = state.players.filter((candidate) => (
    candidate.team === player.team && candidate !== player && candidate.role !== "GK"
  ));
  let target = teammates[0] ?? null;
  let bestScore = -Infinity;
  for (const candidate of teammates) {
    const dx = candidate.x - player.x;
    const dy = candidate.y - player.y;
    const gap = Math.hypot(dx, dy) || 1;
    const forward = dx / gap * facing.x + dy / gap * facing.y;
    const attack = player.team === HOME_TEAM ? dx : -dx;
    const lane = Math.abs(dy / gap);
    const score = forward * 360
      + attack * 0.18
      - gap * 0.2
      - lane * 18
      - passingLaneRisk(state, player, candidate) * 170;
    if (score > bestScore) {
      target = candidate;
      bestScore = score;
    }
  }
  if (!target) return null;

  const gap = distance(player, target);
  const powerScale = lerp(0.82, 1.16, clamp(command.payload.power, 0.08, 1));
  const speed = clamp((430 + gap * 0.35) * powerScale, 440, 760);
  releaseBall(
    state,
    player,
    target.x + target.vx * 0.18 - player.x,
    target.y + target.vy * 0.18 - player.y,
    speed,
    "pass",
    config
  );
  if (command.payload.modifiers?.oneTwo) {
    const run = normalize(
      (player.team === HOME_TEAM ? 1 : -1) * 0.9 + facing.x * 0.45,
      facing.y * 0.55,
      player.team === HOME_TEAM ? 1 : -1,
      0
    );
    player.vx = run.x * 225;
    player.vy = run.y * 225;
    player.controlBoost = 0.7;
  }
  if (player.team === HOME_TEAM) state.match.stats.passes += 1;
  state.ball.pendingPass = { team: player.team, timer: 1.8 };
  return { targetId: target.id, speed, style: command.payload.modifiers?.oneTwo ? "one-two" : "short" };
}

function throughPass(state, player, command, config) {
  const attackDirection = player.team === HOME_TEAM ? 1 : -1;
  const facing = commandDirection(command, player);
  const teammates = state.players.filter((candidate) => (
    candidate.team === player.team && candidate !== player && candidate.role !== "GK"
  ));
  let target = null;
  let bestScore = -Infinity;
  for (const candidate of teammates) {
    const dx = candidate.x - player.x;
    const dy = candidate.y - player.y;
    const gap = Math.hypot(dx, dy) || 1;
    const aligned = dx / gap * facing.x + dy / gap * facing.y;
    const progress = dx * attackDirection;
    const score = aligned * 310 + progress * 0.42 - gap * 0.12;
    if (score > bestScore) {
      target = candidate;
      bestScore = score;
    }
  }
  if (!target) return null;

  const gap = distance(player, target);
  const powerScale = lerp(0.84, 1.18, clamp(command.payload.power, 0.08, 1));
  const speed = clamp((540 + gap * 0.42) * powerScale, 540, 900);
  const chipped = command.payload.modifiers?.chip === true;
  releaseBall(
    state,
    player,
    target.x + target.vx * 0.58 + attackDirection * 58 - player.x,
    target.y + target.vy * 0.58 - player.y,
    speed,
    chipped ? "loft" : "pass",
    config
  );
  if (chipped) {
    state.ball.vz = 8.6 + command.payload.power * 4.2;
    state.ball.height = 0.12;
  }
  if (player.team === HOME_TEAM) state.match.stats.passes += 1;
  state.ball.pendingPass = { team: player.team, timer: 2.1 };
  return { targetId: target.id, speed, style: chipped ? "chipped-through" : "through" };
}

function loftedPass(state, player, command, config) {
  const attackDirection = player.team === HOME_TEAM ? 1 : -1;
  const facing = commandDirection(command, player);
  const teammates = state.players.filter((candidate) => (
    candidate.team === player.team && candidate !== player && candidate.role !== "GK"
  ));
  let target = null;
  let bestScore = -Infinity;
  for (const candidate of teammates) {
    const dx = candidate.x - player.x;
    const dy = candidate.y - player.y;
    const gap = Math.hypot(dx, dy) || 1;
    const aligned = dx / gap * facing.x + dy / gap * facing.y;
    const score = aligned * 240
      + dx * attackDirection * 0.25
      + Math.abs(dy) * 0.12
      - gap * 0.08;
    if (score > bestScore) {
      target = candidate;
      bestScore = score;
    }
  }
  if (!target) return null;

  const gap = distance(player, target);
  const powerScale = lerp(0.82, 1.18, clamp(command.payload.power, 0.08, 1));
  const speed = clamp((610 + gap * 0.3) * powerScale, 580, 940);
  releaseBall(
    state,
    player,
    target.x + target.vx * 0.32 - player.x,
    target.y + target.vy * 0.32 - player.y,
    speed,
    "loft",
    config
  );
  state.ball.vz *= lerp(0.82, 1.14, command.payload.power);
  if (player.team === HOME_TEAM) state.match.stats.passes += 1;
  state.ball.pendingPass = { team: player.team, timer: 2.2 };
  return { targetId: target.id, speed, style: "loft" };
}

function shoot(state, player, command, { config, field, height, random }) {
  const targetX = player.team === HOME_TEAM ? field.right + 45 : field.left - 45;
  const goalkeeper = state.players.find((candidate) => (
    candidate.team !== player.team && candidate.role === "GK"
  ));
  const openY = goalkeeper?.y < height / 2 ? field.goalBottom - 34 : field.goalTop + 34;
  const direction = command.payload.direction;
  const userAim = player.id === state.selectedPlayerId
    && player.team === HOME_TEAM
    && direction
    && Math.hypot(direction.x, direction.y) > 0.12;
  const directedY = userAim
    ? height / 2 + direction.y * 145
    : player.y + player.dirY * 120;
  const spread = userAim ? 16 : 34 / state.match.ai;
  const aimY = clamp(
    lerp(openY, directedY, userAim ? 0.62 : 0.28) + (random.next() - 0.5) * spread,
    field.goalTop + 22,
    field.goalBottom - 22
  );
  const power = clamp(command.payload.power, 0.15, 1);
  const style = command.payload.modifiers?.chip
    ? "chip"
    : command.payload.modifiers?.finesse
      ? "finesse"
      : "power";
  const speed = style === "chip"
    ? 500 + power * 220
    : style === "finesse"
      ? 570 + power * 300
      : 620 + power * 430;
  releaseBall(state, player, targetX - player.x, aimY - player.y, speed, "shot", config);
  if (style === "chip") {
    state.ball.vz = 10.5 + power * 4.5;
    state.ball.curve = 0;
  } else if (style === "finesse") {
    state.ball.curve = clamp((aimY - height / 2) / 105, -1.65, 1.65);
    state.ball.vz = 2.6;
  }
  state.match.stats.shots[player.team] += 1;
  return { targetId: goalkeeper?.id ?? null, speed, style, aimY };
}

export function executeKickAction(state, command, {
  config = ballControlConfig,
  field = createFieldBounds(),
  height = 700,
  random
} = {}) {
  if (!random || typeof random.next !== "function") {
    throw new TypeError("executeKickAction requires a deterministic random source");
  }
  const playerId = command.payload.playerId ?? state.selectedPlayerId;
  const player = findPlayer(state, playerId);
  if (!player || state.ball.ownerId !== player.id) return null;

  let result = null;
  if (command.type === GameCommandType.SHORT_PASS) {
    result = shortPass(state, player, command, config);
  } else if (command.type === GameCommandType.THROUGH_BALL) {
    result = throughPass(state, player, command, config);
  } else if (command.type === GameCommandType.LOFTED_PASS) {
    result = loftedPass(state, player, command, config);
  } else if (command.type === GameCommandType.SHOOT) {
    result = shoot(state, player, command, { config, field, height, random });
  }
  if (!result) return null;
  return Object.freeze({
    type: command.type,
    playerId: player.id,
    ballId: state.ball.id,
    targetId: result.targetId,
    power: command.payload.power,
    speed: result.speed,
    style: result.style,
    aimY: result.aimY ?? null,
    velocity: Object.freeze({ x: state.ball.vx, y: state.ball.vy, z: state.ball.vz })
  });
}
