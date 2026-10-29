# Plus edition: sound sources and licences

Sound is muted by default and only loads after you turn it on (the speaker icon next to the clock).

## Recordings (Wikimedia Commons)

Files in `plus/snd/` are trimmed, high-passed, lightly de-noised and loudness-normalised excerpts of the recordings
below. The excerpts keep each original's licence; the CC BY-SA excerpts are shared under the same licence.

| File(s) | Source recording | Author | Licence |
|---|---|---|---|
| `bleat1.mp3`, `bleat2.mp3` | [Sheep bleating.ogg](https://commons.wikimedia.org/wiki/File:Sheep_bleating.ogg) | earthcalling | Public domain |
| `bleat3.mp3` – `bleat6.mp3` | [Corner of a sheep field in summer.ogg](https://commons.wikimedia.org/wiki/File:Corner_of_a_sheep_field_in_summer.ogg) | earthcalling | Public domain |
| `lamb1.mp3` | [Lamb bleating and its mother's response.flac](https://commons.wikimedia.org/wiki/File:Lamb_bleating_and_its_mother%27s_response.flac) | Yosef Ben Melamed | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `lark.mp3` | [Alauda arvensis - Eurasian Skylark XC484052.mp3](https://commons.wikimedia.org/wiki/File:Alauda_arvensis_-_Eurasian_Skylark_XC484052.mp3) (via xeno-canto) | Marie-Lan Taÿ Pamart | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `crickets.mp3` | [Field cricket unedited.ogg](https://commons.wikimedia.org/wiki/File:Field_cricket_unedited.ogg) | Thatcher | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

Changes to the originals: cut into single calls or loops, 160 Hz–1.5 kHz high-pass (by layer), FFT de-noise,
equal-power loop crossfade, loudness normalised, re-encoded as mono MP3.

## Generated (our own code, no samples)

- **Wind**: two looping pink-noise beds, left and right, through a low-pass and a band-pass. Level and cutoff follow the
  same gust field that ripples the grass (`plus/wind.js`), sampled either side of the view.
- **Pencil on paper**: grainy noise (random 4–30 ms grains) through a band-pass whose level and pitch follow how fast you draw.
