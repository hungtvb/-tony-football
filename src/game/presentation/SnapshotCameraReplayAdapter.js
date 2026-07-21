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
  return Object.freeze({
    active: Boolean(source.active),
    elapsed,
    duration,
    progress: clamp(elapsed / duration, 0, 1),
  });
}

function uniqueFrames(frames) {
  const byTick = new Map();
  for (const frame of frames) {
    assertSnapshot(frame, "replay frame");
    byTick.set(frame.tick, frame);
  }
  return Object.freeze([...byTick.values()].sort((left, right) => left.tick - right.tick));
}

function selectReplayFrame(frames, elapsed, duration) {
  if (frames.length === 0) return Object.freeze({ snapshot: null, index: -1 });
  const progress = clamp(elapsed / Math.max(.001, duration), 0, .999999);
  const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return Object.freeze({ snapshot: frames[index], index });
}

function cameraSubjectSnapshot(snapshot, replaySnapshot, goalScorerId) {
  const source = replaySnapshot ?? snapshot;
  const scorerId = goalScorerId ?? snapshot.match.goalSequence?.scorerId ?? null;
  const scorer = scorerId ? source.players.find((player) => player.id === scorerId) ?? null : null;
  if (!scorer) return source;
  return Object.freeze({
    ...source,
    ball: Object.freeze({ ...source.ball, x: scorer.x, y: scorer.y, vx: 0, vy: 0 }),
  });
}

