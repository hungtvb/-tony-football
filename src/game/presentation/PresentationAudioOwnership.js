const claimedTargets = new WeakSet();

function requireTarget(target) {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError("presentation audio ownership requires a target");
  }
}

export function claimPresentationAudio(target) {
  requireTarget(target);
  if (claimedTargets.has(target)) {
    throw new Error("presentation audio is already owned by an adapter");
  }
  claimedTargets.add(target);
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    return claimedTargets.delete(target);
  };
}

export function isPresentationAudioClaimed(target) {
  requireTarget(target);
  return claimedTargets.has(target);
}
