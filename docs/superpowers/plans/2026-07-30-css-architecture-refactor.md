# TON-37 CSS Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every production stylesheet under `src/styles/` with responsibility-based names, one ordered static entry point, and presentation-owned lazy styles while preserving the approved UI.

**Architecture:** `index.html` loads only `src/styles/app.css`, whose imports preserve the current static cascade. Intro, goal, and post-match styles remain separate and are resolved relative to their owning presentation modules. A source-level architecture test protects filenames, order, paths, and absence of root production CSS.

**Tech Stack:** Static HTML/CSS, ES modules, Node.js test runner, Playwright, recursive static build.

## Global Constraints

- Preserve the approved local visual refinements and current responsive behavior.
- Preserve static Vercel and GitHub Pages deployment.
- Do not change gameplay, simulation, FO4 controls, player models, WebGL, Canvas, or TON-85 bridge ownership.
- Do not add Sass, PostCSS, a runtime bundler, or CSS-in-JS.
- Do not rename selectors unless required to remove a verified duplicate.
- Keep existing user-authored working-tree changes intact.

---

### Task 1: Guard the target stylesheet architecture

**Files:**
- Create: `tests/tooling/cssArchitecture.test.mjs`

**Interfaces:**
- Consumes: repository files through `node:fs/promises`.
- Produces: a source-level contract for `src/styles/app.css`, HTML loading, lazy flow paths, and obsolete-file removal.

- [ ] **Step 1: Write the failing architecture test**

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("CSS uses one ordered static entry and presentation-owned lazy styles", async () => {
  const [index, app, intro, goal, post] = await Promise.all([
    read("index.html"),
    read("src/styles/app.css"),
    read("src/game/presentation/MatchIntroFlow.js"),
    read("src/game/presentation/GoalPresentationFlow.js"),
    read("src/game/presentation/PostMatchHub.js"),
  ]);

  assert.deepEqual(
    [...app.matchAll(/@import url\\("\\.\\/(.+?\\.css)"\\);/g)].map((match) => match[1]),
    ["tokens.css", "foundation.css", "match.css", "match-flow.css"],
  );
  assert.deepEqual(
    [...index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]),
    ["src/styles/app.css"],
  );
  assert.match(intro, /new URL\\("\\.\\.\\/\\.\\.\\/styles\\/match-intro\\.css", import\\.meta\\.url\\)/);
  assert.match(goal, /new URL\\("\\.\\.\\/\\.\\.\\/styles\\/goal-presentation\\.css", import\\.meta\\.url\\)/);
  assert.match(post, /new URL\\("\\.\\.\\/\\.\\.\\/styles\\/post-match\\.css", import\\.meta\\.url\\)/);
});

test("production styles no longer live at repository root", async () => {
  for (const path of [
    "style.css",
    "u1-match-experience.css",
    "u3-camera-hud.css",
    "u3-match-flow.css",
    "u3-match-intro.css",
    "u3-goal-presentation.css",
    "u3-post-match.css",
    "css/style.css",
  ]) {
    await assert.rejects(access(new URL(path, root)));
  }
});
```

- [ ] **Step 2: Run the test and verify the target contract is absent**

Run: `node --test tests/tooling/cssArchitecture.test.mjs`

Expected: FAIL because `src/styles/app.css` does not exist.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/tooling/cssArchitecture.test.mjs
git commit -m "test(ton-37): guard CSS architecture"
```

### Task 2: Migrate CSS and update all runtime references

**Files:**
- Create: `src/styles/app.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/foundation.css`
- Create: `src/styles/match.css`
- Create: `src/styles/match-flow.css`
- Create: `src/styles/match-intro.css`
- Create: `src/styles/goal-presentation.css`
- Create: `src/styles/post-match.css`
- Modify: `index.html`
- Modify: `src/game/presentation/MatchIntroFlow.js`
- Modify: `src/game/presentation/GoalPresentationFlow.js`
- Modify: `src/game/presentation/PostMatchHub.js`
- Modify: `tests/presentation/cameraHudRuntime.test.mjs`
- Modify: `tests/presentation/hudPolishRuntime.test.mjs`
- Modify: `tests/presentation/matchFlowRuntime.test.mjs`
- Modify: `tests/presentation/matchIntroRuntime.test.mjs`
- Modify: `tests/presentation/goalPresentationRuntime.test.mjs`
- Modify: `scripts/validate-assets.mjs`
- Delete: `style.css`
- Delete: `u1-match-experience.css`
- Delete: `u3-camera-hud.css`
- Delete: `u3-match-flow.css`
- Delete: `u3-match-intro.css`
- Delete: `u3-goal-presentation.css`
- Delete: `u3-post-match.css`
- Delete: `css/style.css`

**Interfaces:**
- Consumes: existing selectors/classes/data attributes and `import.meta.url`.
- Produces: `src/styles/app.css` as the sole static entry and three module-relative lazy style URLs.

- [ ] **Step 1: Create the ordered static entry**

```css
@import url("./tokens.css");
@import url("./foundation.css");
@import url("./match.css");
@import url("./match-flow.css");
```

- [ ] **Step 2: Split the canonical core without reordering rules**

Move the complete `:root { ... }` block from `css/style.css` into `src/styles/tokens.css`. Move every remaining byte of the approved canonical core into `src/styles/foundation.css`, retaining its rule and media-query order.

