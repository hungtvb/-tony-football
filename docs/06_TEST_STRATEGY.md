# Test Strategy

Keep existing syntax and asset checks.

Add unit tests for clocks, math, evaluators, state transitions, and config. Add headless simulation tests for movement, ball, passing, AI, and rules. Use manual gameplay checks for controls, feel, rendering synchronization, fallback modes, menus, and responsive UI.

Use seeded random for deterministic tests. For reproducible bugs, add a failing test or scenario before the fix where practical.