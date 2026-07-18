import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectWorkflow, parseWorkflowPolicyAllowlist, scanWorkflowPolicy } from "../../scripts/check-workflow-policy.mjs";

const rootUrl = new URL("../../", import.meta.url);
const fixtureUrl = new URL("../fixtures/workflow-policy/", import.meta.url);
const fixture = (name) => readFile(new URL(name, fixtureUrl), "utf8");
const codes = (result) => result.violations.map(({ code }) => code).sort();

test("repository .yml and .yaml workflows pass", async () => {
  const result = await scanWorkflowPolicy({ rootDir: fileURLToPath(rootUrl) });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations, null, 2));
  assert.equal(result.workflowCount, 2);
});

test("comments containing banned terms are ignored", async () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/safe.yaml", source: await fixture("safe-comments.yaml") });
  assert.deepEqual(result.violations, []);
});

test("workflow and job permissions are evaluated independently", async () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/job-write.yaml", source: await fixture("blocked-job-write.yaml") });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write"]);
  assert.equal(result.violations[0].jobId, "publish");
});

test("write-all is always blocked", () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/write-all.yml", source: "on: [pull_request]\npermissions: write-all\njobs: {}\n" });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write", "write-all"]);
  assert.equal(result.violations[0].jobId, "<workflow>");
});

test("transport fixture reports every source-publication boundary", async () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/patch.yml", source: await fixture("blocked-patch-transport.yml") });
  assert.deepEqual(codes(result), ["direct-git-push", "encoded-patch-transport", "rewrite-and-publish", "source-patch-application", "unallowlisted-contents-write", "workflow-self-commit", "workflow-self-delete"]);
  assert.ok(result.violations.every(({ path, jobId, ruleId, reason }) => path && jobId && ruleId && reason));
});

test("auto-commit actions are blocked from uses values", async () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/auto.yml", source: await fixture("blocked-auto-commit.yml") });
  assert.deepEqual(codes(result), ["workflow-auto-commit-action"]);
});

test("Octokit repository mutation is blocked but read-only GitHub Script passes", async () => {
  const blocked = inspectWorkflow({ workflowPath: ".github/workflows/api.yml", source: await fixture("blocked-octokit.yml") });
  const safe = inspectWorkflow({ workflowPath: ".github/workflows/api-read.yml", source: await fixture("safe-github-script.yml") });
  assert.deepEqual(codes(blocked), ["github-api-repository-mutation"]);
  assert.deepEqual(safe.violations, []);
});

test("exact path, job, trigger and permission exception passes", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const result = inspectWorkflow({ workflowPath: ".github/workflows/release.yml", source: await fixture("allowed-release.yml"), allowlist });
  assert.deepEqual(result.triggers, ["workflow_dispatch"]);
  assert.deepEqual(result.violations, []);
});

test("exception cannot cover a different job", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const source = (await fixture("allowed-release.yml")).replace("publish:", "other:");
  const result = inspectWorkflow({ workflowPath: ".github/workflows/release.yml", source, allowlist });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write", "unused-exception"]);
});

test("exception trigger set must match exactly including pull_request_target", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const source = (await fixture("allowed-release.yml")).replace("workflow_dispatch:", "pull_request_target:");
  const result = inspectWorkflow({ workflowPath: ".github/workflows/release.yml", source, allowlist });
  assert.deepEqual(codes(result), ["exception-trigger-mismatch"]);
});

test("transport violations cannot be suppressed by exception", async () => {
  const allowlist = parseWorkflowPolicyAllowlist(await fixture("allowlist.json"));
  const source = `${await fixture("allowed-release.yml")}\n      - run: git push origin HEAD:main\n`;
  const result = inspectWorkflow({ workflowPath: ".github/workflows/release.yml", source, allowlist });
  assert.deepEqual(codes(result), ["direct-git-push"]);
});

test("exception schema rejects missing job and duplicate path/job", () => {
  assert.throws(() => parseWorkflowPolicyAllowlist(JSON.stringify({ version: 1, exceptions: [{ path: ".github/workflows/a.yml" }] })), /requires job/);
  const entry = { path: ".github/workflows/a.yml", job: "x", owner: "o", reason: "r", reviewIssue: "TON-1", allowedTriggers: ["workflow_dispatch"], permissions: ["contents:write"] };
  assert.throws(() => parseWorkflowPolicyAllowlist(JSON.stringify({ version: 1, exceptions: [entry, entry] })), /duplicate/);
});

test("ordinary base64 artifact decode is not treated as patch transport", () => {
  const result = inspectWorkflow({ workflowPath: ".github/workflows/decode.yml", source: "on: [workflow_dispatch]\npermissions:\n  contents: read\njobs:\n  decode:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo $ASSET | base64 --decode > artifact.bin\n" });
  assert.deepEqual(result.violations, []);
});