- [ ] **Step 3: Consolidate the match layers in cascade order**

Create `src/styles/match.css` by appending the complete approved `u1-match-experience.css` bytes, one newline, then the complete approved `u3-camera-hud.css` bytes. Change only their first-line ownership comments to `/* Match experience and HUD */` and `/* Camera and HUD refinements */`; no selector or declaration may be omitted.

- [ ] **Step 4: Move responsibility-specific styles**

Copy the complete approved contents without selector rewrites:

```text
u3-match-flow.css        → src/styles/match-flow.css
u3-match-intro.css       → src/styles/match-intro.css
u3-goal-presentation.css → src/styles/goal-presentation.css
u3-post-match.css        → src/styles/post-match.css
```

Replace sprint-history file headers with responsibility headers such as `/* Match flow */`.

- [ ] **Step 5: Update static and lazy runtime paths**

Use the single HTML link:

```html
<link rel="stylesheet" href="src/styles/app.css" />
```

Use these exact module-relative URLs:

```js
new URL("../../styles/match-intro.css", import.meta.url).href
new URL("../../styles/goal-presentation.css", import.meta.url).href
new URL("../../styles/post-match.css", import.meta.url).href
```

Rename link markers from `data-u3-*` to responsibility names (`data-match-intro`, `data-goal-presentation`, and `data-post-match`) in both selectors and dataset assignments.

- [ ] **Step 6: Update tests and asset validation**

Read shared match/HUD rules from `../../src/styles/match.css`, flow styles from the matching `src/styles/*.css` files, assert `src/styles/app.css` in `index.html`, and replace the asset contract `"u1-match-experience.css"` with `"src/styles/app.css"`.

- [ ] **Step 7: Remove obsolete source paths**

Delete the seven root production stylesheets and `css/style.css` only after their approved contents exist in `src/styles/`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test tests/tooling/cssArchitecture.test.mjs
node --test tests/presentation/cameraHudRuntime.test.mjs tests/presentation/hudPolishRuntime.test.mjs tests/presentation/matchFlowRuntime.test.mjs tests/presentation/matchIntroRuntime.test.mjs tests/presentation/goalPresentationRuntime.test.mjs
node scripts/validate-assets.mjs
```

Expected: all tests pass and asset validation prints the successful player/presentation contract line.

- [ ] **Step 9: Commit the migration**

```bash
git add index.html src/styles src/game/presentation tests scripts/validate-assets.mjs
git add -u -- style.css u1-match-experience.css u3-camera-hud.css u3-match-flow.css u3-match-intro.css u3-goal-presentation.css u3-post-match.css
git commit -m "refactor(ton-37): consolidate CSS under src styles"
```

### Task 3: Document ownership and verify the complete delivery

**Files:**
- Modify: `docs/11_SOURCE_MAP.md`
- Move: `AI-UI-REFINEMENTS.md` → `docs/ui/VISUAL_STYLE.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: final stylesheet structure and exact test evidence.
- Produces: durable source ownership documentation and a verified local commit.

- [ ] **Step 1: Add CSS ownership to the source map**

Add entries describing:

```text
src/styles/app.css
  → only static stylesheet entry; explicit import order
src/styles/tokens.css + foundation.css
  → theme primitives and shared browser UI foundation
src/styles/match.css + match-flow.css
  → match/HUD and menu/setup/pause presentation
src/styles/match-intro.css + goal-presentation.css + post-match.css
  → lazy styles owned by their matching presentation flows
```

Move the approved visual-refinement rationale to `docs/ui/VISUAL_STYLE.md` and ignore the local `.superpowers/` brainstorming runtime so the task branch remains clean without deleting its generated visual artifacts.

- [ ] **Step 2: Run source and whitespace checks**

Run:

```bash
rg -n "u1-match-experience\\.css|u3-(camera-hud|goal-presentation|match-flow|match-intro|post-match)\\.css|href=\"style\\.css\"" --glob "!docs/superpowers/**" --glob "!AI-UI-REFINEMENTS.md"
git diff --check
```

Expected: `rg` returns no production/test references and `git diff --check` returns no errors.

- [ ] **Step 3: Run the full fast gate**

Run: `npm run test:ci:fast`

Expected: PASS for syntax, assets, engine, presentation, tooling, and static build. On Windows, use the repository's verified Python alias/line-ending preparation workaround if the existing `python3` script assumption fails; do not modify production code to mask that environment issue.

- [ ] **Step 4: Run browser smoke**

Run:

```bash
npm run test:e2e:smoke
npx playwright test tests/e2e/match-intro.spec.mjs tests/e2e/goal-presentation.spec.mjs --project=desktop-chromium
npx playwright test tests/e2e/smoke.spec.mjs --project=narrow-landscape
```

Expected: all selected flows pass with no missing stylesheet request or browser console error.

- [ ] **Step 5: Review the final diff and commit documentation**

```bash
git status --short
git diff --stat HEAD
git diff --check
git add docs/11_SOURCE_MAP.md docs/ui/VISUAL_STYLE.md .gitignore
git commit -m "docs(ton-37): record stylesheet ownership"
```

- [ ] **Step 6: Record final evidence**

Post the branch, exact local head SHA, changed files, commands/results, limitations, and next owner to Linear TON-37. Do not mark Done because the user requested a tested local commit, not publish/PR/merge.
