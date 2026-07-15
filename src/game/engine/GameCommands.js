import {
  assertNonNegativeInteger,
  assertPlainRecord,
  assertUnitInterval,
  assertUnitNumber,
  cloneAndFreezeContractValue
} from "./ContractValue.js";

export const GameCommandType = Object.freeze({
  MOVE: "player:move",
  SET_SPRINT: "player:set-sprint",
  SWITCH_PLAYER: "player:switch",
  SHORT_PASS: "ball:short-pass",
  THROUGH_BALL: "ball:through-pass",
  LOFTED_PASS: "ball:lofted-pass",
  SHOOT: "ball:shoot",
  TACKLE: "player:tackle",
  SET_SHIELD: "player:set-shield",
  TRIGGER_TEAMMATE_RUN: "team:trigger-run",
  START_MATCH: "match:start",
  PAUSE_MATCH: "match:pause",
  RESUME_MATCH: "match:resume",
  RESTART_MATCH: "match:restart"
});

export const GameCommandSource = Object.freeze({
  HUMAN: "human",
  AI: "ai",
  APPLICATION: "application",
  TEST: "test"
});

const commandTypes = new Set(Object.values(GameCommandType));
const commandSources = new Set(Object.values(GameCommandSource));
const noPayloadCommands = new Set([
  GameCommandType.SWITCH_PLAYER,
  GameCommandType.TACKLE,
  GameCommandType.TRIGGER_TEAMMATE_RUN,
  GameCommandType.START_MATCH,
  GameCommandType.PAUSE_MATCH,
  GameCommandType.RESUME_MATCH,
  GameCommandType.RESTART_MATCH
]);
const kickCommands = new Set([
  GameCommandType.SHORT_PASS,
  GameCommandType.THROUGH_BALL,
  GameCommandType.LOFTED_PASS,
  GameCommandType.SHOOT
]);

function validatePayload(type, payload) {
  assertPlainRecord(payload, "command payload");

  if (noPayloadCommands.has(type) && Object.keys(payload).length > 0) {
    throw new TypeError(`${type} does not accept a payload`);
  }

  if (type === GameCommandType.MOVE) {
    assertUnitNumber(payload.x, "move.x");
    assertUnitNumber(payload.y, "move.y");
  }

  if (type === GameCommandType.SET_SPRINT || type === GameCommandType.SET_SHIELD) {
    if (typeof payload.active !== "boolean") throw new TypeError(`${type}.active must be boolean`);
  }

  if (kickCommands.has(type)) {
    assertUnitInterval(payload.power, `${type}.power`);
    if (payload.playerId !== undefined && (typeof payload.playerId !== "string" || !payload.playerId)) {
      throw new TypeError(`${type}.playerId must be a non-empty string`);
    }
    if (payload.direction !== undefined) {
      assertPlainRecord(payload.direction, `${type}.direction`);
      assertUnitNumber(payload.direction.x, `${type}.direction.x`);
      assertUnitNumber(payload.direction.y, `${type}.direction.y`);
    }
    if (payload.modifiers !== undefined) {
      assertPlainRecord(payload.modifiers, `${type}.modifiers`);
      for (const [name, active] of Object.entries(payload.modifiers)) {
        if (!["oneTwo", "finesse", "chip"].includes(name)) {
          throw new TypeError(`${type}.modifiers.${name} is not supported`);
        }
        if (typeof active !== "boolean") {
          throw new TypeError(`${type}.modifiers.${name} must be boolean`);
        }
      }
    }
  }
}

export function createGameCommand(type, payload = {}, {
  source = GameCommandSource.HUMAN,
  sequence = 0,
  targetTick = null
} = {}) {
  if (!commandTypes.has(type)) throw new TypeError(`Unknown game command type: ${type}`);
  if (!commandSources.has(source)) throw new TypeError(`Unknown game command source: ${source}`);
  assertNonNegativeInteger(sequence, "command sequence");
  if (targetTick !== null) assertNonNegativeInteger(targetTick, "command targetTick");
  validatePayload(type, payload);

  return Object.freeze({
    type,
    payload: cloneAndFreezeContractValue(payload, "command payload"),
    source,
    sequence,
    targetTick
  });
}

export class GameCommandBuffer {
  #commands = [];
  #nextSequence = 0;

  get size() {
    return this.#commands.length;
  }

  enqueue(type, payload = {}, options = {}) {
    const command = createGameCommand(type, payload, {
      ...options,
      sequence: this.#nextSequence
    });
    this.#nextSequence += 1;
    this.#commands.push(command);
    return command;
  }

  drain() {
    const drained = Object.freeze(this.#commands.slice());
    this.#commands.length = 0;
    return drained;
  }

  clear() {
    this.#commands.length = 0;
  }
}
