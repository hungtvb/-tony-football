import {
  createPostMatchSummary,
  createPostMatchSummaryFromMatchEvent
} from "./PostMatchSummary.js";
import { ApplicationActionType } from "../application/ApplicationActions.js";
import { requestApplicationAction } from "../application/BrowserApplicationAdapter.js";
import { GameEventType } from "../engine/GameEvents.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";

const resultOverlay = document.getElementById("resultOverlay");
const resultCard = resultOverlay?.querySelector(".result-card");
const resultTitle = document.getElementById("resultTitle");
const resultDetail = document.getElementById("resultDetail");
const finalHome = document.getElementById("finalHome");
const finalAway = document.getElementById("finalAway");
const playAgainButton = document.getElementById("playAgainButton");
const competingOverlays = [
  document.getElementById("mainMenuOverlay"),
  document.getElementById("startOverlay"),
  document.getElementById("pauseOverlay"),
];

let currentSummary = null;
let resultSetupButton = null;
let resultMainMenuButton = null;
let presentationCount = 0;

function ensureStylesheet() {
  if (document.querySelector('link[data-post-match="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../styles/post-match.css", import.meta.url).href;
  link.dataset.postMatch = "true";
  document.head.append(link);
}

function hideCompetingOverlays() {
  competingOverlays.forEach((overlay) => {
    overlay?.classList.remove("show");
    overlay?.setAttribute("aria-hidden", "true");
  });
}

function enhanceResultCard() {
  if (!resultCard || resultCard.dataset.postMatchReady === "true") return;
  resultCard.dataset.postMatchReady = "true";
  resultCard.classList.add("post-match-card");
  resultOverlay.setAttribute("role", "dialog");
  resultOverlay.setAttribute("aria-modal", "true");
  resultOverlay.setAttribute("aria-labelledby", "resultTitle");

  const eyebrow = resultCard.querySelector(".eyebrow");
  const finalScore = resultCard.querySelector(".final-score");
  eyebrow.textContent = "FULL TIME · MATCH REPORT";
  resultDetail.classList.add("post-match-detail");

  const header = document.createElement("header");
  header.className = "post-match-header";
  const outcomeLabel = document.createElement("span");
  outcomeLabel.id = "resultOutcomeLabel";
  outcomeLabel.className = "post-match-outcome-label";
  header.append(eyebrow, resultTitle, outcomeLabel);

  const scoreStage = document.createElement("section");
  scoreStage.className = "post-match-score-stage";
  scoreStage.setAttribute("aria-label", "Tỷ số chung cuộc");
  scoreStage.innerHTML = `
    <article class="post-match-team home">
      <span class="post-match-crest">TF</span>
      <div><small>HOME</small><strong>TONY FC</strong></div>
    </article>
    <article class="post-match-team away">
      <div><small>AWAY</small><strong>NEON UTD</strong></div>
      <span class="post-match-crest">NU</span>
    </article>
  `;
  scoreStage.insertBefore(finalScore, scoreStage.children[1]);

  const stats = document.createElement("section");
  stats.className = "post-match-stats";
  stats.setAttribute("aria-label", "Thống kê trận đấu");
  stats.innerHTML = `
    <div class="post-match-stat possession-stat">
      <div class="post-match-stat-heading"><span>KIỂM SOÁT BÓNG</span><b>MATCH SHARE</b></div>
      <div class="post-match-stat-values"><strong id="resultHomePossession">50%</strong><i></i><strong id="resultAwayPossession">50%</strong></div>
      <div class="post-match-possession-track"><i id="resultPossessionBar"></i></div>
    </div>
    <div class="post-match-stat compact-stat">
      <span>SÚT</span>
      <strong><b id="resultHomeShots">0</b><i>—</i><b id="resultAwayShots">0</b></strong>
    </div>
    <div class="post-match-stat compact-stat">
      <span>CHUYỀN CHÍNH XÁC · TONY FC</span>
      <strong id="resultPassAccuracy">0%</strong>
    </div>
  `;

  const actions = document.createElement("footer");
  actions.className = "post-match-actions";
  playAgainButton.innerHTML = "<span>↻</span><b>ĐÁ LẠI NGAY</b><small>GIỮ NGUYÊN THIẾT LẬP</small>";
  playAgainButton.classList.add("post-match-primary");

  resultSetupButton = document.createElement("button");
  resultSetupButton.id = "resultSetupButton";
  resultSetupButton.className = "post-match-secondary";
  resultSetupButton.type = "button";
  resultSetupButton.innerHTML = "<span>⚙</span><b>ĐỔI THIẾT LẬP</b>";

  resultMainMenuButton = document.createElement("button");
  resultMainMenuButton.id = "resultMainMenuButton";
  resultMainMenuButton.className = "post-match-tertiary";
  resultMainMenuButton.type = "button";
  resultMainMenuButton.innerHTML = "<span>⌂</span><b>VỀ MÀN HÌNH CHÍNH</b>";

  actions.append(playAgainButton, resultSetupButton, resultMainMenuButton);
  resultCard.replaceChildren(header, scoreStage, resultDetail, stats, actions);

  resultSetupButton.addEventListener("click", () => requestApplicationAction(window, ApplicationActionType.OPEN_MATCH_SETUP));
  resultMainMenuButton.addEventListener("click", () => requestApplicationAction(window, ApplicationActionType.OPEN_MAIN_MENU));
}

function renderSummary(summary) {
  currentSummary = summary;
  resultOverlay.dataset.outcome = summary.outcome;
  resultCard.dataset.outcome = summary.outcome;
  resultTitle.textContent = summary.title;
  resultDetail.textContent = summary.detail;
  finalHome.textContent = String(summary.score[0]);
  finalAway.textContent = String(summary.score[1]);
  document.getElementById("resultOutcomeLabel").textContent = summary.label;
  document.getElementById("resultHomePossession").textContent = `${summary.possession[0]}%`;
  document.getElementById("resultAwayPossession").textContent = `${summary.possession[1]}%`;
  document.getElementById("resultPossessionBar").style.width = `${summary.possession[0]}%`;
  document.getElementById("resultHomeShots").textContent = String(summary.shots[0]);
  document.getElementById("resultAwayShots").textContent = String(summary.shots[1]);
  document.getElementById("resultPassAccuracy").textContent = `${summary.passAccuracy}%`;
}

function presentResult(summary = createPostMatchSummary(), { focus = true } = {}) {
  presentationCount += 1;
  enhanceResultCard();
  hideCompetingOverlays();
  renderSummary(summary);
  if (!resultOverlay.classList.contains("show")) resultOverlay.classList.add("show");
  resultOverlay.setAttribute("aria-hidden", "false");
  document.body.dataset.flow = "result";
  if (focus) requestAnimationFrame(() => playAgainButton?.focus());
}

ensureStylesheet();
enhanceResultCard();

subscribeToGameEvents(window, (event) => {
  if (event.type === GameEventType.MATCH_ENDED) {
    presentResult(createPostMatchSummaryFromMatchEvent(event.payload));
  }
});

window.__TONY_POST_MATCH__ = {
  ready: true,
  preview: (options = {}) => presentResult(createPostMatchSummary(options)),
  diagnostics: () => ({
    visible: resultOverlay?.classList.contains("show") ?? false,
    flow: document.body.dataset.flow ?? null,
    outcome: currentSummary?.outcome ?? null,
    summary: currentSummary,
    presentationCount,
    competingVisible: competingOverlays.filter((overlay) => overlay?.classList.contains("show")).map((overlay) => overlay.id),
  }),
};
