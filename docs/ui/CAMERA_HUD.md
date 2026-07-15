# Camera and HUD — Source of Truth

## Principles
1. The pitch, ball, and controlled player are always visually dominant.
2. Camera motion must improve anticipation, not simply center the ball.
3. HUD information appears only where and when it helps a decision.
4. The radar is a pure spatial instrument and contains no instructional text.
5. WebGL and Canvas use the same camera and HUD state.
6. Reduced-motion settings affect camera impulses and UI transitions.

## Camera contract

### Framing
- Camera framing considers the ball, selected player, attack direction, viewport aspect ratio, and replay state.
- The lower-left and lower-right playable areas must not be cropped under normal match zoom.
- Narrow layouts use wider zoom bounds and larger UI safe margins.

### Dead zone
- Small movement inside the dead zone does not move the camera target.
- The target eases only after ball or selected player pressure approaches a dead-zone boundary.
- Dead-zone dimensions are normalized to viewport size.

### Look-ahead
- Look-ahead favors the current attack direction and ball velocity.
- It is clamped so the ball and selected player remain inside the safe area.
- It decreases near restarts, goals, pause, and replay.

### Safe area
- The ball and selected player should remain inside configurable horizontal and vertical margins.
- HUD occupancy contributes to safe margins.
- Camera clamping must not expose space outside the pitch.

### Zoom
- Base zoom responds to aspect ratio, not device labels.
- Dynamic zoom changes are subtle and rate-limited.
- Counterattacks may zoom out slightly; no rapid pumping is allowed.

## Radar contract
- No text, labels, hints, mode names, or status strings inside the radar plot bounds.
- Ball marker has the highest contrast.
- Selected-player marker is distinct from ordinary teammates by shape or ring, not color alone.
- Team and opponent markers remain distinguishable under common color-vision deficiencies.
- Goalkeeper markers may use a secondary shape treatment.
- Radar opacity and scale must not obscure live play.

## HUD hierarchy
1. Ball and selected player in the world.
2. Power during an active charge.
3. Radar during spatial decisions.
4. Score and match clock.
5. Player identity and stamina.
6. Context hints and transient notices.

## Visibility rules
- Power bar: visible only while charging or briefly settling after release.
- Player identity: appears on selection change and fades to a compact state.
- Stamina: compact by default; more prominent below warning thresholds.
- Context hint: transient, rate-limited, and placed outside radar bounds.
- Debug information: never visible in production mode.

## Motion contract
- Common transitions use restrained 150–250 ms easing.
- Score changes may use a single pulse or flip.
- Radar markers do not animate in ways that distort position.
- Reduced motion removes camera shake and large transforms while preserving state changes.

## Responsive contract
- HUD uses safe-area insets and minimum tap/reading sizes.
- Narrow layouts prioritize pitch visibility over decorative chrome.
- Radar and controls may move, but never overlap.
- Scoreboard remains readable without spanning excessive width.

## Testing contract
Required automated or source-level scenarios:
- aspect-ratio-aware zoom bounds;
- look-ahead clamp;
- dead-zone stability;
- safe-area preservation;
- no text nodes inside radar bounds;
- power/context visibility rules;
- reduced-motion fallback;
- WebGL/Canvas shared camera state.
