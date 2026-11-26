# Performance

The number tracked is the **frame time** (GLOSSARY.md), in milliseconds:
the parts of a frame add up in time, frames per second do not. There is no
gate: CI runs in jsdom, which has no canvas and no layout, and its machines
time too unevenly to judge a frame. This file is the record instead.

## How to measure

1. Build and serve the docs as they ship: `npm run docs:build && npm run docs:preview`.
   The dev server measures React's development build, several times slower.
2. Open the page of the chart in Chrome, scroll to its Many demo (the "Many marks" section) and pick
   the renderer with its switch. Reduced motion must be off, or the camera
   jumps once a key and the snippet times idle frames.
3. Click the chart, so it has the focus, then paste this into the console.
   It turns the chart with the arrow key for five seconds and prints its
   frame times:

   ```js
   ;(async () => {
     const svg = document.activeElement
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

The snippet reads the time between painted frames, so it never drops below
one refresh of the screen: 16.7 ms at 60 Hz, 8.3 ms at 120 Hz. Name the
refresh rate with the machine.

Measure before and after on the same machine, in the same session, with the
same browser: a frame time says nothing next to one from another machine,
and the log never compares across rows of different machines. To compare
two commits, build each into its own directory and alternate between them.

shortcut: the measurement is a console snippet run by hand; script it with
headless Chrome once running it by hand gets old.

## What a frame costs

What earlier measurements found, dated, so nobody profiles the same thing
twice. They were taken before this log and name no commit.

- **The CPU work of a frame takes the time, not filling the marks.** A
  WebGL renderer drew no faster than the canvas: the globe's 2,500 tiles
  took about 40 ms a frame on both (dev build, 2026-11-09). See
  [ADR-0014](adr/0014-projection-stays-on-the-cpu.md).
- **Much of a frame is work the camera does not change.** A CPU profile of
  the globe's Many demo (about 5,200 tiles, canvas, 2026-11-14) ran at 36 ms
  a frame: parsing tile ids 10 %, rebuilding tween records at rest 9 %,
  canvas paint 8 %, garbage collection 7 %, d3-3d's projection only 5 %.
  Caching that work took the globe from 34 to 20 ms a frame and the scatter
  chart's 5,000 points from 24.5 to 16.7 ms (the 60 Hz floor).
- **The 80×80 surface** (6,241 quads, canvas, 2026-11-15): about 33 ms a
  frame, the chart's render about 14 ms and the core's paint about 13 ms.
  Most of the render is per-cell work that does not depend on the camera:
  colors, keys and a tooltip closure per quad.
- **An `oklch()` fill is slow on the canvas.** Setting `fillStyle` to an
  `oklch(...)` string costs about 0.7 µs, an `rgb(...)` string about
  0.17 µs: 4.5 ms per 6,241 marks (2026-11-15). The theme colors are oklch.
- **Sides thinner than a pixel.** Leaving out the sides of globe tiles
  thinner than a pixel about halves the frame; with them left out, 2° tiles
  (2,841) ran at 25 ms and 1° tiles (5,219) at 49 ms (dev build, 2026-11-09).
- **SVG costs about 20 ms a frame plus 0.04 ms a path** (dev build,
  2026-11-09): keep a default SVG demo under about 1,000 paths.
- **The land of the globe is cheap**: d3-geo projects its 110m land in about
  2 ms a frame (2026-11-09).
- **The frame on main after the caching** (canvas, production build,
  2026-11-26, commit 2c970ab; the rows of that date in the log). The surface
  numbers of 2026-11-15 above are superseded: its colors, keys and tooltips
  are built when the data moves now. JavaScript is 85 to 90 % of the main
  thread's frame on the slowest charts, and no single cost leads it: the
  slices are 1 to 3 ms each. Two are in the core: `fitCanvas` reads
  `clientWidth` at every frame, which recalculates the styles inside the
  script, 1 to 3.4 ms on the charts with axes; and `resolved` with `ink`
  look every fill up by a string built anew, 5.4 ms on the surface. The
  places chart spends 5.5 ms a frame in its body and the closure that makes
  a place. React leads no profile: `commitHostUpdate` shows once, at 1.2 %.
- **The screen rounds the frame time.** At 120 Hz a median is 8.3, 16.7 or
  25 ms, so a frame of 19 ms reads as 16.7 there and as 33 at 60 Hz. The
  time of the main thread a frame, from a trace, compares where the median
  cannot; the log names it under Change. The line to stay under is 16.7 ms.
- **Measure real frames.** A benchmark that reads pixels back with
  `getImageData` forces the canvas to rasterise at once and overstates
  paint many times over.

## The log

One row per measurement, newest first. The frame time is the median of
three runs of the snippet above.

| Date       | Commit  | Chart      | Renderer | Marks | Median ms | p95 ms | Machine, refresh, browser                     | Change                                |
| ---------- | ------- | ---------- | -------- | ----- | --------- | ------ | --------------------------------------------- | ------------------------------------- |
| 2026-11-26 | 2c970ab | surface    | canvas   | 6,241 | 25.0      | 33.4   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 22.3 ms a frame |
| 2026-11-26 | 2c970ab | line       | canvas   | 8,998 | 24.9      | 25.3   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 21.9 ms a frame |
| 2026-11-26 | 2c970ab | bar-field  | canvas   | 4,800 | 24.6      | 25.1   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 20.6 ms a frame |
| 2026-11-26 | 2c970ab | globe      | canvas   | 4,913 | 24.6      | 25.4   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 20.3 ms a frame |
| 2026-11-26 | 2c970ab | area       | canvas   | 1,422 | 16.7      | 25.1   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 19.7 ms a frame |
| 2026-11-26 | 2c970ab | places     | canvas   | 5,932 | 16.7      | 25.1   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 18.5 ms a frame |
| 2026-11-26 | 2c970ab | routes     | canvas   | 2,111 | 16.6      | 16.7   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 14.0 ms a frame |
| 2026-11-26 | 2c970ab | scatter    | canvas   | 5,000 | 16.6      | 17.2   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 13.4 ms a frame |
| 2026-11-26 | 2c970ab | bar        | canvas   | 900   | 8.4       | 16.7   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 10.5 ms a frame |
| 2026-11-26 | 2c970ab | donut      | canvas   | 3,002 | 8.3       | 16.7   | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 9.7 ms a frame  |
| 2026-11-26 | 2c970ab | choropleth | canvas   | 213   | 8.3       | 8.7    | MacBook Pro M5 on battery, 120 Hz, Chrome 158 | baseline; main thread 5.6 ms a frame  |
