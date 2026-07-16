import {
  BrowserRuntimeMode,
  browserRuntimeComposition,
  resolveBrowserRuntimeMode
} from "../application/BrowserRuntimeComposition.js";
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

function copyArray(target, values) {
  if (!Array.isArray(target) || !Array.isArray(values)) return;
  target.splice(0, target.length, ...values);
}

function projectLiveSnapshotToCompatibilitySource(source, snapshot) {
  const legacyPlayers = new Map(
    (source.players ?? []).map((player) => [compatibilityPlayerId(player), player])
  );
  for (const player of snapshot.players) {
    const legacy = legacyPlayers.get(player.id);
    if (legacy) Object.assign(legacy, copyDefined(player, PLAYER_FIELDS));
  }

  copyArray(source.score, snapshot.match.score);
  copyArray(source.stats?.possession, snapshot.match.stats.possession);
  copyArray(source.stats?.shots, snapshot.match.stats.shots);
  if (source.stats) {
    source.stats.passes = snapshot.match.stats.passes;
    source.stats.completed = snapshot.match.stats.completed;
  }

  if (source.ball) {
    Object.assign(source.ball, copyDefined(snapshot.ball, BALL_FIELDS));
    source.ball.owner = legacyPlayers.get(snapshot.ball.ownerId) ?? null;
    source.ball.lastTouch = legacyPlayers.get(snapshot.ball.lastTouchId) ?? null;
    source.ball.trail = snapshot.ball.trail.map((point) => ({ ...point }));
    source.ball.pendingPass = snapshot.ball.pendingPass ? { ...snapshot.ball.pendingPass } : null;
    source.ball.possession = { ...snapshot.ball.possession };
  }
}

function projectLiveReplayToCompatibilitySource(source, snapshot, previousSnapshot) {
  const replay = source?.replay;
  if (!replay) return;

  const elapsed = snapshot.match.elapsed ?? 0;
  const previousElapsed = previousSnapshot?.match?.elapsed ?? 0;
  const freshMatch = snapshot.match.state === "playing" && (
    previousSnapshot?.match?.state !== "playing" || elapsed < previousElapsed
  );
  if (freshMatch && typeof replay.reset === "function") replay.reset();

  const active = Boolean(snapshot.match.replay?.active);
  const wasActive = Boolean(previousSnapshot?.match?.replay?.active);
  if (active && !wasActive && typeof replay.start === "function") {
    replay.start(snapshot);
  } else if (!active && wasActive && typeof replay.stop === "function") {
    replay.stop();
  }
}

export class CompatibilitySnapshotAdapter {
  #previous = null;
  #current = null;
  #mode;
  #runtimeComposition;

  constructor({
    mode = resolveBrowserRuntimeMode(),
    runtimeComposition = browserRuntimeComposition
  } = {}) {
    this.#mode = mode;
    this.#runtimeComposition = runtimeComposition;
  }

  get mode() {
    return this.#mode;
  }

  get snapshot() {
    return this.#current;
  }

  capture(source) {
    if (this.#mode === BrowserRuntimeMode.ENGINE) {
      const previousSnapshot = this.#current;
      this.#runtimeComposition.configure(source);
      const snapshot = this.#runtimeComposition.advanceToSourceTick(source.tick);
      projectLiveSnapshotToCompatibilitySource(source, snapshot);
      projectLiveReplayToCompatibilitySource(source, snapshot, previousSnapshot);
      this.#previous = previousSnapshot ?? snapshot;
      this.#current = snapshot;
      return snapshot;
    }

    const snapshot = createCompatibilitySnapshot(source);
    if (this.#current && snapshot.tick < this.#current.tick) {
      throw new RangeError("compatibility snapshot tick cannot move backwards");
    }
    this.#previous = this.#current ?? snapshot;
    this.#current = snapshot;
    return snapshot;
  }

  createRenderFrame(alpha) {
    if (!this.#current) throw new Error("capture a snapshot before rendering");
    if (this.#mode === BrowserRuntimeMode.ENGINE) {
      return this.#runtimeComposition.createRenderFrame(alpha);
    }
    return createSnapshotFrame(this.#previous, this.#current, alpha);
  }
}
