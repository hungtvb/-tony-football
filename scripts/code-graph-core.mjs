import { access, readFile } from "node:fs/promises";
import path from "node:path";

const CONFIG = "architecture/graph/graph.config.json";
const OVERLAY = "architecture/graph/semantic-overrides.json";
const SCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
export const normalizePath = (value) => String(value).replaceAll("\\", "/").replace(/^\.\//, "");
export const stableSort = (items, selector) => [...items].sort((a, b) => selector(a).localeCompare(selector(b)));

async function readJson(rootDir, relativePath) {
  return JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8"));
}
async function exists(absolutePath) {
  try { await access(absolutePath); return true; } catch { return false; }
}
function importSpecifiers(source) {
  const result = new Set();
  const patterns = [
    /^\s*import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/gm,
    /^\s*export\s+[^"']+?\s+from\s+["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) result.add(match[1]);
  return [...result].sort();
}
function resolveTracked(sourcePath, specifier, sources) {
  if (!specifier.startsWith(".")) return null;
  const base = normalizePath(path.posix.join(path.posix.dirname(sourcePath), specifier));
  return [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, `${base}/index.js`, `${base}/index.mjs`]
    .find((candidate) => sources.has(candidate)) ?? null;
}
function cycles(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const active = new Set(), visited = new Set(), stack = [], found = new Set();
  function visit(id) {
    if (active.has(id)) { found.add([...stack.slice(stack.indexOf(id)), id].join(" -> ")); return; }
    if (visited.has(id)) return;
    active.add(id); stack.push(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    stack.pop(); active.delete(id); visited.add(id);
  }
  for (const node of nodes) visit(node.id);
  return [...found].sort();
}
function validateOverlay(config, overlay) {
  const errors = [], ids = new Set(), sources = new Set(), edgeKeys = new Set();
  for (const node of overlay.nodes ?? []) {
    if (!node.id || !node.label || !node.layer || !node.source || !node.owner || !node.role) errors.push(`node ${node.id || "<unknown>"} is incomplete`);
    if (ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    if (sources.has(normalizePath(node.source))) errors.push(`source is represented more than once: ${node.source}`);
    if (!config.layers.includes(node.layer)) errors.push(`unknown layer ${node.layer}: ${node.id}`);
    ids.add(node.id); sources.add(normalizePath(node.source));
  }
  for (const edge of overlay.edges ?? []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`edge references unknown node: ${edge.from} -> ${edge.to}`);
    const key = `${edge.from}\0${edge.to}\0${edge.type}`;
    if (edgeKeys.has(key)) errors.push(`duplicate edge: ${edge.from} -> ${edge.to} (${edge.type})`);
    edgeKeys.add(key);
  }
  for (const [view, members] of Object.entries(overlay.views ?? {})) for (const id of members) if (!ids.has(id)) errors.push(`view ${view} references unknown node ${id}`);
  return errors;
}
async function validateImports(rootDir, config, nodes) {
  const sourceToNode = new Map(nodes.map((node) => [normalizePath(node.source), node]));
  const found = [], errors = [];
  for (const node of nodes) {
    const sourcePath = normalizePath(node.source), absolutePath = path.join(rootDir, sourcePath);
    if (!(await exists(absolutePath))) { errors.push(`tracked source does not exist: ${sourcePath} (${node.id})`); continue; }
    if (!SCRIPT_EXTENSIONS.has(path.extname(sourcePath))) continue;
    for (const specifier of importSpecifiers(await readFile(absolutePath, "utf8"))) {
      const resolved = resolveTracked(sourcePath, specifier, sourceToNode);
      if (resolved) found.push({ from: node.id, to: sourceToNode.get(resolved).id });
    }
  }
  const edges = stableSort(new Map(found.map((edge) => [`${edge.from}\0${edge.to}`, edge])).values(), (edge) => `${edge.from}\0${edge.to}`);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) for (const rule of config.forbiddenImports ?? []) {
    if (rule.from.includes(byId.get(edge.from).layer) && rule.to.includes(byId.get(edge.to).layer)) errors.push(`[${rule.id}] ${edge.from} imports ${edge.to}: ${rule.reason}`);
  }
  for (const cycle of cycles(nodes, edges)) errors.push(`tracked import cycle: ${cycle}`);
  return errors;
}
export async function buildArchitectureGraph({ rootDir = process.cwd(), validateSources = true } = {}) {
  const config = await readJson(rootDir, CONFIG), overlay = await readJson(rootDir, OVERLAY);
  const errors = validateOverlay(config, overlay);
  const nodes = stableSort(overlay.nodes ?? [], (node) => node.id).map((node) => ({ ...node, source: normalizePath(node.source) }));
  const edges = stableSort(overlay.edges ?? [], (edge) => `${edge.from}\0${edge.to}\0${edge.type}`);
  if (validateSources) errors.push(...await validateImports(rootDir, config, nodes));
  if (errors.length) throw new Error(`Architecture graph validation failed:\n- ${errors.join("\n- ")}`);
  const layerCounts = Object.fromEntries(config.layers.map((layer) => [layer, 0]));
  for (const node of nodes) layerCounts[node.layer] += 1;
  return {
    schemaVersion: 1, title: config.title, sourceMap: config.sourceMap, nodes, edges,
    summary: { nodeCount: nodes.length, edgeCount: edges.length, layerCounts, bridgeCount: nodes.filter((node) => node.bridge).length },
    views: overlay.views ?? {},
  };
}