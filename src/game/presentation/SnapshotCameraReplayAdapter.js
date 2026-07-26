import { createSnapshotCameraController } from "./SnapshotCameraController.js";

const EMPTY_FRAMES = Object.freeze([]);
const SAMPLE_EPSILON_SECONDS = 1e-9;
const DEFAULT_PRE_SHOT_FRAMES = 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function assertSnapshot(snapshot, name = "snapshot") {
  if (!snapshot || !Object.isFrozen(snapshot) || !Number.isInteger(snapshot.tick) || !snapshot.match || !snapshot.ball || !Array.isArray(snapshot.players)) {
    throw new TypeError(`${name} must be an immutable match snapshot`);
  }
}
function assertFrame(frame) {
  if (!frame || !Object.isFrozen(frame)) throw new TypeError("camera/replay adapter requires an immutable frame");
  assertSnapshot(frame.snapshot, "frame.snapshot"); assertSnapshot(frame.previousSnapshot, "frame.previousSnapshot");
  if (!Number.isFinite(frame.alpha) || frame.alpha < 0 || frame.alpha > 1) throw new TypeError("frame.alpha must be in [0, 1]");
  if (!Number.isFinite(frame.nowMilliseconds)) throw new TypeError("frame.nowMilliseconds must be finite");
}
function replayFacts(snapshot) {
  const source = snapshot.match.replay ?? Object.freeze({});
  const duration = Math.max(.001, Number(source.duration ?? 0));
  const elapsed = clamp(Number(source.elapsed ?? 0), 0, duration);
  return Object.freeze({ active: Boolean(source.active), elapsed, duration, progress: clamp(elapsed / duration, 0, 1) });
}
function goalIncidentKey(snapshot) {
  const sequence = snapshot.match.goalSequence;
  if (!sequence) return null;
  const score = snapshot.match.score ?? Object.freeze([0, 0]);
  return `${Number(score[0] ?? 0)}:${Number(score[1] ?? 0)}:${sequence.team ?? "unknown"}:${sequence.scorerId ?? "unknown"}`;
}
function uniqueFrames(frames) {
  const byTick = new Map();
  for (const frame of frames) { assertSnapshot(frame, "replay frame"); byTick.set(frame.tick, frame); }
  return Object.freeze([...byTick.values()].sort((left, right) => left.tick - right.tick));
}
function appendUniqueFrame(frames, snapshot, limit) {
  const index = frames.findIndex((frame) => frame.tick === snapshot.tick);
  if (index >= 0) frames[index] = snapshot; else frames.push(snapshot);
  frames.sort((left, right) => left.tick - right.tick);
  while (frames.length > limit) frames.shift();
  return true;
}
function selectReplayFrame(frames, elapsed, duration) {
  if (frames.length === 0) return Object.freeze({ snapshot: null, index: -1 });
  const progress = clamp(elapsed / Math.max(.001, duration), 0, .999999);
  const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return Object.freeze({ snapshot: frames[index], index });
}
function replayIncidentScoringRight(frames, worldWidth) {
  const terminal = frames.at(-1) ?? null;
  const ballX = Number(terminal?.ball?.x);
  return Number.isFinite(ballX) ? ballX >= worldWidth / 2 : null;
}
function projectVisualSnapshot(current, historical) {
  if (!historical) return current;
  return Object.freeze({ ...current, match: current.match, players: historical.players, ball: Object.freeze({ ...historical.ball, ownerId: current.ball.ownerId, lastTouchId: current.ball.lastTouchId }) });
}
function cameraSubjectSnapshot(current, visual, goalScorerId) {
  const scorerId = goalScorerId ?? current.match.goalSequence?.scorerId ?? null;
  const scorer = scorerId ? visual.players.find((player) => player.id === scorerId) ?? null : null;
  if (!scorer) return visual;
  return Object.freeze({ ...visual, ball: Object.freeze({ ...visual.ball, x: scorer.x, y: scorer.y, vx: 0, vy: 0 }) });
}

