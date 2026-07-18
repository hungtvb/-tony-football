import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildArchitectureGraph } from "./code-graph-core.mjs";
import { renderGraphJson, renderMermaid, renderSvg } from "./code-graph-render.mjs";

const DIRECTORY = "architecture/graph";
export { buildArchitectureGraph };
export { renderGraphJson, renderMermaid, renderSvg };
async function renderExplorer(rootDir, graph) {
  let template;
  try { template = await readFile(path.join(rootDir, DIRECTORY, "explorer-template.html"), "utf8"); }
  catch { template = "<!doctype html><html><head><meta charset=\"utf-8\"><title>__GRAPH_TITLE__</title></head><body><h1>__GRAPH_TITLE__</h1><p>__SOURCE_MAP__</p></body></html>\n"; }
  return template.replaceAll("__GRAPH_TITLE__", graph.title).replaceAll("__SOURCE_MAP__", graph.sourceMap);
}
export async function renderAllGraphOutputs({ rootDir = process.cwd(), validateSources = true } = {}) {
  const graph = await buildArchitectureGraph({ rootDir, validateSources });
  return {
    "graph.json": renderGraphJson(graph),
    "graph.mmd": renderMermaid(graph),
    "graph.svg": renderSvg(graph),
    "index.html": await renderExplorer(rootDir, graph),
  };
}
export async function writeGraphOutputs({ rootDir = process.cwd(), outputDir = DIRECTORY, validateSources = true } = {}) {
  const outputs = await renderAllGraphOutputs({ rootDir, validateSources });
  const target = path.join(rootDir, outputDir);
  await mkdir(target, { recursive: true });
  for (const [filename, content] of Object.entries(outputs)) await writeFile(path.join(target, filename), content, "utf8");
  return outputs;
}
export async function checkGraphOutputs({ rootDir = process.cwd(), outputDir = DIRECTORY, validateSources = true } = {}) {
  const expected = await renderAllGraphOutputs({ rootDir, validateSources }), stale = [];
  for (const [filename, content] of Object.entries(expected)) {
    try { if (await readFile(path.join(rootDir, outputDir, filename), "utf8") !== content) stale.push(filename); }
    catch { stale.push(filename); }
  }
  return { stale, expected };
}