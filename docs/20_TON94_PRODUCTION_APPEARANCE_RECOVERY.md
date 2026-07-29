# TON-94 Production Appearance Recovery Contract

## Incident

The deployed normal-asset match loaded all twelve GLB rigs but still failed product acceptance:

- `PlayerModelView.commitRig()` hid the complete procedural body, including the only hair mesh;
- jersey, shorts, socks and boots were rigid primitives attached to individual bones;
- count-based tests accepted those objects even when they floated, intersected or separated during animation.

The failure is presentation composition. MatchEngine state, score, possession, replay authority and the shared WebGL/Canvas projection remain unchanged.

## Corrected ownership

`PlayerModelView` continues to own the cloned GLB, its source geometry, per-player material clones and animation mixer.

`RigFootballKitOverlay` no longer adds high-detail skinned copies or rigid kit primitives. It modifies the material clone on the existing integrated `SuperHero_Male` skinned body:

- the source texture map remains referenced;
- `onBeforeCompile` classifies local body regions for jersey, shorts, socks and two footwear regions;
- only those regions receive team or goalkeeper colors;
- all other pixels preserve source body/skin detail;
- no geometry or skeleton is duplicated, so animation cost remains the original single body mesh per player.

Asset-mode hair has an explicit lightweight owner attached to the authoritative `Head` bone. It is disposed with the player root.

## Required evidence

Every asset player must report:

- `appearanceMode: integrated-body-material`;
- exactly one integrated body surface;
- two footwear regions on that same body geometry;
- at least one explicit hair geometry;
- zero rigid appearance primitives;
- preserved source-map evidence;
- no fallback player and no browser console/page error.

The normal asset browser lane must attach both:

- a wide live-match screenshot;
- a close gameplay crop large enough to inspect hair, jersey/short boundaries and footwear while the rig is moving.

Object counts alone are not product acceptance. Reviewer and SA must inspect both screenshots on the exact review head.

## Performance boundary

The correction must not create additional full-body `SkinnedMesh` instances. A prior attempt with three duplicate high-detail skinned surfaces per player passed static contracts but reduced software-WebGL simulation enough that kickoff could not finish within 30 seconds. The integrated material approach preserves the original one-body render cost.

## Scope boundaries

No gameplay tuning, score or possession mutation, replay change, camera redesign, settings/effects ownership change, Canvas fallback rewrite, deployment change or TON-85 bridge cleanup.
