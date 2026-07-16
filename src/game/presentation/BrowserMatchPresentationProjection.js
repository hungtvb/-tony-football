import { GameEventType } from "../engine/GameEvents.js";

function toggleVisible(element, visible) {
  element?.classList?.toggle("show", visible);
}

function setText(element, value) {
  if (element && typeof value === "string" && value.length > 0) {
    element.textContent = value;
  }
}

function teamName(team) {
  return team === 0 ? "TONY FC" : "NEON UNITED";
}

function possessionTeam(ownerId) {
  if (typeof ownerId !== "string") return null;
  if (ownerId.startsWith("home-")) return 0;
  if (ownerId.startsWith("away-")) return 1;
  return null;
}

function kickStatus(payload = {}) {
  const style = payload.style ?? payload.commandType;
  if (style === "short" || style === "one-two") return "TONY FC triển khai phối hợp.";
  if (style === "through" || style === "chipped-through") return "Đường chọc khe mở ra khoảng trống!";
  if (style === "loft") return "Bóng bổng được đưa lên phía trước.";
  if (style === "shot" || style === "finesse" || style === "chip") return "Cú sút hướng về khung thành!";
  return "Bóng tiếp tục lăn trên sân.";
}

export function projectBrowserMatchPresentationEvent(document, event) {
  if (!document || typeof document.getElementById !== "function" || !event) return null;

  const start = document.getElementById("startOverlay");
  const pause = document.getElementById("pauseOverlay");
  const result = document.getElementById("resultOverlay");
  const matchState = document.getElementById("matchState");
  const commentary = document.getElementById("commentary");
  const replayBadge = document.getElementById("replayBadge");
  let status = null;

  switch (event.type) {
    case GameEventType.MATCH_STARTED:
    case GameEventType.MATCH_RESTARTED:
      toggleVisible(start, false);
      toggleVisible(pause, false);
      toggleVisible(result, false);
      setText(matchState, "LIVE");
      status = "TONY FC giao bóng!";
      break;
    case GameEventType.MATCH_PAUSED:
      toggleVisible(pause, true);
      setText(matchState, "TẠM DỪNG");
      status = "Trận đấu đang tạm dừng.";
      break;
    case GameEventType.MATCH_RESUMED:
      toggleVisible(pause, false);
      setText(matchState, "LIVE");
      status = "Trận đấu tiếp tục!";
      break;
    case GameEventType.POSSESSION_CHANGED: {
      const team = possessionTeam(event.payload?.ownerId);
      status = team === null ? "Bóng đang trong pha tranh chấp." : `${teamName(team)} kiểm soát bóng.`;
      break;
    }
    case GameEventType.BALL_KICKED:
      status = kickStatus(event.payload);
      break;
    case GameEventType.TACKLE_RESOLVED:
      status = event.payload?.won ? "Pha tranh chấp thành công!" : "Đối thủ thoát khỏi pha áp sát.";
      break;
    case GameEventType.TEAMMATE_RUN_TRIGGERED:
      status = "Đồng đội đang băng lên nhận bóng!";
      break;
    case GameEventType.SCORE_CHANGED: {
      const score = event.payload?.score ?? [0, 0];
      status = `GOOOOAL! ${teamName(event.payload?.team)} ghi bàn · ${score[0]}-${score[1]}`;
      break;
    }
    case GameEventType.REPLAY_STARTED:
      if (replayBadge) replayBadge.textContent = "● INSTANT REPLAY";
      toggleVisible(replayBadge, true);
      status = "Đang xem lại bàn thắng.";
      break;
    case GameEventType.REPLAY_ENDED:
      toggleVisible(replayBadge, false);
      status = "Chuẩn bị giao bóng lại.";
      break;
    case GameEventType.MATCH_ENDED:
      toggleVisible(pause, false);
      setText(matchState, "FULL TIME");
      status = "Trận đấu đã kết thúc.";
      break;
    default:
      break;
  }

  setText(commentary, status);
  return status;
}
