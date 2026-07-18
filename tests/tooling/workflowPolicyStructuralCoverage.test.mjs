import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectWorkflow,
  parseWorkflowPolicyAllowlist,
  scanWorkflowPolicy,
} from "../../scripts/check-workflow-policy.mjs";

function codes(result) {
  return result.violations.map(({ code }) => code).sort();
}

function exception(overrides = {}) {
  return {
    path: ".github/workflows/release.yml",
    job: "publish",
    owner: "release-maintainers",
    reason: "Publish reviewed release assets",
    reviewIssue: "TON-16",
    allowedTriggers: ["workflow_dispatch"],
    permissions: ["contents:write"],
    ...overrides,
  };
}

function allowlist(entry) {
  return parseWorkflowPolicyAllowlist(JSON.stringify({ version: 1, exceptions: [entry] }));
}

test("recursive repository scan discovers nested yml and yaml workflows", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ton16-policy-"));
  try {
    await mkdir(path.join(root, ".github/workflows/nested"), { recursive: true });
    await writeFile(path.join(root, ".github/workflow-policy-allowlist.json"), '{"version":1,"exceptions":[]}\n');
    await writeFile(path.join(root, ".github/workflows/read-only.yml"), "on: [push]\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n");
    await writeFile(path.join(root, ".github/workflows/nested/unsafe.yaml"), "on: [push]\njobs:\n  publish:\n    permissions: { contents: write }\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo unsafe\n");

    const result = await scanWorkflowPolicy({ rootDir: root });
    assert.equal(result.workflowCount, 2);
    assert.deepEqual(result.results.map(({ path: workflowPath }) => workflowPath), [
      ".github/workflows/nested/unsafe.yaml",
      ".github/workflows/read-only.yml",
    ]);
    assert.deepEqual(result.violations.map(({ path: workflowPath, jobId, code }) => ({ workflowPath, jobId, code })), [
      { workflowPath: ".github/workflows/nested/unsafe.yaml", jobId: "publish", code: "unallowlisted-contents-write" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("flow-style permissions and quoted inline triggers are normalized", () => {
  const source = 'on: ["workflow_dispatch"]\njobs:\n  publish:\n    permissions: { "contents": "write", issues: read }\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo release\n';
  const result = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source,
    allowlist: allowlist(exception()),
  });
  assert.deepEqual(result.triggers, ["workflow_dispatch"]);
  assert.deepEqual(result.violations, []);
});

test("workflow-level write permission cannot be allowlisted", () => {
  const source = "on: [workflow_dispatch]\npermissions: { contents: write }\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo release\n";
  const result = inspectWorkflow({ workflowPath: ".github/workflows/release.yml", source });
  assert.deepEqual(codes(result), ["unallowlisted-contents-write", "workflow-level-contents-write"]);
});

test("high-risk write exceptions require explicit acknowledgement", () => {
  const source = "on: [pull_request_target]\njobs:\n  publish:\n    permissions: { contents: write }\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo release\n";
  const blocked = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source,
    allowlist: allowlist(exception({ allowedTriggers: ["pull_request_target"] })),
  });
  assert.deepEqual(codes(blocked), ["high-risk-write-trigger"]);

  const acknowledged = inspectWorkflow({
    workflowPath: ".github/workflows/release.yml",
    source,
    allowlist: allowlist(exception({ allowedTriggers: ["pull_request_target"], allowHighRiskTriggers: true })),
  });
  assert.deepEqual(acknowledged.violations, []);
});

test("option-prefixed git publication, push actions and createRef API calls are blocked", () => {
  const command = inspectWorkflow({
    workflowPath: ".github/workflows/command.yml",
    source: "on: [push]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git -C . push origin HEAD\n",
  });
  assert.deepEqual(codes(command), ["direct-git-push"]);

  const action = inspectWorkflow({
    workflowPath: ".github/workflows/action.yml",
    source: "on: [push]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ad-m/github-push-action@v1\n",
  });
  assert.deepEqual(codes(action), ["workflow-auto-commit-action"]);

  const api = inspectWorkflow({
    workflowPath: ".github/workflows/api.yml",
    source: "on: [workflow_dispatch]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            await github.rest.git.createRef({ owner: context.repo.owner, repo: context.repo.repo, ref: 'refs/heads/generated', sha: context.sha })\n",
  });
  assert.deepEqual(codes(api), ["github-api-repository-mutation"]);
});

test("inline and block comments cannot manufacture publication violations", () => {
  const source = "on: [workflow_dispatch]\npermissions: { contents: read } # contents: write\njobs:\n  inspect:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          # git push origin HEAD\n          echo safe # git commit -m unsafe\n";
  const result = inspectWorkflow({ workflowPath: ".github/workflows/comments.yml", source });
  assert.deepEqual(result.violations, []);
});
