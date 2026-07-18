import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  inspectWorkflow,
  parseWorkflowPolicyAllowlist,
  scanWorkflowPolicy,
} from "../../scripts/check-workflow-policy.mjs";

const rootUrl = new URL("../../", import.meta.url);
const fixtureUrl = new URL("../fixtures/workflow-policy/", import.meta.url);

async function fixture(name) {
  return readFile(new URL(name, fixtureUrl), "utf8");
}

function codes(result) {
  return result.violations.map((violation) => violation.code).sort();
}

test("repository workflows pass the required policy gate", async () => {
  const result = await scanWorkflowPolicy({ rootDir: fileURLToPath(rootUrl) });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations, null, 2));
  assert.ok(result.workflowCount >= 2);
});

test("normal read-only CI fixture passes", async () => {
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/ci.yml",
    source: await fixture("read-only-ci.yml"),
  });
  assert.deepEqual(result.triggers, ["pull_request", "push"]);
  assert.deepEqual(result.violations, []);
});

test("unallowlisted contents write fixture fails", async () => {
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/write-ci.yml",
    source: await fixture("blocked-write.yml"),
  });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write"]);
});

test("self-applying encoded patch fixture fails every transport boundary", async () => {
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/patch-transport.yml",
    source: await fixture("blocked-patch-transport.yml"),
  });
  assert.deepEqual(codes(result), [
    "direct-git-push",
    "encoded-patch-transport",
    "rewrite-and-publish",
    "source-patch-application",
    "unallowlisted-contents-write",
    "workflow-self-commit",
    "workflow-self-delete",
  ]);
});

test("exact path-scoped release writer exception passes without transport commands", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source: await fixture("allowed-release.yml"),
    allowlist,
  });
  assert.equal(result.allowlisted, true);
  assert.deepEqual(result.triggers, ["workflow_dispatch"]);
  assert.deepEqual(result.violations, []);
});

test("allowlist cannot silently broaden to an undeclared trigger", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source: (await fixture("allowed-release.yml")).replace("workflow_dispatch:", "push:"),
    allowlist,
  });
  assert.deepEqual(codes(result), ["exception-trigger-mismatch"]);
});

test("allowlist compares every top-level GitHub event, not a fixed trigger shortlist", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source: (await fixture("allowed-release.yml")).replace("workflow_dispatch:", "issues:"),
    allowlist,
  });
  assert.deepEqual(result.triggers, ["issues"]);
  assert.deepEqual(codes(result), ["exception-trigger-mismatch"]);
});

test("allowlist entries require review metadata and exact workflow paths", () => {
  assert.throws(
    () => parseWorkflowPolicyAllowlist(JSON.stringify({ version: 1, exceptions: [{ path: "release.yml" }] })),
    /exact \.github\/workflows/,
  );
});

test("write-all is treated as repository write permission", () => {
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/write-all.yml",
    source: "name: Write all\non: [pull_request]\npermissions: write-all\njobs: {}\n",
  });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write"]);
});

test("non-patch base64 decoding without repository publication is not rejected", () => {
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/decode-artifact.yml",
    source: "name: Decode artifact\non: [workflow_dispatch]\npermissions:\n  contents: read\njobs:\n  decode:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo $ASSET | base64 --decode > artifact.bin\n",
  });
  assert.deepEqual(result.violations, []);
});

test("an exception becomes invalid when its workflow no longer needs write access", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source: (await fixture("allowed-release.yml")).replace("contents: write", "contents: read"),
    allowlist,
  });
  assert.deepEqual(codes(result), ["unused-exception"]);
});
