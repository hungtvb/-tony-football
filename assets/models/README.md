# Player assets

The player assets are derived from Quaternius packs released under CC0:

- `football-character-v2.glb`: runtime character rebuilt with 256px embedded JPEG textures and standard `KHR_mesh_quantization`. It requires no texture decoder extension and is the primary PC asset.
- `football-animations-v2.glb`: nine runtime clips resampled and Meshopt-compressed, with the original 5.5 MB payload reduced to about 500 KB.
- `football-character.glb` and `football-player.glb`: legacy source builds retained for provenance and emergency rebuilds; they are no longer loaded at runtime.

The v2 loader displays the character as soon as the character asset resolves. Animation loading is independent, retried once and may fall back to basic procedural motion without hiding the 3D model.

Sources:

- https://quaternius.itch.io/universal-base-characters
- https://quaternius.itch.io/universal-animation-library

License: Creative Commons Zero v1.0 Universal (CC0).
