import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DUPLICATE_BOUNDARIES = Object.freeze([
  ["  function applyBallStyle() {  function applyBallStyle() {", "  function applyBallStyle() {"],
]);

const REQUIRED_BOUNDARIES = Object.freeze([
  "  function applyBallStyle() {",
  "  function createParticleView() {",
  "  function render(now, snapshot, renderState) {",
  "window.__TONY_CANVAS_MATCH_BRIDGE__?.diagnostics?.()",
  "  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
  "  window.__TONY_DEBUG__.ready = true;",
]);

function rebaseGeneratedModuleImports(source) {
  return source
    .replaceAll('from "./src/', 'from "../src/')
    .replaceAll("from './src/", "from '../src/")
    .replaceAll('import("./src/', 'import("../src/')
    .replaceAll("import('./src/", "import('../src/");
}

export function normalizeTon80GameSource(source) {
  let normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  for (const [duplicate, replacement] of DUPLICATE_BOUNDARIES) {
    const occurrences = normalized.split(duplicate).length - 1;
    if (occurrences > 1) throw new Error(`Generated boundary repeated unexpectedly: ${replacement.trim()}`);
    if (occurrences === 1) normalized = normalized.replace(duplicate, replacement);
  }
  if (normalized.includes("\n}\n})();\n")) normalized = normalized.replace("\n}\n})();\n", "\n})();\n");
  normalized = rebaseGeneratedModuleImports(normalized);
  for (const marker of REQUIRED_BOUNDARIES) {
    if (!normalized.includes(marker)) throw new Error(`Missing generated TON-82 boundary: ${marker.trim()}`);
  }
  if (normalized.split("function applyBallStyle() {").length - 1 !== 1) throw new Error("Expected exactly one generated applyBallStyle function");
  if (normalized.includes("renderFallback2D") || normalized.includes("drawFallbackPlayerDetail")) throw new Error("Generated match Canvas ownership remains after TON-82 migration");
  const closingBoundary = "\n})();\n";
  if (normalized.split(closingBoundary).length - 1 !== 1) throw new Error("Expected one generated IIFE closing boundary");
  if (normalized.includes("\n}\n})();\n")) throw new Error("Generated bootstrap remains nested behind an extra closing brace");
  if (normalized.includes('from "./src/') || normalized.includes("from './src/") || normalized.includes('import("./src/') || normalized.includes("import('./src/")) throw new Error("Generated module imports still resolve beneath the generated directory");
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
