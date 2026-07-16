import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const postMatchHub = await readFile(
  new URL("../../src/game/presentation/PostMatchHub.js", import.meta.url),
  "utf8",
);

test("post-match presentation cannot observe its own class mutations", () => {
  const presentResult = postMatchHub.slice(
    postMatchHub.indexOf("function presentResult"),
    postMatchHub.indexOf("ensureStylesheet();"),
  );

  assert.match(presentResult, /resultObserver\?\.disconnect\(\)/);
  assert.match(presentResult, /if \(!resultOverlay\.classList\.contains\("show"\)\)/);
  assert.match(presentResult, /finally \{/);
  assert.match(presentResult, /resultObserver\?\.observe\(resultOverlay/);
});

test("post-match diagnostics expose one presentation per preview", () => {
  assert.match(postMatchHub, /presentationCount \+= 1/);
  assert.match(postMatchHub, /presentationCount,/);
  assert.match(postMatchHub, /document\.body\.dataset\.flow !== "result"/);
});

test("post-match navigation uses explicit application actions", () => {
  assert.match(postMatchHub, /ApplicationActionType\.OPEN_MATCH_SETUP/);
  assert.match(postMatchHub, /ApplicationActionType\.OPEN_MAIN_MENU/);
  assert.doesNotMatch(postMatchHub, /setupButton"\)\?\.click/);
  assert.doesNotMatch(postMatchHub, /mainMenuButton"\)\?\.click/);
});
