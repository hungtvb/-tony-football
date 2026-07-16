const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function formatMatchClock(elapsed, matchSeconds) {
  const safeDuration = Number.isFinite(matchSeconds) && matchSeconds > 0 ? matchSeconds : 150;
  const footballMinutes = clamp(Math.max(0, elapsed) / safeDuration * 90, 0, 90);
  const minutes = Math.floor(footballMinutes);
  const seconds = Math.floor((footballMinutes - minutes) * 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createHudSnapshotProjection(snapshot) {
  if (!snapshot) throw new TypeError("HUD projection requires a match snapshot");
  const { match } = snapshot;
  const selectedPlayer = snapshot.players.find((player) => player.id === match.selectedPlayerId) ?? null;
  const possession = match.stats?.possession ?? [0, 0];
  const possessionTotal = Math.max(0, possession[0] ?? 0) + Math.max(0, possession[1] ?? 0);
  const homePossession = possessionTotal > 0
    ? Math.round(Math.max(0, possession[0] ?? 0) / possessionTotal * 100)
    : 50;
  const passes = Math.max(0, match.stats?.passes ?? 0);
  const completed = Math.max(0, match.stats?.completed ?? 0);
  const passAccuracy = passes > 0 ? clamp(Math.round(completed / passes * 100), 0, 100) : 0;
  const elapsed = Number.isFinite(match.elapsed)
    ? Math.max(0, match.elapsed)
    : Math.max(0, (match.matchSeconds ?? 150) - (match.time ?? 0));

  return Object.freeze({
    clock: formatMatchClock(elapsed, match.matchSeconds),
    elapsed,
    score: Object.freeze([...(match.score ?? [0, 0])]),
    selectedPlayer,
    homePossession,
    shots: Object.freeze([...(match.stats?.shots ?? [0, 0])]),
    passAccuracy,
    state: match.state
  });
}
