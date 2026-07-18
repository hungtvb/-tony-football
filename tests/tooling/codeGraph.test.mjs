import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildArchitectureGraph,
  checkGraphOutputs,
  renderAllGraphOutputs,
  writeGraphOutputs,
} from "../../scripts/code-graph-lib.mjs";

async function write(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function createFixture({ forbiddenImport = false } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "tony-code-graph-"));
  const config = {
    version: 1,
    title: "Fixture graph",
    sourceMap: "docs/source-map.md",
    layers: ["engine", "presentation", "tests"],
    forbiddenImports: [{
      id: "engine-no-presentation",
      from: ["engine"],
      to: ["presentation"],
      reason: "engine stays pure",
    }],
    outputFiles: ["graph.json", "graph.mmd", "graph.svg", "index.html"],
  };
  const overlay = {
    version: 1,
    nodes: [
      { id: "Engine", label: "Engine", layer: "engine", source: "src/engine/Engine.js", owner: "engine", role: "authority" },
      { id: "View", label: "View", layer: "presentation", source: "src/presentation/View.js", owner: "view", role: "projection" },
      { id: "Test", label: "Test", layer: "tests", source: "tests/Engine.test.mjs", owner: "tests", role: "validation" },
    ],
    edges: [
      { from: "Engine", to: "View", type: "snapshots" },
      { from: "Test", to: "Engine", type: "tests" },
    ],
    views: { runtime: ["Engine", "View", "Test"] },
  };
  await write(rootDir, "architecture/graph/graph.config.json", `${JSON.stringify(config, null, 2)}\n`);
  await write(rootDir, "architecture/graph/semantic-overrides.json", `${JSON.stringify(overlay, null, 2)}\n`);
  await write(rootDir, "src/engine/Engine.js", forbiddenImport ? 'import "../presentation/View.js";\nexport const engine = true;\n' : "export const engine = true;\n");
  await write(rootDir, "src/presentation/View.js", "export const view = true;\n");
  await write(rootDir, "tests/Engine.test.mjs", 'import "../src/engine/Engine.js";\n');
  return rootDir;
}

test("architecture graph renders deterministic JSON, Mermaid, SVG and explorer", async () => {
  const rootDir = await createFixture();
  const first = await renderAllGraphOutputs({ rootDir });
  const second = await renderAllGraphOutputs({ rootDir });
  assert.deepEqual(first, second);
  assert.match(first["graph.mmd"], /flowchart LR/);
  assert.match(first["graph.svg"], /<svg/);
  assert.match(first["index.html"], /Fixture graph/);
  const graph = JSON.parse(first["graph.json"]);
  assert.equal(graph.summary.nodeCount, 3);
  assert.equal(graph.summary.edgeCount, 2);
});

test("graph check detects stale generated outputs", async () => {
  const rootDir = await createFixture();
  await writeGraphOutputs({ rootDir });
  assert.deepEqual((await checkGraphOutputs({ rootDir })).stale, []);
  await write(rootDir, "architecture/graph/graph.mmd", "stale\n");
  assert.deepEqual((await checkGraphOutputs({ rootDir })).stale, ["graph.mmd"]);
});

test("tracked engine imports cannot cross into presentation", async () => {
  const rootDir = await createFixture({ forbiddenImport: true });
  await assert.rejects(
    buildArchitectureGraph({ rootDir }),
    /engine-no-presentation.*Engine.*imports View/s,
  );
});

test("semantic graph rejects duplicate source ownership", async () => {
  const rootDir = await createFixture();
  const overlayPath = path.join(rootDir, "architecture/graph/semantic-overrides.json");
  const overlay = JSON.parse(await readFile(overlayPath, "utf8"));
  overlay.nodes.push({ id: "Duplicate", label: "Duplicate", layer: "tests", source: "src/engine/Engine.js", owner: "x", role: "x" });
  await writeFile(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  await assert.rejects(buildArchitectureGraph({ rootDir }), /source is represented more than once/);
});