# Camera and HUD — Source of Truth

## Principles
1. The pitch and active play remain the visual priority.
2. Camera motion reveals useful space without chasing every small ball movement.
3. Faster play shows more field, not less.
4. Radar plots contain only field geometry and gameplay markers.
5. Text, tutorials, commentary, and notices never cover the radar plot.
6. Presentation state must not change gameplay state.
7. Reduced-motion users receive the same information without nonessential animation.

## Camera contract

### Normal play
- Use a bounded logical zoom derived from ball speed.
- Faster ball movement lowers logical zoom to reveal more field.
- Apply velocity look-ahead with a strict maximum distance.
- Apply a horizontal and vertical dead zone before moving the frame target.
- Clamp the target to a safe range that preserves useful field edges.
- Smooth position and zoom independently with frame-rate-safe exponential easing.
- `SnapshotCameraController` owns logical framing state and reads match lifecycle, ball position, velocity, and zoom inputs from immutable fixed-tick snapshots.

### WebGL
- Broadcast, tactical, and close presets consume the shared logical frame target.
- Broadcast distance scales with logical zoom.
- Goal and replay camera branches remain authoritative during their sequences.
- Camera shake is presentation-only and applied after the stable target is calculated.

### Canvas fallback
- Keep the full playable field visible.
- Do not introduce a crop or zoom transform unless parity tests and responsive validation are added first.

## Radar contract
- Map world positions using playable pitch bounds rather than the full canvas bounds.
- Draw pitch boundary, halfway line, and center circle without labels.
- Home and away players use distinct team colors.
- The selected player has a separate outer ring.
- The ball uses the highest-contrast marker and a dark outline.
- No `fillText` or instructional content is allowed inside the radar renderer.

## HUD safe regions
- Bottom left: compact selected-player identity and stamina.
- Bottom center: radar only.
- Bottom right: contextual controls.
- Commentary and notices stay above the radar on desktop.
- On narrow layouts, transient commentary moves to a top safe region.
- Overlay elements must not hide the lower-left or lower-right playable corners.

## HUD hierarchy
1. Pitch, ball, and selected player.
2. Radar during transitions and off-screen play.
3. Score and clock.
4. Selected-player identity and stamina.
5. Contextual controls and commentary.
6. Technical status, which should disappear after initialization.

## Motion contract
- Score changes may use a short emphasis animation.
- Player identity changes may use a restrained fade/slide.
- Low stamina may use a gentle warning state, never a rapid flash.
- Contextual controls may reduce prominence after onboarding.
- All nonessential transitions are removed under `prefers-reduced-motion`.

## Validation contract
- Camera unit tests cover zoom direction, look-ahead cap, dead zone, and safe-area bounds.
- Runtime contracts confirm the camera controller consumes snapshots and WebGL consumes its read-only frame state.
- Radar contracts confirm no text rendering and configured marker hierarchy.
- CSS contracts confirm commentary cannot overlap the radar at desktop and narrow breakpoints.
- Manual validation covers lower-corner visibility, desktop, narrow layout, replay, Canvas fallback, and reduced motion.
