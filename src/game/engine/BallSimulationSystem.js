import { ballControlConfig } from "../config/ballControlConfig.js";
import {
  captureEligibility,
  classifyFirstTouch,
  dribbleAnchor,
  firstTouchScore,
  resolveFirstTouch
} from "../gameplay/BallControl.js";
import {
  beginReceiving,
  controlPossession,
  releasePossession,
  settleLoose
} from "../gameplay/PossessionLifecycle.js";
import { HOME_TEAM, findPlayer } from "./MatchState.js";
import { createFieldBounds } from "./PlayerMovementSystem.js";

const lerp = (a, b, amount) => a + (b - a) * amount;

function controlBall(state, player, outcome, retainedVelocity = null) {
  const { ball } = state;
  if (ball.pendingPass?.team === player.team) {
    if (player.team === HOME_TEAM) state.match.stats.completed += 1;
    ball.pendingPass = null;
  } else if (ball.pendingPass) {
    ball.pendingPass = null;
  }

  ball.possession = beginReceiving(ball.possession, player.id);
  ball.ownerId = player.id;
  ball.lastTouchId = player.id;
  ball.vx = retainedVelocity?.vx ?? 0;
  ball.vy = retainedVelocity?.vy ?? 0;
  ball.height = 0;
  ball.vz = 0;
  ball.curve = 0;
  ball.possession = controlPossession(ball.possession, player.id, outcome);
  player.controlBoost = 0.28;
  player.anim = "receive";
  player.animTime = 0.2;
  player.animDuration = 0.2;
  player.animPower = 0;
  if (player.team === HOME_TEAM && player.role !== "GK") state.selectedPlayerId = player.id;
}

function tryCaptureLooseBall(state, config) {
  const { ball } = state;
  let receiver = null;
  let bestDistance = Infinity;
  for (const player of state.players) {
    const distance = Math.hypot(player.x - ball.x, player.y - ball.y);
    const eligibility = captureEligibility({
      distance,
      ballHeight: ball.height,
      ballSpeed: Math.hypot(ball.vx, ball.vy),
      locked: ball.lock > 0,
      playerCooldown: player.cooldown,
      isGoalkeeper: player.role === "GK",
      isLastTouch: player.id === ball.lastTouchId,
      config: config.capture
    });
    if (eligibility.eligible && distance < bestDistance) {
      receiver = player;
      bestDistance = distance;
    }
  }
  if (!receiver) return;

  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  const precision = receiver.id === state.selectedPlayerId && state.controls.shielding;
  const score = firstTouchScore({
    ballSpeed,
    incomingX: ball.vx,
    incomingY: ball.vy,
    facingX: receiver.dirX,
    facingY: receiver.dirY,
    ballHeight: ball.height,
    playerSpeed: Math.hypot(receiver.vx, receiver.vy),
    rating: receiver.rating,
    precision,
    sprinting: receiver.sprinting,
    config: config.firstTouch,
    captureConfig: config.capture
  });
  const outcome = classifyFirstTouch(score, config.firstTouch);
  const touch = resolveFirstTouch({
    outcome,
    ballX: ball.x,
    ballY: ball.y,
    ballVx: ball.vx,
    ballVy: ball.vy,
    receiver
  });
  ball.x = touch.x;
  ball.y = touch.y;
  ball.vx = touch.vx;
  ball.vy = touch.vy;
  ball.lock = Math.max(ball.lock, touch.lock);

  if (touch.controls) {
    controlBall(
      state,
      receiver,
      outcome,
      outcome === "cushioned" ? { vx: touch.vx, vy: touch.vy } : null
    );
    return;
  }

  ball.ownerId = null;
  ball.lastTouchId = receiver.id;
  ball.possession = releasePossession(
    beginReceiving(ball.possession, receiver.id),
    outcome,
    receiver.id
  );
  receiver.cooldown = Math.max(receiver.cooldown, touch.lock);
  receiver.anim = "receive";
  receiver.animTime = outcome === "heavy" ? 0.26 : 0.18;
  receiver.animDuration = receiver.animTime;
  receiver.animPower = 0;
}

