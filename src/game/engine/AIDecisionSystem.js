import { locomotionConfig } from "../config/locomotionConfig.js";
import { stepTowardTarget } from "../gameplay/PlayerLocomotion.js";
import {
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "./GameCommands.js";
import { passingLaneRisk } from "./KickActionSystem.js";
import { AWAY_TEAM, HOME_TEAM, findPlayer } from "./MatchState.js";
import { createFieldBounds } from "./PlayerMovementSystem.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

function closestPlayer(state, team, target, includeGoalkeeper = true) {
  let closest = null;
  let bestDistance = Infinity;
  for (const player of state.players) {
    if (player.team !== team || (!includeGoalkeeper && player.role === "GK")) continue;
    const gap = distance(player, target);
    if (gap < bestDistance) {
      closest = player;
      bestDistance = gap;
    }
  }
  return closest;
}

function moveToward(player, targetX, targetY, speed, deltaSeconds) {
  const movement = stepTowardTarget({
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    dirX: player.dirX,
    dirY: player.dirY,
    targetX,
    targetY,
    speed,
    dt: deltaSeconds,
    config: locomotionConfig.ai
  });
  player.vx = movement.vx;
  player.vy = movement.vy;
  player.dirX = movement.dirX;
  player.dirY = movement.dirY;
  player.sprinting = Math.hypot(player.vx, player.vy) > 185;
}

function projectedGoalY(state, team, field) {
  const { ball } = state;
  const goalX = team === HOME_TEAM ? field.left : field.right;
  const towardGoal = team === HOME_TEAM ? ball.vx < 0 : ball.vx > 0;
  if (!towardGoal || Math.abs(ball.vx) < 30) return ball.y;
  const time = clamp((goalX - ball.x) / ball.vx, 0, 1.4);
  return ball.y
    + ball.vy * time
    + ball.curve * Math.hypot(ball.vx, ball.vy) * time * time * 0.08;
}

function createAICommand(type, payload, tick, sequence) {
  return createGameCommand(type, payload, {
    source: GameCommandSource.AI,
    sequence,
    targetTick: tick
  });
}

function goalkeeperClearancePower(player, target) {
  const baseSpeed = 430 + distance(player, target) * 0.35;
  const scale = 520 / baseSpeed;
  return clamp((scale - 0.82) / (1.16 - 0.82), 0.08, 1);
}

function decideGoalkeeper(state, player, deltaSeconds, context) {
  const { ball } = state;
  const { field, random: _random, tick, sequence, width: _width } = context;
  const team = player.team;
  const aiSpeed = 168 * (team === AWAY_TEAM ? state.match.ai : 0.96);
  const owner = findPlayer(state, ball.ownerId);
  const hasBall = owner === player;

  if (team === HOME_TEAM && state.controls.lastMode === "defense" && state.controls.goalkeeperRush) {
    moveToward(player, ball.x, ball.y, aiSpeed * 1.34, deltaSeconds);
    return null;
  }

  const goalX = team === HOME_TEAM ? field.left + 34 : field.right - 34;
  const danger = team === HOME_TEAM ? ball.x < 330 : ball.x > 870;
  const projectedY = clamp(
    projectedGoalY(state, team, field),
    field.goalTop + 18,
    field.goalBottom - 18
  );
  const shotIncoming = !owner
    && (team === HOME_TEAM ? ball.vx < 0 : ball.vx > 0)
    && Math.hypot(ball.vx, ball.vy) > 360;
  if (
    shotIncoming
    && danger
    && Math.abs(projectedY - player.y) > 24
    && Math.abs(projectedY - player.y) < 155
    && player.diveCooldown <= 0
    && ball.height < 3.1
  ) {
    player.anim = "dive";
    player.animTime = 0.5;
    player.animDuration = 0.5;
    player.animPower = Math.sign(projectedY - player.y);
    player.diveCooldown = 1.05;
  }
  const stepX = shotIncoming
    ? (team === HOME_TEAM ? field.left + 56 : field.right - 56)
    : goalX;
  const targetY = shotIncoming
    ? projectedY
    : clamp(ball.y, field.goalTop + 25, field.goalBottom - 25);
  moveToward(
    player,
    danger ? stepX : goalX,
    targetY,
    aiSpeed * (shotIncoming ? 1.04 : 0.78),
    deltaSeconds
  );

  if (!hasBall || player.cooldown > 0) return null;
  const target = state.players.find((candidate) => (
    candidate.team === team && candidate.role === "DF"
  ));
  if (!target) return null;
  return createAICommand(GameCommandType.SHORT_PASS, {
    playerId: player.id,
    power: goalkeeperClearancePower(player, target),
    direction: normalize(target.x - player.x, target.y - player.y, team === HOME_TEAM ? 1 : -1, 0)
  }, tick, sequence);
}

function decideOwnerAction(state, player, deltaSeconds, context) {
  const { field, height, random, tick, sequence } = context;
  const goalX = player.team === HOME_TEAM ? field.right : field.left;
  const distanceToGoal = Math.abs(goalX - player.x);
  if (
    distanceToGoal < 300
    && Math.abs(player.y - height / 2) < 210
    && player.cooldown <= 0
    && random.next() < deltaSeconds * 2.2 * state.match.ai
  ) {
    return createAICommand(GameCommandType.SHOOT, {
      playerId: player.id,
      power: 0.58 + random.next() * 0.38
    }, tick, sequence);
  }

  const pressured = state.players.some((candidate) => (
    candidate.team !== player.team && distance(candidate, player) < 85
  ));
  if (pressured && random.next() < deltaSeconds * 0.85 * state.match.ai) {
    const runners = state.players
      .filter((candidate) => (
        candidate.team === player.team && candidate !== player && candidate.role !== "GK"
      ))
      .sort((first, second) => (
        passingLaneRisk(state, player, first) - passingLaneRisk(state, player, second)
      ));
    const useThroughBall = runners[0]
      && passingLaneRisk(state, player, runners[0]) < 0.48
      && random.next() < 0.42;
    return createAICommand(
      useThroughBall ? GameCommandType.THROUGH_BALL : GameCommandType.SHORT_PASS,
      {
        playerId: player.id,
        power: useThroughBall ? 0.45 : 0.35,
        direction: { x: player.dirX, y: player.dirY }
      },
      tick,
      sequence
    );
  }

  const weave = Math.sin(state.match.elapsed * 1.7 + player.index) * 105;
  moveToward(
    player,
    goalX,
    clamp(height / 2 + weave, 130, height - 130),
    168 * (player.team === AWAY_TEAM ? state.match.ai : 0.96) * 1.03,
    deltaSeconds
  );
  return null;
}

function decideOffBallMovement(state, player, deltaSeconds, context) {
  const { ball } = state;
  const { field, width, height } = context;
  const team = player.team;
  const owner = findPlayer(state, ball.ownerId);
  const attackDirection = team === HOME_TEAM ? 1 : -1;
  const ownGoalX = team === HOME_TEAM ? field.left : field.right;
  const teamChaser = closestPlayer(state, team, ball, false);
  const aiSpeed = 168 * (team === AWAY_TEAM ? state.match.ai : 0.96);
  const pressSupport = team === HOME_TEAM
    ? state.players
      .filter((candidate) => (
        candidate.team === HOME_TEAM
        && candidate.role !== "GK"
        && candidate.id !== state.selectedPlayerId
      ))
      .sort((first, second) => distance(first, ball) - distance(second, ball))[0]
    : null;
  const teammatePress = team === HOME_TEAM
    && state.controls.lastMode === "defense"
    && state.controls.teamPress
    && player === pressSupport;
  const shouldChase = (teamChaser === player || teammatePress)
    && (!owner || owner.team !== team);
  if (shouldChase) {
    moveToward(player, ball.x, ball.y, aiSpeed * 1.08, deltaSeconds);
    return;
  }

  let targetX = player.baseX + (ball.x - width / 2) * 0.26;
  let targetY = player.baseY + (ball.y - height / 2) * 0.2;
  if (owner?.team === team) {
    const laneSide = player.index % 2 ? 1 : -1;
    targetX += attackDirection * (player.role === "FW" ? 145 : player.role === "MF" ? 78 : 28);
    targetY += laneSide * (player.role === "FW" ? 42 : 24);
    if (player.role === "FW" && Math.abs(player.y - owner.y) < 54) targetY += laneSide * 48;
  }
  if (owner?.team !== team) {
    targetX = lerp(targetX, ownGoalX, player.role === "DF" ? 0.2 : 0.07);
    if (player.role === "DF") targetY = lerp(targetY, height / 2, 0.08);
  }
  moveToward(
    player,
    clamp(targetX, field.left + 45, field.right - 45),
    clamp(targetY, field.top + 45, field.bottom - 45),
    aiSpeed * 0.82,
    deltaSeconds
  );
}

export function advanceAIDecisions(state, deltaSeconds, {
  field = createFieldBounds(),
  width = 1200,
  height = 700,
  random,
  tick = 0
} = {}) {
  if (!random || typeof random.next !== "function") {
    throw new TypeError("advanceAIDecisions requires a deterministic random source");
  }
  const owner = findPlayer(state, state.ball.ownerId);
  if (owner) state.controls.lastMode = owner.team === HOME_TEAM ? "attack" : "defense";

  const commands = [];
  for (const player of state.players) {
    if (player.id === state.selectedPlayerId) continue;
    const context = {
      field,
      width,
      height,
      random,
      tick,
      sequence: commands.length
    };
    let command = null;
    if (player.role === "GK") {
      command = decideGoalkeeper(state, player, deltaSeconds, context);
    } else if (owner === player) {
      command = decideOwnerAction(state, player, deltaSeconds, context);
    } else {
      decideOffBallMovement(state, player, deltaSeconds, context);
    }
    if (command) commands.push(command);
  }
  return Object.freeze(commands);
}
