import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

function makeIndexOffline(source) {
  return source
    .replace(
      "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js",
      "/node_modules/three/build/three.module.js",
    )
    .replace(
      "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/",
      "/node_modules/three/examples/jsm/",
    );
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    let file = join(root, safePath === "/" ? "index.html" : safePath);
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");

    let body = await readFile(file);
    if (file.endsWith("index.html")) body = Buffer.from(makeIndexOffline(body.toString("utf8")));

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Tony Football offline test server: http://127.0.0.1:${port}`);
});
