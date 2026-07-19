import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../game.js", import.meta.url);
let source = readFileSync(path, "utf8");
const replacements = [
  ["  function createLabelSprite  function createLabelSprite", "  function createLabelSprite"],
  ["  function drawFallbackPlayerDetail  function drawFallbackPlayerDetail", "  function drawFallbackPlayerDetail"],
];

for (const [duplicate, normalized] of replacements) {
  const occurrences = source.split(duplicate).length - 1;
  if (occurrences !== 1) throw new Error(`Expected one generated boundary for ${normalized}, found ${occurrences}`);
  source = source.replace(duplicate, normalized);
}

const closingBoundary = "\n})();\n";
const closingOccurrences = source.split(closingBoundary).length - 1;
if (closingOccurrences !== 1) {
  throw new Error(`Expected one generated IIFE closing boundary, found ${closingOccurrences}`);
}
source = source.replace(closingBoundary, "\n}\n})();\n");

writeFileSync(path, source, "utf8");
