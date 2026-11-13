# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `tooltip` on every chart: a function of what the mark would say, a title
  and its items, and of the data behind the mark - the entry and series key
  of a bar, the entry of a point, the series key and the spanned entries of
  a face of a ribbon, the row, column and height of a cell, the entries on a
  tile of the globe, the entry of a region or a place - that returns
  what it says, or `null` for nothing. It runs when the pointer lands on the
  mark (ADR-0006).
- `Mark3D.tooltip` may be a function, which the core calls when the pointer
  lands on the mark, so a chart with thousands of marks pays for one tooltip
  per hover, not one per mark per frame.
- `useSeries` hands back `entries`, the entry behind every name in the data.
- `choropleth-chart-3d`: the regions of the land on a globe, each in the
  color of its class, joined to the data by the `id` of the feature; a
  region fades in and out, and its name and value show on hover.
- `places-chart-3d`: a dot on the land at every place, its area the place's
  value, hidden on the far side of the globe; a new dot grows as it fades in.
- The geo helpers of the core, for a chart on the globe: `orthographic`,
  `earth` and `GLOBE_RADIUS`. d3-geo stays with the charts (ADR-0007).
- `globe-chart-3d`: `label`, the field that names an entry, as the title of
  the tooltip of its tile.
- `globe-chart-3d`: a globe of tiles between meridians and parallels, `step`
  degrees wide, on the land. The tile that holds an entry rises to its value
  in the color of its series; a new tile grows from the globe as it fades in
  and a gone one shrinks back. The `land` is a GeoJSON feature collection,
  cut at the horizon by d3-geo and laid on the ocean disc, flat in the colors
  of the walls. Regions as the data and hexagons are out of scope by decision
  (ADR-0007).
- `globe` in the core: the point at a longitude and latitude on a sphere in
  the world box, since a chart may not do trigonometry of its own.
- A chart may declare npm dependencies of its own on its registry item, which
  land only where that chart installs: the globe's `d3-geo` is the first.
- `--chart-3d-ocean` and `--chart-3d-land`: the colors of the ocean and the
  land of the globe, falling back to `--muted` and `--border`. The globe demos
  set them for a globe at night and show the populated places of the world,
  from Natural Earth, summed per tile, in nine classes of YlOrRd.
- `finite` and `colorOf` in the core, for a chart of your own: whether a
  value is a number the chart can place, and the CSS variable of a config key.

### Changed

- The docs say which exports semver covers from 1.0.0: the charts,
  `ChartContainer3D`, `ChartLegend3D`, their props and the types they take.
  What a chart is built from - `Axes3D`, `Marks3D`, the hooks, `Mark3D` and
  the helpers such as `earth` and `colorOf` - may change in a minor version.
- The install page no longer says the CLI installs `lucide-react`, and the
  home page no longer says the charts have no canvas.

- The tooltip of a mark is built from the data behind it: its values read
  as the ticks name them through `format`, and the entry of a bar as the
  ticks of x name it. The core sets the tooltip when the pointer lands on a
  mark and a glide never updates it, so it used to freeze a mid-glide number.
- A mark on its way out of the data - a bar, a point, a segment of a ribbon,
  a cell, a tile or a dot fading away - says nothing on hover.
- A turn - a drag or an arrow key - is divided by the zoom, so the chart
  moves as far under the pointer zoomed in as zoomed out (ADR-0001).
- The globe draws no side of a tile thinner than a pixel, projects the faces
  of the tiles in front of the globe only, and builds a tooltip only for the
  tile under the pointer: a globe of thousands of flat tiles turns about
  twice as fast (ADR-0007).
- The choropleth leaves out the land ring under a region it colors, so a
  colored region is drawn once.
- The wheel and a trackpad pinch zoom to the cursor: the point under it stays
  where it is, so the zoom moves `pan` of the view with it, and at the limits
  of the zoom the chart stands still. `+` and `-` zoom to the middle of the
  chart, as before (ADR-0001).

### Removed

- The webgl renderer. Measured, it drew no faster than the canvas, because
  projecting the marks on the CPU takes the time, not filling them: the
  globe's 2,500 tiles ran at about 25 fps on both. `renderer="webgl"` still
  works and draws on the canvas; the name is deprecated and goes in the next
  major version. The chart no longer opens a WebGL context at all, so the
  limit of about 16 per page and the fallback on a lost context are gone.

- `chart-3d` no longer depends on `lucide-react`: the keyboard icon of the
  shortcut button is drawn in the core. A project that installed it for the
  charts alone may remove it.

### Fixed

