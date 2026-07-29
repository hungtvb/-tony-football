# TON-94 Production Appearance Recovery Contract

## Incident

The deployed normal-asset match loaded all twelve GLB rigs but still failed product acceptance:

- the rig was bald because `PlayerModelView.commitRig()` hid the complete procedural body, including the only hair mesh;
- jersey, shorts, socks and boots were rigid primitives attached directly to individual bones;
- count-based tests accepted seven nodes and two boots even when those objects visibly floated, intersected or separated during animation.

The issue is presentation composition. MatchEngine state, score, possession, replay authority and the shared WebGL/Canvas projection are unchanged.

## Corrected ownership

`PlayerModelView` continues to own the cloned source GLB and its animation mixer. Source geometry, maps and texture lifetime remain unchanged.

`RigFootballKitOverlay` now owns an asset appearance layer with four visible nodes:

1. one skinned kit surface for jersey, shorts and socks;
2. one left skinned boot surface;
3. one right skinned boot surface;
4. explicit hair geometry attached to the `Head` bone.

The three clothing/footwear surfaces reuse the integrated source-body geometry and the same skeleton in detached bind mode. Their materials clone the source material, preserve its map reference and apply local body-region masks through `onBeforeCompile`. A small normal offset prevents z-fighting while the shell follows every animated vertex. No rigid box or cylinder kit primitive remains.

Hair has an explicit asset-mode owner after the procedural body is hidden. It follows the authoritative `Head` bone and is disposed with the player root.

## Acceptance evidence

Every asset player must report:

- `appearanceMode: skinned-surface`;
- exactly three body-conforming skinned surfaces;
- exactly two boot surfaces;
- at least one hair geometry;
- zero rigid appearance primitives;
- preserved source-map evidence;
- no fallback player and no browser console/page error.

The normal asset browser lane must attach both:

- a wide live-match screenshot;
- a close gameplay crop large enough to inspect hair, jersey/short boundaries and footwear while the rig is moving.

Object counts alone are not product acceptance. Reviewer and SA must inspect the screenshots on the exact review head.

## Scope boundaries

This correction does not change gameplay tuning, engine authority, replay timing, camera ownership, settings/effects ownership, Canvas fallback, deployment configuration or TON-85 bridge cleanup.
