import { createMatchSnapshot, createSnapshotFrame } from "../engine/MatchSnapshot.js";

const PLAYER_FIELDS = Object.freeze([
  "team", "index", "baseX", "baseY", "role", "name", "number", "rating",
  "x", "y", "vx", "vy", "dirX", "dirY", "radius", "stamina", "cooldown",
  "anim", "animTime", "animDuration", "animPower", "stepPhase", "sprinting",
  "diveCooldown", "controlBoost", "motionYaw", "turnLean", "strideBlend",
  "dribbleSide"
]);

const BALL_FIELDS = Object.freeze([
  "x", "y", "vx", "vy", "height", "vz", "curve", "radius", "lock", "angle", "spin"
]);

function copyDefined(source, fields) {
  const copy = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) copy[field] = source[field];
  }
  return copy;
}

export function compatibilityPlayerId(player) {
  if (!player || (player.team !== 0 && player.team !== 1) || !Number.isInteger(player.index)) {
    throw new TypeError("compatibility player requires team and integer index");
  }
  return `${player.team === 0 ? "home" : "away"}-${player.index}`;
}

function compatibilityPossessionId(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/^([01]):(\d+)$/);
  return match ? `${match[1] === "0" ? "home" : "away"}-${match[2]}` : String(value);
}

function projectPlayer(player) {
  return {
    id: compatibilityPlayerId(player),
    ...copyDefined(player, PLAYER_FIELDS)
  };
}

function projectPossession(possession = {}) {
  return {
    state: possession.state ?? "loose",
    ownerId: compatibilityPossessionId(possession.ownerId),
    receiverId: compatibilityPossessionId(possession.receiverId),
    lastControllerId: compatibilityPossessionId(possession.lastControllerId),
    releaseReason: possession.releaseReason ?? null,
    touchOutcome: possession.touchOutcome ?? null
  };
}

export function createCompatibilitySnapshot({
  tick,
  state,
  matchSeconds,
  time,
  difficulty,
  score,
  stats,
  settings,
  replay,
  selectedPlayer,
  players,
  ball
}) {
  const snapshotPlayers = players.map(projectPlayer);
  return createMatchSnapshot({
    tick,
    match: {
      state,
      difficulty,
      time,
      matchSeconds,
      elapsed: Math.max(0, matchSeconds - time),
      score: score.slice(),
      stats: {
        possession: stats.possession.slice(),
        shots: stats.shots.slice(),
        passes: stats.passes,
        completed: stats.completed
      },
      selectedPlayerId: selectedPlayer ? compatibilityPlayerId(selectedPlayer) : null,
      settings: { ...settings },
      replay: {
        active: Boolean(replay.active),
        elapsed: replay.elapsed,
        duration: replay.duration
      }
    },
    players: snapshotPlayers,
    ball: {
      id: "match-ball",
      ...copyDefined(ball, BALL_FIELDS),
      ownerId: ball.owner ? compatibilityPlayerId(ball.owner) : null,
      lastTouchId: ball.lastTouch ? compatibilityPlayerId(ball.lastTouch) : null,
      trail: (ball.trail ?? []).map((point) => copyDefined(point, ["x", "y", "height"])),
      pendingPass: ball.pendingPass ? copyDefined(ball.pendingPass, ["team", "timer"]) : null,
      possession: projectPossession(ball.possession)
    }
  });
}

export class CompatibilitySnapshotAdapter {
  #previous = null;
  #current = null;

  get snapshot() {
    return this.#current;
  }

  capture(source) {
    const snapshot = createCompatibilitySnapshot(source);
    if (this.#current && snapshot.tick < this.#current.tick) {
      throw new RangeError("compatibility snapshot tick cannot move backwards");
    }
    this.#previous = this.#current ?? snapshot;
    this.#current = snapshot;
    return snapshot;
  }

  createRenderFrame(alpha) {
    if (!this.#current) throw new Error("capture a compatibility snapshot before rendering");
    return createSnapshotFrame(this.#previous, this.#current, alpha);
  }
}
