from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


def replace_between(start, end, replacement, label):
    global text
    start_index = text.find(start)
    end_index = text.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"{label}: markers missing")
    text = text[:start_index] + replacement + text[end_index:]


replace_once(
    "  let ballTrailView; let particleView; let screenFx; let ctx; let use3D = true;",
    "  let ballTrailView; let particleView; let screenFx; let use3D = true;",
    "Canvas context state",
)
replace_once(
    '''    if (rendererPreference === "canvas") {
      use3D = false;
      ctx = canvas.getContext("2d");
      return false;
    }''',
    '''    if (rendererPreference === "canvas") {
      use3D = false;
      return false;
    }''',
    "forced Canvas initialization",
)
replace_once(
    '''    if (!threeScenePort) {
      use3D = false;
      ctx = canvas.getContext("2d");
      ui.commentary.textContent = "WebGL không khả dụng · Đang chạy chế độ tương thích 2D";
      return false;
    }''',
    '''    if (!threeScenePort) {
      use3D = false;
      ui.commentary.textContent = "WebGL không khả dụng · Đang chuyển sang Canvas snapshot renderer";
      return false;
    }''',
    "missing scene initialization",
)
replace_between(
    "  function drawFallbackPlayerDetail",
    "  function updateUI(",
    '''  function render(now, snapshot, renderState) {
    if (!use3D) return false;
    return render3D(now, snapshot, renderState);
  }

''',
    "legacy Canvas renderer ownership",
)
replace_once(
    '      modelViews: window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false }),\n',
    '      modelViews: window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false }),\n      canvasMatch: window.__TONY_CANVAS_MATCH_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "canvas-match-renderer", attached: false, active: false }),\n',
    "Canvas diagnostics bridge",
)

forbidden_tokens = [
    "renderFallback2D",
    "drawFallbackPlayerDetail",
    'canvas.getContext("2d")',
    "function drawPitch(",
    "function drawPlayer(",
    "function drawBall(",
    "function drawEffects(",
    "function drawScreenEffects(",
]
remaining = []
for line_number, line in enumerate(text.splitlines(), start=1):
    for token in forbidden_tokens:
        if token in line:
            remaining.append(f"{token}@{line_number}: {line.strip()[:220]}")
if remaining:
    raise RuntimeError("forbidden Canvas ownership remains:\n" + "\n".join(remaining))

path.write_text(text, encoding="utf-8")
