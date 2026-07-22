# TON-84 Browser Settings and Effects Adapter Contract

## Boundary

TON-84 moves browser preference commands and visual feedback state out of the generated compatibility runtime. It does not change match simulation, gameplay tuning or visual design.

`BrowserSettingsAdapter` is the single owner of pitch, ball, weather and sound UI listeners, persistence and preview tones. It emits frozen `user-preference` commands through declared callbacks. Control bindings are exposed as read-only diagnostics; the adapter cannot reach or mutate the engine.

`BrowserEffectsAdapter` is the single owner of particle lifecycle, contextual bursts and trail/charge projections. It copies immutable facts before producing frozen projections consumed by WebGL and Canvas. Missing audio/effect capability fails closed without changing gameplay.

## Lifecycle

Both adapters implement attach, reset, teardown and read-only diagnostics. A second live owner on the same browser target is rejected. Teardown removes listeners and clears owned transient state. Disable and missing-capability paths return a no-effect projection.

## Generated runtime

The generated runtime binds through `window.__TONY_SETTINGS_EFFECTS_BRIDGE__`. It may apply a validated user preference command to presentation resources and consume frozen effect projections. It no longer owns settings listeners, settings-preview audio, particle state or trail/charge policy.

The existing engine authority and the single frozen camera/replay projection shared by WebGL/model and Canvas remain unchanged.
