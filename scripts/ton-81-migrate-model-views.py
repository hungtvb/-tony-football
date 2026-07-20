from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")

start = "  function createChargeView() {"
end = "  function updateParticleView() {"
start_index = text.find(start)
end_index = text.find(end, start_index + len(start))
if start_index < 0 or end_index < 0:
    raise RuntimeError("TON-81 model-view migration markers missing")
if text.find(start, start_index + len(start)) >= 0:
    raise RuntimeError("TON-81 charge-view marker repeated unexpectedly")

text = text[:start_index] + text[end_index:]
path.write_text(text, encoding="utf-8")
