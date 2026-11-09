# One scene is the renderer contract - charts project with d3-3d, the core draws

Context: the registry draws with three renderers - SVG, canvas and webgl - and
a chart must behave the same on all of them, gap-free. A chart that draws for
one renderer, or projects with mathematics of its own, breaks that silently:
the gap only shows when a reader switches the renderer.

Decision: a chart is a pure function from data to marks. It projects its data
with a d3-3d generator (`points3D`, `cubes3D`, `gridPlanes3D`, ...) on every
render, sorts the shapes with d3-3d's `sort`, and hands them to the core as one
scene. Only the core draws - as SVG elements, painted on a canvas, or
triangulated on webgl - and the hover hit-tests the scene, whatever the
renderer. Parity is behavioural: every mark of the scene draws on every
renderer, and hover, tooltip and focus act the same. Pixels may differ, and
webgl draws a stroke as a line loop, so the focus edge may differ in width
there (ADR-0002).

Three gates hold the contract, because prose alone does not: the template check
requires the d3-3d projection, the sort and the four demos (`-demo`,
`-update-demo`, `-renderers-demo`, `-many-demo`); fallow forbids a chart its
own trigonometry - hand-rolled projection - and the DOM, a canvas and the event
loop, which the core owns; and the parity test in `tests/chart-3d.test.tsx`
drives one scene with every mark shape over all three renderers.

Considered options: per-renderer chart code (rejected: three implementations
per chart drift apart, and every new chart pays three times), a 3D engine such
as three.js (rejected: a scene graph and a dependency where a projection
suffices, and the CSS theming of the marks would go), review alone (rejected:
a checklist nobody runs gates nothing).

Consequences: a chart never draws and never touches the DOM. The mark shapes
are a closed vocabulary - a polygon and a circle; a third shape turns `Mark3D`
into a discriminated union with an exhaustive switch everywhere the core draws
(`Marks3D`, `paint`, `paintGL`), and extends the parity test. The npm whitelist of the charts stays minimal
(`d3-3d`, `d3-array`): a chart reaches for a core helper first, then an allowed
d3 module, and never writes its own; a new d3 module is a deliberate change to
the dependencies of `chart-3d` in `registry.json` and lands in every installing
project, so it has to earn its place - or, where one chart alone needs it, to
the dependencies of that chart's item, which land only where the chart
installs, as the globe's `d3-geo` does (ADR-0006).
