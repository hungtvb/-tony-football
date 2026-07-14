export class FixedClock {
  constructor({ fixedDeltaSeconds = 1 / 60, maxSubSteps = 5, maxFrameDeltaSeconds = 0.1 } = {}) {
    if (!(fixedDeltaSeconds > 0)) throw new RangeError("fixedDeltaSeconds must be greater than zero");
    if (!Number.isInteger(maxSubSteps) || maxSubSteps < 1) throw new RangeError("maxSubSteps must be a positive integer");
    if (!(maxFrameDeltaSeconds > 0)) throw new RangeError("maxFrameDeltaSeconds must be greater than zero");

    this.fixedDeltaSeconds = fixedDeltaSeconds;
    this.maxSubSteps = maxSubSteps;
    this.maxFrameDeltaSeconds = maxFrameDeltaSeconds;
    this.accumulatorSeconds = 0;
    this.lastTimeSeconds = null;
  }

  reset(nowSeconds = null) {
    this.accumulatorSeconds = 0;
    this.lastTimeSeconds = nowSeconds;
  }

  advance(nowSeconds, update) {
    if (!Number.isFinite(nowSeconds)) throw new TypeError("nowSeconds must be finite");
    if (typeof update !== "function") throw new TypeError("update must be a function");

    if (this.lastTimeSeconds === null) {
      this.lastTimeSeconds = nowSeconds;
      return { steps: 0, alpha: 0, frameDeltaSeconds: 0, droppedSeconds: 0 };
    }

    const rawFrameDelta = Math.max(0, nowSeconds - this.lastTimeSeconds);
    const frameDeltaSeconds = Math.min(rawFrameDelta, this.maxFrameDeltaSeconds);
    this.lastTimeSeconds = nowSeconds;
    this.accumulatorSeconds += frameDeltaSeconds;

    let steps = 0;
    while (this.accumulatorSeconds + Number.EPSILON >= this.fixedDeltaSeconds && steps < this.maxSubSteps) {
      update(this.fixedDeltaSeconds);
      this.accumulatorSeconds -= this.fixedDeltaSeconds;
      steps += 1;
    }

    let droppedSeconds = 0;
    if (steps === this.maxSubSteps && this.accumulatorSeconds >= this.fixedDeltaSeconds) {
      droppedSeconds = this.accumulatorSeconds - (this.accumulatorSeconds % this.fixedDeltaSeconds);
      this.accumulatorSeconds %= this.fixedDeltaSeconds;
    }

    const tolerance = this.fixedDeltaSeconds * 1e-9;
    if (Math.abs(this.accumulatorSeconds) < tolerance) this.accumulatorSeconds = 0;
    if (this.accumulatorSeconds >= this.fixedDeltaSeconds) this.accumulatorSeconds %= this.fixedDeltaSeconds;
    if (this.accumulatorSeconds < 0) this.accumulatorSeconds = 0;

    return {
      steps,
      alpha: this.accumulatorSeconds / this.fixedDeltaSeconds,
      frameDeltaSeconds,
      droppedSeconds,
    };
  }
}
