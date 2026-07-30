import {
  GOAL_PRESENTATION_STATES,
  createGoalPresentationState,
} from "../state/GoalPresentationState.js";
import { GameEventType } from "../engine/GameEvents.js";
import { GoalSequencePhase } from "../engine/GoalSequenceTimeline.js";
import { subscribeToGameEvents } from "./BrowserGameEventBridge.js";
import { projectGoalPresentationPhase } from "./GoalPresentationPhaseProjection.js";

const params = new URLSearchParams(window.location.search);
const visualTestMode = params.has("visualTest");
const goalTestMode = params.has("goalTest");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const previewTimings = reducedMotion
  ? { leadIn: 40, goal: 60, score: 60, replayMax: 120 }
  : visualTestMode
    ? { leadIn: 140, goal: 260, score: 220, replayMax: 900 }
    : { leadIn: 460, goal: 500, score: 380, replayMax: 3050 };

const pitchPanel = document.querySelector(".match-pitch");
const history = [];
const timelineHistory = [];
let overlay = null;
let running = false;
let runToken = 0;
let testHoldReleased = !goalTestMode;
let timelinePhase = "idle";
let latestScore = Object.freeze([0, 0]);
let replayActive = false;
let replaySeenForGoal = false;
let activeTeam = "home";

const TEAMS = Object.freeze({
  home: Object.freeze({ key: "home", name: "TONY FC", crest: "TF", accent: "gold" }),
  away: Object.freeze({ key: "away", name: "NEON UTD", crest: "NU", accent: "cyan" }),
});

