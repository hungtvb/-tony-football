import { MatchEngine } from "../engine/MatchEngine.js";
import { GameEventType } from "../engine/GameEvents.js";

function assertEngine(engine) {
  if (
    !engine
    || typeof engine.enqueue !== "function"
    || typeof engine.step !== "function"
    || typeof engine.createRenderFrame !== "function"
    || typeof engine.drainEvents !== "function"
    || typeof engine.drainActionIntents !== "function"
    || typeof engine.startReplay !== "function"
    || typeof engine.recordGoal !== "function"
  ) {
    throw new TypeError("BrowserMatchRuntime requires a MatchEngine-compatible engine");
  }
}

function assertCommand(command) {
  if (!command || typeof command !== "object") {
    throw new TypeError("BrowserMatchRuntime dispatch requires an immutable game command");
  }
  if (typeof command.type !== "string" || command.type.length === 0) {
    throw new TypeError("BrowserMatchRuntime command type must be a non-empty string");
  }
  if (!command.payload || typeof command.payload !== "object" || Array.isArray(command.payload)) {
    throw new TypeError("BrowserMatchRuntime command payload must be a plain object");
  }
}

export class BrowserMatchRuntime {
  #engine;
  #publishEvent;
  #lastEvents = Object.freeze([]);
  #lastActionIntents = Object.freeze([]);

  constructor({
    engine = null,
    engineOptions = {},
    publishEvent = () => {},
  } = {}) {
    if (engine !== null && Object.keys(engineOptions).length > 0) {
      throw new TypeError("Provide either engine or engineOptions, not both");
    }
    if (typeof publishEvent !== "function") {
      throw new TypeError("BrowserMatchRuntime publishEvent must be a function");
    }

    this.#engine = engine ?? new MatchEngine(engineOptions);
    assertEngine(this.#engine);
    this.#publishEvent = publishEvent;
  }

  get tick() {
    return this.#engine.tick;
  }

  get snapshot() {
    return this.#engine.snapshot;
  }

  get state() {
    return this.#engine.snapshot.match.state;
  }

  get lastEvents() {
    return this.#lastEvents;
  }

  get lastActionIntents() {
    return this.#lastActionIntents;
  }

  dispatch(command) {
    assertCommand(command);
    const earliestTick = this.#engine.tick + 1;
    const requestedTick = command.targetTick ?? earliestTick;
    const targetTick = Math.max(earliestTick, requestedTick);

    return this.#engine.enqueue(command.type, command.payload, {
      source: command.source,
      targetTick,
    });
  }

  recordGoalForTesting(team, options = {}) {
    return this.#engine.recordGoal(team, options);
  }

  advanceForTesting(steps, deltaSeconds = 1 / 60) {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new RangeError("test runtime steps must be a non-negative integer");
    }
    for (let index = 0; index < steps; index += 1) this.step(deltaSeconds);
    return this.snapshot;
  }

  step(deltaSeconds) {
    const snapshot = this.#engine.step(deltaSeconds);
    const steppedEvents = this.#engine.drainEvents();
    if (steppedEvents.some((event) => event.type === GameEventType.SCORE_CHANGED)) {
      this.#engine.startReplay();
    }
    const replayEvents = this.#engine.drainEvents();
    const events = Object.freeze([...steppedEvents, ...replayEvents]);
    const actionIntents = this.#engine.drainActionIntents();

    for (const event of events) this.#publishEvent(event);
    this.#lastEvents = events;
    this.#lastActionIntents = actionIntents;

    return Object.freeze({ snapshot, events, actionIntents });
  }

  createRenderFrame(alpha) {
    return this.#engine.createRenderFrame(alpha);
  }
}