export function createSnapshotCameraReplayAdapter({ worldWidth, worldHeight, viewportWidth = worldWidth, viewportHeight = worldHeight, cameraConfig, sampleRate = 15, maxFrames = 66, preShotFrames = DEFAULT_PRE_SHOT_FRAMES } = {}) {
  if (![worldWidth, worldHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) throw new TypeError("camera/replay adapter dimensions must be positive finite numbers");
  if (!cameraConfig) throw new TypeError("camera/replay adapter requires cameraConfig");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError("sampleRate must be positive");
  if (!Number.isInteger(maxFrames) || maxFrames <= 0) throw new TypeError("maxFrames must be a positive integer");
  if (!Number.isInteger(preShotFrames) || preShotFrames <= 0 || preShotFrames > maxFrames) throw new TypeError("preShotFrames must be a positive integer no greater than maxFrames");

  const cameraController = createSnapshotCameraController({ worldWidth, worldHeight, viewportWidth, viewportHeight, config: cameraConfig });
  const sampleInterval = 1 / sampleRate;
  let attached = false; let disposed = false; let status = "idle";
  let history = []; let incidentFrames = []; let playbackFrames = EMPTY_FRAMES; let lastRecordedElapsed = null;
  let incidentKey = null; let playbackIncidentKey = null; let playbackScoringRight = null; let previousReplayActive = false;
  let lastNowMilliseconds = null; let lastCameraMode = "broadcast"; let latestSnapshot = null; let latestProjection = null; let renderCount = 0;

  function clearPlayback({ clearHistory = false, clearIncident = clearHistory } = {}) {
    playbackFrames = EMPTY_FRAMES; playbackIncidentKey = null; playbackScoringRight = null; previousReplayActive = false;
    if (clearHistory) { history = []; lastRecordedElapsed = null; }
    if (clearIncident) { incidentFrames = []; incidentKey = null; }
  }
  function recordNormal(snapshot) {
    const elapsed = Math.max(0, Number(snapshot.match.elapsed ?? 0));
    if (lastRecordedElapsed !== null && elapsed < lastRecordedElapsed) clearPlayback({ clearHistory: true });
    if (lastRecordedElapsed !== null && elapsed - lastRecordedElapsed + SAMPLE_EPSILON_SECONDS < sampleInterval) return false;
    appendUniqueFrame(history, snapshot, maxFrames); lastRecordedElapsed = elapsed; return true;
  }
  function recordIncident(snapshot, key) {
    if (incidentKey !== key) {
      incidentKey = key;
      incidentFrames = history.slice(-preShotFrames);
    }
    appendUniqueFrame(incidentFrames, snapshot, maxFrames);
    return true;
  }
  function record(snapshot) {
    const facts = replayFacts(snapshot);
    if (facts.active || snapshot.match.state !== "playing") return false;
    if (previousReplayActive) { clearPlayback({ clearHistory: true }); return false; }
    const key = goalIncidentKey(snapshot);
    if (key) return recordIncident(snapshot, key);
    if (incidentKey && latestSnapshot?.match?.goalSequence) clearPlayback({ clearHistory: true });
    return recordNormal(snapshot);
  }
  function playbackSource(frame, key) {
    const previous = frame.previousSnapshot.match.replay?.active ? null : frame.previousSnapshot;
    if (key && key === incidentKey && incidentFrames.length > 0) return uniqueFrames([...incidentFrames, ...(previous ? [previous] : [])]);
    return uniqueFrames([...history, ...(previous ? [previous] : [])]);
  }
  function project(frame) {
    if (!attached || disposed) return null;
    assertFrame(frame);
    const snapshot = frame.snapshot;
    const previousElapsed = Number(latestSnapshot?.match?.elapsed ?? snapshot.match.elapsed ?? 0);
    const currentElapsed = Number(snapshot.match.elapsed ?? previousElapsed);
    if (latestSnapshot && (currentElapsed < previousElapsed || (latestSnapshot.match.state !== "playing" && snapshot.match.state === "playing"))) clearPlayback({ clearHistory: true });
    record(snapshot);
    const authoritative = replayFacts(snapshot);
    if (authoritative.active && !previousReplayActive) {
      const key = goalIncidentKey(snapshot);
      playbackFrames = playbackSource(frame, key);
      playbackIncidentKey = key && key === incidentKey ? key : null;
      playbackScoringRight = replayIncidentScoringRight(playbackFrames, worldWidth);
    }
    if (!authoritative.active && previousReplayActive) {
      playbackFrames = EMPTY_FRAMES;
      playbackIncidentKey = null;
      playbackScoringRight = null;
    }
    previousReplayActive = authoritative.active;
    const selection = authoritative.active ? selectReplayFrame(playbackFrames, authoritative.elapsed, authoritative.duration) : Object.freeze({ snapshot: null, index: -1 });
    const cinematicAvailable = authoritative.active && Boolean(selection.snapshot) && typeof playbackScoringRight === "boolean";
    const renderSnapshot = projectVisualSnapshot(snapshot, selection.snapshot);
    const deltaSeconds = lastNowMilliseconds === null ? 1 / 60 : clamp((frame.nowMilliseconds - lastNowMilliseconds) / 1000, 0, .05);
    lastNowMilliseconds = frame.nowMilliseconds; lastCameraMode = frame.cameraMode ?? lastCameraMode;
    cameraController.update(cameraSubjectSnapshot(snapshot, renderSnapshot, frame.goalScorerId ?? null), deltaSeconds);
    latestSnapshot = snapshot; renderCount += 1;
    latestProjection = Object.freeze({
      snapshot, renderSnapshot, replaySnapshot: selection.snapshot,
      camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }),
      replay: Object.freeze({
        ...authoritative,
        incidentKey: playbackIncidentKey,
        scoringRight: playbackScoringRight,
        cinematicAvailable,
        frameIndex: selection.index,
        frameCount: playbackFrames.length,
        missingFrame: authoritative.active && !selection.snapshot,
      }),
      projectionSequence: renderCount,
    });
    return latestProjection;
  }

  const cameraFacade = Object.freeze({ get state() { return cameraController.state; }, reset(options = {}) { return cameraController.reset(options); } });
  const replayFacade = Object.freeze({
    get active() { return Boolean(latestProjection?.replay.active); }, get elapsed() { return Number(latestProjection?.replay.elapsed ?? 0); }, get duration() { return Number(latestProjection?.replay.duration ?? 0); },
    get scoringRight() { return latestProjection?.replay.scoringRight ?? null; }, get cinematicAvailable() { return Boolean(latestProjection?.replay.cinematicAvailable); },
    get bufferedFrames() { return history.length; }, get playbackFrames() { return playbackFrames.length; },
    reset() { clearPlayback({ clearHistory: true }); return true; }, stop() { clearPlayback({ clearHistory: false, clearIncident: false }); return true; }, update() { return false; },
    currentSnapshot() { return latestProjection?.replay.active ? latestProjection.renderSnapshot : null; },
  });

  return Object.freeze({
    camera: cameraFacade, replay: replayFacade,
    attach() { if (attached || disposed) return false; attached = true; status = "ready"; return true; },
    render: project, project, projection: () => latestProjection,
    reset() { if (!attached || disposed) return false; clearPlayback({ clearHistory: true }); cameraController.reset(); lastNowMilliseconds = null; latestSnapshot = null; latestProjection = null; renderCount = 0; status = "ready"; return true; },
    teardown() { if (disposed) return false; clearPlayback({ clearHistory: true }); attached = false; disposed = true; status = "disposed"; latestSnapshot = null; latestProjection = null; return true; },
    diagnostics: () => Object.freeze({
      owner: "snapshot-camera-replay", attached, disposed, status, renderCount, projectionSequence: latestProjection?.projectionSequence ?? 0,
      camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }),
      replay: Object.freeze({
        active: Boolean(latestProjection?.replay.active), elapsed: Number(latestProjection?.replay.elapsed ?? 0), duration: Number(latestProjection?.replay.duration ?? 0),
        historyFrames: history.length, preShotFrames, incidentFrames: incidentFrames.length, incidentKey, playbackIncidentKey, playbackScoringRight, playbackFrames: playbackFrames.length,
        historyFrameTicks: Object.freeze(history.map((snapshot) => snapshot.tick)), incidentFrameTicks: Object.freeze(incidentFrames.map((snapshot) => snapshot.tick)), playbackFrameTicks: Object.freeze(playbackFrames.map((snapshot) => snapshot.tick)),
        cinematicAvailable: Boolean(latestProjection?.replay.cinematicAvailable), frameIndex: latestProjection?.replay.frameIndex ?? -1, missingFrame: Boolean(latestProjection?.replay.missingFrame),
      }),
    }),
  });
}
