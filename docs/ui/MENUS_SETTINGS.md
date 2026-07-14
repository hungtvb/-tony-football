# Pause and Settings Specification

## Pause menu order
1. Resume
2. Controls
3. Match Statistics
4. Settings
5. Restart Match
6. Return to Setup

Destructive actions require confirmation.

## Settings categories
- Gameplay
- Camera
- Graphics
- Audio
- Controls
- Accessibility

## U1 rule
Only expose a setting when the code already supports it or U1 explicitly implements it. Do not create decorative toggles with no behavior.

## Dialog behavior
- Escape closes the topmost non-destructive dialog or resumes from pause.
- Focus is trapped inside an open dialog.
- Closing restores focus to the triggering control.
- Background controls cannot activate while a modal is open.
- Dialog title and selected states use semantic attributes.

## Persistence
Use existing local preferences where available. Any new setting belongs to one versioned settings object rather than unrelated storage keys.

## Acceptance
- Pause and resume never create duplicate loops or input state.
- Restart and return-to-setup confirmations prevent accidental loss.
- Menus work with keyboard only.
- Settings shown to users have real effects.