export function createSnapshotCameraReplayAdapter({
  worldWidth,
  worldHeight,
  viewportWidth = worldWidth,
  viewportHeight = worldHeight,
  cameraConfig,
  sampleRate = 15,
  maxFrames = 66,
  minimumPlaybackFrames = 2,
  manualDuration = 3.05,
} = {}) {
  if (![worldWidth, worldHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("camera/replay adapter dimensions must be positive finite numbers");
  }
  if (!cameraConfig) throw new TypeError("camera/replay adapter requires cameraConfig");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError("sampleRate must be positive");
  if (!Number.isInteger(maxFrames) || maxFrames <= 0) throw new TypeError("maxFrames must be a positive integer");
  if (!Number.isInteger(minimumPlaybackFrames) || minimumPlaybackFrames <= 0) throw new TypeError("minimumPlaybackFrames must be positive");
  if (!Number.isFinite(manualDuration) || manualDuration <= 0) throw new TypeError("manualDuration must be positive");

  const cameraController = createSnapshotCameraController({
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
    config: cameraConfig,
  });
  const sampleInterval = 1 / sampleRate;
  let attached = false;
  let disposed = false;
  let status = "idle";
  let history = [];
  let playbackFrames = EMPTY_FRAMES;
  let manualFrames = EMPTY_FRAMES;
  let manualActive = false;
  let manualElapsed = 0;
  let lastRecordedElapsed = null;
  let previousReplayActive = false;
  let lastNowMilliseconds = null;
  let lastCameraMode = "broadcast";
  let latestSnapshot = null;
  let latestProjection = null;
  let renderCount = 0;

  function clearPlayback({ clearHistory = false } = {}) {
    playbackFrames = EMPTY_FRAMES;
    manualFrames = EMPTY_FRAMES;
    manualActive = false;
    manualElapsed = 0;
    previousReplayActive = false;
    if (clearHistory) {
      history = [];
      lastRecordedElapsed = null;
    }
  }

  function record(snapshot) {
    assertSnapshot(snapshot);
    const facts = replayFacts(snapshot);
    if (facts.active || snapshot.match.goalSequence || snapshot.match.state !== "playing") return false;
    const elapsed = Math.max(0, Number(snapshot.match.elapsed ?? 0));
    if (lastRecordedElapsed !== null && elapsed < lastRecordedElapsed) clearPlayback({ clearHistory: true });
    if (lastRecordedElapsed !== null && elapsed - lastRecordedElapsed < sampleInterval) return false;
    history.push(snapshot);
    while (history.length > maxFrames) history.shift();
    lastRecordedElapsed = elapsed;
    return true;
  }

  function beginAuthoritativePlayback(frame) {
    const finalLiveFrame = frame.previousSnapshot.match.replay?.active ? null : frame.previousSnapshot;
    playbackFrames = uniqueFrames([...history, ...(finalLiveFrame ? [finalLiveFrame] : [])]);
    return playbackFrames.length;
  }

  function project(frame) {
    if (!attached || disposed) return null;
    assertFrame(frame);
    const snapshot = frame.snapshot;
    const previousElapsed = Number(latestSnapshot?.match?.elapsed ?? snapshot.match.elapsed ?? 0);
    const currentElapsed = Number(snapshot.match.elapsed ?? previousElapsed);
    const freshRuntime = latestSnapshot && (
      currentElapsed < previousElapsed
      || (latestSnapshot.match.state !== "playing" && snapshot.match.state === "playing")
    );
    if (freshRuntime) clearPlayback({ clearHistory: true });
    record(snapshot);

    const authoritative = replayFacts(snapshot);
    if (authoritative.active && !previousReplayActive) beginAuthoritativePlayback(frame);
    if (!authoritative.active && previousReplayActive) playbackFrames = EMPTY_FRAMES;
    previousReplayActive = authoritative.active;

    let replaySelection = Object.freeze({ snapshot: null, index: -1 });
    let activeReplayFacts = authoritative;
    if (authoritative.active) {
      replaySelection = selectReplayFrame(playbackFrames, authoritative.elapsed, authoritative.duration);
    } else if (manualActive) {
      activeReplayFacts = Object.freeze({
        active: true,
        elapsed: manualElapsed,
        duration: manualDuration,
        progress: clamp(manualElapsed / manualDuration, 0, 1),
      });
      replaySelection = selectReplayFrame(manualFrames, manualElapsed, manualDuration);
    }

    const replaySnapshot = replaySelection.snapshot;
    const renderSnapshot = replaySnapshot ?? snapshot;
    const nowMilliseconds = frame.nowMilliseconds;
    const deltaSeconds = lastNowMilliseconds === null
      ? 1 / 60
      : clamp((nowMilliseconds - lastNowMilliseconds) / 1000, 0, .05);
    lastNowMilliseconds = nowMilliseconds;
    lastCameraMode = frame.cameraMode ?? lastCameraMode;
    cameraController.update(cameraSubjectSnapshot(snapshot, replaySnapshot, frame.goalScorerId ?? null), deltaSeconds);

    latestSnapshot = snapshot;
    renderCount += 1;
    latestProjection = Object.freeze({
      snapshot,
      renderSnapshot,
      replaySnapshot,
      camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }),
      replay: Object.freeze({
        ...activeReplayFacts,
        frameIndex: replaySelection.index,
        frameCount: authoritative.active ? playbackFrames.length : manualFrames.length,
        missingFrame: activeReplayFacts.active && !replaySnapshot,
      }),
    });
    return latestProjection;
  }

  const cameraFacade = Object.freeze({
    get state() { return cameraController.state; },
    reset(options = {}) { return cameraController.reset(options); },
    update(snapshot, deltaSeconds) {
      assertSnapshot(snapshot);
      return cameraController.update(snapshot, deltaSeconds);
    },
  });

  const replayFacade = Object.freeze({
    get active() { return Boolean(latestProjection?.replay.active ?? manualActive); },
    get elapsed() { return Number(latestProjection?.replay.elapsed ?? manualElapsed); },
    get duration() { return Number(latestProjection?.replay.duration ?? manualDuration); },
    get bufferedFrames() { return history.length; },
    get playbackFrames() { return playbackFrames.length || manualFrames.length; },
    reset() { clearPlayback({ clearHistory: true }); return true; },
    stop() { clearPlayback({ clearHistory: false }); return true; },
    record(snapshot) { return record(snapshot); },
    start(finalSnapshot) {
      assertSnapshot(finalSnapshot, "final replay snapshot");
      manualFrames = uniqueFrames([...history, finalSnapshot]);
      manualElapsed = 0;
      manualActive = manualFrames.length >= minimumPlaybackFrames;
      return manualActive;
    },
    loadFrames(snapshots, { play = true } = {}) {
      if (!Array.isArray(snapshots)) throw new TypeError("replay frames must be an array");
      manualFrames = uniqueFrames(snapshots);
      manualElapsed = 0;
      manualActive = Boolean(play && manualFrames.length);
      return manualActive;
    },
    syncElapsed(nextElapsed) {
      if (!Number.isFinite(nextElapsed) || nextElapsed < 0) throw new TypeError("replay elapsed must be non-negative");
      if (nextElapsed < manualElapsed) throw new RangeError("replay elapsed cannot move backwards");
      if (nextElapsed === manualElapsed) return false;
      manualElapsed = nextElapsed;
      return true;
    },
    update() { return false; },
    currentSnapshot() {
      if (latestProjection?.replay.active) return latestProjection.replaySnapshot;
      if (!manualActive) return null;
      return selectReplayFrame(manualFrames, manualElapsed, manualDuration).snapshot;
    },
  });

  return Object.freeze({
    camera: cameraFacade,
    replay: replayFacade,
    attach() {
      if (attached || disposed) return false;
      attached = true;
      status = "ready";
      return true;
    },
    render: project,
    project,
    projection: () => latestProjection,
    reset() {
      if (!attached || disposed) return false;
      clearPlayback({ clearHistory: true });
      cameraController.reset();
      lastNowMilliseconds = null;
      latestSnapshot = null;
      latestProjection = null;
      renderCount = 0;
      status = "ready";
      return true;
    },
    teardown() {
      if (disposed) return false;
      clearPlayback({ clearHistory: true });
      attached = false;
      disposed = true;
      status = "disposed";
      latestSnapshot = null;
      latestProjection = null;
      return true;
    },
    diagnostics: () => Object.freeze({
      owner: "snapshot-camera-replay",
      attached,
      disposed,
      status,
      renderCount,
      camera: Object.freeze({ ...cameraController.state, mode: lastCameraMode }),
      replay: Object.freeze({
        active: Boolean(latestProjection?.replay.active ?? manualActive),
        elapsed: Number(latestProjection?.replay.elapsed ?? manualElapsed),
        duration: Number(latestProjection?.replay.duration ?? manualDuration),
        historyFrames: history.length,
        playbackFrames: playbackFrames.length || manualFrames.length,
        frameIndex: latestProjection?.replay.frameIndex ?? -1,
        missingFrame: Boolean(latestProjection?.replay.missingFrame),
      }),
    }),
  });
}
