import { locomotionConfig } from "../config/locomotionConfig.js";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";
import {
  chooseSprintTransitionResponse,
  chooseTurnResponse,
  dampVelocity,
  normalizeMovementInput,
  stepFacing,
  stepStamina,
  stepVelocity
} from "../gameplay/PlayerLocomotion.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

export function createFieldBounds(
  width = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldWidth,
  height = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldHeight,
  scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE,
) {
  const widthScale = width / scaleProfile.simulation.worldWidth;
  const heightScale = height / scaleProfile.simulation.worldHeight;
  const bounds = scaleProfile.field.bounds;
  const centreY = height / 2;
  const mouthHalfHeight = scaleProfile.goal.mouthWidthSimulation * heightScale / 2;
  const ballRadiusY = scaleProfile.ball.radiusSimulation * heightScale;
  return Object.freeze({
    left: bounds.left * widthScale,
    right: bounds.right * widthScale,
    top: bounds.top * heightScale,
    bottom: bounds.bottom * heightScale,
    goalTop: centreY - mouthHalfHeight,
    goalBottom: centreY + mouthHalfHeight,
    scoringGoalTop: centreY - mouthHalfHeight + ballRadiusY,
    scoringGoalBottom: centreY + mouthHalfHeight - ballRadiusY,
    goalCrossbarHeight: scaleProfile.goal.crossbarHeightMetres,
    goalScoringMaxBallHeight: scaleProfile.goal.scoringMaxBallHeightMetres,
    goalDepth: scaleProfile.goal.depthSimulation * widthScale,
    goalPostThickness: scaleProfile.goal.postThicknessSimulation * heightScale,
    goalkeeperDepth: scaleProfile.field.markings.penaltyAreaDepthSimulation * widthScale,
    scaleProfileId: scaleProfile.id,
  });
}

function keepPlayerInBounds(player, field) {
  const pad = player.radius + 5;
  player.x = clamp(player.x, field.left + pad, field.right - pad);
  player.y = clamp(player.y, field.top + pad, field.bottom - pad);
  if (player.role !== "GK") return;

  player.x = player.team === 0
    ? clamp(player.x, field.left + 15, field.left + field.goalkeeperDepth)
    : clamp(player.x, field.right - field.goalkeeperDepth, field.right - 15);
  player.y = clamp(player.y, field.goalTop - 35, field.goalBottom + 35);
}

function updateControlledPlayer(player, controls, deltaSeconds, config) {
  const movement = normalizeMovementInput(controls.moveX, controls.moveY);
  const hasMove = movement.magnitude > config.minimumMoveMagnitude;
  const precision = controls.shielding;
  const wasSprinting = player.sprinting;
  const canSprint = controls.sprinting
    && !precision
    && player.stamina > config.sprintStaminaThreshold;
  player.sprinting = canSprint && hasMove;
  player.controlBoost = Math.max(0, player.controlBoost - deltaSeconds);

  const baseSpeed = precision ? config.precisionSpeed : config.baseSpeed;
  const targetSpeed = baseSpeed
    * (canSprint ? config.sprintMultiplier : 1)
    * movement.magnitude;

  if (hasMove) {
    const turn = chooseTurnResponse({
      currentX: player.vx || movement.x,
      currentY: player.vy || movement.y,
      desiredX: movement.x,
      desiredY: movement.y,
      config,
      boosted: player.controlBoost > 0
    });
    const baseResponse = precision ? config.precisionResponse : turn.response;
    const response = chooseSprintTransitionResponse({
      wasSprinting,
      sprinting: player.sprinting,
      baseResponse,
      config
    });
    const velocity = stepVelocity({
      vx: player.vx,
      vy: player.vy,
      desiredX: movement.x,
      desiredY: movement.y,
      targetSpeed,
      dt: deltaSeconds,
      response,
      turnGrip: turn.turnGrip
    });
    player.vx = velocity.vx;
    player.vy = velocity.vy;
    const facing = stepFacing({
      dirX: player.dirX,
      dirY: player.dirY,
      targetX: movement.x,
      targetY: movement.y,
      dt: deltaSeconds,
      response: config.facingResponse
    });
    player.dirX = facing.dirX;
    player.dirY = facing.dirY;
  } else {
    const velocity = dampVelocity({
      vx: player.vx,
      vy: player.vy,
      dt: deltaSeconds,
      damping: config.stopDamping
    });
    player.vx = velocity.vx;
    player.vy = velocity.vy;
  }

  player.stamina = stepStamina({
    stamina: player.stamina,
    moving: hasMove,
    sprinting: player.sprinting,
    precision,
    magnitude: movement.magnitude,
    dt: deltaSeconds,
    config
  });
}

function advanceMotionState(player, deltaSeconds) {
  const speed = Math.hypot(player.vx, player.vy);
  const moving = speed > 18;
  const target = moving ? Math.atan2(player.vx, player.vy) : player.motionYaw;
  const delta = Math.atan2(
    Math.sin(target - player.motionYaw),
    Math.cos(target - player.motionYaw)
  );
  const yawAmount = 1 - Math.exp(-deltaSeconds * (player.sprinting ? 7.5 : 10.5));
  const yawDelta = Math.atan2(
    Math.sin(target - player.motionYaw),
    Math.cos(target - player.motionYaw)
  );
  player.motionYaw += yawDelta * yawAmount;
  player.turnLean = lerp(
    player.turnLean,
    clamp(delta * 1.35, -0.72, 0.72),
    1 - Math.exp(-deltaSeconds * 9)
  );
  player.strideBlend = lerp(
    player.strideBlend,
    moving ? clamp(speed / 205, 0, 1.35) : 0,
    1 - Math.exp(-deltaSeconds * (moving ? 10 : 7))
  );
}

function resolvePlayerCollisions(players) {
  for (let firstIndex = 0; firstIndex < players.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex += 1) {
      const first = players[firstIndex];
      const second = players[secondIndex];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.hypot(dx, dy) || 1;
      const minimumDistance = first.radius + second.radius + 3;
      if (distance >= minimumDistance) continue;
      const push = (minimumDistance - distance) * 0.5;
      first.x -= dx / distance * push;
      first.y -= dy / distance * push;
      second.x += dx / distance * push;
      second.y += dy / distance * push;
    }
  }
}

export function advancePlayerMovement(state, deltaSeconds, {
  field = createFieldBounds(),
  config = locomotionConfig.controlled
} = {}) {
  const selected = state.players.find((player) => player.id === state.selectedPlayerId);
  if (selected) updateControlledPlayer(selected, state.controls, deltaSeconds, config);

  for (const player of state.players) {
    player.cooldown = Math.max(0, player.cooldown - deltaSeconds);
    player.diveCooldown = Math.max(0, player.diveCooldown - deltaSeconds);
    player.animTime = Math.max(0, player.animTime - deltaSeconds);
    if (player.animTime === 0) {
      player.anim = "idle";
      player.animPower = 0;
    }
    advanceMotionState(player, deltaSeconds);
    player.stepPhase += deltaSeconds * (0.035 * Math.hypot(player.vx, player.vy) + 2.2);
    player.x += player.vx * deltaSeconds;
    player.y += player.vy * deltaSeconds;
    keepPlayerInBounds(player, field);
  }

  resolvePlayerCollisions(state.players);
  for (const player of state.players) keepPlayerInBounds(player, field);
}
