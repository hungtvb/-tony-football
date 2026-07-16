import { GameEventType } from "../engine/GameEvents.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isFiniteNumber = (value) => Number.isFinite(value);

function entityPoint(snapshot, entityId) {
  if (!entityId) return null;
  const entity = snapshot?.players?.find((player) => player.id === entityId);
  return entity && isFiniteNumber(entity.x) && isFiniteNumber(entity.y)
    ? { x: entity.x, y: entity.y }
    : null;
}

function ballPoint(snapshot) {
  const ball = snapshot?.ball;
  return ball && isFiniteNumber(ball.x) && isFiniteNumber(ball.y)
    ? { x: ball.x, y: ball.y }
    : null;
}

function payloadPoint(payload, xKey = "x", yKey = "y") {
  return isFiniteNumber(payload[xKey]) && isFiniteNumber(payload[yKey])
    ? { x: payload[xKey], y: payload[yKey] }
    : null;
}

function withPoint(payload, point) {
  return point ? { ...payload, x: point.x, y: point.y } : { ...payload };
}

function kickProjection(payload, snapshot) {
  const point = payloadPoint(payload) ?? ballPoint(snapshot);
  const contextPoint = payloadPoint(payload, "contextX", "contextY")
    ?? entityPoint(snapshot, payload.playerId)
    ?? point;
  const style = payload.style ?? payload.kind ?? payload.type ?? "pass";
  const shot = style === "shot"
    || style === "power"
    || style === "finesse"
    || style === "chip"
    || payload.type === "ball:shoot";
  const power = isFiniteNumber(payload.power) ? clamp(payload.power, 0, 1) : 0.55;
  const particles = withPoint({
    ...payload,
    particleCount: payload.particleCount ?? (shot ? 9 : 4),
    particleColor: payload.particleColor ?? (shot ? "#f5d067" : "#f4f7f5"),
    particleEnergy: payload.particleEnergy ?? 1.2
  }, point);
  const contextParticles = payload.contextEnergy !== undefined || shot
    ? withPoint({
      ...payload,
      contextEnergy: payload.contextEnergy ?? (0.55 + power * 1.2)
    }, contextPoint)
    : null;

  return Object.freeze({
    audioPower: payload.audioPower ?? (shot ? 0.55 + power * 0.35 : 0.4 + power * 0.22),
    particles: Object.freeze(particles),
    contextParticles: contextParticles ? Object.freeze(contextParticles) : null
  });
}

function tackleProjection(payload, snapshot) {
  const won = Boolean(payload.won ?? payload.success);
  const point = payloadPoint(payload)
    ?? entityPoint(snapshot, payload.playerId)
    ?? entityPoint(snapshot, payload.opponentId)
    ?? ballPoint(snapshot);
  return Object.freeze({
    won,
    audioPower: won ? (payload.audioPower ?? 0.3) : null,
    contextParticles: Object.freeze(withPoint({
      ...payload,
      won,
      contextEnergy: payload.contextEnergy ?? 0.8
    }, point))
  });
}

function scoreProjection(payload, snapshot) {
  const point = payloadPoint(payload) ?? ballPoint(snapshot);
  return Object.freeze({
    goal: payload,
    particles: Object.freeze(withPoint({
      ...payload,
      particleCount: payload.particleCount ?? 80,
      particleColor: payload.particleColor ?? (payload.team === 0 ? "#e1bb58" : "#47c9d4"),
      particleEnergy: payload.particleEnergy ?? 3.5
    }, point))
  });
}

export function projectPresentationFeedback(event, snapshot = null) {
  const payload = event.payload ?? {};
  if (event.type === GameEventType.BALL_KICKED) return kickProjection(payload, snapshot);
  if (event.type === GameEventType.TACKLE_RESOLVED) return tackleProjection(payload, snapshot);
  if (event.type === GameEventType.SCORE_CHANGED) return scoreProjection(payload, snapshot);
  return null;
}
