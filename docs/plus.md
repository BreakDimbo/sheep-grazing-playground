# Plus edition — plan

The faithful replica stays at `/`. The enhanced edition is `/plus/`: the same `main.js`
(it loads `plus/plus.js` only when `window.PLUS` is set, so the replica render is
unchanged, checked against the FINAL17 scores), plus physical-light additions. Each side has a small link to the other at bottom left.

Taste bar: restrained, cinematic, real light on real objects. No glow, sheen, particles,
glitch or chromatic aberration. Effects should be felt, not invisible.

| # | Feature | Status |
|---|---|---|
| 1 | **Living light**: a slow day cycle. Morning, then noon (exactly the replica's light), a long golden hour, blue hour and a moonlit night. It runs through the replica's own sun and sky lights, so shadows are real cast shadows that lengthen and sweep across the board. Painted sprites, the river and the paper are graded by the light on the ground. Clouds stay sun-lit and turn rose after the fields fall into shade. There is a minimal clock and scrubber at the top. | shipped P1 |
| 2 | **Wind and weather of light**: soft cloud shadows drifting over the fields, projected along the sun. A gust field travels across the grass as a value ripple, crowns lean with the gusts, plus a wind ambience. | shipped P2 (cloud shadows, gust ripple, crown lean; sound later with #4) |
| 3 | **Flock**: cohesion around a wandering leader; three lambs (smaller sprites) trot after their mothers; a tap on open grass startles nearby sheep away (graded by distance, lambs fastest), they stop, look back and regroup; at dusk/night they lie down one by one to rest (legs tucked into the grass, bodies lowered) and get up again in the morning. | shipped P3 |
| 4 | **Camera as a lens**: tilt-shift miniature depth of field (thin-lens circle of confusion of the ground point under each pixel, i.e. a tilted focus plane; small dead band; the focus racks slowly to the flock, or the selected sheep), two separable 13-tap passes over the finished frame. A slow breathing orbit (±1°) after 6 s idle that eases out on any touch. Gyroscope parallax on phones (±3°, slowly re-centring; iOS behind a 'tilt to look' tap). Drift/parallax use a separate render camera; ray picks and projections follow it. ?tilt=0, ?drift=0 to compare | shipped P4 |
| 5 | **Sound** (muted by default): wind tied to gust strength, occasional real bleats, birds by day, crickets at night, paper rustle when drawing. Recordings freely licensed or generated; no synth beeps. | planned |
| 6 | **Better night**: deeper moonlit mood without murk, real moon reflection on the river; fix the mauve cast near 18:00. | planned |
| later | Rain that wets the paper; feeding. | backlog |

`?h=17.5` freezes the hour (for screenshots). `window.__sheep.setHour(h)` does the same.
