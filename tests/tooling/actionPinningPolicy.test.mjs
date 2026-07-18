import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ACTION_PIN_RULE_ID,
  ACTION_VERSION_RULE_ID,
  CHECKOUT_CREDENTIAL_RULE_ID,
  LOCAL_ACTION_CYCLE_RULE_ID,
  LOCAL_ACTION_MANIFEST_RULE_ID,
  LOCAL_ACTION_PATH_RULE_ID,
  LOCAL_ACTION_SCAN_RULE_ID,
  LOCAL_ACTION_YAML_STRUCTURE_RULE_ID,
  LOCAL_DOCKER_ACTION_RULE_ID,
  inspectActionPinningPolicy,
  scanActionPinningPolicy,
} from "../../scripts/check-action-pinning-policy.mjs";

const SETUP_SHA = "49933ea5288caeca8642d1e84afbd3f7d6820020";
const CHECKOUT_SHA = "11bd71901bbe5b1630ceea73d27597364c9af683";
const DOCKER_DIGEST = "a".repeat(64);
const inspect = (source) => inspectActionPinningPolicy({ workflowPath: ".github/workflows/ci.yml", source: `${source}\n` });
const codes = (source) => inspect(source).map(({ code }) => code);

async function createRepository(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "tony-action-pins-"));
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
const compositeUsing = (action) => `name: Local action\ndescription: Test local dependency closure\nruns:\n  using: composite\n  steps:\n    - uses: ${action}\n`;

test("floating tag refs are rejected", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4"), [ACTION_PIN_RULE_ID]);
});

test("floating branch refs are rejected", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@main"), [ACTION_PIN_RULE_ID]);
});

test("short commit SHAs are rejected", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@49933ea # v4.4.0"), [ACTION_PIN_RULE_ID]);
});

test("full SHA pins require readable semantic-version comments", () => {
  assert.deepEqual(codes(`jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@${SETUP_SHA}`), [ACTION_VERSION_RULE_ID]);
});

test("full SHA pins with readable version comments pass", () => {
  assert.deepEqual(inspect(`jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@${SETUP_SHA} # v4.4.0`), []);
});

test("quoted uses values are inspected", () => {
  assert.deepEqual(inspect(`jobs:\n  test:\n    steps:\n      - uses: 'actions/setup-node@${SETUP_SHA}' # v4.4.0`), []);
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: \"actions/setup-node@main\""), [ACTION_PIN_RULE_ID]);
});

test("multiline uses values fail closed", () => {
  const source = "jobs:\n  test:\n    steps:\n      - uses: >-\n          actions/setup-node@main";
  assert.deepEqual(codes(source), [ACTION_PIN_RULE_ID]);
});

test("checkout requires persist-credentials false", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("checkout rejects persist-credentials true", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          persist-credentials: true`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("checkout rejects duplicate persist-credentials declarations", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          persist-credentials: false\n          persist-credentials: true`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("checkout rejects duplicate with mappings", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        with:\n          persist-credentials: false\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          persist-credentials: false`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("checkout ignores similarly named values outside its with block", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        env:\n          persist-credentials: false`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("named checkout with disabled persisted credentials passes", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          persist-credentials: false`;
  assert.deepEqual(inspect(source), []);
});

test("checkout mapping key order is irrelevant", () => {
  const source = `jobs:\n  test:\n    steps:\n      - with:\n          persist-credentials: false\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2`;
  assert.deepEqual(inspect(source), []);
});

test("direct uses checkout syntax accepts its nested with block", () => {
  const source = `jobs:\n  test:\n    steps:\n      - uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          fetch-depth: 1\n          persist-credentials: false`;
  assert.deepEqual(inspect(source), []);
});

test("nested checkout input cannot impersonate direct persist-credentials", () => {
  const source = `jobs:\n  test:\n    steps:\n      - uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          nested:\n            persist-credentials: false`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("isolated inspection fails closed on unresolved local actions", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: ./.github/actions/test"), [LOCAL_ACTION_SCAN_RULE_ID]);
});

test("container actions require immutable digests", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: docker://alpine:3.20"), [ACTION_PIN_RULE_ID]);
});

test("pinned container actions require readable version comments", () => {
  assert.deepEqual(codes(`jobs:\n  test:\n    steps:\n      - uses: docker://alpine@sha256:${DOCKER_DIGEST}`), [ACTION_VERSION_RULE_ID]);
  assert.deepEqual(inspect(`jobs:\n  test:\n    steps:\n      - uses: docker://alpine@sha256:${DOCKER_DIGEST} # v3.20.0`), []);
});

test("recursive discovery scans nested yaml workflows", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/nested/branch-ref.yaml", workflowUsing("actions/setup-node@main"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.equal(result.workflowCount, 1);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].path, ".github/workflows/nested/branch-ref.yaml");
  assert.equal(result.violations[0].code, ACTION_PIN_RULE_ID);
});

test("local composite actions expose floating third-party dependencies", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
  await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", compositeUsing("vendor/action@main"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.equal(result.localActionCount, 1);
  assert.deepEqual(result.violations.map(({ code }) => code), [ACTION_PIN_RULE_ID]);
  assert.equal(result.violations[0].path, ".github/actions/build/action.yml");
});

