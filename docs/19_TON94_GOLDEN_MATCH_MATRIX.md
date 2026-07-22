# TON-94 Golden-Match Stabilization Matrix

## Baseline and policy

- audited current-main baseline: `5202e53f79953f8e72788177f21cd5a6814c6b51`;
- active incident: TON-94 / GitHub #100;
- TON-85 and PR #99 remain frozen;
- this phase inventories and reproduces defects before broad repairs;
- a green unit/adapter contract is not accepted as live product parity evidence;
- a missing automated assertion is recorded as a **validation gap**, not falsely reported as a reproduced product defect;
- every confirmed P0/P1 repair must later receive a focused regression that fails on this baseline.

## Severity and status

- **P0** — game cannot start/continue or authoritative match state is corrupted;
- **P1** — core playable flow, visible match parity, scoring/replay or lifecycle is materially wrong;
- **P2** — degraded feedback or presentation with a viable core flow;
- **COVERED** — objective current-main browser evidence exists;
- **GAP** — the current required lane does not prove the contract;
- **REPRODUCED** — a deterministic current-main flow has failed and durable evidence exists;
- **PENDING MANUAL** — PO evidence exists but the automated flow has not reproduced or isolated the first broken boundary yet.

## Current-main matrix

| ID | Area | Required objective flow | Current evidence | Status | Severity if failed | First owning boundary |
| --- | --- | --- | --- | --- | --- | --- |
| GM-01 | Startup and menu | clean boot → main menu → quick-match setup | `smoke.spec.mjs` proves clean WebGL composition and menu routing | COVERED | P0 | browser bootstrap / UI shell |
| GM-02 | WebGL match lifecycle | setup → match → kickoff complete → movement → pause → resume | required browser smoke covers this on desktop and narrow viewport | COVERED | P0 | input → engine → presentation composition |
| GM-03 | Forced Canvas playable lifecycle | Canvas boot → actual match start → movement → pause → restart | existing smoke only boots Canvas in menu and checks projection diagnostics | GAP | P1 | Canvas renderer / shared projection / UI lifecycle |
| GM-04 | Normal asset appearance | real GLB load → 12 rigs → differentiated home/away/keeper kit and real boots during play | TON-93 has focused normal-asset evidence, but it is not part of an integrated golden-match lifecycle | GAP | P1 | player model view / rig kit overlay |
| GM-05 | Representative controls | move, switch, pass, through ball, shot, tackle/press, sprint and possession/stat changes | engine/input units exist; required browser smoke proves movement only | GAP | P1 | input adapter / MatchEngine action routing |
| GM-06 | Natural goal chronology | command-driven shot → natural score → goal/score cards → exact replay incident → coherent kickoff | current browser goal test calls `recordGoalForE2E`; its harness explicitly says it is not natural-scoring acceptance evidence | GAP | P1 | input/engine scoring → goal presentation → replay projection |
| GM-07 | Replay isolation | first goal completes → later goal uses only its own buildup/shot/goal/aftermath | deterministic adapter regression exists, but no full browser golden-match flow proves it | GAP | P1 | replay incident index / immutable projection |
| GM-08 | Restart and second match | active match → restart → score/tick reset → main menu → second match | pause/resume is covered; restart and second-match lifecycle are not required CI evidence | GAP | P1 | UI lifecycle / runtime reset / presentation reset |
| GM-09 | HUD, radar and statistics | live score/clock/player/radar/possession/shots/pass accuracy remain coherent through actions, goal and restart | isolated DOM projection and smoke assertions exist; the full chronology is not covered | GAP | P1 | HUD/radar adapters / immutable snapshots |
| GM-10 | Settings and feedback | pitch/ball/weather/sound preferences plus audio/particles/trails/charge enabled, disabled, reset and missing-capability paths | TON-84 adapter tests are green; no integrated playable golden-match evidence | GAP | P2 | settings/effects adapters |
| GM-11 | Narrow viewport | 844×390 startup → match → controls/HUD/radar → pause/resume with no overflow | current smoke proves basic match and no horizontal overflow | COVERED (partial) | P1 | responsive presentation shell |
| GM-12 | Errors/assets/fallbacks | no uncaught errors; missing character/animation/audio/WebGL capabilities fail locally and remain recoverable | required smoke captures console/page errors; focused lifecycle tests cover several missing-capability paths | COVERED (partial) | P0/P1 | owning adapter fallback |
| GM-13 | Full Time | natural clock completion → result UI → teardown/restart/new match | no current required browser evidence | GAP | P1 | MatchEngine lifecycle / UI shell |

## PO-reported live regressions

The PO reports broad visible defects on the playable build after TON-93 and TON-84. Those observations remain blocking product evidence. Until a matrix row is reproduced by the automated golden flow or receives exact manual evidence, it remains `PENDING MANUAL` rather than being converted into an unsupported technical diagnosis.

## Phase-1 executable evidence

`tests/e2e/golden-match.spec.mjs` adds the first incident lane:

1. normal asset-mode WebGL boot with 12 real rigs and explicit kit/boot geometry;
2. real match start, kickoff completion and movement;
3. command-driven natural shot using the existing deterministic formation override — no direct score mutation API;
4. natural score, goal presentation, replay activation/completion and kickoff recovery;
5. pause/restart and second-match reset;
6. forced-Canvas actual match start, movement, pause and restart;
7. uncaught console/page errors collected for both modes.

A failing assertion is incident evidence, not permission to weaken the test. The failure must be recorded with exact head, steps, expected/actual, first broken boundary and artifact before a bounded repair begins.

## Recovery sequencing

1. Run the golden-match lane unchanged against the baseline branch.
2. Record the first deterministic P0/P1 failure in this matrix and on TON-94 / GitHub #100.
3. Repair one first-broken-boundary cluster only.
4. Keep the new regression and rerun the complete golden lane.
5. Repeat until no P0/P1 remains.
6. Only then may PM consider TON-72 execution and eventual TON-85 reactivation.
