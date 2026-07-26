import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classifyTon80GameSource, prepareTon80Game } from "../../scripts/prepare-ton80-game.mjs";
const finalSource=["const presentationPort = window.__TONY_COMPATIBILITY_PRESENTATION_PORT__;","new BrowserBootstrapComposition({});","createBrowserPresentationFeedbackAdapter({});","})();"].join("\n")+"\n";
const legacySource=`${finalSource}function updateUI() {}`;
function workspace(source){const cwd=mkdtempSync(join(tmpdir(),"ton85-prepare-"));writeFileSync(join(cwd,"game.js"),source);return cwd;}
test("classifies only the final presentation boundary",()=>{assert.equal(classifyTon80GameSource(finalSource),"final");assert.equal(classifyTon80GameSource(legacySource),"inconsistent");});
test("generation is deterministic and leaves tracked source byte-identical",()=>{const cwd=workspace(finalSource);const original=readFileSync(join(cwd,"game.js"),"utf8");const first=prepareTon80Game({cwd});const second=prepareTon80Game({cwd});assert.equal(first.changed,true);assert.equal(second.changed,false);assert.equal(readFileSync(join(cwd,"game.js"),"utf8"),original);assert.equal(readFileSync(join(cwd,"generated/game.js"),"utf8"),finalSource);});
test("tracked sources with migrated owners fail closed",()=>{const cwd=workspace(legacySource);assert.throws(()=>prepareTon80Game({cwd}),/TON-85 final presentation boundary/);});
