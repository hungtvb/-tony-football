# Active Sprint

```yaml
Sprint: U3.1
Title: Camera and HUD
Status: In Progress
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/U3_1_CAMERA_HUD.md
Primary specs:
  - docs/ui/CAMERA_HUD.md
Delivered:
  - G3 ball control and first touch merged into main
Planned:
  - camera framing that preserves lower-left and lower-right field visibility
  - dead-zone and look-ahead behavior without abrupt camera motion
  - safe-area contract for ball and selected player
  - radar cleanup with no text inside the playable radar area
  - clearer selected-player, ball, teammate, and opponent markers
  - scoreboard, timer, stamina, and power hierarchy cleanup
  - contextual HUD visibility and restrained micro-motion
Validation required:
  - desktop and narrow-layout camera framing
  - left/right wing visibility near the lower screen edge
  - WebGL and Canvas fallback parity
  - radar readability during attack, defense, and transitions
  - reduced-motion compatibility
Do not modify:
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
  - AI tactics or formations
  - pause/menu flow, match customization, multiplayer, or game modes
```

Only one sprint may be active at a time.
