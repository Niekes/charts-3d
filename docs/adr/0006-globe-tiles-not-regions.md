# The globe is a grid of tiles, not regions - lat/lon tiles, no d3-geo

Context: the globe chart shows a value per place on the earth - population,
disasters - and the obvious shapes are regions, as GeoJSON country outlines,
or hexagons, as a hexbin. d3-3d projects every vertex of a polygon and clips
nothing: a region that straddles the horizon of the globe, such as Russia or
Antarctica, draws its hidden half over the front. Clipping a sphere is what
d3-geo does, and a dependency of the core lands in every installing project.
Hexagons do not tile a sphere; H3 does it with twelve pentagons and a package
of its own.

Decision: the globe is a grid of tiles between meridians and parallels, `step`
degrees wide, and the data is one entry per tile: the fields of its center,
`lon` and `lat`, a `value` that becomes its height and a `series` that names
its color. A tile is small, so it is whole or hidden, culled by `ccw` as a face
of a cube is, and the grid tiles the sphere with no gaps and no dependency.
Every tile of the grid is drawn, an empty one flat in the wall color, so the
tiles together are the globe. Aggregation happens before the chart: a point
dataset is rounded to the grid by the user, a raster already is one.

Considered options: GeoJSON regions (rejected: horizon clipping needs d3-geo in
the core's dependencies, for one chart); hexagons (rejected: they do not tile a
sphere without H3); a smooth sphere under the data tiles (rejected: a second
shape for what the empty tiles already draw); aggregating points in the chart
(rejected: binning on a sphere is a dependency or trigonometry, which a chart
may not have).

Consequences: the data shape is semver, so regions, if a user asks for them
and accepts d3-geo, are a second chart, not a change to this one. The globe is
the only chart without axes. Charts may not call `Math.sin` or `Math.cos`, so
the mapping from lon/lat to the sphere is a core helper, `globe`, exported and
part of the npm API.