test("nested local action chains are scanned transitively", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/a"));
  await writeRepositoryFile(rootDir, ".github/actions/a/action.yml", compositeUsing("./.github/actions/b"));
  await writeRepositoryFile(rootDir, ".github/actions/b/action.yaml", compositeUsing("vendor/action@v2"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.equal(result.localActionCount, 2);
  assert.deepEqual(result.violations.map(({ code }) => code), [ACTION_PIN_RULE_ID]);
  assert.equal(result.violations[0].path, ".github/actions/b/action.yaml");
});

test("fully pinned local composite actions pass dependency closure", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
  await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", compositeUsing(`actions/setup-node@${SETUP_SHA} # v4.4.0`));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.equal(result.workflowCount, 1);
  assert.equal(result.localActionCount, 1);
  assert.deepEqual(result.violations, []);
});

test("flow-style local composite steps fail closed", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
  await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", "name: Flow action\nruns:\n  using: composite\n  steps: [{ uses: vendor/action@main }]\n");

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_YAML_STRUCTURE_RULE_ID]);
  assert.match(result.violations[0].reason, /flow-style YAML/);
});

test("local action YAML anchors aliases and merge keys fail closed", async (t) => {
  for (const [name, manifest] of [
    ["anchor", "name: Anchor action\ndefaults: &defaults\n  uses: vendor/action@main\nruns:\n  using: composite\n  steps: []\n"],
    ["alias", "name: Alias action\ndefaults: *defaults\nruns:\n  using: composite\n  steps: []\n"],
    ["merge", "name: Merge action\n\"<<\": *defaults\nruns:\n  using: composite\n  steps: []\n"],
  ]) {
    const rootDir = await createRepository(t);
    await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
    await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", manifest);
    const result = await scanActionPinningPolicy({ rootDir });
    assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_YAML_STRUCTURE_RULE_ID], name);
  }
});

test("local action YAML tags fail closed", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
  await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", "name: Tagged action\nmetadata: !custom value\nruns:\n  using: composite\n  steps: []\n");

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_YAML_STRUCTURE_RULE_ID]);
  assert.match(result.violations[0].reason, /YAML tags/);
});

test("quoted punctuation and block scalar scripts do not trigger structural findings", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/build"));
  await writeRepositoryFile(rootDir, ".github/actions/build/action.yml", `name: Safe action\ndescription: "Shows [brackets], & anchors, * aliases and ! tags as text"\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        values=(one two)\n        echo safe\n    - uses: actions/setup-node@${SETUP_SHA} # v4.4.0\n`);

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations, []);
});

test("local action dependency cycles fail closed", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/a"));
  await writeRepositoryFile(rootDir, ".github/actions/a/action.yml", compositeUsing("./.github/actions/b"));
  await writeRepositoryFile(rootDir, ".github/actions/b/action.yml", compositeUsing("./.github/actions/a"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_CYCLE_RULE_ID]);
  assert.equal(result.violations[0].path, ".github/actions/b/action.yml");
});

test("local action paths cannot escape the repository", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./../outside"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_PATH_RULE_ID]);
});

test("missing local action manifests fail closed", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/missing"));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_MANIFEST_RULE_ID]);
});

test("ambiguous local action manifests fail closed", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/ambiguous"));
  await writeRepositoryFile(rootDir, ".github/actions/ambiguous/action.yml", compositeUsing(`actions/setup-node@${SETUP_SHA} # v4.4.0`));
  await writeRepositoryFile(rootDir, ".github/actions/ambiguous/action.yaml", compositeUsing(`actions/setup-node@${SETUP_SHA} # v4.4.0`));

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_ACTION_MANIFEST_RULE_ID]);
});

test("local Docker actions fail closed until Dockerfile dependencies are scanned", async (t) => {
  const rootDir = await createRepository(t);
  await writeRepositoryFile(rootDir, ".github/workflows/ci.yml", workflowUsing("./.github/actions/docker"));
  await writeRepositoryFile(rootDir, ".github/actions/docker/action.yml", "name: Docker action\ndescription: Local Docker action\nruns:\n  using: docker\n  image: Dockerfile\n");

  const result = await scanActionPinningPolicy({ rootDir });
  assert.deepEqual(result.violations.map(({ code }) => code), [LOCAL_DOCKER_ACTION_RULE_ID]);
});
