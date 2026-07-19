const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const claimedContexts = new WeakSet();

function requireContext(context) {
  if (!context || (typeof context !== "object" && typeof context !== "function")) {
    throw new TypeError("radar renderer requires a context");
  }
}

function drawRadarSnapshot(context, snapshot, {
  width,
  height,
  field,
  config,
}) {
  requireContext(context);
  if (!snapshot) throw new TypeError("radar renderer requires a snapshot");
  const pad = config.plotPadding;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;
  const mapX = (value) => pad + clamp((value - field.left) / (field.right - field.left), 0, 1) * plotWidth;
  const mapY = (value) => pad + clamp((value - field.top) / (field.bottom - field.top), 0, 1) * plotHeight;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#062d1e";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(236,248,241,.5)";
  context.lineWidth = 1;
  context.strokeRect(pad, pad, plotWidth, plotHeight);
  context.beginPath();
  context.moveTo(width / 2, pad);
  context.lineTo(width / 2, height - pad);
  context.stroke();
  context.beginPath();
  context.arc(width / 2, height / 2, Math.min(plotWidth, plotHeight) * 0.13, 0, Math.PI * 2);
  context.stroke();

  for (const player of snapshot.players) {
    const selected = player.id === snapshot.match.selectedPlayerId;
    const radius = selected ? config.selectedRadius : config.playerRadius;
    context.fillStyle = player.team === 0 ? "#f0c85d" : "#55d5df";
    context.beginPath();
    context.arc(mapX(player.x), mapY(player.y), radius, 0, Math.PI * 2);
    context.fill();
    if (selected) {
      context.strokeStyle = "#fff3bd";
      context.lineWidth = 1.7;
      context.beginPath();
      context.arc(mapX(player.x), mapY(player.y), radius + 2.2, 0, Math.PI * 2);
      context.stroke();
    }
  }

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#101615";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(mapX(snapshot.ball.x), mapY(snapshot.ball.y), config.ballRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  return true;
}

export function claimRadarSnapshotContext(context) {
  requireContext(context);
  if (claimedContexts.has(context)) {
    throw new Error("radar context is already owned by a presentation adapter");
  }
  claimedContexts.add(context);
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    return claimedContexts.delete(context);
  };
}

export function renderOwnedRadarSnapshot(context, snapshot, options) {
  return drawRadarSnapshot(context, snapshot, options);
}

export function renderRadarSnapshot(context, snapshot, options) {
  requireContext(context);
  if (claimedContexts.has(context)) return false;
  return drawRadarSnapshot(context, snapshot, options);
}
