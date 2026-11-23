# The projection stays on the CPU

Context: a chart projects its data with d3-3d on the CPU at every frame and
hands the core 2D marks, which SVG and the canvas draw (ADR-0003). A WebGL
renderer of those marks was built and measured: it drew no faster than the
canvas, the globe's 2,500 tiles at about 25 fps on both, because projecting
the marks takes the time, not filling them. A CPU profile of the globe put
d3-3d's projection at about 5 % of a frame and the work the camera does not
change at far more (docs/performance.md).

Decision: there is no WebGL renderer, neither our own nor three.js. The
charts project on the CPU with d3-3d, and a frame gets faster by doing less
there: caching what the camera does not change, cheaper colors, fewer
faces.

What would reopen it: a renderer that projects on the GPU, through
`camera.matrix()` in a shader, and a measurement of the frame time
(docs/performance.md) that shows it faster than the canvas on the same Many
demo.

## Considered Options

- **A WebGL renderer of the projected marks.** Built and measured. Rejected:
  no faster, since it draws the same projected marks.
- **three.js, projecting on the GPU.** Rejected for now: every chart would
  hand the renderer 3D geometry instead of marks, a second contract beside
  `Mark3D`; hover, focus and symbols would need a GPU version each; a depth
  buffer orders overlaps unlike SVG's paint order (ADR-0003); the theme's
  CSS colors would have to be resolved for it; and three.js would land in
  every project that installs a chart. The projection it would move to the
  GPU is a small part of a frame today.
