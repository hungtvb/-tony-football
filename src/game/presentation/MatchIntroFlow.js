import {
  MATCH_PRESENTATION_STATES,
  createMatchPresentationState,
} from "../state/MatchPresentationState.js";

const params = new URLSearchParams(window.location.search);
const debugScenario = params.get("debugScenario");
const introDisabled = params.has("skipIntro");
const fastMode = params.has("visualTest") || params.has("introTest");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const timings = fastMode
  ? { versus: 520, countdown: 220, kickoff: 300 }
  : reducedMotion
    ? { versus: 220, countdown: 140, kickoff: 180 }
    : { versus: 1350, countdown: 650, kickoff: 700 };

const playButton = document.getElementById("playButton");
const matchSetup = document.getElementById("startOverlay");
const pitchPanel = document.querySelector(".match-pitch");
const history = [];
let overlay = null;
let running = false;
let allowNativeStart = false;
let skipRequested = false;
let runToken = 0;

const difficultyLabels = Object.freeze({ rookie: "ROOKIE", pro: "PRO", legend: "LEGEND" });
const pitchLabels = Object.freeze({ classic: "CLASSIC", elite: "ELITE", dry: "DRY", midnight: "MIDNIGHT" });
const ballLabels = Object.freeze({ classic: "CLASSIC", volt: "VOLT", crimson: "CRIMSON" });
const weatherLabels = Object.freeze({ clear: "TRỜI QUANG", rain: "TRỜI MƯA" });

function ensureStylesheet() {
  if (document.querySelector('link[data-u3-match-intro="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../../u3-match-intro.css", import.meta.url).href;
  link.dataset.u3MatchIntro = "true";
  document.head.append(link);
}

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "matchIntroOverlay";
  overlay.className = "game-overlay match-intro-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-labelledby", "matchIntroTitle");
  overlay.innerHTML = `
    <div class="match-intro-backdrop" aria-hidden="true"></div>
    <div class="overlay-card match-intro-card">
      <header class="match-intro-header">
        <span class="eyebrow"><i></i> MATCHDAY PRESENTATION</span>
        <span id="introLoadingLabel" class="intro-loading-label">ĐANG CHUẨN BỊ SÂN</span>
      </header>
      <section class="intro-versus-stage" aria-label="Cặp đấu">
        <article class="intro-team intro-home">
          <span class="intro-crest">TF</span>
          <small>HOME</small>
          <h2>TONY FC</h2>
        </article>
        <div class="intro-versus-mark">
          <span>VS</span>
          <b id="matchIntroTitle">QUICK MATCH</b>
        </div>
        <article class="intro-team intro-away">
          <span class="intro-crest neon">NU</span>
          <small>AWAY</small>
          <h2>NEON UTD</h2>
        </article>
      </section>
      <section class="intro-match-details" aria-label="Thiết lập trận">
        <span><small>AI</small><b id="introDifficulty">PRO</b></span>
        <span><small>SÂN</small><b id="introPitch">CLASSIC</b></span>
        <span><small>BÓNG</small><b id="introBall">CLASSIC</b></span>
        <span><small>THỜI TIẾT</small><b id="introWeather">TRỜI QUANG</b></span>
      </section>
      <section class="intro-countdown-stage" aria-live="assertive" aria-atomic="true">
        <small>SẴN SÀNG</small>
        <strong id="introCountdown">3</strong>
        <b id="introKickoffLabel">KICK OFF</b>
      </section>
      <div class="intro-progress" aria-hidden="true"><i></i></div>
      <button id="skipMatchIntroButton" class="intro-skip-button" type="button">BỎ QUA INTRO</button>
    </div>
  `;
  pitchPanel?.append(overlay);
  overlay.querySelector("#skipMatchIntroButton")?.addEventListener("click", () => {
    skipRequested = true;
  });
  return overlay;
}

function activeValue(selector, key, fallback) {
  return document.querySelector(`${selector}.active`)?.dataset[key] ?? fallback;
}

function snapshotSetup() {
  const difficulty = activeValue("[data-difficulty]", "difficulty", "pro");
  const pitch = activeValue("[data-pitch]", "pitch", "classic");
  const ball = activeValue("[data-ball]", "ball", "classic");
  const weather = activeValue("[data-weather]", "weather", "clear");
  return {
    difficulty: difficultyLabels[difficulty] ?? difficulty.toUpperCase(),
    pitch: pitchLabels[pitch] ?? pitch.toUpperCase(),
    ball: ballLabels[ball] ?? ball.toUpperCase(),
    weather: weatherLabels[weather] ?? weather.toUpperCase(),
  };
}

