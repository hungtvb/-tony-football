const BLOCKED_GAMEPLAY_PARAMS = Object.freeze([
  "runtime",
  "debugScenario",
]);

export function sanitizeBrowserRuntimeSearch(search = "") {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const name of BLOCKED_GAMEPLAY_PARAMS) {
    if (!params.has(name)) continue;
    params.delete(name);
    changed = true;
  }
  return {
    changed,
    search: params.size > 0 ? `?${params.toString()}` : "",
  };
}

if (typeof globalThis.window !== "undefined") {
  const sanitized = sanitizeBrowserRuntimeSearch(globalThis.location.search);
  if (sanitized.changed) {
    globalThis.history.replaceState(
      globalThis.history.state,
      "",
      `${globalThis.location.pathname}${sanitized.search}${globalThis.location.hash}`,
    );
  }
  await import("./game.js?v=20.0.0");
}