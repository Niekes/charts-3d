# The globe is tiles on d3-geo land - the data a grid, the earth regions

Context: the globe chart shows a value per place on the earth - population,
disasters - and the obvious shapes are regions, as GeoJSON country outlines,
or hexagons, as a hexbin. d3-3d projects every vertex of a polygon and clips
nothing: a region that straddles the horizon of the globe, such as Russia or
Antarctica, draws its hidden half over the front. Clipping a sphere is what
d3-geo does. Hexagons do not tile a sphere; H3 does it with twelve pentagons
and a package of its own. A globe of nothing but tiles draws the empty ones
too, flat in the wall color: thousands of marks for a shape the reader does
not recognise as the earth.

Decision: the data is a grid of tiles between meridians and parallels, `step`
degrees wide, one entry per tile: the fields of its center, `lon` and `lat`,
a `value` that becomes its height and a `series` that names its color. A tile
is small, so it is whole or hidden: culled by `ccw` as a face of a cube is,
and behind the center plane of the globe, since the ocean is one disc drawn
first and a side of a far tile turned to the camera would show through it.
Aggregation happens before the chart: a point dataset is rounded to the grid
by the user, a raster already is one. Under the tiles lies the land: the
regions of a GeoJSON `FeatureCollection` the chart takes as `land`, required,
drawn with d3-geo's orthographic projection, which cuts them at the horizon,
on an ocean disc. The chart builds that projection from the core's camera -
its scale, origin and rotations - so the land turns, pans and zooms with the
gizmo and the shortcuts, and renders it through a sink that collects each
ring, cut at the horizon, as a polygon of points: every ring is a mark the
core draws on every renderer, grouped by nothing, with no tooltip, and it
neither enters nor glides. The land and the ocean are flat, in the colors of
the walls; the depth comes from the shaded tiles and the horizon. d3-geo is a
dependency of the globe item alone, not of the core, so a project that
installs the bar chart never gets it; a chart may import its own declared
dependencies, and the template check allows exactly those.

Considered options: GeoJSON regions as the data, a choropleth (deferred: the
data shape is semver, so a region colored by its value is a second chart on
the same land, not a change to this one); hexagons (rejected: they do not
tile a sphere without H3); empty tiles as the globe (rejected: a third of the
marks of the default demo and half of the many demo, for a surface the land
draws in a few hundred rings); d3-geo in the core (rejected: every installing
project would carry it for one chart); a third mark shape for a path string
(rejected: the canvas and webgl would need to parse it, where a sink hands
them polygons); d3-geo for the cut at the horizon only and d3-3d for the
projection (rejected: more code for a perspective the globe does not use);
lighting the land with `shade` (rejected: a ring has no face in 3D, and lit
land on a flat ocean looks odd); aggregating points in the chart (rejected:
binning on a sphere is a dependency or trigonometry, which a chart may not
have); TopoJSON as the input (rejected: the user converts it, as the user
aggregates).

Consequences: the globe is the only chart without axes, and it ignores the
camera's `perspective`: d3-geo has no perspective projection, so under it the
land and the tiles would disagree, and the page says so. A test holds the two
projections together: a tile corner and the geo projection of the same
longitude and latitude land on the same point. The land does not make the
globe fast on SVG - the prism faces remain, more than half of its marks - so
canvas stays the renderer for many marks. Charts may not call `Math.sin` or
`Math.cos`, so the mapping from lon/lat to the sphere is a core helper,
`globe`, exported and part of the npm API. Holes in a region, such as a lake,
fill in the land color; world-atlas at 110m has none.

Amended 2026-11-09: the ocean and the land draw in `--chart-3d-ocean` and
`--chart-3d-land` where those are set, and in the colors of the walls
otherwise - looks are CSS (ADR-0004), and the globe demos set them for a globe
at night.

Amended 2026-11-13: world-atlas at 110m does have a hole, Lesotho in South
Africa. A hole still fills in the color of the region around it, once: its
ring is not drawn as a polygon of its own, and the choropleth paints the
larger region first, so a region inside another lands on top (#19).

Amended 2026-11-09: a tile thinner than a pixel on screen draws its top alone.
Its sides would draw nothing, and on a globe of thousands of flat tiles - the
places of the world, summed per tile - they are most of the faces d3-3d
projects and sorts, so leaving them out turns the globe about twice as fast.
The sides join as the tile grows past a pixel, too small to see.

Amended 2026-11-09: the choropleth and the places chart join the globe on the
same land - the regions colored by class, deferred above, and dots at places,
their area a value. What the three share moved to the core, without d3-geo:
`orthographic`, the camera without its perspective; `earth`, which takes the
chart's `geoOrthographic()` and `geoPath`, sets the projection to the camera
and returns the ocean and the land as marks, with the path and the sink that
collects rings for a chart that draws regions of its own; and `GLOBE_RADIUS`.
Each chart imports d3-geo itself and declares it on its own item, so the core
still carries none. The template check lets a chart of regions alone project with
`geoPath` instead of a d3-3d generator, since it has no shapes of d3-3d to
sort. The globe also projects the centers of its tiles first and builds the
faces of those in front of the center plane only: the faces of the others
are behind it too, and projecting them only to cull them cost half the
frame.
