# TON-94 Golden-Match Stabilization Matrix

## Baseline and policy

- audited incident baseline: `5202e53f79953f8e72788177f21cd5a6814c6b51`;
- active incident: TON-94 / GitHub #100; PR #101 is the merged bounded Phase-one baseline and the P1 continuation uses a separate branch/PR;
- TON-85 and PR #99 remain frozen;
- a green unit/adapter contract is not accepted as live product-parity evidence;
- a missing automated assertion is a **validation gap**, not a reproduced defect;
- every reproduced P0/P1 repair keeps a focused regression and exact-head browser evidence.

## Status vocabulary

- **P0** — game cannot start/continue or authoritative match state is corrupted;
- **P1** — core playable flow, visible match parity, scoring/replay or lifecycle is materially wrong;
- **P2** — degraded feedback or presentation with a viable core flow;
- **COVERED** — objective required evidence exists on the stabilization branch;
- **COVERED (partial)** — the listed subset is proven but the complete row is not;
- **GAP** — the current required lanes do not prove the complete contract;
- **REPAIRED** — a deterministic defect was reproduced, repaired at its first owning boundary and retained by regression.

## Stabilization checkpoint

Implementation head `bd58ed96fcbd8ab9a4c7eed0621359ac48f91cf8` passed CI #590 / run `29941839610`:

- Unit and contracts — success;
- Browser composition smoke — success;
- Real asset appearance smoke — success;
- Golden match lifecycle — success;
- CI gate — success.

Exact artifacts:

- fast-test evidence `8538509095`;
- browser-smoke evidence `8538562373`;
- golden-match evidence `8538564289`;
- asset-smoke evidence `8538593672`.

The golden artifact was visually inspected. Replay framing looks inward across the penalty area with both teams and goal context visible; stadium roof/stand geometry no longer blocks the incident.

## Matrix

| ID | Area | Required objective flow | Stabilization evidence | Status | Severity if failed | First owning boundary |
| --- | --- | --- | --- | --- | --- | --- |
| GM-01 | Startup and menu | clean boot → main menu → quick-match setup | required browser smoke proves clean composition and menu routing | COVERED | P0 | browser bootstrap / UI shell |
| GM-02 | WebGL match lifecycle | setup → match → kickoff complete → movement → pause/resume | browser smoke covers desktop and narrow viewport | COVERED | P0 | input → engine → presentation composition |
| GM-03 | Forced Canvas playable lifecycle | Canvas boot → actual match → movement → pause → restart | golden lane runs an authoritative Canvas match and verifies shared replay/projection sequence | COVERED | P1 | Canvas renderer / shared projection / UI lifecycle |
| GM-04 | Normal asset appearance | real GLB load → 12 rigs → differentiated kit and real boots during play | dedicated real-asset job now also proves live sprint speed, rig animation state and bounded time scale | COVERED | P1 | `PlayerAssetLoader` attempt timeout / retry boundary |
| GM-05 | Representative controls | move, switch, pass, through ball, shot, tackle/press, sprint and possession/stat changes | required P1 lane records immutable browser-dispatched commands and authoritative possession/stat progression | COVERED | P1 | input adapter / MatchEngine action routing |
| GM-06 | Natural goal chronology | command-driven shot → natural score → cards → exact replay → kickoff | golden lane uses browser input for the score, then proves goal-card, score-card, replay frames and kickoff recovery | COVERED | P1 | input/engine scoring → goal presentation → replay projection |
| GM-07 | Replay isolation | first goal completes → later goal uses only its own incident | required browser lane proves two ordered incidents and a later frozen replay snapshot with only the second score | COVERED | P1 | replay incident index / immutable projection |
| GM-08 | Restart and second match | active match → restart → reset → main menu → second match | golden lane proves restart and a clean second match with zeroed score | COVERED | P1 | UI lifecycle / runtime reset / presentation reset |
| GM-09 | HUD, radar and statistics | score/clock/player/radar/stats remain coherent through actions, goal and restart | required P1 chronology asserts score, clock, stamina, radar repaint, possession, shots and pass UI against engine facts | COVERED | P1 | HUD/radar adapters / immutable snapshots |
| GM-10 | Settings and feedback | pitch/ball/weather/sound plus audio/particles/trails/charge lifecycle | focused TON-84 contracts are green; no single integrated golden flow proves every feedback path | GAP | P2 | settings/effects adapters |
| GM-11 | Narrow viewport | 844×390 startup → match → HUD/radar → pause/resume without overflow | required P1 lane runs forced Canvas on desktop and narrow, with complete HUD/radar/stat and overflow checks | COVERED | P1 | responsive presentation shell |
| GM-12 | Errors/assets/fallbacks | no uncaught errors; missing capabilities remain recoverable | required smoke, restore tests and P1 Canvas lanes capture page/console errors across both viewports | COVERED | P0/P1 | owning adapter fallback |
| GM-13 | Full Time | natural clock completion → result UI → teardown/restart/new match | authoritative browser stepping reaches time zero, verifies result UI/final facts and starts a clean play-again match | COVERED | P1 | MatchEngine lifecycle / UI shell |

## Repaired P1 — GM-04 asset decode timeout

Failing head: `baa42931a00535607afb55311a20ce3a15d22f3c`.

CI #572 showed two complete HTTP 200 GLB responses, but the 10-second timer covered download, Meshopt decode and scene construction. A successful parse was discarded, a second parser started and procedural fallback remained active.

Repair:

- bounded attempt budget increased to 30 seconds;
- two attempts and late-result disposal preserved;
- deterministic budget regression added;
- unchanged normal-asset acceptance subsequently passed in CI #590.

## Repaired P1 — replay camera stadium occlusion

CI #575 proved natural scoring and replay activation but captured the replay camera easing through stadium geometry. Early fixes cleared the roof but still looked outward because replay direction depended on legacy `game.goalSequence`, which can be absent when replay ownership is engine-driven.

Repair:

- replay entry snaps to a bounded stadium-safe pose;
- camera position is exposed through immutable diagnostics;
- goal side is derived from the immutable replay-frame ball position, not legacy mutable state;
- inward framing is retained by migration/source guards;
- golden artifact `8538564289` was visually inspected and accepted.

## Phase-one conclusion

There are no open **reproduced** P0/P1 defects in the covered Phase-one lanes. The P1 continuation closes GM-04/05/07/09/11/12/13 with required executable evidence. P2 GM-10 remains out of this bounded incident scope and must not be interpreted as permission to resume bridge deletion.

Reviewer and SA must review the exact PR head and confirm:

1. the new required jobs cannot be bypassed by the aggregate CI gate;
2. natural score remains browser-command-driven and no direct score mutation is used;
3. post-score deterministic stepping advances authoritative time only;
4. asset timeout and replay-camera repairs stay inside their owning presentation boundaries;
5. TON-85 / PR #99 remains frozen until PM explicitly reactivates it after TON-72 evidence.
