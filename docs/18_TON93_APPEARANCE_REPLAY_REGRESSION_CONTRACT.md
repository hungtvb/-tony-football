# TON-93 Player Appearance and Goal Replay Regression Contract

## Purpose

TON-93 restores two product-visible guarantees without reopening the R1 presentation architecture:

1. player assets retain source skin/hair texture detail while visibly wearing team-specific football clothing and boots;
2. goal replay selects frames from the scoring incident that activated the authoritative replay.

The correction remains presentation-only. It does not change match simulation, scoring, replay activation/progress, clock, possession or kickoff authority.

## Player appearance

`PlayerModelView` clones source materials per live player while preserving source texture references. Shared textures remain owned by the loaded character template and are disposed only after all dependent player views are released.

Surface classification combines mesh and material names. Only explicit native `kit`, `shorts` and `socks` material slots may receive team/keeper tinting. `skin`, `hair`, native footwear and unknown surfaces preserve source material color and texture. Unknown surfaces are never treated as kit by default.

The shipped GLB has one integrated body mesh rather than separate football clothing slots. `RigFootballKitOverlay` therefore attaches seven explicit owned meshes to the cloned rig after asset commit:

- jersey and chest band on `spine_02`;
- shorts on `pelvis`;
- left/right socks on `calf_l` and `calf_r`;
- left/right boot geometry on `foot_l` and `foot_r`.

These meshes use distinct home, away and goalkeeper palettes, follow skeleton animation, and live below the player root so existing player-view teardown disposes their materials and geometry. Installation is idempotent and fails closed when required bones or boot geometry are missing.

Procedural fallback separately owns two explicit boot meshes (`TonyBootLeft`, `TonyBootRight`). Skeleton foot bones alone are never accepted as footwear evidence.

`BrowserModelViewAdapter` aggregates immutable per-player evidence:

- fallback versus rigged mode;
- preserved source maps;
- rig-overlay installation;
- exact visible kit-node and boot-geometry counts;
- home/away/keeper identity.

Asset mode is Ready only when every live rig has seven overlay meshes and exactly two boot meshes.

## Goal incident replay

`SnapshotCameraReplayAdapter` retains three separate presentation buffers:

- rolling normal-play history;
- the active goal incident window;
- immutable playback frames selected when engine-owned replay becomes active.

The incident key is derived from immutable score, scoring team and scorer facts. A new key starts a new incident from an explicitly bounded `preShotFrames` window (default: two sampled frames), never the whole rolling history. The first live frame after replay is treated as kickoff/restoration and is deliberately excluded before current-goal history resumes. Goal-sequence frames are then retained through shot, goal and immediate aftermath until authoritative replay activation. Sampling at the configured interval includes a small deterministic floating-point tolerance so exact boundary frames are not lost.

After replay/kickoff completes, prior incident/history state is cleared before normal recording resumes. A later score therefore cannot select playback frames from a prior goal. The adapter still reads replay active/elapsed/duration from the current engine snapshot and never activates, advances or ends replay locally.

Historical replay substitutes only player/ball visual facts. Current score, clock, lifecycle and replay metadata remain engine-owned and current.

## Shared projection

The existing exact-once contract remains unchanged:

- `SnapshotCameraReplayAdapter` projects once per immutable presentation frame;
- WebGL/model and Canvas consume the same frozen projection;
- Canvas never creates a second camera/replay owner;
- skip, reset, missing-frame and teardown behavior remain explicit.

## Required evidence

- source-material map preservation tests;
- explicit rig-overlay geometry and bone-attachment tests;
- distinct home, away and goalkeeper palette tests;
- fallback boot geometry test;
- normal asset-mode live-match evidence for all 12 rigs: seven visible clothing meshes and exactly two boot geometries each;
- screenshot evidence showing distinct team clothing and visible footwear during animation;
- synthetic unique-position pre-shot → shot → goal → aftermath replay chronology;
- second-goal isolation proving prior-goal kickoff/restoration and unrelated buildup are rejected, while only the uniquely marked current-goal pre-shot, shot, goal and aftermath frames are replayed;
- existing authority, projection parity, lifecycle and ownership guards.

## Out of scope

No kit customization UI, replacement character art, gameplay tuning, replay timeline redesign, TON-84 settings/effects, TON-85 bridge cleanup, deployment changes or TON-78 work.
