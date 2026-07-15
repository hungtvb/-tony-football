import {
  GOAL_PRESENTATION_STATES,
  createGoalPresentationState,
} from "../state/GoalPresentationState.js";

const params = new URLSearchParams(window.location.search);
const visualTestMode = params.has("visualTest");
const goalTestMode = params.has("goalTest");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const timings = reducedMotion
  ? { leadIn: 40, goal: 60, score: 60, replayMax: 120 }
  : visualTestMode
    ? { leadIn: 140, goal: 260, score: 220, replayMax: 900 }
    : { leadIn: 460, goal: 500, score: 380, replayMax: 1800 };

const homeScore = document.getElementById("homeScore");
const awayScore = document.getElementById("awayScore");
const replayBadge = document.getElementById("replayBadge");
const pitchPanel = document.querySelector(".match-pitch");
const history = [];
let overlay = null;
let running = false;
let runToken = 0;
let testHoldReleased = !goalTestMode;
let timelinePhase = "idle";

const TEAMS = Object.freeze({
  home: Object.freeze({ key: "home", name: "TONY FC", crest: "TF", accent: "gold" }),
  away: Object.freeze({ key: "away", name: "NEON UTD", crest: "NU", accent: "cyan" }),
});

function ensureStylesheet() {
  if (document.querySelector('link[data-u3-goal-presentation="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../../u3-goal-presentation.css", import.meta.url).href;
  link.dataset.u3GoalPresentation = "true";
  document.head.append(link);
}

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("section");
  overlay.id = "goalPresentationOverlay";
  overlay.className = "goal-presentation-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "assertive");
  overlay.setAttribute("aria-atomic", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="goal-presentation-wash" aria-hidden="true"></div>
    <div class="goal-presentation-lines" aria-hidden="true"></div>
    <div class="goal-presentation-card">
      <header class="goal-presentation-header">
        <span><i></i> MATCHDAY LIVE</span>
        <b id="goalPresentationReplayFlag">GOAL CONFIRMED</b>
      </header>
      <div class="goal-presentation-main">
        <div id="goalPresentationCrest" class="goal-presentation-crest">TF</div>
        <div class="goal-presentation-copy">
          <small id="goalPresentationTeam">TONY FC</small>
          <strong>GOAL!</strong>
          <p id="goalPresentationCaption">BÀN THẮNG ĐÃ ĐƯỢC GHI</p>
        </div>
        <div class="goal-presentation-score" aria-label="Tỷ số">
          <span id="goalPresentationHomeScore">1</span>
          <b>—</b>
          <span id="goalPresentationAwayScore">0</span>
        </div>
      </div>
      <footer class="goal-presentation-footer">
        <span id="goalPresentationPhase">GOAL MOMENT</span>
        <i><b></b></i>
        <span id="goalPresentationReplayLabel">INSTANT REPLAY READY</span>
      </footer>
    </div>
  `;
  pitchPanel?.append(overlay);
  return overlay;
}

function record(value) {
  history.push(value);
  window.dispatchEvent(new CustomEvent("tony:goal-presentation-state", { detail: { value } }));
}

const presentation = createGoalPresentationState({
  onChange: ({ current }) => {
    ensureOverlay();
    overlay.dataset.stage = current;
    document.body.dataset.goalPresentation = current;
    record(current);
  },
});

function readScores() {
  return [Number(homeScore?.textContent ?? 0) || 0, Number(awayScore?.textContent ?? 0) || 0];
}

let observedScores = readScores();

function replayIsActive() {
  return Boolean(
    replayBadge?.classList.contains("show")
    && /REPLAY/i.test(replayBadge.textContent ?? ""),
  );
}

function setVisible(visible) {
  ensureOverlay();
  overlay.classList.toggle("show", visible);
  overlay.setAttribute("aria-hidden", String(!visible));
  pitchPanel?.classList.toggle("goal-presentation-active", visible);
}

function applySnapshot({ team, score, replay }) {
  ensureOverlay();
  const profile = TEAMS[team] ?? TEAMS.home;
  overlay.dataset.team = profile.key;
  overlay.dataset.accent = profile.accent;
  overlay.querySelector("#goalPresentationCrest").textContent = profile.crest;
  overlay.querySelector("#goalPresentationTeam").textContent = profile.name;
  overlay.querySelector("#goalPresentationCaption").textContent = team === "home"
    ? "TONY FC BÙNG NỔ TRÊN SÂN"
    : "NEON UNITED GỠ LẠI THẾ TRẬN";
  overlay.querySelector("#goalPresentationHomeScore").textContent = String(score[0]);
  overlay.querySelector("#goalPresentationAwayScore").textContent = String(score[1]);
  overlay.querySelector("#goalPresentationReplayFlag").textContent = replay ? "REPLAY AVAILABLE" : "GOAL CONFIRMED";
  overlay.querySelector("#goalPresentationReplayLabel").textContent = replay ? "INSTANT REPLAY" : "RETURNING TO KICK OFF";
}

function setPhase(label) {
  ensureOverlay();
  overlay.querySelector("#goalPresentationPhase").textContent = label;
}

async function wait(duration, token) {
  const deadline = performance.now() + duration;
  while (performance.now() < deadline) {
    if (token !== runToken) return false;
    await new Promise((resolve) => setTimeout(resolve, Math.min(40, Math.max(0, deadline - performance.now()))));
  }
  return token === runToken;
}

async function waitForTestRelease(token) {
  while (goalTestMode && !testHoldReleased) {
    if (token !== runToken) return false;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return token === runToken;
}

async function waitForNativeReplayEnd(token) {
  const deadline = performance.now() + timings.replayMax;
  while (performance.now() < deadline) {
    if (token !== runToken) return false;
    if (!replayIsActive()) return true;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return token === runToken;
}

async function startPresentation({ team = "home", score = readScores(), replay = replayIsActive() } = {}) {
  const token = ++runToken;
  running = true;
  testHoldReleased = !goalTestMode;
  timelinePhase = "native-highlight";
  if (presentation.state !== GOAL_PRESENTATION_STATES.HIDDEN) presentation.reset({ reason: "new-goal" });

  applySnapshot({ team, score, replay });
  setVisible(false);

  try {
    // Let the native flash and scoreboard pop finish before presenting the score card.
    if (!await wait(timings.leadIn, token)) return;

    setVisible(true);
    setPhase("GOAL MOMENT");
    presentation.transition(GOAL_PRESENTATION_STATES.GOAL, { team, score, replay });
    timelinePhase = "goal-card";

    if (!await waitForTestRelease(token)) return;
    if (!await wait(timings.goal, token)) return;

    setPhase("SCORE UPDATE");
    presentation.transition(GOAL_PRESENTATION_STATES.SCORE, { team, score, replay });
    timelinePhase = "score-card";
    if (!await wait(timings.score, token)) return;

    // Reveal the actual native replay instead of covering it with another full-screen card.
    setVisible(false);
    if (replay) {
      setPhase("INSTANT REPLAY");
      presentation.transition(GOAL_PRESENTATION_STATES.REPLAY, { team, score, replay });
      timelinePhase = "native-replay";
      if (!await waitForNativeReplayEnd(token)) return;
    }

    presentation.transition(GOAL_PRESENTATION_STATES.COMPLETE, { team, score, replay });
    presentation.transition(GOAL_PRESENTATION_STATES.HIDDEN, { team, score, replay });
  } finally {
    if (token === runToken) {
      setVisible(false);
      delete document.body.dataset.goalPresentation;
      timelinePhase = "idle";
      running = false;
    }
  }
}

function detectScoreChange() {
  const nextScores = readScores();
  const flow = document.body.dataset.flow;
  if (flow === "match") {
    if (nextScores[0] > observedScores[0]) {
      void startPresentation({ team: "home", score: nextScores, replay: replayIsActive() });
    } else if (nextScores[1] > observedScores[1]) {
      void startPresentation({ team: "away", score: nextScores, replay: replayIsActive() });
    }
  }
  observedScores = nextScores;
}

ensureStylesheet();
ensureOverlay();

const scoreObserver = new MutationObserver(detectScoreChange);
if (homeScore) scoreObserver.observe(homeScore, { childList: true, characterData: true, subtree: true });
if (awayScore) scoreObserver.observe(awayScore, { childList: true, characterData: true, subtree: true });

window.__TONY_GOAL_PRESENTATION__ = {
  ready: true,
  timings: { ...timings },
  history,
  preview: (options = {}) => startPresentation(options),
  releaseTestHold: () => {
    testHoldReleased = true;
  },
  diagnostics: () => ({
    running,
    state: presentation.state,
    history: [...history],
    visible: overlay?.classList.contains("show") ?? false,
    timelinePhase,
    team: overlay?.dataset.team ?? null,
    scores: readScores(),
    goalTestMode,
  }),
};
