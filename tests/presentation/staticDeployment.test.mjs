import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));

test("static deployment does not reference node_modules URLs", () => {
  assert.doesNotMatch(index, /["']\/node_modules\//);
});

test("Three.js import map uses browser-accessible HTTPS modules", () => {
  assert.match(index, /"three":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/build\/three\.module\.min\.js"/);
  assert.match(index, /"three\/addons\/":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/examples\/jsm\/"/);
});

test("Vercel publishes the generated static bundle instead of the Node development server", () => {
  assert.equal(packageJson.scripts.start, "node scripts/dev-server.mjs");
  assert.equal(packageJson.scripts.build, "node scripts/build-static.mjs");
  assert.equal(vercel.framework, null);
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "dist");
});
