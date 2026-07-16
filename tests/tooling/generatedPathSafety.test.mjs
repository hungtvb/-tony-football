import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const generatedRoot = path.join(repositoryRoot, ".local-runtime");
const bootstrapPath = path.join(repositoryRoot, "scripts/bootstrap-local-playwright.sh");
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

function bootstrapArgs(workspace, browserRoot) {
  return [
    bootstrapPath,
    "missing-runtime.zip",
    "missing-browser.zip",
    "--expected-main-sha",
    "a".repeat(40),
    "--workspace",
    workspace,
    "--browser-root",
    browserRoot,
  ];
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

test("bootstrap rejects traversal before artifacts or outside files can be touched", () => {
  mkdirSync(generatedRoot, { recursive: true });
  const outside = path.join(repositoryRoot, `outside-ton10-${process.pid}-${Date.now()}`);
  const traversalWorkspace = `${generatedRoot}/../${path.basename(outside)}`;
  const browserRoot = uniqueGeneratedPath("traversal-browser");

  try {
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, "sentinel.txt"), "outside-safe\n");

    const result = run("bash", bootstrapArgs(traversalWorkspace, browserRoot));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /traversal segment/i);
    assert.equal(readFileSync(path.join(outside, "sentinel.txt"), "utf8"), "outside-safe\n");
    assert.equal(existsSync(browserRoot), false);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(browserRoot, { recursive: true, force: true });
  }
});

