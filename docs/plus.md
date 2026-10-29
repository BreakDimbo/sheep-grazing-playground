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
| 5 | **Sound** (muted by default, loads on first tap of the speaker): wind is generated pink noise in two beds left and right, with level and low-pass following the gust field that ripples the grass. Recorded bleats come every 10–30 s from a random sheep that isn't resting, panned to where it stands; a startle triggers them too; a lamb's bleat often gets its mother's answer. A recorded skylark sings in phrases by day, and a recorded field-cricket loop, doubled, detuned and spread, plays at night. Pencil-on-paper is grainy noise following drawing speed. Sources and licences in docs/sound.md. | shipped P5 |
| 6 | **Moonlit night**: a low moon beyond the far edge (about 20°), placed so its mirror image falls on the river. Moonlight is the key light, so sheep and trees cast long real moon shadows toward the viewer. Moonlight on the river is a glitter path: each fragment reflects the view ray off its own ripple normal, and only reflections within a fraction of a degree of the moon light up, scaled by water Fresnel and patchy chop. No glow. Scotopic colour: below about 0.3 ground irradiance, colour drains toward a cool grey and the exposure drops (in the lens pass; the CSS paper goes through the same transform so the ragged rim matches). Golden hour re-keyed: sky green ≥ red and green-grass bounce, so 18:00–18:50 is warm then neutral, no mauve. The moon rises with the end of blue hour (no dark dip at 20:00). | shipped P6 |
| later | Rain that wets the paper; feeding. | backlog |

`?h=17.5` freezes the hour (for screenshots). `window.__sheep.setHour(h)` does the same.
