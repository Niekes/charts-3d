# Performance

The charts get faster by measurement, not by feel. The number the project
tracks is the **frame time** (see GLOSSARY.md): how long one step of the
camera takes until the picture is painted, while the camera orbits in a
Many demo. It is kept in milliseconds, not frames per second, because the
parts of a frame add up in time.

There is no gate: CI runs in jsdom, which has no canvas and no layout, and
its machines time too unevenly to judge a frame. This file is the record
instead. A change that claims to be faster adds its before and after rows
to the log below.

## How to measure

1. Build and serve the docs as they ship: `npm run docs:build && npm run docs:preview`.
   The dev server measures React's development build, several times slower.
2. Open the page of the chart in Chrome and scroll to its Many demo. Pick the
   renderer with its switch.
3. Paste this into the console. It turns the first chart on the page with
   the arrow key for five seconds and prints its frame times:

   ```js
   await(async () => {
     const svg = [...document.querySelectorAll("svg[tabindex]")].find(
       (svg) => svg.getBoundingClientRect().top >= 0
     )
     const key = () =>
       svg.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
     const frames = []
     const press = setInterval(key, 100)
     let last = await new Promise(requestAnimationFrame)
     const end = last + 5000
     while (last < end) {
       const now = await new Promise(requestAnimationFrame)
       frames.push(now - last)
       last = now
     }
     clearInterval(press)
     frames.sort((a, b) => a - b)
     const at = (q) => frames[Math.floor(q * (frames.length - 1))].toFixed(1)
     console.log(`median ${at(0.5)} ms, p95 ${at(0.95)} ms, ${frames.length} frames`)
   })()
   ```

4. Run it three times and keep the median of the three medians.

Measure before and after on the same machine, in the same session, with the
same browser: a frame time says nothing next to one from another machine,
and the log never compares across rows of different machines. To compare
two commits, build each into its own directory and alternate between them.

shortcut: the measurement is a console snippet run by hand; script it with
headless Chrome once running it by hand gets old.

## What a frame costs

What earlier measurements found, dated, so nobody profiles the same thing
twice. They were taken before this log and name no commit.

- **Projecting on the CPU is most of a frame, not filling the marks.**
  A WebGL renderer drew no faster than the canvas: the globe's 2,500 tiles
  ran at about 25 fps on both (2026-11-09). See
  [ADR-0014](adr/0014-projection-stays-on-the-cpu.md).
- **Much of a frame is work the camera does not change.** A CPU profile of
  the globe's Many demo (about 5,200 tiles, canvas, 2026-11-14) ran at 36 ms
  a frame: parsing tile ids 10 %, rebuilding tween records at rest 9 %,
  canvas paint 8 %, garbage collection 7 %, d3-3d's projection only 5 %.
  Caching that work took the globe from 34 to 20 ms a frame and the scatter
  chart's 5,000 points from 24.5 to 16.7 ms.
- **The 80×80 surface** (6,241 quads, canvas, 2026-11-15): about 33 ms a
  frame, the chart's render about 14 ms and the core's paint about 13 ms.
  Most of the render is per-cell work that does not depend on the camera:
  colors, keys and a tooltip closure per quad.
- **An `oklch()` fill is slow on the canvas.** Setting `fillStyle` to an
  `oklch(...)` string costs about 0.7 µs, an `rgb(...)` string about
  0.17 µs: 4.5 ms per 6,241 marks (2026-11-15). The theme colors are oklch.
- **Sides thinner than a pixel.** Leaving out the sides of globe tiles
  thinner than a pixel halved the frame: 2° tiles 25 ms, 1° tiles 49 ms
  (2026-11-09).
- **SVG costs about 20 ms a frame plus 0.04 ms a path** (dev build,
  2026-11-09): keep a default SVG demo under about 1,000 paths.
- **The land of the globe is cheap**: d3-geo projects its 110m land in about
  2 ms a frame (2026-11-09).
- **Measure real frames.** A benchmark that reads pixels back with
  `getImageData` forces the canvas to rasterise at once and overstates
  paint many times over.

## The log

One row per measurement, newest first. The frame time is the median of
three runs of the snippet above.

| Date | Commit | Chart | Renderer | Marks | Median ms | p95 ms | Machine, browser | Change |
| ---- | ------ | ----- | -------- | ----- | --------- | ------ | ---------------- | ------ |