- An entry whose coordinate is `null`, an empty string or a boolean has no
  mark: the scatter chart, the places and the globe read it as 0 and drew a
  point on the floor, a dot or a tile at 0°, 0°. `finite` in the core tells a
  number a chart can place.
- A config key or a chart `id` with a character a CSS identifier cannot hold -
  the space of `"Net sales"`, the dot of `"q1.sales"` - keeps its colors: the
  container escapes it, where the browser dropped the rule and the marks drew
  black. `colorOf` in the core names the variable of a key; a plain key reads
  `var(--color-desktop)` as before.
- A value of `Infinity` in the bar and the area chart stands as 0, as one
  that is not a number, and a height of `NaN` or `Infinity` in the surface
  stands at the lowest of the others: one such value wrote `NaN` into the
  whole chart. So did a bar chart without data and without series.
- Entries of the same name are a bar, or a point of the area chart, of their
  own: two entries named "Jan" drew one bar, the last, where the axis named
  both. Their ticks and tooltips read the name as the data gives it.
- A chart taken out of a container that stays takes its marks along: the
  hover showed the tooltips of its marks over the empty chart, and the canvas
  kept painting them.
- The canvas renderer clears its canvas between frames instead of sizing it
  again, which threw its buffer away and made a new one every frame.
- `renderer="webgl"`: a chart holds one WebGL context, not two - the probe
  for support hands its context back at once - and a chart that loses its
  context, on a page with more WebGL charts than the browser allows or when
  the GPU resets, falls back to `"canvas"` and keeps drawing, where it
  stayed blank (#22).
- An `animationDuration` that turns 0 while a chart glides makes it jump to
  the new data: the marks vanished, their numbers `NaN`, until the data
  changed again.
- On a phone a vertical swipe on a chart scrolls the page: the svg carries
  `touch-pan-y` where it took every touch with `touch-none`, for a drag a
  touch cannot make without a modifier (ADR-0001).
- The SVG renderer rounds the center and the radius of a circle to two
  decimals, like a path: a sine's last bits differ between the server and
  the browser, and the dots of the places chart no longer fail to hydrate.
- The legend wraps where its entries do not fit in one row.
- A region inside another - Lesotho in South Africa - keeps its color and
  its tooltip on the choropleth: the larger region is painted first, and
  the hole of the region around it is no longer drawn as a second polygon
  over it (#19).
- The webgl renderer fills a polygon with a dent through the stencil buffer
  instead of cutting it into triangles on every frame, which took longer
  with the square of its corners: detailed land, such as the countries at
  1:50m, took 50 ms and more a frame for the cutting alone (#23). A polygon
  that crosses itself now fills even-odd on webgl, as the hover finds it.
- A `<` in the `id`, a key or a color of a chart is escaped where the
  container writes them into its style element, so a config built from the
  input of users cannot close that element on a server-rendered page.
  Whether the text is CSS stays with the app (#25).

## [0.6.0] - 2026-11-05

### Added

- `area-chart-3d`: the area under the line of every series, pushed back into a
  ribbon, one ribbon per series along z. Ribbons are painted back to front by
  the planes that separate them, so the order stays exact from every angle; an
  entry that comes or goes unfolds from its neighbour and folds back into it.
- `useSeries` in the core: the entries of a chart along x and its series along
  z, as the bar and the area chart lay them out, with their values, rows and
  presence gliding by name and the labels of their ticks.
- `tooltip` on `ChartContainer3D`: the corner beside the pointer the tooltip
  sits at, `"top-right"` by default. Where the tooltip would leave the chart
  it flips to the other side, on each axis alone, and its `data-placement`
  names the corner it took (ADR-0005).

### Changed

- The webgl renderer cuts a polygon into triangles ear by ear instead of
  fanning it out, so a concave mark - the front of a ribbon - fills as it does
  on SVG and canvas instead of spilling over its dents.
- **Breaking:** the tooltip follows the pointer instead of sitting above an
  anchor of its mark, so `Tooltip3D` has no `at` any more.

### Removed

- **Breaking:** `center` in the core, which computed the anchor of a tooltip.

## [0.5.0] - 2026-11-04

### Added

- `"webgl"` for `renderer` on `ChartContainer3D`, for more marks than the
  canvas paints smoothly. It draws the same scene - every mark, the hover, the
  tooltip and the focus edge - and falls back to `"canvas"`, then to SVG,
  where the browser has no webgl.
- `id` on `ScatterChart3D`: the field that names a point, so it follows its
  name through updates - a new one grows, a gone one shrinks away where it
  stands, and one that moves glides.
- Data that comes and goes animates on every chart: a bar follows the name of
  its entry, so an added month grows out of the floor, a removed one shrinks
  back into it and the rows around it glide to their new cells; a scatter
  point grows and shrinks; the surface fades the cells it gains or loses in
  place. A mark fades in as it grows and out as it shrinks, so nothing flat
  pops in or out at the end of a glide.
- `faded(color, opacity)` in the core: a color mixed with transparent, which
  every renderer draws, to fade the marks of a chart of your own.
- `--chart-3d-focus`: the color of the focus edge. Without it, a mark's edge
  is its own fill, lightened.
- Cursors that name the gesture: a hand while the platform modifier is held
  and `grabbing` while the camera turns, the four arrows while Alt is held,
  `zoom-in` or `zoom-out` while the wheel zooms.
- A `data-slot` on every visible part - the tooltip, the legend, the marks and
  the canvas among them - listed on the theming page as the way to restyle,
  move or hide a part with CSS (ADR-0004).
- The docs: every demo has a renderer select, and every chart page an
  enter-and-leave, a renderers and a many-marks example.

### Changed

- **Breaking:** a plain drag only inspects the chart, with the default
  cursor. ⌘ on a Mac, Ctrl on Windows and Linux, and a drag rotates it, as in
  the 3D viewers of the browser (ADR-0001). `keymap` turns the gesture off as
  before, but cannot rebind it to a plain drag.
- **Breaking:** Alt - ⌥ on a Mac - and a drag pans, instead of Space and a
  drag, and Space scrolls the page again. The wheel zooms with the platform
  modifier; a trackpad pinch zooms on every platform, as before.
- **Breaking:** `groups` on `Mark3D` names the marks of the same element, such
  as the faces of a bar. Pointing at a mark gives exactly those an edge in the
  focus color until the pointer leaves the mark; nothing fades and no fill
  changes on hover any more (ADR-0002).
- **Breaking:** `data-slot="chart-3d-shortcuts"` is the corner that holds the
  keyboard button and its panel; the list of shortcuts is
  `chart-3d-shortcuts-panel`.
- `useTween` keeps a key the data drops until the glide is done, gliding it
  back to the enter value, the mirror of its entering - or, without one,
  standing where it is.
- The shortcut panel names each action first, then its keys and - past a thin
  rule - its gestures. It closes on a click outside, and its button carries
  the page background, so it reads over the marks.
- Every part of the axes that enters fades in - a tick label, a tick mark, a
  gridline, a wall - and a tick the data drops fades out, in place or as the
  gliding end sweeps past it. The line of an axis grows to a new outermost
  tick and shrinks from a dropped one.

### Removed

- **Breaking:** the sankey chart, `sankey-chart-3d` and `SankeyChart3D`.
- **Breaking:** `groups` on `Label3D`: a label no longer fades with its mark.

### Fixed

- The line of an axis no longer runs past the box while the axis grows.
- The hover clears when the pointer leaves the mark, not only the chart, and
  stays through a drag.

## [0.4.0] - 2026-10-27

### Added

- `keymap` on `ChartContainer3D`: rebinds, renames or turns off every key and
  gesture of the chart, per action, in the syntax of `aria-keyshortcuts`.
  `keymap={false}` stands the chart still and takes it out of the tab order.
- `data-slot="chart-3d-shortcuts-trigger"` on the shortcut button and
  `data-slot="chart-3d-shortcuts"` on its list, which is now a `<dl>` that the
  button points to with `aria-controls`.
- `gizmo` on `ChartContainer3D`: the axes of the chart in its lower left
  corner, turned with the camera but neither panned nor zoomed. Another corner
  moves it, `gizmo={false}` hides it. It is `data-slot="chart-3d-gizmo"`, each
  of its axes `data-axis`, in `--muted-foreground`.
- `groups` on `Mark3D` and `Label3D`: pointing at a mark fades every mark and
  label that shares none of its groups, in place and with every renderer, until
  the pointer leaves the chart. The sankey chart sets them: pointing at a flow
  lights it and its two nodes, pointing at a node its flows and the nodes at
  their other ends.
- `toward` on `Label3D`: a unit vector that lays the label on that side of its
  point and slides it round the point as the vector turns. The sankey chart
  lays its node labels with it.
- `animationDuration` on `ChartContainer3D` and `useTween` in the core: a chart
  tweens the numbers of its data before it projects, so new data glides in -
  the axes, the domains and the shading follow - while the camera answers at
  once. `useTweenAxes` glides the ends of the axes with the marks, so the box
  scales smoothly instead of jumping from one round end to the next, and a
  tick label that the new data keeps glides on. The bar, scatter, surface and
  sankey charts use them, and their docs pages show an Update example that
  presses it. Where the reader asks for reduced motion, or the browser cannot
  say, the data jumps, as the camera does.
- `pad` and `intoWorld` in the core: `pad` widens the domain of an axis by
  half a cell and leaves its ticks as they are, `intoWorld` hands a d3-3d
  projection its accessors into the world box.

### Changed

- An axis draws its line along its edge of the box, between its outermost
  ticks, and a mark at every tick that points out of the box. Both fade from
  one edge to the next with the labels, and a mark hides where its label
  hides. The tick labels stand clear of the marks.
- The bar and surface charts keep half a cell of room between the data and
  the walls of the box. A `domain` handed to the surface chart still names the
  box exactly.
- `sankey-chart-3d`: flows that cross pass one another in depth, so a crossing
  no longer flips halfway and reads the same from every side. They share the
  depth of a flow in lanes, the lane that carries less in front, and nothing
  reaches out of it; a flow narrows into its lane and is whole again at the
  next node, or, where that way would be too steep, keeps to its lane.
- The shortcut panel has a row per label, with the keys and the gesture of an
  action side by side: five rows instead of nine.
- A key glides the camera to its next view in 200 ms instead of jumping
  there, and a held key turns it smoothly; a reset turns the short way round.
  Where the reader asks for reduced motion, the camera jumps as before.
- The axis labels no longer dim while the camera turns: they slide round
  their ticks with it, and fade where they come and go.
- `d3-3d` 2.4.0 or later, for the edges of the chart box that `edges` lists.

### Fixed

- A key with a modifier it is not bound with goes to the browser: Ctrl and
  `0`, `-` or `=` zoom the page again while the chart has the focus.
- An axis label no longer vanishes where it has room: a label that would
  touch its neighbour slides along the axis, two rows take labels that still
  have none, and a label gives way only to an axis with fewer ticks. The two
  series of the bar chart demo show from every angle.
- The axis labels no longer jump: a label slides round its tick instead of
  switching from one text anchor to another, and an axis that moves to
  another edge of the box fades from one to the other.
- The axis labels no longer flicker when the camera is level with the box,
  where an axis jumped between the floor and the ceiling.
- A node label of the sankey chart swings over its node as the node turns
  edge on, instead of jumping across it.

## [0.3.0] - 2026-10-23

### Added

- `sankey-chart-3d`: flows from left to right, as bands between boxes. The core
  gains `Labels3D`, for text beside the marks, and `cubeMarks`, which the bar
  chart uses too.
- `aria-keyshortcuts` on the chart, from the same table as the shortcut panel,
  and `data-slot="kbd"` on the keys of the panel, so a project restyles them
  the way it restyles the Kbd of shadcn/ui.

### Fixed

- `SurfaceChart3D` no longer throws on an empty grid; it draws the box without a
  surface.

## [0.2.0] - 2026-10-23

### Added

- `renderer="canvas"` on `ChartContainer3D`: the charts hand their marks to the
  core, which draws them as SVG or on a canvas, and one hit test finds the
  hovered mark for both. `Marks3D` draws the marks of your own shapes.
- Pan, zoom and reset beside the rotation, with a panel of the shortcuts behind
  the keyboard button and `?`.
- The axis labels fade out while the camera turns and back in once it rests.
- The npm package `@niekes/charts-3d`: the same components as the registry, from
  the same files, as ESM with type definitions. Add
  `@source "../node_modules/@niekes/charts-3d/dist"` to your CSS so that Tailwind
  generates their classes.

### Changed

- `chart-3d` depends on `lucide-react`, for the keyboard icon.

## [0.1.0] - 2026-10-23

### Added

- `chart-3d`: the core every chart installs with it. `ChartContainer3D` takes the
  `ChartConfig` of shadcn/ui, holds the camera, turns on drag and on the arrow keys,
  and shows the tooltip and the legend. `useChart3D` hands the camera to your own
  d3-3d shapes, `Axes3D` draws the chart box, and `axis`, `linear`, `worldBox`,
  `shade` and `center` are the helpers the charts share.
- `bar-chart-3d`: bars on a floor, one row per entry and one per series, with
  negative values.
- `scatter-chart-3d`: points in a box, colored by series.
- `surface-chart-3d`: a shaded surface over a grid of heights, with a color ramp
  between two config keys.
- The documentation site: a page per item with a preview, its code, the install
  commands and the API table, prerendered to static HTML.
