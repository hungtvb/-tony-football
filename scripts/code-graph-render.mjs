const graphId = (value) => `n_${value.replace(/[^A-Za-z0-9_]/g, "_")}`;
const xml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function renderGraphJson(graph) {
  const { views: _views, ...canonical } = graph;
  return `${JSON.stringify(canonical, null, 2)}\n`;
}
export function renderMermaid(graph, viewName = "runtime") {
  const selected = new Set(graph.views[viewName] ?? graph.nodes.map((node) => node.id));
  const nodes = graph.nodes.filter((node) => selected.has(node.id));
  const lines = ["flowchart LR"];
  for (const layer of [...new Set(nodes.map((node) => node.layer))]) {
    lines.push(`  subgraph ${graphId(`layer_${layer}`)}["${layer}"]`);
    for (const node of nodes.filter((item) => item.layer === layer)) lines.push(`    ${graphId(node.id)}["${node.label.replaceAll('"', "'")}"]${node.bridge ? ":::bridge" : ""}`);
    lines.push("  end");
  }
  for (const edge of graph.edges) if (selected.has(edge.from) && selected.has(edge.to)) lines.push(`  ${graphId(edge.from)} -->|${edge.type}| ${graphId(edge.to)}`);
  lines.push("  classDef bridge stroke:#c58a00,stroke-width:3px;");
  return `${lines.join("\n")}\n`;
}
function layout(graph, viewName) {
  const selected = new Set(graph.views[viewName] ?? graph.nodes.map((node) => node.id));
  const nodes = graph.nodes.filter((node) => selected.has(node.id));
  const order = ["browser", "application", "input", "core", "engine", "presentation", "tests", "tooling"];
  const groups = new Map(), positions = new Map();
  for (const node of nodes) { if (!groups.has(node.layer)) groups.set(node.layer, []); groups.get(node.layer).push(node); }
  for (const [layer, group] of groups) {
    group.sort((a, b) => a.label.localeCompare(b.label));
    group.forEach((node, row) => positions.set(node.id, { x: 25 + Math.max(0, order.indexOf(layer)) * 225, y: 55 + row * 76 }));
  }
  return { selected, nodes, positions, width: 1900, height: Math.max(520, 130 + Math.max(...[...groups.values()].map((group) => group.length)) * 76) };
}
export function renderSvg(graph, viewName = "runtime") {
  const data = layout(graph, viewName), parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.width} ${data.height}" role="img"><title>${xml(graph.title)}</title>`,
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#64748b"/></marker></defs><rect width="100%" height="100%" fill="#0b1020"/>`,
  ];
  for (const edge of graph.edges) {
    if (!data.selected.has(edge.from) || !data.selected.has(edge.to)) continue;
    const from = data.positions.get(edge.from), to = data.positions.get(edge.to);
    const x1 = from.x + 185, y1 = from.y + 25, x2 = to.x, y2 = to.y + 25, middle = (x1 + x2) / 2;
    parts.push(`<path d="M${x1} ${y1}C${middle} ${y1},${middle} ${y2},${x2} ${y2}" fill="none" stroke="#64748b" marker-end="url(#a)"/><text x="${middle}" y="${(y1 + y2) / 2 - 3}" fill="#aab6d4" font-family="system-ui" font-size="9" text-anchor="middle">${xml(edge.type)}</text>`);
  }
  for (const node of data.nodes) {
    const point = data.positions.get(node.id), label = node.label.length > 25 ? `${node.label.slice(0, 23)}…` : node.label;
    parts.push(`<g transform="translate(${point.x},${point.y})"><rect width="185" height="50" rx="9" fill="#17233d" stroke="${node.bridge ? "#f2c45e" : "#60739d"}" stroke-width="${node.bridge ? 2.5 : 1.2}"/><text x="9" y="20" fill="#eef3ff" font-family="system-ui" font-size="12">${xml(label)}</text><text x="9" y="38" fill="#aab6d4" font-family="system-ui" font-size="9">${xml(node.layer)}</text></g>`);
  }
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}