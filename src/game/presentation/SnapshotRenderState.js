const DEFAULT_SNAP_DISTANCE = Object.freeze({ player: 80, ball: 160 });

const lerp = (from, to, alpha) => from + (to - from) * alpha;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function interpolateNumber(previous, current, alpha) {
  const to = finiteOr(current, 0);
  return lerp(finiteOr(previous, to), to, alpha);
}

export function interpolateRenderAngle(previous, current, alpha) {
  const to = finiteOr(current, 0);
  const from = finiteOr(previous, to);
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function exceedsSnapDistance(previous, current, distance) {
  const dx = finiteOr(current.x, 0) - finiteOr(previous.x, current.x ?? 0);
  const dy = finiteOr(current.y, 0) - finiteOr(previous.y, current.y ?? 0);
  return dx * dx + dy * dy > distance * distance;
}

function interpolateDirection(previous, current, alpha) {
  const previousYaw = Math.atan2(finiteOr(previous.dirX, 0), finiteOr(previous.dirY, 1));
  const currentYaw = Math.atan2(finiteOr(current.dirX, 0), finiteOr(current.dirY, 1));
  const yaw = interpolateRenderAngle(previousYaw, currentYaw, alpha);
  return { dirX: Math.sin(yaw), dirY: Math.cos(yaw) };
}

function interpolatePlayer(previous, current, alpha, snapDistance) {
  if (!previous || previous.id !== current.id || exceedsSnapDistance(previous, current, snapDistance)) {
    return current;
  }

  const direction = interpolateDirection(previous, current, alpha);
  const sameAnimation = previous.anim === current.anim;
  return Object.freeze({
    ...current,
    x: interpolateNumber(previous.x, current.x, alpha),
    y: interpolateNumber(previous.y, current.y, alpha),
    vx: interpolateNumber(previous.vx, current.vx, alpha),
    vy: interpolateNumber(previous.vy, current.vy, alpha),
    dirX: direction.dirX,
    dirY: direction.dirY,
    motionYaw: interpolateRenderAngle(previous.motionYaw, current.motionYaw, alpha),
    turnLean: interpolateNumber(previous.turnLean, current.turnLean, alpha),
    strideBlend: interpolateNumber(previous.strideBlend, current.strideBlend, alpha),
    stepPhase: interpolateNumber(previous.stepPhase, current.stepPhase, alpha),
    animTime: sameAnimation
      ? interpolateNumber(previous.animTime, current.animTime, alpha)
      : current.animTime
  });
}

function interpolateBall(previous, current, alpha, snapDistance) {
  if (!previous || previous.id !== current.id || exceedsSnapDistance(previous, current, snapDistance)) {
    return current;
  }

  return Object.freeze({
    ...current,
    x: interpolateNumber(previous.x, current.x, alpha),
    y: interpolateNumber(previous.y, current.y, alpha),
    vx: interpolateNumber(previous.vx, current.vx, alpha),
    vy: interpolateNumber(previous.vy, current.vy, alpha),
    height: interpolateNumber(previous.height, current.height, alpha),
    vz: interpolateNumber(previous.vz, current.vz, alpha),
    angle: interpolateRenderAngle(previous.angle, current.angle, alpha),
    spin: interpolateNumber(previous.spin, current.spin, alpha)
  });
}

export function createSnapshotRenderState(frame, {
  playerSnapDistance = DEFAULT_SNAP_DISTANCE.player,
  ballSnapDistance = DEFAULT_SNAP_DISTANCE.ball
} = {}) {
  if (!frame?.previous || !frame?.current) {
    throw new TypeError("snapshot render state requires a previous/current frame");
  }
  if (!Number.isFinite(frame.alpha) || frame.alpha < 0 || frame.alpha > 1) {
    throw new RangeError("snapshot render alpha must be between 0 and 1");
  }

  const { previous, current, alpha } = frame;
  if (previous.tick === current.tick) {
    return Object.freeze({
      previousTick: previous.tick,
      currentTick: current.tick,
      alpha,
      players: current.players,
      ball: current.ball
    });
  }

  const previousPlayers = new Map(previous.players.map((player) => [player.id, player]));
  const players = current.players.map((player) => interpolatePlayer(
    previousPlayers.get(player.id),
    player,
    alpha,
    playerSnapDistance
  ));

  return Object.freeze({
    previousTick: previous.tick,
    currentTick: current.tick,
    alpha,
    players: Object.freeze(players),
    ball: interpolateBall(previous.ball, current.ball, alpha, ballSnapDistance)
  });
}
