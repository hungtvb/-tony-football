---
name: game-3d
description: Build, debug, optimize, and review real-time 3D rendering and asset pipelines, especially Three.js, WebGL, glTF, cameras, animation, skinning, lighting, materials, and GPU lifecycle.
---

# Game 3D

Use for Three.js/WebGL code, models, cameras, scale, lighting, shadows, materials, textures, skeletal animation, environment rendering, GPU performance, or visual regressions.

## Mental model

Debug the complete pipeline:

```text
source asset -> export -> glTF/textures -> loader -> scene graph
-> transforms/skinning/animation -> materials/lights -> camera -> renderer/GPU -> screen
```

Prove the first incorrect stage before changing code.

## Non-negotiable conventions

- Declare one world-unit convention, normally `1 unit = 1 metre`.
- Prefer glTF 2.0 for runtime delivery.
- Keep simulation coordinates renderer-agnostic.
- Treat Three.js objects as presentation resources.
- Annotate color and non-color textures correctly.
- Give every GPU resource a disposal owner.
- Measure `renderer.info`, CPU frame time, and deterministic visual output.
- Test suspect assets in an independent glTF viewer.

## Diagnostic workflow

1. Classify: missing object, transform/scale, skin/pose, animation, material/color, light/shadow, camera/framing, lifecycle, or performance.
2. Inspect scene graph: uniqueness, parent chain, accumulated scale, world transform, visibility, layers, culling, bounds, depth/transparency, and material ownership.
3. Separate asset from runtime with cheap tests: independent viewer, basic material, animation disabled, culling disabled, fixed camera, neutral light.
4. Repair the responsible pipeline stage rather than adding arbitrary compensating offsets.
5. Verify with deterministic front/back/side/close-up/gameplay views and structural assertions.

## Asset checklist

- glTF 2.0 validation passes.
- Orientation and units are documented.
- Node/mesh roles are stable.
- Skinned attachments use compatible skeletons and bind matrices.
- Clothing, hair, and shoes remain visible across clips and camera angles.
- Animation clips are self-contained actions.
- Texture formats and sizes fit memory budgets.
- Color maps use sRGB; normal/roughness/metalness maps remain non-color.
- Compression decoders are configured before loading.
- Textures and image bitmaps are explicitly disposed.

## Character and animation checklist

- One mixer owner per animated root.
- Mixer updates exactly once per frame/tick.
- Actions are cached, not recreated per frame.
- Transition graph defines interruption and fallback.
- Crossfades clean stale action weights.
- Root-motion policy is explicit.
- Bind pose, skeleton scale, attachments, and animated bounds are validated.
- Foot/ball contact timing comes from a defined source.

## Camera and scale checklist

- Pitch, goals, ball, and players share one unit contract.
- FOV, aspect, height, tilt, target, and framing are reviewed together.
- Near/far planes are tight enough for precision.
- Resize updates size, DPR, and projection exactly once.
- Smoothing is frame-rate independent.
- Supported aspect ratios are captured.
- Distinguish world-scale defects from perspective/framing defects.

## Performance checklist

Measure draw calls, triangles, geometries, textures, programs, shadow casters/maps, mixers/bones, passes, DPR, render-target size, frame-time percentiles, and repeated-mount resource counts.

## Tony Football mapping

Read `ThreeSceneEnvironmentAdapter.js`, `PlayerAssetLoader.js`, `PlayerModelView.js`, `CameraFraming.js`, and `BrowserThreeSceneEnvironmentHost.js`. Run asset/presentation tests and relevant model-view/golden Playwright scenarios.

## Evidence required

Report the failing pipeline stage, scene/resource observations, independent viewer result for asset issues, deterministic before/after captures, renderer metrics for performance claims, and disposal/rebind evidence for lifecycle changes.

## Primary references

- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js animation system: https://threejs.org/manual/en/animation-system.html
- Three.js color management: https://threejs.org/manual/en/color-management.html
- Three.js renderer diagnostics: https://threejs.org/docs/pages/WebGLRenderer.html
- Khronos glTF 2.0: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Khronos glTF Validator: https://github.khronos.org/glTF-Validator/
