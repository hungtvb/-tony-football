import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectWorkflowWithYamlSafety } from "../../scripts/enforce-workflow-policy.mjs";

const fixtureUrl = new URL("../fixtures/workflow-policy/", import.meta.url);
const fixture = (name) => readFile(new URL(name, fixtureUrl), "utf8");

function assertAliasBlocked(result) {
  assert.ok(result.violations.length >= 2);
  assert.ok(result.violations.every(({ code, jobId, line, reason }) => (
    code === "yaml-anchor-alias-unsupported"
    && jobId === "<workflow>"
    && Number.isInteger(line)
    && /(?:anchor|alias)/.test(reason)
  )));
  assert.deepEqual(result.triggers, []);
}

test("aliased permission maps fail closed before permission inspection", async () => {
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-permissions.yml",
    source: await fixture("blocked-aliased-permissions.yml"),
  });
  assertAliasBlocked(result);
});

test("aliased executable job content fails closed before job inspection", async () => {
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-job.yaml",
    source: await fixture("blocked-aliased-job.yaml"),
  });
  assertAliasBlocked(result);
});

test("YAML merge-key aliases fail closed before inherited job inspection", () => {
  const source = `
on: [push]
jobs:
  template: &publisher_job
    runs-on: ubuntu-latest
    steps:
      - run: echo generated
  publish:
    <<: *publisher_job
`;
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-merge.yml",
    source,
  });
  assertAliasBlocked(result);
});

test("anchor-like text in quoted scalars, comments and block scripts is not YAML alias syntax", () => {
  const source = `
on: [workflow_dispatch]
name: "literal &anchor and *alias"
jobs:
  inspect:
    runs-on: ubuntu-latest
    steps:
      # permissions: *write_permissions
      - run: |
          echo '&anchor'
          echo "*alias"
      - run: echo '*inline_alias'
`;
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/literals.yml",
    source,
  });
  assert.deepEqual(result.violations, []);
});
