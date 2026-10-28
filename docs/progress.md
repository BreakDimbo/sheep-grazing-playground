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