test(
  "bootstrap rejects symlinked workspace and browser targets before mutation",
  { skip: process.platform === "win32" },
  () => {
    mkdirSync(generatedRoot, { recursive: true });
    const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-ton10-symlink-"));
    const outsideWorkspace = path.join(temporary, "outside-workspace");
    const outsideBrowser = path.join(temporary, "outside-browser");
    const workspaceLink = uniqueGeneratedPath("workspace-link");
    const browserLink = uniqueGeneratedPath("browser-link");
    const safeBrowser = uniqueGeneratedPath("safe-browser");
    const safeWorkspace = uniqueGeneratedPath("safe-workspace");

    try {
      mkdirSync(outsideWorkspace);
      mkdirSync(outsideBrowser);
      writeFileSync(path.join(outsideWorkspace, "sentinel.txt"), "workspace-outside-safe\n");
      writeFileSync(path.join(outsideBrowser, "sentinel.txt"), "browser-outside-safe\n");
      symlinkSync(outsideWorkspace, workspaceLink, "dir");
      symlinkSync(outsideBrowser, browserLink, "dir");

      const workspaceResult = run("bash", bootstrapArgs(workspaceLink, safeBrowser));
      assert.notEqual(workspaceResult.status, 0);
      assert.match(workspaceResult.stderr, /symlink boundary/i);
      assert.equal(readFileSync(path.join(outsideWorkspace, "sentinel.txt"), "utf8"), "workspace-outside-safe\n");
      assert.equal(existsSync(safeBrowser), false);

      const browserResult = run("bash", bootstrapArgs(safeWorkspace, browserLink));
      assert.notEqual(browserResult.status, 0);
      assert.match(browserResult.stderr, /symlink boundary/i);
      assert.equal(readFileSync(path.join(outsideBrowser, "sentinel.txt"), "utf8"), "browser-outside-safe\n");
      assert.equal(existsSync(safeWorkspace), false);
    } finally {
      rmSync(workspaceLink, { recursive: true, force: true });
      rmSync(browserLink, { recursive: true, force: true });
      rmSync(safeBrowser, { recursive: true, force: true });
      rmSync(safeWorkspace, { recursive: true, force: true });
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);

test("bootstrap rejects approved roots and overlapping generated targets", () => {
  mkdirSync(generatedRoot, { recursive: true });
  const safeBrowser = uniqueGeneratedPath("root-browser");
  const workspace = uniqueGeneratedPath("overlap-workspace");
  const nestedBrowser = path.join(workspace, "browsers");

  try {
    const rootResult = run("bash", bootstrapArgs(generatedRoot, safeBrowser));
    assert.notEqual(rootResult.status, 0);
    assert.match(rootResult.stderr, /generated root itself/i);
    assert.equal(existsSync(safeBrowser), false);

    const overlapResult = run("bash", bootstrapArgs(workspace, nestedBrowser));
    assert.notEqual(overlapResult.status, 0);
    assert.match(overlapResult.stderr, /distinct and non-overlapping/i);
    assert.equal(existsSync(workspace), false);
  } finally {
    rmSync(safeBrowser, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});

test(
  "sync rejects unsafe browser paths before changing the active Git workspace or outside files",
  { skip: process.platform === "win32" },
  () => {
    mkdirSync(generatedRoot, { recursive: true });
    const workspace = uniqueGeneratedPath("sync-workspace");
    const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-ton10-sync-"));
    const outsideBrowser = path.join(temporary, "outside-browser");
    const browserLink = uniqueGeneratedPath("sync-browser-link");
    const sourceSha = "b".repeat(40);

    try {
      initializeCleanWorkspace(workspace, sourceSha);
      mkdirSync(outsideBrowser);
      writeFileSync(path.join(outsideBrowser, "sentinel.txt"), "browser-outside-safe\n");
      symlinkSync(outsideBrowser, browserLink, "dir");
      const headBefore = run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim();

      const result = run(
        "bash",
        [
          syncPath,
          "missing-runtime.zip",
          "missing-browser.zip",
          "--expected-main-sha",
          sourceSha,
          "--browser-root",
          browserLink,
        ],
        { cwd: workspace, env: { ...process.env, PWD: workspace } },
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /symlink boundary/i);
      assert.equal(readFileSync(path.join(workspace, "sentinel.txt"), "utf8"), "workspace-safe\n");
      assert.equal(run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim(), headBefore);
      assert.equal(readFileSync(path.join(outsideBrowser, "sentinel.txt"), "utf8"), "browser-outside-safe\n");
    } finally {
      rmSync(browserLink, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);

test("sync rejects nested workspace/browser targets before artifact inspection", () => {
  mkdirSync(generatedRoot, { recursive: true });
  const workspace = uniqueGeneratedPath("sync-overlap-workspace");
  const nestedBrowser = path.join(workspace, "browser-cache");
  const sourceSha = "c".repeat(40);

  try {
    initializeCleanWorkspace(workspace, sourceSha);
    const headBefore = run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim();

    const result = run(
      "bash",
      [
        syncPath,
        "missing-runtime.zip",
        "missing-browser.zip",
        "--expected-main-sha",
        sourceSha,
        "--browser-root",
        nestedBrowser,
      ],
      { cwd: workspace, env: { ...process.env, PWD: workspace } },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /distinct and non-overlapping/i);
    assert.equal(readFileSync(path.join(workspace, "sentinel.txt"), "utf8"), "workspace-safe\n");
    assert.equal(run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim(), headBefore);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test(
  "bootstrap rejects a staging root that crosses a symlink boundary",
  { skip: process.platform === "win32" },
  () => {
    mkdirSync(generatedRoot, { recursive: true });
    const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-ton10-staging-"));
    const realTmp = path.join(temporary, "real-tmp");
    const linkedTmp = path.join(temporary, "linked-tmp");
    const workspace = uniqueGeneratedPath("staging-workspace");
    const browserRoot = uniqueGeneratedPath("staging-browser");

    try {
      mkdirSync(realTmp);
      symlinkSync(realTmp, linkedTmp, "dir");
      const result = run("bash", bootstrapArgs(workspace, browserRoot), {
        env: { ...process.env, TMPDIR: linkedTmp },
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Staging root path crosses a symlink boundary/i);
      assert.equal(existsSync(workspace), false);
      assert.equal(existsSync(browserRoot), false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
      rmSync(browserRoot, { recursive: true, force: true });
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);