function ensureStylesheet() {
  if (document.querySelector('link[data-goal-presentation="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../styles/goal-presentation.css", import.meta.url).href;
  link.dataset.goalPresentation = "true";
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
        <span><i></i> GOAL</span>
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

function applyReplayAvailability(replay) {
  ensureOverlay();
  overlay.querySelector("#goalPresentationReplayFlag").textContent = replay ? "REPLAY AVAILABLE" : "GOAL CONFIRMED";
  overlay.querySelector("#goalPresentationReplayLabel").textContent = replay ? "INSTANT REPLAY" : "RETURNING TO KICK OFF";
}

function setPhase(label) {
  ensureOverlay();
  overlay.querySelector("#goalPresentationPhase").textContent = label;
}

function setTimelinePhase(phase) {
  timelinePhase = phase;
  const snapshot = Object.freeze({
    phase,
    visible: overlay?.classList.contains("show") ?? false,
  });
  timelineHistory.push(snapshot);
  window.dispatchEvent(new CustomEvent("tony:goal-presentation-timeline", { detail: snapshot }));
}

function beginAuthoritativeGoal({ team = activeTeam, score = latestScore } = {}) {
  runToken += 1;
  running = true;
  activeTeam = team;
  latestScore = Object.freeze([...score]);
  replayActive = false;
  replaySeenForGoal = false;
  if (presentation.state !== GOAL_PRESENTATION_STATES.HIDDEN) {
    presentation.reset({ reason: "new-authoritative-goal" });
  }
  applySnapshot({ team, score: latestScore, replay: false });
  setVisible(false);
  setTimelinePhase(GoalSequencePhase.NATIVE_HIGHLIGHT);
}

function completeAuthoritativeGoal() {
  if (presentation.canTransition(GOAL_PRESENTATION_STATES.COMPLETE)) {
    presentation.transition(GOAL_PRESENTATION_STATES.COMPLETE, {
      team: activeTeam,
      score: latestScore,
      replay: replaySeenForGoal
    });
  }
  if (presentation.canTransition(GOAL_PRESENTATION_STATES.HIDDEN)) {
    presentation.transition(GOAL_PRESENTATION_STATES.HIDDEN, {
      team: activeTeam,
      score: latestScore,
      replay: replaySeenForGoal
    });
  }
  setVisible(false);
  delete document.body.dataset.goalPresentation;
  setTimelinePhase("idle");
  running = false;
}

function applyAuthoritativePhase(payload = {}) {
  const team = payload.team === 1 ? "away" : "home";
  const projected = projectGoalPresentationPhase(payload.phase);
  if (!projected) return;
  if (Array.isArray(payload.score)) latestScore = Object.freeze([...payload.score]);

  switch (payload.phase) {
    case GoalSequencePhase.NATIVE_HIGHLIGHT:
      beginAuthoritativeGoal({ team, score: latestScore });
      break;
    case GoalSequencePhase.GOAL_CARD:
      if (!running) beginAuthoritativeGoal({ team, score: latestScore });
      setVisible(projected.visible);
      setPhase(projected.label);
      if (presentation.canTransition(GOAL_PRESENTATION_STATES.GOAL)) {
        presentation.transition(GOAL_PRESENTATION_STATES.GOAL, {
          team,
          score: latestScore,
          replay: false
        });
      }
      setTimelinePhase(projected.timelinePhase);
      break;
    case GoalSequencePhase.SCORE_CARD:
      setVisible(projected.visible);
      setPhase(projected.label);
      if (presentation.canTransition(GOAL_PRESENTATION_STATES.SCORE)) {
        presentation.transition(GOAL_PRESENTATION_STATES.SCORE, {
          team,
          score: latestScore,
          replay: replaySeenForGoal
        });
      }
      setTimelinePhase(projected.timelinePhase);
      break;
    case GoalSequencePhase.REPLAY:
      replaySeenForGoal = true;
      applyReplayAvailability(true);
      setVisible(projected.visible);
      setPhase(projected.label);
      if (presentation.canTransition(GOAL_PRESENTATION_STATES.REPLAY)) {
        presentation.transition(GOAL_PRESENTATION_STATES.REPLAY, {
          team,
          score: latestScore,
          replay: true
        });
      }
      setTimelinePhase(projected.timelinePhase);
      break;
    case GoalSequencePhase.KICKOFF:
      completeAuthoritativeGoal();
      break;
    default:
      break;
  }
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

async function waitForReplayEnd(token) {
  const deadline = performance.now() + previewTimings.replayMax;
  while (performance.now() < deadline) {
    if (token !== runToken) return false;
    if (!replayActive) return true;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return token === runToken && !replayActive;
}

async function startPreview({ team = "home", score = latestScore, replay = replayActive } = {}) {
  const token = ++runToken;
  running = true;
  testHoldReleased = !goalTestMode;
  latestScore = Object.freeze([...score]);
  activeTeam = team;
  replaySeenForGoal = Boolean(replay);
  if (presentation.state !== GOAL_PRESENTATION_STATES.HIDDEN) presentation.reset({ reason: "new-preview" });

  applySnapshot({ team, score, replay });
  setVisible(false);
  setTimelinePhase(GoalSequencePhase.NATIVE_HIGHLIGHT);

  try {
    if (!await wait(previewTimings.leadIn, token)) return;
    setVisible(true);
    setPhase("GOAL MOMENT");
    presentation.transition(GOAL_PRESENTATION_STATES.GOAL, { team, score, replay });
    setTimelinePhase(GoalSequencePhase.GOAL_CARD);

    if (!await waitForTestRelease(token)) return;
    if (!await wait(previewTimings.goal, token)) return;

    setPhase("SCORE UPDATE");
    presentation.transition(GOAL_PRESENTATION_STATES.SCORE, { team, score, replay });
    setTimelinePhase(GoalSequencePhase.SCORE_CARD);
    if (!await wait(previewTimings.score, token)) return;

    setVisible(false);
    if (replaySeenForGoal) {
      setPhase("INSTANT REPLAY");
      presentation.transition(GOAL_PRESENTATION_STATES.REPLAY, { team, score, replay: true });
      setTimelinePhase(GoalSequencePhase.REPLAY);
      if (!await waitForReplayEnd(token)) return;
    }

    presentation.transition(GOAL_PRESENTATION_STATES.COMPLETE, { team, score, replay: replaySeenForGoal });
    presentation.transition(GOAL_PRESENTATION_STATES.HIDDEN, { team, score, replay: replaySeenForGoal });
  } finally {
    if (token === runToken) {
      setVisible(false);
      delete document.body.dataset.goalPresentation;
      setTimelinePhase("idle");
      running = false;
    }
  }
}

ensureStylesheet();
ensureOverlay();

subscribeToGameEvents(window, (event) => {
  if (event.type === GameEventType.SCORE_CHANGED) {
    latestScore = Object.freeze([...event.payload.score]);
    activeTeam = event.payload.team === 0 ? "home" : "away";
    if (Object.hasOwn(event.payload, "replayAvailable")) {
      replayActive = Boolean(event.payload.replayAvailable);
      void startPreview({
        team: activeTeam,
        score: latestScore,
        replay: replayActive
      });
    } else {
      beginAuthoritativeGoal({ team: activeTeam, score: latestScore });
    }
  }
  else if (event.type === GameEventType.GOAL_PHASE_CHANGED) {
    applyAuthoritativePhase(event.payload);
  }
  else if (event.type === GameEventType.REPLAY_STARTED) {
    replayActive = true;
    replaySeenForGoal = true;
    applyReplayAvailability(true);
  }
  else if (event.type === GameEventType.REPLAY_ENDED) {
    replayActive = false;
  }
});

window.__TONY_GOAL_PRESENTATION__ = {
  ready: true,
  timings: { ...previewTimings },
  history,
  preview: (options = {}) => {
    if (options.score) latestScore = Object.freeze([...options.score]);
    replayActive = Boolean(options.replay);
    return startPreview(options);
  },
  endPreviewReplay: () => {
    replayActive = false;
  },
  releaseTestHold: () => {
    testHoldReleased = true;
  },
  diagnostics: () => ({
    running,
    state: presentation.state,
    history: [...history],
    timelineHistory: timelineHistory.map((entry) => ({ ...entry })),
    visible: overlay?.classList.contains("show") ?? false,
    timelinePhase,
    team: overlay?.dataset.team ?? null,
    scores: [...latestScore],
    replayActive,
    replaySeenForGoal,
    goalTestMode,
  }),
};
