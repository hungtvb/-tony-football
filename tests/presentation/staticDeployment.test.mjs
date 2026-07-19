import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
const pagesWorkflow = await readFile(new URL("../../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

test("static deployment does not reference node_modules URLs", () => {
  assert.doesNotMatch(index, /["']\/node_modules\//);
});

test("Three.js import map uses browser-accessible HTTPS modules", () => {
  assert.match(index, /"three":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/build\/three\.module\.min\.js"/);
  assert.match(index, /"three\/addons\/":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/examples\/jsm\/"/);
});

test("Vercel publishes the prepared static bundle instead of the Node development server", () => {
  assert.equal(packageJson.scripts["prepare:ton80-game"], "node scripts/prepare-ton80-game.mjs");
  assert.equal(packageJson.scripts.start, "npm run prepare:ton80-game && node scripts/dev-server.mjs");
  assert.equal(packageJson.scripts.build, "npm run prepare:ton80-game && node scripts/build-static.mjs");
  assert.equal(vercel.framework, null);
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "dist");
});

test("GitHub Pages builds and uploads the explicit generated static bundle", () => {
  const installIndex = pagesWorkflow.indexOf("run: npm ci");
  const buildIndex = pagesWorkflow.indexOf("run: npm run build");
  const uploadIndex = pagesWorkflow.indexOf("actions/upload-pages-artifact@");
  assert.ok(installIndex >= 0, "Pages workflow must install locked dependencies");
  assert.ok(buildIndex > installIndex, "Pages workflow must build after dependency installation");
  assert.ok(uploadIndex > buildIndex, "Pages workflow must upload only after the static build");
  assert.match(pagesWorkflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.match(pagesWorkflow, /path:\s+dist(?:\s|$)/);
  assert.doesNotMatch(pagesWorkflow, /path:\s+\.(?:\s|$)/);
});
