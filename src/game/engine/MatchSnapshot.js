import {
  assertNonNegativeInteger,
  assertPlainRecord,
  assertUnitInterval,
  cloneAndFreezeContractValue
} from "./ContractValue.js";

function requireStableId(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export function createMatchSnapshot({ tick, match, players, ball }) {
  assertNonNegativeInteger(tick, "snapshot tick");
  assertPlainRecord(match, "snapshot match");
  assertPlainRecord(ball, "snapshot ball");
  requireStableId(ball.id, "ball.id");

  if (!Array.isArray(players)) throw new TypeError("snapshot players must be an array");
  const playerIds = new Set();
  for (const [index, player] of players.entries()) {
    assertPlainRecord(player, `snapshot players[${index}]`);
    requireStableId(player.id, `players[${index}].id`);
    if (playerIds.has(player.id)) throw new TypeError(`Duplicate player id: ${player.id}`);
    playerIds.add(player.id);
  }

  if (ball.ownerId !== undefined && ball.ownerId !== null && !playerIds.has(ball.ownerId)) {
    throw new TypeError(`ball.ownerId does not reference a snapshot player: ${ball.ownerId}`);
  }

  return Object.freeze({
    tick,
    match: cloneAndFreezeContractValue(match, "snapshot match"),
    players: cloneAndFreezeContractValue(players, "snapshot players"),
    ball: cloneAndFreezeContractValue(ball, "snapshot ball")
  });
}

export function createSnapshotFrame(previous, current, alpha) {
  if (!previous || !current) throw new TypeError("snapshot frame requires previous and current snapshots");
  assertNonNegativeInteger(previous.tick, "previous snapshot tick");
  assertNonNegativeInteger(current.tick, "current snapshot tick");
  if (previous.tick > current.tick) throw new RangeError("previous snapshot tick must not exceed current tick");
  assertUnitInterval(alpha, "snapshot interpolation alpha");
  return Object.freeze({ previous, current, alpha });
}
