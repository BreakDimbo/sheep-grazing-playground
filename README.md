# Sheep grazing grass — playground

A playable, from-scratch reimplementation of the watercolor miniature farm shown in
[“sheep grazing grass! 🐑🌱”](https://x.com/AreadneMaria/status/2114898325451444419) by areadne (@AreadneMaria),
as introduced in the Chinese mirror article <https://breakdimbo.github.io/zh-blog-mirrors/areadne-sheep-grazing/>.

The original author published no code, repository or licence, so **none of her code is used here**. Everything (ground painting,
sheep, trees, behaviour, UI) was rebuilt independently from the public video frames. The scene's design belongs to areadne;
this is an unofficial fan study for learning. Removal on request.

## Play
- **Place** (default): tap grass to drop a sheep · tap a sheep to select it · drag a sheep to move it · drag a corner handle to resize it
- Selected-sheep toolbar: **Idle / Graze / Walk / Jump**, turn left/right, duplicate, delete (keys 1–4, Space, Delete, Esc)
- **Call**: tap/drag to call nearby sheep · **Shoo**: tap/drag to scare them · **Grass**: paint to regrow grazed grass (sheep come to fresh patches)
- − / + sheep count, ½× 1× 2× speed, reset
- Camera: drag to orbit, right-drag / two fingers to pan, wheel / pinch to zoom

## Tech
Plain ES modules + [three.js](https://threejs.org) r170 (MIT, vendored in `vendor/`). The ground is a 2048-px canvas painting
(fields, hedgerows, river, path, wheat, pencil-tick grass, wildflowers, dithered paper-bleed edge) traced from the reference via a
homography; grazing writes into a wear map that slowly regrows. Sheep run a small state machine (graze → idle → walk → …) with
separation, river/tree/edge avoidance and a preference for lush, uncrowded grass.

## Plus edition sound

The plus edition's sheep, lamb, skylark and cricket recordings come from Wikimedia Commons (public domain, CC BY-SA 3.0/4.0), by earthcalling, Yosef Ben Melamed, Marie-Lan Taÿ Pamart and Thatcher. Sources, licences and changes are listed in [docs/sound.md](docs/sound.md). Wind and pencil sounds are generated.
