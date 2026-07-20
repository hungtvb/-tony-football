import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DUPLICATE_BOUNDARIES = Object.freeze([
  ["  function drawFallbackPlayerDetail  function drawFallbackPlayerDetail", "  function drawFallbackPlayerDetail"],
  ["  function applyBallStyle() {  function applyBallStyle() {", "  function applyBallStyle() {"],
]);

const REQUIRED_BOUNDARIES = Object.freeze([
  "  function applyBallStyle() {",
  "  function createParticleView() {",
  "  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {",
  "  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
  "  window.__TONY_DEBUG__.ready = true;",
]);

function rebaseGeneratedModuleImports(source) {
  return source
    .replace(/(\bfrom\s+["'])\.\/src\//g, "$1../src/")
    .replace(/(\bimport\s*\(\s*["'])\.\/src\//g, "$1../src/");
}

export function normalizeTon80GameSource(source) {
  let normalized = source;
  for (const [duplicate, replacement] of DUPLICATE_BOUNDARIES) {
    const occurrences = normalized.split(duplicate).length - 1;
    if (occurrences > 1) throw new Error(`Generated boundary repeated unexpectedly: ${replacement.trim()}`);
    if (occurrences === 1) normalized = normalized.replace(duplicate, replacement);
  }

  if (normalized.includes("\n}\n})();\n")) normalized = normalized.replace("\n}\n})();\n", "\n})();\n");
  normalized = rebaseGeneratedModuleImports(normalized);

  for (const marker of REQUIRED_BOUNDARIES) {
    if (!normalized.includes(marker)) throw new Error(`Missing generated TON-80 boundary: ${marker.trim()}`);
  }
  if ((normalized.match(/function applyBallStyle\(\) \{/g) ?? []).length !== 1) {
    throw new Error("Expected exactly one generated applyBallStyle function");
  }
  const closingBoundary = "\n})();\n";
  if (normalized.split(closingBoundary).length - 1 !== 1) throw new Error("Expected one generated IIFE closing boundary");
  if (normalized.includes("\n}\n})();\n")) throw new Error("Generated bootstrap remains nested behind an extra closing brace");
  if (/\bfrom\s+["']\.\/src\//.test(normalized) || /\bimport\s*\(\s*["']\.\/src\//.test(normalized)) {
    throw new Error("Generated module imports still resolve beneath the generated directory");
  }
  return normalized;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [inputArgument, outputArgument] = process.argv.slice(2);
  if (!inputArgument || !outputArgument) throw new Error("normalize-ton80-game requires explicit input and output paths");
  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument);
  writeFileSync(outputPath, normalizeTon80GameSource(readFileSync(inputPath, "utf8")), "utf8");
}
