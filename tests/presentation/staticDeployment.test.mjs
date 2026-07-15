import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("static deployment does not reference node_modules URLs", () => {
  assert.doesNotMatch(index, /["']\/node_modules\//);
});

test("Three.js import map uses browser-accessible HTTPS modules", () => {
  assert.match(index, /"three":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/build\/three\.module\.min\.js"/);
  assert.match(index, /"three\/addons\/":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/examples\/jsm\/"/);
});
