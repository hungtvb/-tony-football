import { createSnapshotCameraController } from "./SnapshotCameraController.js";

const EMPTY_FRAMES = Object.freeze([]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function assertSnapshot(snapshot, name = "snapshot") {
  if (!snapshot || !Object.isFrozen(snapshot) || !Number.isInteger(snapshot.tick) || !snapshot.match || !snapshot.ball || !Array.isArray(snapshot.players)) {
    throw new TypeError(`${name} must be an immutable match snapshot`);
  }
}

function assertFrame(frame) {
  if (!frame || !Object.isFrozen(frame)) throw new TypeError("camera/replay adapter requires an immutable frame");
  assertSnapshot(frame.snapshot, "frame.snapshot");
  assertSnapshot(frame.previousSnapshot, "frame.previousSnapshot");
  if (!Number.isFinite(frame.alpha) || frame.alpha < 0 || frame.alpha > 1) throw new TypeError("frame.alpha must be in [0, 1]");
  if (!Number.isFinite(frame.nowMilliseconds)) throw new TypeError("frame.nowMilliseconds must be finite");
}

function replayFacts(snapshot) {
  const source = snapshot.match.replay ?? Object.freeze({});
  const duration = Math.max(.001, Number(source.duration ?? 0));
  const elapsed = clamp(Number(source.elapsed ?? 0), 0, duration);
  return Object.freeze({ active: Boolean(source.active), elapsed, duration, progress: clamp(elapsed / duration, 0, 1) });
}

function uniqueFrames(frames) {
  const byTick = new Map();
  for (const frame of frames) { assertSnapshot(frame, "replay frame"); byTick.set(frame.tick, frame); }
  return Object.freeze([...byTick.values()].sort((left, right) => left.tick - right.tick));
}

function selectReplayFrame(frames, elapsed, duration) {
  if (frames.length === 0) return Object.freeze({ snapshot: null, index: -1 });
  const progress = clamp(elapsed / Math.max(.001, duration), 0, .999999);
  const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return Object.freeze({ snapshot: frames[index], index });
}

function projectVisualSnapshot(current, historical) {
  if (!historical) return current;
  return Object.freeze({
    ...current,
    match: current.match,
    players: historical.players,
    ball: Object.freeze({ ...historical.ball, ownerId: current.ball.ownerId, lastTouchId: current.ball.lastTouchId }),
  });
}

function cameraSubjectSnapshot(current, visual, goalScorerId) {
  const scorerId = goalScorerId ?? current.match.goalSequence?.scorerId ?? null;
  const scorer = scorerId ? visual.players.find((player) => player.id === scorerId) ?? null : null;
  if (!scorer) return visual;
  return Object.freeze({ ...visual, ball: Object.freeze({ ...visual.ball, x: scorer.x, y: scorer.y, vx: 0, vy: 0 }) });
}

export function createSnapshotCameraReplayAdapter({ worldWidth, worldHeight, viewportWidth = worldWidth, viewportHeight = worldHeight, cameraConfig, sampleRate = 15, maxFrames = 66 } = {}) {
  if (![worldWidth, worldHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) throw new TypeError("camera/replay adapter dimensions must be positive finite numbers");
  if (!cameraConfig) throw new TypeError("camera/replay adapter requires cameraConfig");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError("sampleRate must be positive");
  if (!Number.isInteger(maxFrames) || maxFrames <= 0) throw new TypeError("maxFrames must be a positive integer");

  const cameraController = createSnapshotCameraController({ worldWidth, worldHeight, viewportWidth, viewportHeight, config: cameraConfig });
  const sampleInterval = 1 / sampleRate;
  let attached = false; let disposed = false; let status = "idle";
  let history = []; let playbackFrames = EMPTY_FRAMES; let lastRecordedElapsed = null;
  let previousReplayActive = false; let lastNowMilliseconds = null; let lastCameraMode = "broadcast";
  let latestSnapshot = null; let latestProjection = null; let renderCount = 0;

  function clearPlayback({ clearHistory = false } = {}) {
    playbackFrames = EMPTY_FRAMES; previousReplayActive = false;
    if (clearHistory) { history = []; lastRecordedElapsed = null; }
  }

  function record(snapshot) {
    const facts = replayFacts(snapshot);
    if (facts.active || snapshot.match.goalSequence || snapshot.match.state !== "playing") return false;
    const elapsed = Math.max(0, Number(snapshot.match.elapsed ?? 0));
    if (lastRecordedElapsed !== null && elapsed < lastRecordedElapsed) clearPlayback({ clearHistory: true });
    if (lastRecordedElapsed !== null && elapsed - lastRecordedElapsed < sampleInterval) return false;
    history.push(snapshot); while (history.length > maxFrames) history.shift(); lastRecordedElapsed = elapsed; return true;
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
      const finalLive = frame.previousSnapshot.match.replay?.active ? null : frame.previousSnapshot;
      playbackFrames = uniqueFrames([...history, ...(finalLive ? [finalLive] : [])]);
    }
    if (!authoritative.active && previousReplayActive) playbackFrames = EMPTY_FRAMES;
    previousReplayActive = authoritative.active;
    const selection = authoritative.active ? selectReplayFrame(playbackFrames, authoritative.elapsed, authoritative.duration) : Object.freeze({ snapshot: null, index: -1 });
    const renderSnapshot = projectVisualSnapshot(snapshot, selection.snapshot);
    const deltaSeconds = lastNowMilliseconds === null ? 1 / 60 : clamp((frame.nowMilliseconds - lastNowMilliseconds) / 1000, 0, .05);
    lastNowMilliseconds = frame.nowMilliseconds; lastCameraMode = frame.cameraMode ?? lastCameraMode;
    cameraController.update(cameraSubjectSnapshot(snapshot, renderSnapshot, frame.goalScorerId ?? null), deltaSeconds);
    latestSnapshot = snapshot; renderCount += 1;
    latestProjection = Object.freeze({
      snapshot,
      renderSnapshot,
      replaySnapshot: selection.snapshot,
      camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }),
      replay: Object.freeze({ ...authoritative, frameIndex: selection.index, frameCount: playbackFrames.length, missingFrame: authoritative.active && !selection.snapshot }),
      projectionSequence: renderCount,
    });
    return latestProjection;
  }

  const cameraFacade = Object.freeze({ get state() { return cameraController.state; }, reset(options = {}) { return cameraController.reset(options); } });
  const replayFacade = Object.freeze({
    get active() { return Boolean(latestProjection?.replay.active); },
    get elapsed() { return Number(latestProjection?.replay.elapsed ?? 0); },
    get duration() { return Number(latestProjection?.replay.duration ?? 0); },
    get bufferedFrames() { return history.length; },
    get playbackFrames() { return playbackFrames.length; },
    reset() { clearPlayback({ clearHistory: true }); return true; },
    stop() { clearPlayback({ clearHistory: false }); return true; },
    update() { return false; },
    currentSnapshot() { return latestProjection?.replay.active ? latestProjection.renderSnapshot : null; },
  });

  return Object.freeze({
    camera: cameraFacade, replay: replayFacade,
    attach() { if (attached || disposed) return false; attached = true; status = "ready"; return true; },
    render: project, project, projection: () => latestProjection,
    reset() { if (!attached || disposed) return false; clearPlayback({ clearHistory: true }); cameraController.reset(); lastNowMilliseconds = null; latestSnapshot = null; latestProjection = null; renderCount = 0; status = "ready"; return true; },
    teardown() { if (disposed) return false; clearPlayback({ clearHistory: true }); attached = false; disposed = true; status = "disposed"; latestSnapshot = null; latestProjection = null; return true; },
    diagnostics: () => Object.freeze({ owner: "snapshot-camera-replay", attached, disposed, status, renderCount, camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }), replay: Object.freeze({ active: Boolean(latestProjection?.replay.active), elapsed: Number(latestProjection?.replay.elapsed ?? 0), duration: Number(latestProjection?.replay.duration ?? 0), historyFrames: history.length, playbackFrames: playbackFrames.length, frameIndex: latestProjection?.replay.frameIndex ?? -1, missingFrame: Boolean(latestProjection?.replay.missingFrame) }) }),
  });
}
