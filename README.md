# ai-stikman-historyy

Short vertical history explainers (1080×1920, 60 fps), built with Remotion.

## What's here

| Path | What it is |
|---|---|
| `script.md` | Narration, shot list, picture list, style line |
| `images/` | Cut-out illustrations and `prompts.md` |
| `public/audio/narration.mp3` | The voice-over (ElevenLabs, voice "Dallin – Storyteller") |
| `public/audio/narration.words.json` | Start and end time of every spoken word |
| `settings/napoleon.json` | **Everything about the video**: pictures, positions, camera, lights, labels, timings |
| `src/engine/` | The reusable template (camera, layers, effects) |
| `scripts/stills.mjs` | Renders check stills every 0.5 s and at every sentence start |
| `scripts/check.py` | Flags stills where a picture enters the top 8% / bottom 18% or touches the frame edge |

## Commands

```bash
npm install
npx remotion studio                                    # preview
npx remotion render src/index.ts napoleon out/video.mp4
node scripts/stills.mjs napoleon && python3 scripts/check.py
```

## Making a new video

Add a new file to `settings/` (copy `napoleon.json`, change `name`). Each settings file becomes
its own composition. Nothing in `src/` needs to change.

**Times** are seconds, or word references into the words file: `"w12"` (word 12 starts),
`"w12.end"` (word 12 ends), with an optional offset: `"w12+0.3"`, `"w12.end-0.2"`.

**World units.** The camera films one big page. Picture positions, labels and the camera use
world units. With zoom 1, one world unit is one pixel. The camera's `x`/`y` lands at
`canvas.focus` (the middle of the safe area).

- `camera`: keyframes `{t, x, y, zoom}`. They are joined by a smooth spline: every move eases in and
  settles, and moves in the same direction flow into each other.
- `layers`: pictures with `x`, `y`, `width`, optional `depth` (<1 = farther: slower and
  `depthBlur`), `in`/`out` fades (opacity + a little scale + blur), and `anim` keyframes for
  `x`, `y`, `scale`, `rotate`, `opacity` and `blur`.
- `effects`:
  - `light`: a soft glow travelling along `path` (points as fractions of the picture, so it stays on it)
  - `puff`: soft smoke
  - `glow`: a blurred fill of a traced shape
  - `magnifier`: a lens that grows out of a detail, joined to it by two lines
  - `label`: bold, letter-spaced text that fades in, with an optional underline that draws itself
- `style`: accent colour (used only for light and movement), ink, font.
- `dots`: the faint dot grid. Two layers at different depths, so you can feel the camera move.
