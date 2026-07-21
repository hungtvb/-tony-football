import { createSnapshotRenderState } from "./SnapshotRenderState.js";

const DEFAULT_WORLD = Object.freeze({ width: 1200, height: 700 });
const DEFAULT_FIELD = Object.freeze({ left: 48, right: 1152, top: 42, bottom: 658, goalTop: 265, goalBottom: 435 });
const PITCH_STYLES = Object.freeze({
  classic: Object.freeze({ mid: "#087044", outside: "#07100d" }),
  elite: Object.freeze({ mid: "#0b8351", outside: "#07140f" }),
  dry: Object.freeze({ mid: "#74883e", outside: "#16170d" }),
  midnight: Object.freeze({ mid: "#064b38", outside: "#030c09" }),
});
const BALL_STYLES = Object.freeze({
  classic: Object.freeze({ base: "#f3f4ef", patch: "#17201d", stroke: "#59635e" }),
  volt: Object.freeze({ base: "#dff44a", patch: "#172019", stroke: "#5b681b" }),
  crimson: Object.freeze({ base: "#f2f3f1", patch: "#c92832", stroke: "#7c3439" }),
});
const SKIN = Object.freeze(["#d89d78", "#b97958", "#8f5a3d", "#e5b08b"]);
const HAIR = Object.freeze(["#231914", "#38241b", "#111413", "#5a351f"]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function rendererPreference(target) {
  try { return new URLSearchParams(target?.location?.search ?? "").get("renderer"); }
  catch { return null; }
}

function assertImmutableFrame(frame) {
  if (!frame || !Object.isFrozen(frame)) throw new TypeError("CanvasMatchRenderer requires an immutable frame");
  if (!Object.isFrozen(frame.snapshot) || !Object.isFrozen(frame.previousSnapshot)) throw new TypeError("CanvasMatchRenderer requires immutable snapshots");
}

function canvasViewport(canvas, target) {
  return Object.freeze({
    cssWidth: Math.max(1, Number(canvas?.clientWidth || canvas?.width || DEFAULT_WORLD.width)),
    cssHeight: Math.max(1, Number(canvas?.clientHeight || canvas?.height || DEFAULT_WORLD.height)),
    pixelRatio: Math.max(1, Number(target?.devicePixelRatio || 1)),
    backingWidth: Math.max(1, Number(canvas?.width || DEFAULT_WORLD.width)),
    backingHeight: Math.max(1, Number(canvas?.height || DEFAULT_WORLD.height)),
  });
}

function drawPitch(context, world, field, pitchStyle) {
  const theme = PITCH_STYLES[pitchStyle] ?? PITCH_STYLES.classic;
  context.clearRect(0, 0, world.width, world.height);
  context.fillStyle = theme.outside;
  context.fillRect(0, 0, world.width, world.height);
  context.fillStyle = theme.mid;
  context.fillRect(field.left, field.top, field.right - field.left, field.bottom - field.top);
  for (let index = 0; index < 14; index += 1) {
    context.fillStyle = index % 2 ? "rgba(255,255,255,.025)" : "rgba(0,20,8,.04)";
    context.fillRect(field.left + index * (field.right - field.left) / 14, field.top, (field.right - field.left) / 14, field.bottom - field.top);
  }
  context.strokeStyle = "rgba(245,250,247,.88)";
  context.lineWidth = 3;
  context.strokeRect(field.left, field.top, field.right - field.left, field.bottom - field.top);
  context.beginPath(); context.moveTo(world.width / 2, field.top); context.lineTo(world.width / 2, field.bottom); context.stroke();
  context.beginPath(); context.arc(world.width / 2, world.height / 2, 83, 0, Math.PI * 2); context.stroke();
  for (const [x, side] of [[field.left, 1], [field.right, -1]]) {
    context.strokeRect(side === 1 ? x : x - 180, 175, 180, 350);
    context.strokeRect(side === 1 ? x : x - 82.8, 267, 82.8, 166);
    context.fillStyle = "rgba(255,255,255,.75)";
    context.beginPath(); context.arc(x + side * 125, world.height / 2, 4, 0, Math.PI * 2); context.fill();
  }
}

function drawPlayer(context, player, { selected, defenseSelection, nowMilliseconds }) {
  const home = player.team === 0;
  const keeper = player.role === "GK";
  const speed = Math.hypot(player.vx || 0, player.vy || 0);
  const stride = speed > 30 ? Math.sin(player.stepPhase || 0) * 6 : 0;
  const index = (Number(player.index || 0) + Number(player.team || 0)) % SKIN.length;
  const jersey = keeper ? (home ? "#8a62dd" : "#ed6757") : (home ? "#e1bb58" : "#47c9d4");
  const shorts = keeper ? "#20212c" : (home ? "#171b1a" : "#092e35");
  const socks = home ? "#e9d58f" : "#b8eff3";
  context.save();
  context.translate(player.x, player.y + (speed > 30 ? Math.abs(Math.sin(player.stepPhase || 0)) * -2 : 0));
  context.fillStyle = "rgba(0,0,0,.3)"; context.beginPath(); context.ellipse(5, 17, 23, 9, 0, 0, Math.PI * 2); context.fill();
  if (selected) {
    const pulse = 1 + Math.sin(nowMilliseconds * .006) * .07;
    context.strokeStyle = defenseSelection ? "#47c9d4" : "#ffdb6d";
    context.lineWidth = 3; context.beginPath(); context.ellipse(0, 13, 28 * pulse, 14 * pulse, 0, 0, Math.PI * 2); context.stroke();
  }
  context.rotate(Math.atan2(player.dirY || 0, player.dirX || 1));
  context.lineCap = "round";
  context.strokeStyle = socks; context.lineWidth = 6; context.beginPath();
  context.moveTo(-6, 10); context.lineTo(-7 + stride, 25); context.moveTo(6, 10); context.lineTo(7 - stride, 25); context.stroke();
  context.strokeStyle = "#191c1b"; context.lineWidth = 5; context.beginPath();
  context.moveTo(-10 + stride, 26); context.lineTo(-5 + stride, 26); context.moveTo(3 - stride, 26); context.lineTo(10 - stride, 26); context.stroke();
  context.fillStyle = shorts; context.beginPath(); context.roundRect(-11, 4, 22, 12, 4); context.fill();
  context.fillStyle = jersey; context.beginPath(); context.roundRect(-13, -15, 26, 22, 7); context.fill();
  context.fillStyle = home ? "#161b19" : "#e4f5f3"; context.fillRect(-12, -5, 24, 3);
  context.strokeStyle = jersey; context.lineWidth = 6; context.beginPath();
  context.moveTo(-11, -9); context.lineTo(-18 - stride * .35, 3); context.moveTo(11, -9); context.lineTo(18 + stride * .35, 3); context.stroke();
  context.strokeStyle = SKIN[index]; context.lineWidth = 4; context.beginPath();
  context.moveTo(-18 - stride * .35, 3); context.lineTo(-20 - stride * .35, 9); context.moveTo(18 + stride * .35, 3); context.lineTo(20 + stride * .35, 9); context.stroke();
  context.fillStyle = SKIN[index]; context.fillRect(-3, -19, 6, 6); context.beginPath(); context.ellipse(0, -23, 8, 9, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = HAIR[index]; context.beginPath(); context.arc(0, -26, 8, Math.PI, Math.PI * 2); context.fill();
  context.fillStyle = home ? "#101413" : "#f0fbfa"; context.font = "800 11px Barlow Condensed"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(String(player.number ?? ""), 0, -1);
  context.restore();
}

function drawBall(context, ball, styleName) {
  const style = BALL_STYLES[styleName] ?? BALL_STYLES.classic;
  const radius = Math.max(2, Number(ball.radius || 9));
  const height = Math.max(0, Number(ball.height || 0));
  context.save();
  context.globalAlpha = clamp(.3 - height * .03, .08, .3); context.fillStyle = "black"; context.beginPath(); context.ellipse(ball.x + 5, ball.y + 9, 12, 5, 0, 0, Math.PI * 2); context.fill();
  context.globalAlpha = 1; context.translate(ball.x, ball.y - height * 2.5); context.rotate(ball.angle || 0);
  context.fillStyle = style.base; context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill(); context.strokeStyle = style.stroke; context.lineWidth = 2; context.stroke();
  context.fillStyle = style.patch; context.beginPath(); context.arc(-2.5, -2.5, Math.max(2, radius * .34), 0, Math.PI * 2); context.fill();
  context.restore();
}

function drawRain(context, world, nowMilliseconds, lowPowerDevice) {
  context.fillStyle = "rgba(135,190,196,.055)"; context.fillRect(0, 0, world.width, world.height);
  context.strokeStyle = "rgba(195,235,242,.32)"; context.lineWidth = 1.2; context.beginPath();
  for (let index = 0; index < (lowPowerDevice ? 60 : 140); index += 1) {
    const x = (seededNoise(index * 3.7) * world.width + nowMilliseconds * .11) % world.width;
    const y = (seededNoise(index * 8.9) * world.height + nowMilliseconds * .34 * (.7 + seededNoise(index))) % world.height;
    context.moveTo(x, y); context.lineTo(x - 5, y + 17);
  }
  context.stroke();
}

function drawCharge(context, selectedPlayer, activeCharge) {
  if (!selectedPlayer || !activeCharge) return;
  const power = clamp(Number(activeCharge.power || 0), 0, 1);
  context.fillStyle = "rgba(0,0,0,.7)"; context.fillRect(selectedPlayer.x - 31, selectedPlayer.y - 50, 62, 8);
  context.fillStyle = power > .82 ? "#ff5b45" : "#ffcf58"; context.fillRect(selectedPlayer.x - 30, selectedPlayer.y - 49, 60 * power, 6);
}

function drawGoalFlash(context, world, goalSequence) {
  if (!goalSequence) return;
  const duration = Math.max(.001, Number(goalSequence.duration || 1));
  const alpha = clamp(Number(goalSequence.timer ?? duration) / duration, 0, 1);
  context.fillStyle = `rgba(255,225,126,${alpha * .16})`; context.fillRect(0, 0, world.width, world.height);
  context.fillStyle = `rgba(255,255,255,${alpha})`; context.font = "800 96px Barlow Condensed"; context.textAlign = "center"; context.fillText("GOAL!", world.width / 2, 145);
}

export function createCanvasMatchRenderer({ target, document, canvasId = "gameCanvas", world = DEFAULT_WORLD, field = DEFAULT_FIELD, lowPowerDevice = false, getRendererPreference = () => rendererPreference(target) } = {}) {
  if (!target || typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") throw new TypeError("CanvasMatchRenderer requires an event target");
  if (!document || typeof document.getElementById !== "function") throw new TypeError("CanvasMatchRenderer requires a document");
  if (typeof getRendererPreference !== "function") throw new TypeError("getRendererPreference must be a function");
  let canvas = null; let context = null; let attached = false; let active = false; let disposed = false; let status = "idle"; let renderCount = 0; let lastFacts = null;
  let viewport = Object.freeze({ cssWidth: 0, cssHeight: 0, pixelRatio: 1, backingWidth: 0, backingHeight: 0 });
  const handleResize = () => { if (!attached || !canvas) return false; viewport = canvasViewport(canvas, target); return true; };
  const clear = () => { if (!context || !canvas) return false; context.save(); context.setTransform?.(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, canvas.width || world.width, canvas.height || world.height); context.restore(); return true; };
  return Object.freeze({
    get attached() { return attached; }, get active() { return active; }, get status() { return status; },
    attach() {
      if (attached || disposed) return false;
      attached = true;
      if (getRendererPreference() !== "canvas") { status = "inactive"; return false; }
      canvas = document.getElementById(canvasId);
      if (!canvas) { status = "canvas-missing"; return false; }
      context = canvas.getContext?.("2d") ?? null;
      if (!context) { status = "context-missing"; return false; }
      active = true; status = "ready"; target.addEventListener("resize", handleResize); handleResize(); return true;
    },
    resize() { return handleResize(); },
    render(frame) {
      if (!attached || !active || disposed || !context || !canvas) return false;
      assertImmutableFrame(frame);
      const snapshot = frame.snapshot;
      const renderState = createSnapshotRenderState({ previous: frame.previousSnapshot, current: snapshot, alpha: frame.alpha });
      const settings = snapshot.match.settings ?? Object.freeze({});
      const selectedPlayer = renderState.players.find((player) => player.id === snapshot.match.selectedPlayerId) ?? null;
      const defenseSelection = frame.controlMode === "defense" && (frame.pressedCodes?.length ?? 0) > 0;
      const scaleX = Math.max(.0001, Number(canvas.width || world.width) / world.width);
      const scaleY = Math.max(.0001, Number(canvas.height || world.height) / world.height);
      context.save(); context.setTransform?.(scaleX, 0, 0, scaleY, 0, 0);
      drawPitch(context, world, field, settings.pitchStyle);
      for (const player of [...renderState.players].sort((left, right) => left.y - right.y)) drawPlayer(context, player, { selected: !snapshot.match.replay?.active && player.id === snapshot.match.selectedPlayerId, defenseSelection, nowMilliseconds: frame.nowMilliseconds });
      drawBall(context, renderState.ball, settings.ballStyle);
      if (settings.weather === "rain") drawRain(context, world, frame.nowMilliseconds, lowPowerDevice);
      if (snapshot.ball.ownerId === snapshot.match.selectedPlayerId) drawCharge(context, selectedPlayer, frame.activeCharge);
      drawGoalFlash(context, world, snapshot.match.goalSequence);
      context.restore();
      renderCount += 1;
      lastFacts = Object.freeze({ tick: snapshot.tick, score: snapshot.match.score, time: snapshot.match.time, selectedPlayerId: snapshot.match.selectedPlayerId, ballOwnerId: snapshot.ball.ownerId, selectedX: selectedPlayer?.x ?? null, selectedY: selectedPlayer?.y ?? null, ballX: renderState.ball.x, ballY: renderState.ball.y });
      return true;
    },
    reset() { if (!attached || disposed) return false; lastFacts = null; renderCount = 0; clear(); return active; },
    teardown() { if (!attached || disposed) return false; target.removeEventListener("resize", handleResize); clear(); attached = false; active = false; disposed = true; status = "disposed"; canvas = null; context = null; lastFacts = null; return true; },
    diagnostics: () => Object.freeze({ owner: "canvas-match-renderer", attached, active, disposed, status, renderCount, viewport, lastFacts }),
  });
}
