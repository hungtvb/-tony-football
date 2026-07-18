import assert from "node:assert/strict";
import test from "node:test";

import { ACTION_PIN_RULE_ID, ACTION_VERSION_RULE_ID, CHECKOUT_CREDENTIAL_RULE_ID, inspectActionPinningPolicy } from "../../scripts/check-action-pinning-policy.mjs";

const inspect = (source) => inspectActionPinningPolicy({ workflowPath: ".github/workflows/ci.yml", source: `${source}\n` });
const codes = (source) => inspect(source).map(({ code }) => code);

test("floating third-party action tags are rejected", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4"), [ACTION_PIN_RULE_ID]);
});

test("full SHA pins require readable semantic-version comments", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"), [ACTION_VERSION_RULE_ID]);
});

test("checkout requires persist-credentials false", () => {
  const source = "jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2";
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("checkout does not accept a similarly named value outside its with block", () => {
  const source = "jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2\n        env:\n          persist-credentials: false";
  assert.deepEqual(codes(source), [CHECKOUT_CREDENTIAL_RULE_ID]);
});

test("pinned checkout with disabled persisted credentials passes", () => {
  const source = "jobs:\n  test:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2\n        with:\n          persist-credentials: false";
  assert.deepEqual(inspect(source), []);
});

test("local actions do not require third-party pins", () => {
  assert.deepEqual(inspect("jobs:\n  test:\n    steps:\n      - uses: ./.github/actions/test"), []);
});

test("container actions require immutable digests", () => {
  assert.deepEqual(codes("jobs:\n  test:\n    steps:\n      - uses: docker://alpine:3.20"), [ACTION_PIN_RULE_ID]);
});