function advanceOwnedBall(state, deltaSeconds, config) {
  const { ball } = state;
  const owner = findPlayer(state, ball.ownerId);
  if (!owner) {
    ball.ownerId = null;
    ball.possession = releasePossession(ball.possession, "missing-owner", ball.lastTouchId);
    return;
  }

  ball.height = 0;
  ball.vz = 0;
  const touch = Math.sin(owner.stepPhase);
  if (Math.abs(touch) > 0.82) owner.dribbleSide = touch > 0 ? 1 : -1;
  const precision = owner.id === state.selectedPlayerId && !owner.sprinting;
  const mode = owner.sprinting ? "sprint" : precision ? "precision" : "normal";
  const anchor = dribbleAnchor({
    owner,
    mode,
    stepPhase: owner.stepPhase,
    config: config.dribble
  });
  const follow = 1 - Math.exp(-deltaSeconds * anchor.followRate);
  ball.x = lerp(ball.x, anchor.x, follow);
  ball.y = lerp(ball.y, anchor.y, follow);
  ball.vx = owner.vx;
  ball.vy = owner.vy;
  ball.angle += Math.hypot(owner.vx, owner.vy) * deltaSeconds * 0.035;
  state.match.stats.possession[owner.team] += deltaSeconds;
}

function advanceLooseBall(state, deltaSeconds, config) {
  const { ball } = state;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 20 && Math.abs(ball.curve) > 0.005) {
    const turn = ball.curve * deltaSeconds;
    const cosine = Math.cos(turn);
    const sine = Math.sin(turn);
    const vx = ball.vx;
    ball.vx = vx * cosine - ball.vy * sine;
    ball.vy = vx * sine + ball.vy * cosine;
  }
  ball.x += ball.vx * deltaSeconds;
  ball.y += ball.vy * deltaSeconds;
  ball.height += ball.vz * deltaSeconds;
  ball.vz -= 22 * deltaSeconds;
  if (ball.height < 0) {
    ball.height = 0;
    ball.vz = Math.abs(ball.vz) > 3.5 ? -ball.vz * 0.34 : 0;
  }
  const friction = Math.pow(state.settings.weather === "rain" ? 0.36 : 0.22, deltaSeconds);
  ball.vx *= friction;
  ball.vy *= friction;
  if (Math.hypot(ball.vx, ball.vy) < 4) {
    ball.vx = 0;
    ball.vy = 0;
  }
  if (ball.lock <= 0) tryCaptureLooseBall(state, config);
}

function resolveFieldBoundary(ball, field) {
  const inGoalMouth = ball.y > field.goalTop && ball.y < field.goalBottom;
  if (inGoalMouth && ball.height < 3.25 && ball.x > field.right + 20) return HOME_TEAM;
  if (inGoalMouth && ball.height < 3.25 && ball.x < field.left - 20) return 1;
  if (inGoalMouth && ball.height >= 3.25 && ball.x > field.right - ball.radius) {
    ball.x = field.right - ball.radius;
    ball.vx = -Math.abs(ball.vx) * 0.58;
    ball.vz *= 0.72;
  }
  if (inGoalMouth && ball.height >= 3.25 && ball.x < field.left + ball.radius) {
    ball.x = field.left + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.58;
    ball.vz *= 0.72;
  }
  if (ball.y < field.top + ball.radius) {
    ball.y = field.top + ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.74;
  }
  if (ball.y > field.bottom - ball.radius) {
    ball.y = field.bottom - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.74;
  }
  if (!inGoalMouth && ball.x < field.left + ball.radius) {
    ball.x = field.left + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.74;
  }
  if (!inGoalMouth && ball.x > field.right - ball.radius) {
    ball.x = field.right - ball.radius;
    ball.vx = -Math.abs(ball.vx) * 0.74;
  }
  return null;
}

export function advanceBallSimulation(state, deltaSeconds, {
  field = createFieldBounds(),
  config = ballControlConfig
} = {}) {
  const { ball } = state;
  ball.angle += ball.spin * deltaSeconds;
  ball.spin *= Math.pow(0.55, deltaSeconds);
  ball.curve *= Math.pow(0.3, deltaSeconds);
  if (ball.lock > 0) {
    ball.lock = Math.max(0, ball.lock - deltaSeconds);
  } else if (!ball.ownerId && ball.possession.state === "released") {
    ball.possession = settleLoose(ball.possession);
  }
  if (ball.pendingPass) {
    ball.pendingPass.timer -= deltaSeconds;
    if (ball.pendingPass.timer <= 0) ball.pendingPass = null;
  }

  if (ball.ownerId) advanceOwnedBall(state, deltaSeconds, config);
  else advanceLooseBall(state, deltaSeconds, config);
  return Object.freeze({ goalTeam: resolveFieldBoundary(ball, field) });
}
