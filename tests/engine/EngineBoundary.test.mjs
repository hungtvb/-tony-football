import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const engineRoot = new URL("../../src/game/engine/", import.meta.url);
const files = (await readdir(engineRoot)).filter((file) => file.endsWith(".js"));

const forbiddenDependencies = [
  { label: "Three.js", pattern: /(?:from|import\s*)\s*\(?["']three(?:\/|["'])/ },
  { label: "presentation module", pattern: /from\s+["'][^"']*\/presentation\// },
  { label: "renderer module", pattern: /from\s+["'][^"']*\/render\// }
];

const forbiddenBrowserGlobals = [
  "window",
  "document",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "AudioContext",
  "HTMLCanvasElement",
  "CanvasRenderingContext2D"
];

for (const file of files) {
  test(`${file} remains headless and presentation-independent`, async () => {
    const source = await readFile(new URL(file, engineRoot), "utf8");
    for (const dependency of forbiddenDependencies) {
      assert.doesNotMatch(source, dependency.pattern, `${file} imports forbidden ${dependency.label}`);
    }
    for (const identifier of forbiddenBrowserGlobals) {
      assert.doesNotMatch(source, new RegExp(`\\b${identifier}\\b`), `${file} uses browser global ${identifier}`);
    }
  });
}
