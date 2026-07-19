import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const staticExtensions = new Set([".css", ".html", ".js"]);
const staticDirectories = new Set(["assets", "src", "generated"]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
const copied = [];
for (const entry of entries) {
  if (entry.isDirectory() && staticDirectories.has(entry.name)) {
    await cp(new URL(`${entry.name}/`, root), new URL(`${entry.name}/`, output), { recursive: true });
    copied.push(`${entry.name}/`);
    continue;
  }
  if (entry.isFile() && staticExtensions.has(extname(entry.name))) {
    await cp(new URL(entry.name, root), new URL(entry.name, output));
    copied.push(entry.name);
  }
}
if (!copied.includes("index.html")) throw new Error("Static build did not include index.html");
if (!copied.includes("generated/")) throw new Error("Static build did not include generated runtime artifact");
console.log(`Static build ready: ${join(output.pathname)} (${copied.length} root entries)`);
