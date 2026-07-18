function assertSnapshot(snapshot, name = "replay snapshot") {
  if (!snapshot || !Number.isInteger(snapshot.tick) || !snapshot.match || !Array.isArray(snapshot.players) || !snapshot.ball) {
    throw new TypeError(`${name} must be a match snapshot`);
  }
}

export function createSnapshotReplayController({
  sampleRate = 15,
  maxFrames = 66,
  duration = 3.05,
  minimumPlaybackFrames = 9
} = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError("replay sampleRate must be positive");
  if (!Number.isInteger(maxFrames) || maxFrames <= 0) throw new TypeError("replay maxFrames must be a positive integer");
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError("replay duration must be positive");
  if (!Number.isInteger(minimumPlaybackFrames) || minimumPlaybackFrames <= 0) throw new TypeError("replay minimumPlaybackFrames must be a positive integer");

  const buffer = [];
  let frames = Object.freeze([]);
  let active = false;
  let elapsed = 0;
  let accumulator = 0;
  const sampleInterval = 1 / sampleRate;

  return Object.freeze({
    get active() { return active; },
    get elapsed() { return elapsed; },
    get duration() { return duration; },
    get bufferedFrames() { return buffer.length; },
    get playbackFrames() { return frames.length; },

    reset() {
      buffer.length = 0;
      frames = Object.freeze([]);
      active = false;
      elapsed = 0;
      accumulator = 0;
    },

    stop() {
      active = false;
    },

    record(snapshot, dt) {
      assertSnapshot(snapshot);
      if (!Number.isFinite(dt) || dt < 0) throw new TypeError("replay dt must be a non-negative finite number");
      accumulator += dt;
      if (accumulator < sampleInterval) return false;
      accumulator %= sampleInterval;
      buffer.push(snapshot);
      if (buffer.length > maxFrames) buffer.shift();
      return true;
    },

    start(finalSnapshot) {
      assertSnapshot(finalSnapshot, "final replay snapshot");
      frames = Object.freeze([...buffer, finalSnapshot]);
      active = frames.length >= minimumPlaybackFrames;
      elapsed = 0;
      return active;
    },

    loadFrames(snapshots, { play = true } = {}) {
      if (!Array.isArray(snapshots)) throw new TypeError("replay frames must be an array");
      snapshots.forEach((snapshot, index) => assertSnapshot(snapshot, `replay frames[${index}]`));
      frames = Object.freeze(snapshots.slice());
      active = Boolean(play && frames.length);
      elapsed = 0;
      return active;
    },

    syncElapsed(nextElapsed) {
      if (!Number.isFinite(nextElapsed) || nextElapsed < 0) {
        throw new TypeError("replay elapsed must be a non-negative finite number");
      }
      if (!active) return false;
      if (nextElapsed < elapsed) throw new RangeError("replay elapsed cannot move backwards");
      if (nextElapsed == elapsed) return false;
      elapsed = nextElapsed;
      return true;
    },

    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new TypeError("replay dt must be a non-negative finite number");
      if (!active) return false;
      elapsed += dt;
      if (elapsed < duration) return false;
      active = false;
      return true;
    },

    currentSnapshot() {
      if (!active || frames.length === 0) return null;
      const progress = Math.max(0, Math.min(0.999, elapsed / duration));
      return frames[Math.floor(progress * frames.length)];
    }
  });
}
