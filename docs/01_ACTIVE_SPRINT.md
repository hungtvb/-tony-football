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
  - centralized camera and radar configuration
  - pure camera zoom, look-ahead, dead-zone, and safe-area policy
  - WebGL broadcast camera integrated with shared frame target
  - speed now zooms out rather than zooming in
  - radar plot uses pitch bounds, clearer ball marker, and selected-player ring
  - radar plot contains no text
  - commentary toast moved away from radar on desktop and narrow layouts
  - standard read-only CI restored and guarded migration removed
Validation complete:
  - camera policy unit tests
  - runtime camera integration contracts
  - radar no-text and marker hierarchy contracts
  - HUD stylesheet ordering and toast-overlap contracts
  - clean-branch full repository npm test
Remaining:
  - refine scoreboard and match clock hierarchy
  - add selected-player identity transition
  - add low-stamina state and restrained warning motion
  - reduce contextual control hints after initial onboarding
  - manual lower-corner visibility validation in WebGL
  - manual desktop, narrow-layout, replay, Canvas fallback, and reduced-motion validation
Do not modify:
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
  - AI tactics or formations
  - pause/menu flow, match customization, multiplayer, or game modes
```

Only one sprint may be active at a time.
