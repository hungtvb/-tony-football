import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const generatedRoot = path.join(repositoryRoot, ".local-runtime");
const syncPath = path.join(repositoryRoot, "scripts/sync-local-main.sh");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
}

function assertSucceeded(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function uniqueGeneratedPath(name) {
  return path.join(generatedRoot, `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function initializeCleanWorkspace(workspace, sourceSha) {
  mkdirSync(workspace, { recursive: true });
  assertSucceeded(run("git", ["init", "-q", workspace]), "initialize workspace fixture");
  assertSucceeded(run("git", ["-C", workspace, "checkout", "-q", "-B", "main"]), "create main fixture branch");
  assertSucceeded(run("git", ["-C", workspace, "config", "user.name", "Fixture"]), "configure fixture name");
  assertSucceeded(
    run("git", ["-C", workspace, "config", "user.email", "fixture@example.invalid"]),
    "configure fixture email",
  );
  writeFileSync(path.join(workspace, ".local-runtime-sha"), `${sourceSha}\n`);
  writeFileSync(path.join(workspace, "package.json"), '{"name":"fixture","private":true,"type":"module"}\n');
  writeFileSync(path.join(workspace, "sentinel.txt"), "workspace-safe\n");
  assertSucceeded(run("git", ["-C", workspace, "add", "-A"]), "stage workspace fixture");
  assertSucceeded(run("git", ["-C", workspace, "commit", "-q", "-m", "fixture"]), "commit workspace fixture");
}

test(
  "sync rejects a workspace reached through a symlink before inspecting artifacts",
  { skip: process.platform === "win32" },
  () => {
    mkdirSync(generatedRoot, { recursive: true });
    const realWorkspace = uniqueGeneratedPath("sync-real-workspace");
    const workspaceLink = uniqueGeneratedPath("sync-workspace-link");
    const browserRoot = uniqueGeneratedPath("sync-symlink-browser");
    const sourceSha = "d".repeat(40);

    try {
      initializeCleanWorkspace(realWorkspace, sourceSha);
      symlinkSync(realWorkspace, workspaceLink, "dir");
      const headBefore = run("git", ["-C", realWorkspace, "rev-parse", "HEAD"]).stdout.trim();

      const result = run(
        "bash",
        [
          syncPath,
          "missing-runtime.zip",
          "missing-browser.zip",
          "--expected-main-sha",
          sourceSha,
          "--browser-root",
          browserRoot,
        ],
        { cwd: workspaceLink, env: { ...process.env, PWD: workspaceLink } },
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Workspace path crosses a symlink boundary/i);
      assert.equal(readFileSync(path.join(realWorkspace, "sentinel.txt"), "utf8"), "workspace-safe\n");
      assert.equal(run("git", ["-C", realWorkspace, "rev-parse", "HEAD"]).stdout.trim(), headBefore);
      assert.equal(existsSync(browserRoot), false);
    } finally {
      rmSync(workspaceLink, { recursive: true, force: true });
      rmSync(realWorkspace, { recursive: true, force: true });
      rmSync(browserRoot, { recursive: true, force: true });
    }
  },
);
