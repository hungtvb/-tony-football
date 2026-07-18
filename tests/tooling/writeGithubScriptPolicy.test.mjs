import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectWriteGithubScriptPolicy,
  WRITE_GITHUB_SCRIPT_RULE_ID,
} from "../../scripts/check-write-github-script-policy.mjs";

const yaml = (...lines) => `${lines.join("\n")}\n`;

function inspect(source) {
  return inspectWriteGithubScriptPolicy({
    workflowPath: ".github/workflows/release.yml",
    source,
  });
}

test("write jobs reject GitHub Script regardless of script spelling", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    permissions: { contents: write }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/github-script@v7",
    "        with:",
    "          script: |",
    "            const load = require;",
    "            load(['.', 'publish.cjs'].join('/'));",
  );

  assert.deepEqual(inspect(source), [{
    path: ".github/workflows/release.yml",
    jobId: "publish",
    ruleId: WRITE_GITHUB_SCRIPT_RULE_ID,
    code: WRITE_GITHUB_SCRIPT_RULE_ID,
    reason: "a contents:write job may not use actions/github-script",
    message: "a contents:write job may not use actions/github-script",
    line: 7,
  }]);
});

test("quoted GitHub Script action values are also rejected in write jobs", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    permissions:",
    "      contents: write",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: 'actions/github-script@v7'",
  );

  assert.equal(inspect(source)[0]?.code, WRITE_GITHUB_SCRIPT_RULE_ID);
});

test("jobs inherit workflow-level contents write", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "permissions:",
    "  contents: write",
    "jobs:",
    "  publish:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/github-script@v7",
  );

  assert.equal(inspect(source)[0]?.code, WRITE_GITHUB_SCRIPT_RULE_ID);
});

test("workflow-level permissions are detected even when declared after jobs", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/github-script@v7",
    "permissions:",
    "  contents: write",
  );

  assert.equal(inspect(source)[0]?.code, WRITE_GITHUB_SCRIPT_RULE_ID);
});

test("nested action inputs cannot hide a later job-level write grant", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: acme/configure@v1",
    "        with:",
    "          permissions:",
    "            contents: read",
    "      - uses: actions/github-script@v7",
    "    permissions:",
    "      contents: write",
  );

  assert.equal(inspect(source)[0]?.code, WRITE_GITHUB_SCRIPT_RULE_ID);
});

test("job-level read permissions override workflow-level write permissions", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "permissions: { contents: write }",
    "jobs:",
    "  inspect:",
    "    permissions: { contents: read }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/github-script@v7",
  );

  assert.deepEqual(inspect(source), []);
});

test("GitHub Script remains allowed in a separate read-only job", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    permissions: { contents: write }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: gh release create v1 asset.zip",
    "  inspect:",
    "    permissions: { contents: read }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/github-script@v7",
    "        with:",
    "          script: console.log('read only')",
  );

  assert.deepEqual(inspect(source), []);
});
