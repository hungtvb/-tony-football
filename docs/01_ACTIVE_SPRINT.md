# Active Sprint

```yaml
Sprint: U3.1
Title: Camera and HUD
Status: Implementation Complete — Manual Validation Pending
Owner: Codex or Antigravity agent
Sprint document: docs/sprints/U3_1_CAMERA_HUD.md
Primary specs:
  - docs/ui/CAMERA_HUD.md
Delivered:
  - centralized camera and radar configuration
  - pure camera zoom, look-ahead, dead-zone, and safe-area policy
  - WebGL broadcast camera integrated with shared frame target
  - faster play zooms out instead of zooming in
  - radar uses pitch bounds, high-contrast ball marker, and selected-player ring
  - radar plot contains no text
  - commentary toast moved away from radar on desktop and narrow layouts
  - refined broadcast scoreboard and match-clock hierarchy
  - restrained selected-player card transition
  - low-stamina warning state without rapid flashing
  - contextual control hints dim after onboarding and reactivate during input
  - reduced-motion support for HUD transitions
  - standard read-only CI restored and guarded migrations removed
Validation complete:
  - camera policy unit tests
  - runtime camera integration contracts
  - radar no-text and marker hierarchy contracts
  - HUD stylesheet ordering and toast-overlap contracts
  - player transition, stamina, hint visibility, and reduced-motion contracts
  - clean-branch full repository npm test
Remaining:
  - manual lower-left and lower-right visibility validation in WebGL
  - manual desktop and narrow-layout HUD validation
  - manual replay and Canvas fallback validation
  - manual reduced-motion validation
Do not modify:
  - simulation timing
  - movement, possession, pass, shot, tackle, or goalkeeper balance
  - FO4 control mapping
  - AI tactics or formations
  - pause/menu flow, match customization, multiplayer, or game modes
```

Only one sprint may be active at a time.
