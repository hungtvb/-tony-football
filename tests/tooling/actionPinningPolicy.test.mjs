import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ACTION_PIN_RULE_ID,
  ACTION_VERSION_RULE_ID,
  CHECKOUT_CREDENTIAL_RULE_ID,
  inspectActionPinningPolicy,
  scanActionPinningPolicy,
} from "../../scripts/check-action-pinning-policy.mjs";

const SETUP_SHA = "49933ea5288caeca8642d1e84afbd3f7d6820020";
const CHECKOUT_SHA = "11bd71901bbe5b1630ceea73d27597364c9af683";
const DOCKER_DIGEST = "a".repeat(64);
const inspect = (source) => inspectActionPinningPolicy({ workflowPath: ".github/workflows/ci.yml", source: `${source}\n` });
const codes = (source) => inspect(source).map(({ code }) => code);

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

test("checkout ignores similarly named values outside its with block", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        env:\n          persist-credentials: false`;
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("named checkout with disabled persisted credentials passes", () => {
  const source = `jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2\n        with:\n          persist-credentials: false`;
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

test("local actions do not require third-party pins", () => {
  assert.deepEqual(inspect("jobs:\n  test:\n    steps:\n      - uses: ./.github/actions/test"), []);
});

test("container actions require immutable digests", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: docker://alpine:3.20"), [ACTION_PIN_RULE_ID]);
});

test("pinned container actions require readable version comments", () => {
  assert.deepEqual(codes(`jobs:\n  test:\n    steps:\n      - uses: docker://alpine@sha256:${DOCKER_DIGEST}`), [ACTION_VERSION_RULE_ID]);
  assert.deepEqual(inspect(`jobs:\n  test:\n    steps:\n      - uses: docker://alpine@sha256:${DOCKER_DIGEST} # v3.20.0`), []);
});

test("recursive discovery scans nested yaml workflows", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "tony-action-pins-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const workflowDir = path.join(rootDir, ".github", "workflows", "nested");
  await mkdir(workflowDir, { recursive: true });
  await writeFile(path.join(workflowDir, "branch-ref.yaml"), "jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@main\n", "utf8");

  const result = await scanActionPinningPolicy({ rootDir });
  assert.equal(result.workflowCount, 1);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].path, ".github/workflows/nested/branch-ref.yaml");
  assert.equal(result.violations[0].code, ACTION_PIN_RULE_ID);
});
