# Plus edition — plan

The faithful replica stays at `/`. The enhanced edition is `/plus/`: the same `main.js`
(it loads `plus/plus.js` only when `window.PLUS` is set, so the replica render is
unchanged, checked against the FINAL17 scores), plus physical-light additions. Each side has a small link to the other at bottom left.

Taste bar: restrained, cinematic, real light on real objects. No glow, sheen, particles,
glitch or chromatic aberration. Effects should be felt, not invisible.

| # | Feature | Status |
|---|---|---|
| 1 | **Living light**: a slow day cycle. Morning, then noon (exactly the replica's light), a long golden hour, blue hour and a moonlit night. It runs through the replica's own sun and sky lights, so shadows are real cast shadows that lengthen and sweep across the board. Painted sprites, the river and the paper are graded by the light on the ground. Clouds stay sun-lit and turn rose after the fields fall into shade. There is a minimal clock and scrubber at the top. | shipped P1 |
| 2 | **Wind and weather of light**: soft cloud shadows drifting over the fields, projected along the sun. A gust field travels across the grass as a value ripple, crowns lean with the gusts, plus a wind ambience. | next |
| 3 | **Camera**: slow breathing drift, a tilt-shift miniature depth of field (focus band on the board), gyroscope parallax on phones. | planned |
| 4 | **Sound** (muted by default): wind tied to gust strength, paper rustle when drawing, crickets at night. No cartoon bleats. | planned |
| later | Rain that wets the paper; flock behaviour; feeding. | backlog |

`?h=17.5` freezes the hour (for screenshots). `window.__sheep.setHour(h)` does the same.
