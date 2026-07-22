import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function rebaseGeneratedModuleImports(source) {
  return source
    .replaceAll('from "./src/', 'from "../src/')
    .replaceAll("from './src/", "from '../src/")
    .replaceAll('import("./src/', 'import("../src/')
    .replaceAll("import('./src/", "import('../src/");
}

export function normalizeTon80GameSource(source) {
  const normalized = rebaseGeneratedModuleImports(source);
  const required = ["__TONY_COMPATIBILITY_PRESENTATION_PORT__", "new BrowserBootstrapComposition", "createBrowserPresentationFeedbackAdapter"];
  for (const marker of required) if (!normalized.includes(marker)) throw new Error(`Missing TON-85 runtime boundary: ${marker}`);
  if (normalized.split("\n})();\n").length - 1 !== 1) throw new Error("Expected one runtime IIFE closing boundary");
  if (normalized.includes('from "./src/') || normalized.includes("from './src/")) throw new Error("Generated imports still resolve beneath generated/");
  return normalized;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [inputArgument, outputArgument] = process.argv.slice(2);
  if (!inputArgument || !outputArgument) throw new Error("normalize-ton80-game requires input and output paths");
  writeFileSync(resolve(outputArgument), normalizeTon80GameSource(readFileSync(resolve(inputArgument), "utf8")), "utf8");
}