function applySnapshot(snapshot) {
  ensureOverlay();
  overlay.querySelector("#introDifficulty").textContent = snapshot.difficulty;
  overlay.querySelector("#introPitch").textContent = snapshot.pitch;
  overlay.querySelector("#introBall").textContent = snapshot.ball;
  overlay.querySelector("#introWeather").textContent = snapshot.weather;
}

function record(value) {
  history.push(value);
  window.dispatchEvent(new CustomEvent("tony:match-intro-state", { detail: { value } }));
}

const presentation = createMatchPresentationState({
  onChange: ({ current }) => {
    ensureOverlay();
    overlay.dataset.stage = current;
    document.body.dataset.introStage = current;
    record(current);
  },
});

function setIntroVisible(visible) {
  ensureOverlay();
  overlay.classList.toggle("show", visible);
  overlay.setAttribute("aria-hidden", String(!visible));
  pitchPanel?.classList.toggle("intro-camera-active", visible);
  if (!visible) delete document.body.dataset.introStage;
}

function setSetupVisible(visible) {
  matchSetup?.classList.toggle("show", visible);
  matchSetup?.setAttribute("aria-hidden", String(!visible));
}

async function waitStage(duration, token) {
  const deadline = performance.now() + duration;
  while (performance.now() < deadline) {
    if (token !== runToken || skipRequested) return;
    await new Promise((resolve) => setTimeout(resolve, Math.min(40, Math.max(0, deadline - performance.now()))));
  }
}

function setCountdown(value) {
  ensureOverlay();
  overlay.dataset.countdown = String(value).toLowerCase().replaceAll(" ", "-");
  const countdown = overlay.querySelector("#introCountdown");
  countdown.textContent = value;
  countdown.classList.remove("pulse");
  void countdown.offsetWidth;
  countdown.classList.add("pulse");
  record(`countdown:${value}`);
}

function startNativeMatch() {
  setIntroVisible(false);
  running = false;
  allowNativeStart = true;
  try {
    playButton?.click();
  } finally {
    allowNativeStart = false;
  }
  presentation.reset({ reason: "match-started" });
}

async function beginMatchIntro() {
  if (running || debugScenario || introDisabled || !playButton) return;

  running = true;
  skipRequested = false;
  const token = ++runToken;
  if (presentation.state !== MATCH_PRESENTATION_STATES.IDLE) presentation.reset({ reason: "restart-intro" });

  applySnapshot(snapshotSetup());
  setSetupVisible(false);
  setIntroVisible(true);
  document.body.dataset.flow = "match-intro";

  try {
    presentation.transition(MATCH_PRESENTATION_STATES.VERSUS);
    await waitStage(timings.versus, token);
    if (token !== runToken) return;

    presentation.transition(MATCH_PRESENTATION_STATES.COUNTDOWN);
    for (const value of ["3", "2", "1"]) {
      setCountdown(value);
      await waitStage(timings.countdown, token);
      if (token !== runToken) return;
    }

    presentation.transition(MATCH_PRESENTATION_STATES.KICKOFF);
    setCountdown("KICK OFF");
    await waitStage(timings.kickoff, token);
    if (token !== runToken) return;

    presentation.transition(MATCH_PRESENTATION_STATES.COMPLETE);
    startNativeMatch();
  } catch (error) {
    console.error("Match intro failed", error);
    running = false;
    setIntroVisible(false);
    setSetupVisible(true);
    document.body.dataset.flow = "match-setup";
    presentation.reset({ reason: "intro-error" });
  }
}

ensureStylesheet();
ensureOverlay();

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target.closest("#playButton") : null;
    if (!target || allowNativeStart || debugScenario || introDisabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void beginMatchIntro();
  },
  true,
);

window.__TONY_MATCH_INTRO__ = {
  ready: true,
  disabled: Boolean(debugScenario || introDisabled),
  timings: { ...timings },
  history,
  start: beginMatchIntro,
  skip: () => {
    skipRequested = true;
  },
  diagnostics: () => ({
    running,
    state: presentation.state,
    history: [...history],
    flow: document.body.dataset.flow,
    visible: overlay?.classList.contains("show") ?? false,
  }),
};
