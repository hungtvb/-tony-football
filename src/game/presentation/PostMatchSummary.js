const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createPostMatchSummary({
  homeScore = 0,
  awayScore = 0,
  homePossession = 50,
  homeShots = 0,
  awayShots = 0,
  passAccuracy = 0,
} = {}) {
  const score = [Math.max(0, Math.round(numberOr(homeScore))), Math.max(0, Math.round(numberOr(awayScore)))];
  const possession = clamp(Math.round(numberOr(homePossession, 50)), 0, 100);
  const shots = [Math.max(0, Math.round(numberOr(homeShots))), Math.max(0, Math.round(numberOr(awayShots)))];
  const accuracy = clamp(Math.round(numberOr(passAccuracy)), 0, 100);
  const difference = score[0] - score[1];
  const outcome = difference > 0 ? "win" : difference < 0 ? "loss" : "draw";

  const copy = {
    win: {
      title: "CHIẾN THẮNG!",
      label: "3 ĐIỂM THUYẾT PHỤC",
      detail: "Tony FC khép lại trận đấu bằng một màn trình diễn bản lĩnh.",
    },
    draw: {
      title: "HÒA KỊCH TÍNH",
      label: "BẤT PHÂN THẮNG BẠI",
      detail: "Hai đội chia điểm sau một trận đấu giằng co đến phút cuối.",
    },
    loss: {
      title: "CHƯA ĐỦ!",
      label: "SẴN SÀNG TRỞ LẠI",
      detail: "Tony FC đã chiến đấu hết mình. Điều chỉnh chiến thuật và thử lại.",
    },
  }[outcome];

  return Object.freeze({
    outcome,
    ...copy,
    score: Object.freeze(score),
    possession: Object.freeze([possession, 100 - possession]),
    shots: Object.freeze(shots),
    passAccuracy: accuracy,
  });
}

export function createPostMatchSummaryFromMatchEvent({ score = [0, 0], stats = {} } = {}) {
  const possession = Array.isArray(stats.possession) ? stats.possession : [0, 0];
  const possessionTotal = Math.max(0, numberOr(possession[0])) + Math.max(0, numberOr(possession[1]));
  const homePossession = possessionTotal > 0
    ? Math.round(Math.max(0, numberOr(possession[0])) / possessionTotal * 100)
    : 50;
  const passes = Math.max(0, numberOr(stats.passes));
  const completed = Math.max(0, numberOr(stats.completed));
  return createPostMatchSummary({
    homeScore: score[0],
    awayScore: score[1],
    homePossession,
    homeShots: stats.shots?.[0],
    awayShots: stats.shots?.[1],
    passAccuracy: passes > 0 ? Math.round(completed / passes * 100) : 0
  });
}
