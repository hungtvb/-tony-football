# TON-93 Player Appearance and Goal Replay Regression Contract

## Purpose

TON-93 restores two product-visible guarantees without reopening the R1 presentation architecture:

1. player assets retain clothing, skin, hair and footwear semantics;
2. goal replay selects frames from the scoring incident that activated the authoritative replay.

The correction remains presentation-only. It does not change match simulation, scoring, replay activation/progress, clock, possession or kickoff authority.

## Player appearance

`PlayerModelView` clones source materials per live player while preserving source texture references. Shared textures remain owned by the loaded character template and are disposed only after all dependent player views are released.

Surface classification combines mesh and material names. Only explicit `kit`, `shorts` and `socks` surfaces receive team/keeper tinting. `skin`, `hair`, `boots` and unknown surfaces preserve source material color and texture. Unknown surfaces are never treated as kit by default.

Procedural fallback owns two explicit boot meshes (`TonyBootLeft`, `TonyBootRight`) and reports the same immutable appearance diagnostics as asset-backed rigs.

`BrowserModelViewAdapter` aggregates immutable per-player evidence:

- fallback versus rigged mode;
- visible footwear evidence;
- preserved source maps;
- explicit kit tint count;
- semantic material counts;
- home/away/keeper identity.

## Goal incident replay

`SnapshotCameraReplayAdapter` retains three separate presentation buffers:

- rolling normal-play history;
- the active goal incident window;
- immutable playback frames selected when engine-owned replay becomes active.

The incident key is derived from immutable score, scoring team and scorer facts. A new key starts a new incident from the current rolling pre-shot history. Goal-sequence frames are retained through shot/goal/highlight aftermath until replay activation. After replay/kickoff completes, prior incident/history state is cleared before normal recording resumes.

A later score therefore cannot select playback frames from a prior goal. The adapter still reads replay active/elapsed/duration from the current engine snapshot and never activates, advances or ends replay locally.

Historical replay substitutes only player/ball visual facts. Current score, clock, lifecycle and replay metadata remain engine-owned and current.

## Shared projection

The existing exact-once contract remains unchanged:

- `SnapshotCameraReplayAdapter` projects once per immutable presentation frame;
- WebGL/model and Canvas consume the same frozen projection;
- Canvas never creates a second camera/replay owner;
- skip, reset, missing-frame and teardown behavior remain explicit.

## Required evidence

- semantic material tests for home, away and goalkeeper palettes;
- proof that skin, hair, boots and unknown surfaces preserve source maps/colors;
- fallback boot geometry test;
- normal asset-mode browser evidence for all 12 players and representative home/away/keeper diagnostics;
- synthetic unique-position pre-shot → shot → goal → aftermath replay chronology;
- second-goal isolation proving no first-goal ticks are reused;
- existing authority, projection parity, lifecycle and ownership guards.

## Out of scope

No kit customization UI, new character art, gameplay tuning, replay timeline redesign, TON-84 settings/effects, TON-85 bridge cleanup, deployment changes or TON-78 work.
