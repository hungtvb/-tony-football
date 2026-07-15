export const possessionStates = Object.freeze({
  loose: "loose",
  receiving: "receiving",
  controlled: "controlled",
  released: "released",
});

export function createPossessionLifecycle() {
  return {
    state: possessionStates.loose,
    ownerId: null,
    receiverId: null,
    lastControllerId: null,
    releaseReason: null,
    touchOutcome: null,
  };
}

export function beginReceiving(lifecycle, receiverId) {
  return {
    ...lifecycle,
    state: possessionStates.receiving,
    receiverId,
    touchOutcome: null,
  };
}

export function controlPossession(lifecycle, ownerId, touchOutcome = "clean") {
  return {
    ...lifecycle,
    state: possessionStates.controlled,
    ownerId,
    receiverId: null,
    lastControllerId: ownerId,
    releaseReason: null,
    touchOutcome,
  };
}

export function releasePossession(lifecycle, reason, lastControllerId = lifecycle.ownerId) {
  return {
    ...lifecycle,
    state: possessionStates.released,
    ownerId: null,
    receiverId: null,
    lastControllerId,
    releaseReason: reason,
    touchOutcome: null,
  };
}

export function settleLoose(lifecycle) {
  return {
    ...lifecycle,
    state: possessionStates.loose,
    ownerId: null,
    receiverId: null,
  };
}

export function resetPossessionLifecycle() {
  return createPossessionLifecycle();
}
