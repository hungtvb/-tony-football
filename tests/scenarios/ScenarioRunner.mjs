import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import {
  GameCommandSource,
  createGameCommand
} from "../../src/game/engine/GameCommands.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_MAX_TICKS = 12_000;
const DEFAULT_TRACE_DEPTH = 12;

function assertPositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function rounded(value, digits = 4) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function cloneSummary(snapshot) {
  return Object.freeze({
    tick: snapshot.tick,
    state: snapshot.match.state,
    time: rounded(snapshot.match.time),
    score: Object.freeze([...snapshot.match.score]),
    phase: snapshot.match.goalSequence?.phase ?? null,
    replayActive: Boolean(snapshot.match.replay?.active),
    replayElapsed: rounded(snapshot.match.replay?.elapsed ?? 0),
    kickoffTimer: rounded(snapshot.match.kickoffTimer),
    selectedPlayerId: snapshot.match.selectedPlayerId,
    ballOwnerId: snapshot.ball.ownerId,
    ball: Object.freeze({
      x: rounded(snapshot.ball.x, 2),
      y: rounded(snapshot.ball.y, 2),
      z: rounded(snapshot.ball.z, 2)
    }),
    stats: Object.freeze({
      possession: Object.freeze([...snapshot.match.stats.possession]),
      shots: Object.freeze([...snapshot.match.stats.shots]),
      passes: snapshot.match.stats.passes,
      completed: snapshot.match.stats.completed
    })
  });
}

function changedFields(previous, current) {
  if (!previous) return Object.freeze({ initial: current });
  const diff = {};
  for (const key of Object.keys(current)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      diff[key] = Object.freeze({ before: previous[key], after: current[key] });
    }
  }
  return Object.freeze(diff);
}

function formatFrame(frame) {
  const commands = frame.commands.length
    ? frame.commands.map((command) => `${command.type}@${command.targetTick}`).join(",")
    : "-";
  const events = frame.events.length
    ? frame.events.map((event) => `${event.sequence}:${event.type}`).join(",")
    : "-";
  return `tick=${frame.tick} commands=[${commands}] events=[${events}] diff=${JSON.stringify(frame.diff)}`;
}

export class ScenarioFailure extends Error {
  constructor(message, trace, cause = null) {
    super(`${message}\nScenario trace:\n${trace.map(formatFrame).join("\n")}`, { cause });
    this.name = "ScenarioFailure";
    this.trace = Object.freeze([...trace]);
  }
}

export class ScenarioRunner {
  #runtime;
  #stepSeconds;
  #maxTicks;
  #traceDepth;
  #sequence = 0;
  #scheduledByTick = new Map();
  #history = [];
  #events = [];

  constructor({
    engineOptions = {},
    engine = null,
    stepSeconds = DEFAULT_STEP_SECONDS,
    maxTicks = DEFAULT_MAX_TICKS,
    traceDepth = DEFAULT_TRACE_DEPTH
  } = {}) {
    assertPositiveFinite(stepSeconds, "scenario stepSeconds");
    assertPositiveInteger(maxTicks, "scenario maxTicks");
    assertPositiveInteger(traceDepth, "scenario traceDepth");
    if (engine !== null && Object.keys(engineOptions).length > 0) {
      throw new TypeError("Provide either engine or engineOptions, not both");
    }
    this.#stepSeconds = stepSeconds;
    this.#maxTicks = maxTicks;
    this.#traceDepth = traceDepth;
    this.#runtime = new BrowserMatchRuntime({
      engine: engine ?? new MatchEngine(engineOptions)
    });
  }

  get tick() {
    return this.#runtime.tick;
  }

  get snapshot() {
    return this.#runtime.snapshot;
  }

  get events() {
    return Object.freeze([...this.#events]);
  }

  get history() {
    return Object.freeze([...this.#history]);
  }

  schedule(type, payload = {}, {
    atTick = this.tick + 1,
    source = GameCommandSource.TEST
  } = {}) {
    if (!Number.isInteger(atTick) || atTick <= this.tick) {
      throw new RangeError(`scenario command tick ${atTick} must be greater than current tick ${this.tick}`);
    }
    const command = createGameCommand(type, payload, {
      source,
      sequence: this.#sequence,
      targetTick: atTick
    });
    this.#sequence += 1;
    this.#runtime.dispatch(command);
    const scheduled = this.#scheduledByTick.get(atTick) ?? [];
    scheduled.push(command);
    this.#scheduledByTick.set(atTick, scheduled);
    return command;
  }

  step(count = 1) {
    assertPositiveInteger(count, "scenario step count");
    let result = null;
    for (let index = 0; index < count; index += 1) {
      if (this.tick >= this.#maxTicks) {
        throw this.#failure(`scenario exceeded maximum tick ${this.#maxTicks}`);
      }
      const previous = this.#history.at(-1)?.summary ?? null;
      result = this.#runtime.step(this.#stepSeconds);
      const commands = Object.freeze([...(this.#scheduledByTick.get(this.tick) ?? [])]);
      this.#scheduledByTick.delete(this.tick);
      const summary = cloneSummary(result.snapshot);
      const frame = Object.freeze({
        tick: this.tick,
        commands,
        events: result.events,
        actionIntents: result.actionIntents,
        snapshot: result.snapshot,
        summary,
        diff: changedFields(previous, summary)
      });
      this.#history.push(frame);
      this.#events.push(...result.events);
    }
    return result;
  }

  stepUntil(predicate, {
    maxTicks = this.#maxTicks - this.tick,
    label = "scenario condition"
  } = {}) {
    if (typeof predicate !== "function") throw new TypeError("stepUntil predicate must be a function");
    assertPositiveInteger(maxTicks, "stepUntil maxTicks");
    for (let index = 0; index < maxTicks; index += 1) {
      const result = this.step();
      if (predicate(result.snapshot, result.events, this)) return result;
    }
    throw this.#failure(`${label} was not satisfied within ${maxTicks} ticks`);
  }

  check(label, assertion) {
    if (typeof assertion !== "function") throw new TypeError("scenario assertion must be a function");
    try {
      assertion(this.snapshot, this);
    } catch (error) {
      throw this.#failure(label, error);
    }
  }

  trace(depth = this.#traceDepth) {
    return Object.freeze(this.#history.slice(-depth));
  }

  #failure(message, cause = null) {
    return new ScenarioFailure(message, this.trace(), cause);
  }
}
