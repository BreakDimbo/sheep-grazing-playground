# Progress log (dev notes, not part of the UI)

Reconstructed 2026-10-29 after the build box lost out/ — earlier per-round G1–G25 rows lived only in out/progress.md;
the summary below is from the session record.

Harness: `DPR=2 shot.py URL out.png 1188 716 3`, `compare.py ref/F0.png out.png tag` (ref = frame 0 of areadne's
2026-10-27 "sheep grazing grass!" video, 2376×1432, kept off-repo). Guards: lf = σ4-blurred SSIM, bdE = σ6-blurred CIEDE2000.
Texture is judged by eye on zoomed side-by-sides / blinks, not SSIM.

## Ground phase (G rounds)
G25 final: all lf .962 / bdE 2.15. Per region: edge .939/3.94, light .966/1.80, bright .959/1.95, dark .939/3.18,
lime .979/2.24, wheat .987/0.75, river .931/4.70, path .957/2.63, hedges .903/4.17.

## Visual-match phase
| Round | Change | Guard (all lf / bdE) | Visual |
|---|---|---|---|
| H1 | pink tree: desaturate (sat .55) + violet shadow hue shift (uShade) | .962 / ~2.15 | pink tree matches ref |
| H2 | board edge: feathered dry-brush flecks in the fade, lime wash .55→.3 | .962 / edge 4.52→4.40, lf .939→.942 | blocky feathered fringe like ref; ref fringe a bit wider/denser |
| H3 | flowers: ~1.6× radius, ~330 yellow blobs, less orange, density map | .962 / light bdE 1.84 | size/colour similar |
| H4 | fine grass grain: vertical ticks + pale clover dabs (offscreen blur) | .962 / 2.10 | grain reads like ref |
| H5 | fieldFix refit after flowers/grain | .962 / 2.10 | — |
| H6 | hedges: halo alpha ×0.6, crisper core (blur ×0.6), noise-wobbled core width, per-hedge width refit | .962 / 2.09; hedges lf .901, bdE 4.05 | crisp irregular outline like ref |
| H7 | river: patchy light-cyan rims on both banks (crisp-edged noise patches, drift slowly), thin long flow streaks (were oval blobs), deeper core (RD .44→.52) | .962 / 2.09; river lf .932→.933, bdE 4.48→4.46 | rims + streaks read like ref (h7_river3.jpg); ref bank line slightly wavier |
| H8 | board edge re-fit from per-side edge profiles (eprof2.py): solid paint pulled ~15 px inward (eo .02→-.12), ramp starts at 50% paint instead of ~15% (no wide pale band), fleck blocks 5 px square, pale flecks (tf 0–.3) with less lime wash (.3→.08), more of them (fp 2) | .962 / 2.04; edge lf .941, bdE 3.86→3.54 | fringe is now broken pale blocks over paper like ref; ref outline has bigger step-like bays |
| H9 | flowers: density ×1.33, sharper clustering (blur radius 7→4), white share .03→.015 → Y 330 / W 29 blobs (ref 330 / 22); grain: sparser fine specks (gt .2→.12) + sparse dark 1–2-stroke grass ticks on their own PRNG (tu .7) | .962 / 2.04; light bdE 1.85→1.78 | ticks now read as distinct dark strokes like ref; ref also has faint broad brush streaks we lack |
| Live | Pages build cd83d29 (2026-10-29 02:37 UTC+8). Final render FINAL.png | .962 / 2.04 (river .934/4.16, edge .941/3.54) | interact.py on live URL: 9→10 dup, drag 2.78 m, lasso →11, toolbar shown, 0 console errors (swiftshader 2.6 fps). 390-px layout OK. Remaining by eye: ref grain has faint broad brush streaks; flowers slightly orange vs ref pale yellow/white and sparser in left light field; board outline lacks ref's big step-bays, top fringe shorter; some ref hedges softer/wider with light halo and tapered ends; pink tree rounder than ref's lumpy silhouette; river end into paper lacks ref's blue fleck break-up. |
| H10 | river: banks are now polygons whose half-width follows a per-side profile measured from the ref (layout.riverBank, bankfit.py ×2); ribbon highlights clipped to painted water (no spill onto paper); at the paper edge, blue texels keep their colour (rkp .85) so the river breaks up into blue flecks | .962 / 2.00; river lf .934→.942–.953, bdE 4.16→2.98–3.28 | bank follows ref's wavy line; blue flecks at the paper end |
| H11 | board edge: per-side solid-edge offset profile measured from ref (layout.edgeDet, edet.py ×3) gives the ref's step-bays; block-dissolve fringe (emd 1: each 3-px block, 1.8 tall, is paint or paper with a probability ramp), top fringe ×1.8 taller, no dark fringe under paper texels | .965 / 1.76; edge lf .941→.961, bdE 3.54→2.22 | ragged dissolve plus bays like ref; ref blocks a bit smaller and paler |
| H12 | pink tree: 4 new Codex-generated lobed crowns (prompts/p_pink2.txt) packed into atlas row 4 (cells 24–27, pack_pink.py); uses cell 24 ×0.93, tint 1.04,1.2,0.82; no trunk | .965 / 1.76; trees bdE 5.03→4.11 | lumpy, no trunk; ref outline is more irregular, with smaller lobes and a slightly more mauve tone |
| H13 | flowers: own PRNG (fseed) so flower tweaks no longer reshuffle grain/edge/river randomness; orange share .1→.05; optional light-field density boost (flb, default 1: boosting raised light bdE 1.73→1.81–1.89, so it stays off). Bigger dots (fs 2) tested and rejected: they blur into smears | .965 / 1.76 | still differs: the ref's left-field cluster has ~2× more distinct dots and more white ones; ours look smaller and softer |
| Live | Pages build 5f0c259 (2026-10-29 ~03:58 UTC+8). Final render FINAL2.png | .964 / 1.78 (edge .960/2.22, river .953/2.97, trees .881/4.14, hedges .901/4.07) | interact.py on live URL: 9→10 dup, drag 2.78 m, lasso →11, toolbar shown, 0 console errors (swiftshader 2.4 fps). Items 1 (brush streaks) and 4 (hedge halo/taper) not started yet |
| H14 | top edge: the measured top profile was median-filtered (±7 bins) and clamped to ±.02. Raw spikes, where trees and clouds hide the ref edge, had drawn big triangular teeth right of the path that the ref doesn't have | .965 / 1.75; edge lf .960→.963, bdE 2.22→2.18 | top fringe right of the path is now a straight broken band like the ref (it4c_zc.jpg) |
| H15 | hedges: tapered ends (dab radius ∝ √(distance to end / 2 widths), no round-capped core stroke), core ×1.1 wider, softer (blur .6→.8). Optional pale halo (hla) tested: .25 hurt hedges bdE 4.09→4.33, .1 was neutral but invisible, so it stays off. Paler flowers (fy e6d873) tested and rejected: mean colour overshot the ref (221,213,110 vs 207,192,84) | .965 / 1.75; hedges .901 / 4.11 (was 4.07) | ends taper to points; ref hedges still somewhat wider and blurrier in places |
