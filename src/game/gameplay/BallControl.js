const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

export function captureEligibility({
  distance,
  ballHeight,
  ballSpeed,
  locked,
  playerCooldown,
  isGoalkeeper,
  isLastTouch,
  config,
}) {
  const radius = isGoalkeeper ? config.goalkeeperRadius : config.outfieldRadius;
  const maxHeight = isGoalkeeper ? config.goalkeeperMaxHeight : config.outfieldMaxHeight;
  const blockedByLastTouch = isLastTouch && ballSpeed > config.lastTouchSpeedBlock;
  const eligible = !locked
    && playerCooldown <= 0
    && !blockedByLastTouch
    && ballHeight <= maxHeight
    && distance < radius;
  return Object.freeze({ eligible, radius, maxHeight, blockedByLastTouch });
}

export function firstTouchScore({
  ballSpeed,
  incomingX,
  incomingY,
  facingX,
  facingY,
  ballHeight,
  playerSpeed,
  rating,
  precision,
  sprinting,
  config,
  captureConfig,
}) {
  const incoming = normalize(-incomingX, -incomingY, facingX || 1, facingY || 0);
  const facing = normalize(facingX, facingY, 1, 0);
  const alignment = clamp((incoming.x * facing.x + incoming.y * facing.y + 1) * 0.5, 0, 1);
  const speedQuality = 1 - clamp(ballSpeed / captureConfig.receivingSpeedHardCap, 0, 1);
  const heightQuality = 1 - clamp(ballHeight / captureConfig.outfieldMaxHeight, 0, 1);
  const movementQuality = 1 - clamp(playerSpeed / 320, 0, 1);
  const ratingQuality = clamp((rating - 70) / 30, 0, 1);
  let score = speedQuality * config.speedWeight
    + alignment * config.angleWeight
    + heightQuality * config.heightWeight
    + movementQuality * config.movementWeight
    + ratingQuality * config.ratingWeight;
  if (precision) score += config.precisionBonus;
  if (sprinting) score -= config.sprintPenalty;
  return clamp(score, 0, 1);
}

export function classifyFirstTouch(score, config) {
  if (score >= config.cleanScore) return "clean";
  if (score >= config.cushionedScore) return "cushioned";
  if (score >= config.heavyScore) return "heavy";
  return "rejected";
}

export function dribbleAnchor({ owner, mode, stepPhase, config }) {
  const speed = Math.hypot(owner.vx, owner.vy);
  const touch = Math.sin(stepPhase);
  const leadBase = mode === "precision" ? config.precisionLead : mode === "sprint" ? config.sprintLead : config.normalLead;
  const lateralBase = mode === "precision" ? config.precisionLateral : mode === "sprint" ? config.sprintLateral : config.normalLateral;
  const followRate = mode === "precision" ? config.precisionFollow : mode === "sprint" ? config.sprintFollow : config.normalFollow;
  const lead = owner.radius + leadBase + clamp(speed / 110, 0, 2.8) * Math.max(0, touch);
  const lateral = speed > 35 ? owner.dribbleSide * lateralBase : 0;
  return Object.freeze({
    x: owner.x + owner.dirX * lead - owner.dirY * lateral,
    y: owner.y + owner.dirY * lead + owner.dirX * lateral,
    lead,
    lateral,
    followRate,
  });
}
