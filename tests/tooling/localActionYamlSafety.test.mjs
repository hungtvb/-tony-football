import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  LOCAL_ACTION_EXPLICIT_KEY_RULE_ID,
  LOCAL_ACTION_QUOTED_KEY_RULE_ID,
  LOCAL_ACTION_TAG_RULE_ID,
  inspectLocalActionYamlSafety,
  scanLocalActionYamlSafety,
} from "../../scripts/check-local-action-yaml-safety.mjs";

const inspect = (source) => inspectLocalActionYamlSafety({ manifestPath: ".github/actions/test/action.yml", source });

async function repository(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "tony-local-yaml-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  return rootDir;
}

async function write(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

test("quoted mapping keys fail closed", () => {
  for (const source of [
    'runs:\n  using: composite\n  steps:\n    - "uses": vendor/action@main\n',
    "runs:\n  using: composite\n  steps:\n    - 'uses': vendor/action@main\n",
  ]) {
    assert.deepEqual(inspect(source).map(({ code }) => code), [LOCAL_ACTION_QUOTED_KEY_RULE_ID]);
  }
});

test("explicit mapping key syntax fails closed", () => {
  const source = "runs:\n  using: composite\n  steps:\n    - ? uses\n      : vendor/action@main\n";
  assert.deepEqual(inspect(source).map(({ code }) => code), [LOCAL_ACTION_EXPLICIT_KEY_RULE_ID]);
});

test("bare and named YAML tags fail closed", () => {
  for (const source of [
    "metadata: ! { uses: vendor/action@main }\nruns:\n  using: composite\n  steps: []\n",
    "metadata: !custom value\nruns:\n  using: composite\n  steps: []\n",
    "metadata: !!map {}\nruns:\n  using: composite\n  steps: []\n",
    "metadata: !<tag:yaml.org,2002:map> {}\nruns:\n  using: composite\n  steps: []\n",
  ]) {
    assert.deepEqual(inspect(source).map(({ code }) => code), [LOCAL_ACTION_TAG_RULE_ID]);
  }
});

test("quoted punctuation and block scalar content remain valid", () => {
  const source = `name: Safe action\ndescription: "Shows ?, !, [brackets], and a key: value as text"\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        echo '\"uses\": vendor/action@main'\n        echo '? uses'\n        echo '! { uses: vendor/action@main }'\n`;
  assert.deepEqual(inspect(source), []);
});

test("recursive manifest discovery covers action yml and yaml", async (t) => {
  const rootDir = await repository(t);
  await write(rootDir, ".github/actions/a/action.yml", "name: safe\nruns:\n  using: node20\n  main: index.js\n");
  await write(rootDir, ".github/actions/nested/b/action.yaml", 'name: unsafe\nruns:\n  using: composite\n  steps:\n    - "uses": vendor/action@main\n');
  const result = await scanLocalActionYamlSafety({ rootDir });
  assert.equal(result.manifestCount, 2);
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_QUOTED_KEY_RULE_ID]);
  assert.equal(result.violations[0].path, ".github/actions/nested/b/action.yaml");
});
