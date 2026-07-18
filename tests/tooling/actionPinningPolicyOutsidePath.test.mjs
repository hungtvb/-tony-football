import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanActionPinningPolicy } from "../../scripts/check-action-pinning-policy.mjs";
import {
  LOCAL_ACTION_QUOTED_KEY_RULE_ID,
  LOCAL_ACTION_TAG_RULE_ID,
} from "../../scripts/check-local-action-yaml-safety.mjs";

async function createRepository(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "tony-action-pins-outside-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(path.join(rootDir, ".github", "workflows"), { recursive: true });
  return rootDir;
}

async function writeRepositoryFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

const workflowUsing = (action) => `jobs:\n  test:\n    steps:\n      - uses: ${action}\n`;

async function scanOutsideManifest(t, manifest) {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./tools/build-action"));
  await writeRepositoryFile(rootDir, "tools/build-action/action.yml", manifest);
  return scanActionPinningPolicy({ rootDir });
}

test("quoted uses keys fail closed in referenced local actions outside .github/actions", async (t) => {
  const result = await scanOutsideManifest(
    t,
    "name: Outside action\nruns:\n  using: composite\n  steps:\n    - \"uses\": vendor/action@main\n",
  );

  assert.equal(result.localActionCount, 1);
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_QUOTED_KEY_RULE_ID]);
  assert.equal(result.violations[0].path, "tools/build-action/action.yml");
});

test("bare YAML tags fail closed in referenced local actions outside .github/actions", async (t) => {
  const result = await scanOutsideManifest(
    t,
    "name: Outside tagged action\nruns:\n  using: composite\n  steps:\n    - ! { uses: vendor/action@main }\n",
  );

  assert.equal(result.localActionCount, 1);
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_TAG_RULE_ID]);
  assert.equal(result.violations[0].path, "tools/build-action/action.yml");
});
