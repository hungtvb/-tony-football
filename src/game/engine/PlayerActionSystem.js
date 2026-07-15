import { ballControlConfig } from "../config/ballControlConfig.js";
import { releasePossession } from "../gameplay/PossessionLifecycle.js";
import { HOME_TEAM, findPlayer } from "./MatchState.js";

const lerp = (from, to, amount) => from + (to - from) * amount;

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

function closestOpponent(state, player) {
  let closest = null;
  let bestDistance = Infinity;
  for (const candidate of state.players) {
    if (candidate.team === player.team) continue;
    const gap = Math.hypot(candidate.x - player.x, candidate.y - player.y);
    if (gap < bestDistance) {
      closest = candidate;
      bestDistance = gap;
    }
  }
  return closest;
}

export function executeTackle(state, {
  playerId = state.selectedPlayerId,
  random,
  config = ballControlConfig
} = {}) {
  if (!random || typeof random.next !== "function") {
    throw new TypeError("executeTackle requires a deterministic random source");
  }
  const player = findPlayer(state, playerId);
  if (!player || player.cooldown > 0) return null;
  const owner = findPlayer(state, state.ball.ownerId);
  const opponent = owner && owner.team !== player.team ? owner : closestOpponent(state, player);
  if (!opponent || Math.hypot(player.x - opponent.x, player.y - opponent.y) > 48) return null;

  const chance = 0.48 + (player.rating - opponent.rating) * 0.012;
  const won = owner === opponent && random.next() < chance;
  if (won) {
    const direction = normalize(
      opponent.x - player.x,
      opponent.y - player.y,
      player.dirX,
      player.dirY
    );
    state.ball.possession = releasePossession(
      state.ball.possession,
      "tackle",
      opponent.id
    );
    state.ball.ownerId = null;
    state.ball.lastTouchId = player.id;
    state.ball.x = opponent.x;
    state.ball.y = opponent.y;
    state.ball.vx = direction.x * 250;
    state.ball.vy = direction.y * 250;
    state.ball.lock = config.release.tackleLock;
  }

  player.cooldown = 1.05;
  player.vx += player.dirX * 105;
  player.vy += player.dirY * 105;
  player.anim = "tackle";
  player.animTime = 0.52;
  player.animDuration = 0.52;
  player.animPower = 1;
  return Object.freeze({
    playerId: player.id,
    opponentId: opponent.id,
    won,
    chance,
    previousOwnerId: owner?.id ?? null,
    ownerId: state.ball.ownerId
  });
}

export function triggerTeammateRun(state, { playerId = state.selectedPlayerId } = {}) {
  const owner = findPlayer(state, playerId);
  if (!owner || state.ball.ownerId !== owner.id) return null;
  const inputMagnitude = Math.hypot(state.controls.moveX, state.controls.moveY);
  const direction = inputMagnitude > 0.12
    ? normalize(state.controls.moveX, state.controls.moveY, 1, 0)
    : { x: 1, y: 0 };
  let runner = null;
  let bestScore = -Infinity;
  for (const player of state.players) {
    if (player.team !== HOME_TEAM || player === owner || player.role === "GK") continue;
    const dx = player.x - owner.x;
    const dy = player.y - owner.y;
    const gap = Math.hypot(dx, dy) || 1;
    const score = dx / gap * direction.x + dy / gap * direction.y - gap / 1200;
    if (score > bestScore) {
      runner = player;
      bestScore = score;
    }
  }
  if (!runner) return null;

  runner.vx = lerp(runner.vx, direction.x * 220, 0.72);
  runner.vy = lerp(runner.vy, direction.y * 220, 0.72);
  runner.controlBoost = 0.75;
  return Object.freeze({
    ownerId: owner.id,
    runnerId: runner.id,
    direction: Object.freeze({ ...direction })
  });
}
