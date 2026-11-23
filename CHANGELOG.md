# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- A tick mark follows its label where the label moved to make room: in a
  curve where it slid along the edge, straight out where it took a second
  row - unless that way runs through a tick label of the first row, where
  the mark stays short.

## [1.0.0] - 2026-11-23

### Added

- `useTooltips(deps)`, the tooltips of a chart's marks, each built once per
  mark and kept until `deps` change.
- `entryTicks(count)`, about ten ticks on whole entries, which the bar and
  the area chart lay along x.
- `joined(...parts)`, one key of several parts, such as an entry and its
  series, joined by a control character no name is expected to hold.
- `keyOf(value, fallback)`, the config key a field of the data names: the
  value as a string, or `fallback` where it is missing or blank.
- `earth` also returns `ground(feature, key)`, which draws one feature as
  land, for a chart that paints the land of a region in an order of its own.
- `LineChart3D`, lines through the chart box: the entries of `data` at their
  fields `x`, `y` and `z`, joined in the order of the data - a trajectory, a
  spiral, a walk - one line per value of `series`. A line is as wide on the
  screen from every side, pointing at it lights the point nearest the
  pointer, with a dot on it, and the tooltip reads that point. `colors`
  ramps each point's part of a line by its height between two config
  colors. An entry without a finite x,
  y or z breaks its line instead of being bridged. With `id`, a new point
  unfolds from the point before it and a gone one folds back, so a line
  grows at its end and shrinks from its start.
- `whenLit` on `Mark3D`: a mark drawn only while its groups are in focus,
  on every renderer, such as the dot on the point of a line.
- The core helpers the scatter and the line chart share: `usePoints` and
  `pointTooltip`.
- `RoutesChart3D`, routes over a globe: the entries of `data` are stops at
  their `lon` and `lat`, joined in the order of the data along the great
  circle, one route per value of `series`. What lies on the far side is
  hidden by the globe. Pointing at a leg lights that leg alone and says its
  two stops; a stop lights and says itself. `leg` names the field that gives
  a leg a color of its own, the config key the stop it arrives at names. With `id`, a stop that joins the end of a
  route grows its leg out of the stop before it, and a gone one draws its
  leg back.
- `view` on `ChartContainer3D`, a view the camera heads for: it starts
  there and glides there over the `animationDuration` when the view changes,
  moving only what the view names; the reader turns on from it (ADR-0010).
  `facing(lon, lat)` is the view that looks at a place on the globe, and
  `placeOf(point)` reads a place back from a point of it.
- `useTween` takes a function for `enter`: where a key comes from among the
  numbers on screen, and where a gone one goes among the new ones, such as
  the number of its neighbour.
- The core helpers the line and the routes chart share: `useRuns` and
  `segment`; and `useConfigKeys`, which the scatter and the routes chart
  share.
- `symbol` on a key of `ChartConfig`, and the tip of a route: the last stop
  of a route is drawn as the symbol of the key that colors it, in place of
  its circle - a plane, a ship, any icon as SVG path data in a box of 24,
  outlined as Lucide draws it or filled. A symbol that names where it
  `points` turns to its bearing, the leg that arrives; one that names none
  stays upright. A stop that joins a route flies its leg as the tip, and
  its symbol turns into the new bearing as it sets out, the shorter way
  round, turned when a quarter of the leg is flown (ADR-0011).
- The core helpers of a geo chart that turns one place round another:
  `azimuth(from, to)`, the way one place sets out for another, `placeAt`,
  the place that way and so far on, and `azimuthAt(camera, place, way)`, the
  way over the globe of a way on the screen.

### Changed

- The core's builder helpers - every name the Stability section lists as
  free to change in a minor version - say so in their doc comment with
  `@experimental`, so an editor shows it where they are imported.
- `floored(shapes, projection)` hands every shape - a cube, a quad of a
  grid, a polygon - where it stands on the floor as `floor`, for d3-3d's
  `sort`: the point of its footprint nearest to the eye. It took cubes alone
  and handed each its bottom face.
- `BarChart3D`: a value that is not a finite number draws no bar, as in
  `BarFieldChart3D`, not a flat tile with a tooltip; a value that goes
  missing shrinks back into the floor and fades as it does, saying nothing
  on hover on its way out, and fades in again as it comes back.
- `SurfaceChart3D`: a cell says the x and z it starts at beside its height,
  and hands them to `tooltip` as `x` and `z`, as a bar of `BarFieldChart3D`
  does.
- A series the config does not name, and a chart without a config, draw in
  `currentColor`, the color of the text, on every renderer: `colorOf(key)`
  is `var(--color-key, currentColor)`. An undeclared variable drew black on
  SVG and the text color on the canvas, and a chart without a config read
  `--color-undefined`.
- `AreaChart3D`: a single entry draws no ribbon, where it drew the two ends
  of one without a width.
- `BarChart3D` ticks about ten of its entries along x, as `AreaChart3D`
  does, not every one: a dozen bars keep a label each, a year of daily bars
  lays out eight instead of 365, and turns at frame rate. The labels of an
  edge make room for each other in linear time, not quadratic.
- The title of an axis runs along its edge as the screen shows it, never
  upside down, beyond its tick labels at the middle of the edge: the y title
  stands along the vertical axis, bottom to top, instead of over its top end,
  and a floor title no longer sticks out from the box by its width. A title
  fades out where its edge points at the camera, as the y axis does from
  straight above (ADR-0013).
- **Breaking:** `format` of `GlobeChart3D`, `PlacesChart3D` and
  `ChoroplethChart3D` is a record keyed by what it formats, as in every other
  chart: `format={{ value: fn }}` in place of `format={fn}`. A prop means
  one thing in every chart that takes it, listed under Props on the
  `chart-3d` page (ADR-0012).
- **Breaking:** `placement` on `ChartContainer3D` is the corner the tooltip
  sits at, `placement="bottom-left"` in place of `tooltip="bottom-left"`:
  `tooltip` is what a mark says, on every chart (ADR-0012).
- **Breaking:** `Mark3D` names its shape: a mark is a polygon unless `shape`
  says `"circle"` or `"symbol"`, and the core draws each through an
  exhaustive switch on every renderer. A chart of your own that hands
  `Marks3D` a circle adds `shape: "circle"` beside its `r`; without it the
  circle draws and hits nothing. A polygon stays as it is.
- **Breaking:** the `id` of `ScatterChart3D` and `LineChart3D` names an
  entry within its `series`, as the routes chart's does: lines that share
  ids keep their points when the data reorders, and a point that changes
  its series is a new point that grows in, not one that glides there. `id`
  is read as text: a key of several fields, or a nested one, is a field the
  page derives, `data.map((d) => ({ ...d, key: `${d.a}-${d.b}` }))` (ADR-0012).
- `facing` is on the semver side of the Stability list: a page hands it to
  `view`. `uniqueIds` joins the core helpers.
- What a stylesheet styles a chart by - the names of the `data-slot`s, the
  `data-*` attributes beside them and the CSS variables of the Theming page
  - is on the semver side of the Stability list too.
- The docs follow the release: the release workflow deploys them from its
  tag once the version is on npm, and its commit pins their install
  commands to it.

### Removed

- **Breaking:** `renderer="webgl"`, deprecated in 0.7.0: use `"canvas"`,
  which it drew as. It goes in 1.0.0, as 0.7.0 announced. Only the type
  drops it: a caller that still passes it draws on the canvas.

### Fixed

- `SurfaceChart3D`: the cells paint in the order of their footprints,
  however high each reaches. They were ordered by the depth of their middle,
  height and all, so a high cell behind could paint over a low one before
  it: a stepped or a noisy surface showed that on a tenth of its pixels and
  more.
- `BarChart3D`, `BarFieldChart3D`: a bar below 0 paints in the order of its
  footprint, as one above it. The bars were ordered by their bottom face,
  which lies below the floor for a bar that hangs from it, so among bars
  above and below 0 one behind could paint over the one before it.
- With `perspective` in the view, the bars, the ribbons of `AreaChart3D` and
  the cells of the surface paint in the order of their distance from the
  eye. They were ordered by their depth, so seen along an axis of the box a
  mark further out could paint over the one that hides it.
- Bars, ribbons and cells that stand equally deep paint in the order of the
  data, so the server and the browser, which round a sine differently in the
  last bit, agree on a view along a diagonal of the box.
- Every chart takes data whose entries are declared as a TypeScript
  `interface`. The type of an entry had to be a `Record<string, unknown>`,
  which an interface - it has no index signature - is not, so
  `data={rows}` did not compile for `rows: Sale[]` of an `interface Sale`;
  a type alias did. The constraint is `object` now - no `any`, which the
  linters of a Next.js or a Vite project reject in the files the registry
  copies; nothing changes at run time, and `tooltip` is handed entries of
  the type given.
- `PlacesChart3D`: a lone dot grows out of an empty globe and shrinks back
  into it, where it popped in at full size and only faded.
- `ScatterChart3D`, `LineChart3D`: a single point, or a field that never
  varies, lies in the middle of its axis, not on the wall of the box.
- `ChoroplethChart3D`: an id with spaces around it, as padded CSV holds it,
  matches its region.
- A key listed twice in `keys` is one series, not a second, empty lane.
- Two fingers turn and zoom the chart when they land on its marks or the
  walls of its box: on a phone, a pinch with each finger on an element of its
  own was left to the page, so the chart moved only where both fingers met
  its bare background.
- An entry named like a property every object has - `constructor`,
  `toString`, `__proto__` - glides in and out like any other: the bar and
  the area chart hid it until its glide was done, the line drew NaN and the
  scatter threw. The glides ask for the keys an object has of its own, and
  so does the scatter for the presence of a point: one so named flashed
  black where a new `radius` came while it left.
- `BarFieldChart3D`, `SurfaceChart3D`: a height given as text, as parsed CSV
  has it, is the number it names - compared as text, "9" topped "100", the
  axis ended short or ran upside down and a glide added the text up. So is a
  place given as text through `x`, `z` or `domain`: joined as text, "10" and
  half a cell ended the axis at "100.5", and the grid stood squeezed into a
  corner of the box.
- `RoutesChart3D` with `id`: a stop is named within its route, so two routes
  through one stop keep their own - a route that came or went folded the
  other one, which had not changed, and regrew it.
- A drag let go beyond the chart before it turned anything no longer turns
  the camera later, when the pointer comes back with the modifier but no
  button held: a drag ends with its button.
- The tooltip says a number below 1 to three significant digits, so 0.0004
  no longer reads 0; from 1 on it keeps three decimals, as before.
- `BarChart3D`, `AreaChart3D`: names and series with a hyphen keep their
  values apart - the entry "a" of the series "b-c" and the entry "a-b" of
  "c" drew the same bar. The keys of the marks of the bar, the bar field,
  the area, the line, the routes and the choropleth chart join their parts
  with `joined`, so a region "US" of the series "CA-low" and "US-CA" of
  "low" no longer share one.
- A mark under a pointer that rests no longer builds its tooltip again at
  every frame of the camera or of a glide, nor renders the container with
  it: the charts keep their tooltips through `useTooltips` - the globe kept
  its own already - and `tooltip` runs once until the data, the config or a
  prop it reads changes.
- The tooltip and the focus under a pointer that rests follow new data and
  a turn of the camera: the mark under the pointer is hit again whenever the
  marks change, where the tooltip of a mark that had changed or left went on
  saying its old values until the pointer moved.
- `keyOf` drops the spaces around a value, as `leg` of `RoutesChart3D`
  already did: a padded `series`, such as `" b "` from a CSV, colors its
  config key `b`, where it was a key of its own without a color.
- `ChoroplethChart3D`: a feature whose `id` is null is scenery, as one
  without an id, where an entry whose id was missing colored every such
  feature.
- `GlobeChart3D`: when `step` changes, the tiles of the old grid fade out at
  their own size, where they swelled to the new one and covered their
  neighbours while they left, and near the horizon, where the margin of the
  new grid hid them early.
- `PlacesChart3D`: a dot sent to a new place mid-glide turns the short way
  round from where it is on screen, where it measured from the place it was
  headed for and could circle most of the globe the long way.
- `PlacesChart3D`: a dot whose series changes fades out in the old color as
  it fades in in the new one, as a tile of the globe and a region of the
  choropleth do, where its color switched at once; the two glide together
  where its place changes too.
- `BarChart3D`, `AreaChart3D`: a series that `keys` or the config drops
  flattens and fades away, and the series that stay glide to their new rows,
  where the dropped one vanished at once and the others jumped past their
  place; a series that comes fades in as it grows, where it popped in. A
  series on its way out says nothing on hover. `useSeries` returns `lanes`
  and `lanePresence`, the place of every series along z and how far it has
  come.
- `LineChart3D`, `RoutesChart3D`: a point or a stop that loses its x, y or
  z - its lon or lat - folds into its neighbour and fades out before the
  line breaks there, as one that leaves the data does, where the line broke
  at once and both of its segments vanished.
- The canvas renderer follows new colors in `config`: a mark it painted in
  the old color of a key, where SVG already showed the new one, until the
  theme changed.
- An entry without its `series` field, or with it null or blank, takes the
  first key of the config, the key it takes without `series`, where it was
  the key "undefined": a mark without a color, titled "undefined", in the
  scatter, line, places, routes, globe and choropleth charts.
- `PlacesChart3D`, `RoutesChart3D`: a place or a stop whose `id` is null or
  missing is titled by its series or named by its place, never "null" or
  "undefined".
- `LineChart3D`, `RoutesChart3D`: thousands of points that arrive at once,
  as data that loads into an empty chart, find where they enter from in one
  sweep per line, where a search per point froze the page for seconds.
- `ChoroplethChart3D`: a numeric code names its region whatever its leading
  zeros, so `40`, as parsed data holds it, colors Austria, `"040"` in
  world-atlas, where it colored nothing.
- `ChoroplethChart3D`: a region inside another without an entry of its own,
  as Lesotho in South Africa, lies over the color of the region around it,
  where the pointer finds it, instead of under it, naming the outer region.
- `SurfaceChart3D`: the cell of a short row's missing corner stands at the
  floor and shows, where it was invisible and lit up white on hover.
- `GlobeChart3D` and `ChoroplethChart3D`: an entry whose `label` is missing
  or null is titled by its series, where the tooltip said "undefined" or
  "null".
- `BarChart3D`, `AreaChart3D`, `GlobeChart3D` and `PlacesChart3D`: a
  missing value stands as 0 but says no value in its tooltip, where it said
  0, as the choropleth; the globe and the places chart tell a negative value
  as it is, where they said 0.
- `GlobeChart3D`: a longitude beyond -180..180, as data from 0 to 360 has,
  wraps round to its tile, where every one east of 180 piled up on the last.
- `BarChart3D`, `AreaChart3D` and `PlacesChart3D` draw more than about
  120,000 values, where the chart threw "Maximum call stack size exceeded".
- `ChoroplethChart3D`: a region of several features of one `id`, as a
  mainland and its islands, colors every one of them, where only the last
  was colored and the others showed as ocean.
- `PlacesChart3D`: a dot that moves glides there, as `id` promises, the
  short way over the antimeridian, where it jumped; and a name or a place
  that repeats is a dot of its own, where the last one hid the others.
- `GlobeChart3D`: a `step` that does not divide 180, such as 7, draws the
  tiles of the default, where it drew tiles past the poles or overlapping.
- `SurfaceChart3D` fades a cell as every mark fades, in oklab.
- The hover finds the mark under the pointer in an svg that CSS made
  taller than its view box, as the wheel and the pinch do.
- The canvas renderer paints the marks on their axes in an svg that CSS made
  taller or wider than its view box: the canvas takes the box of the svg and
  fits the view box into it as the browser does, centred, where it kept the
  shape of the view box at the top of the svg.
- With `perspective`, the line of an axis stays on its edge while a glide
  changes the scale: it was found between two ticks, and a tick of the new
  data far beyond the box threw it across the chart for some frames.
- With `perspective`, a face is lit as the side of it the eye sees: the left
  and the right sides of a row of bars seen from the front took one shade.
- A `view` that names a `perspective` brings the eye in over the
  `animationDuration`, as it turns the camera, where the perspective jumped.
- A tooltip whose `title` is the number 0 - an hour, a row - shows it as a
  title, where it stood bare above the items.
- Data that comes faster than the `animationDuration`, as from a feed, no
  longer piles up the marks it drops: a glide starts over with every change,
  so a mark on its way out was never done leaving - a line of 20 points fed
  every 50 ms held 1,258 marks after 20 seconds, and every update took
  longer. A mark that left the data now goes with the first change that
  comes the time of a glide after it left (`useTween`).
- The canvas renderer repaints in the colors of a theme switched by a class
  on any ancestor of the chart, such as `.dark` on a wrapper or on `<body>`:
  it followed `<html>` alone, and its marks kept the old colors while the
  box and the labels changed.
- `SurfaceChart3D`: cells that come or go stay inside the box while the axes
  glide. A new border cell stood at its own place and height, beyond the old
  walls, until the axes made room for it - with `perspective` reaching across
  the whole chart - and a leaving one rose out of the box as the axes shrank.
- `view`: a field it leaves undefined, as `{ ...facing(lon, lat), zoom }`
  does without a zoom, is one it does not name: the zoom and the pan of the
  reader stay, where they went back to the default.
- `GlobeChart3D`, `PlacesChart3D` and `ChoroplethChart3D` without a config
  draw in `currentColor`, as every other chart does: the choropleth threw,
  and the globe and the places drew in `--color-undefined` and said
  "undefined" in every tooltip. `keyOf` hands back the empty key where there
  is neither a value nor a fallback, and `colorOf` draws it in
  `currentColor`.
- The files of the registry lint clean in a new Next.js 16 project, whose
  react-hooks rules forbid reading and writing refs while rendering: the
  five files whose hooks remember values that way say `/* eslint-disable */`,
  with the reason, until those hooks keep them in state. The lint of the
  repository holds the other files to those rules.
- The code of the registry compiles in a project that turns on
  `noUnusedLocals` and `noUnusedParameters`, as the React template of Vite
  does: `chart-3d` held a parameter it never read, and the build of such a
  project stopped there. The repository checks itself with both now.
- `ChartContainer3D` puts its `id` on its `div`, as it does the other props
  of a div: it only scoped the colors of the chart, so a link or an
  `aria-labelledby` that named the id found nothing.
- `require("@niekes/charts-3d")` finds the package, as `import` does: the
  exports named the entry for `import` alone, so Jest and other tools that
  resolve with `require` stopped at `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- A glide whose `animationDuration` changes on its way goes on from where
  it is, where it started over.
- `keymap`: `Shift+Space` is a binding of its own, where it fired on Space;
  a field left undefined keeps its default keys or label, where it took
  the action off or the button lost its name; and a hint that shows when
  the keymap changes closes, where it stayed.
- The box, its labels and the gizmo write their numbers with two decimals,
  as the marks, so the HTML the server writes is the HTML the browser
  hydrates.
- `BarChart3D`, `AreaChart3D`, `BarFieldChart3D`, `ScatterChart3D`,
  `PlacesChart3D` and `GlobeChart3D`: a mark on its way out while new data comes no longer paints black or
  vanishes - its fade could end before its glide, as when rows with
  names like years reorder, and it drew with no opacity at all.
- `ChoroplethChart3D`: a region whose value is missing - `null`, `""`, not
  a number - says no value in its tooltip, where it said 0.
- The focus stays within the `Marks3D` of the hovered mark: two charts in
  one container whose `groups` share a name, such as the point names of a
  line and a scatter chart, no longer light each other.
- `ScatterChart3D` and `LineChart3D` with `id`: entries of the same name are
  points of their own, told apart by the order of the data, where they
  shared one point before.
- New data that comes while a chart glides no longer flashes: a frame the
  glide before had queued could move the next one, so a mark on its way out
  jumped to its end for a frame.
- `LineChart3D`: a point that goes from the start of a line after a gap
  folds into its line, where it stood alone before; and new data that comes
  while points are on their way moves every one on from where it is, where
  the line jumped to its places before - a new point starts on its
  neighbour wherever that has come to, and a gone one heads for the nearest
  that stays.
- `ChartLegend3D` on its own, outside a container, shows the colors of its
  config, where its swatches were empty: it scopes the `--color-*` of its
  config itself.

## [0.7.0] - 2026-11-15

### Added

- `BarFieldChart3D`, a field of bars over a grid of values, `data[row][column]`,
  colored on a ramp by height - the bar chart of a height map. Everything
  about a bar comes from the data: its place, its footprint, its height and
  its color. Its columns and rows stand evenly over `domain`, or at any
  values through `x` and `z`, the footprint the smallest gap between them.
- `x` and `z` on `SurfaceChart3D`: the value every column and row stands
  at, at any spacing, in place of `domain`; a column or row without a finite
  value drops out, its neighbours joined.
- The core helpers the bar, surface and bar field charts now share:
  `barCorners`, `barMarks`, `floored`, `gridAxis` and `ramp`. A surface of a
  single row or column without a `domain` now keeps half a cell of room
  along it, as every other grid does.
- A drag that turns nothing - the mouse without ⌘ or Ctrl, one finger
  sideways - shows a hint in the middle of the chart, over a light veil, for a
  moment: the gesture that would have turned it, as the shortcut panel names
  it. It follows `keymap`; the veil is the slot `chart-3d-hint`, the box in
  it `chart-3d-hint-box` (ADR-0001).
- On a touch screen two fingers turn the chart and pinch it to the point
  between them, while one finger scrolls the page and a tap inspects:
  `touchOrbit` and `pinchZoom` in the shortcut panel and in `keymap`
  (ADR-0001).
- `finite`, the core helper the charts read numbers with:
  `null` and `""` are missing, not 0, and an infinite value stands as 0.
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
- `useSeries` hands back `entries`, the entry behind every name in the data,
  and `nameOf`, the name behind the id of an entry, where a name repeats.
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
- `finite`, `nonNegative` and `colorOf` in the core, for a chart of your own:
  whether a value is a number the chart can place, an amount to size a mark
  by, and the CSS variable of a config key.

### Changed

- **Breaking:** a chart notices new data by a new `data` array: one changed
  in place no longer redraws it. Hand it a new array, as React state does.
- The canvas turns a surface of thousands of cells faster - the 80 by 80
  demo from about 30 to about 50 frames a second: it resolves every color
  once into the sRGB it paints, whose `rgb()` it parses about four times
  faster than the `oklch()` of the theme, and once per mark, not once for
  the fill and again for the outline; `SurfaceChart3D` builds its lattice
  and the color, name and tooltip of every cell once per change of the
  data, not at every frame the camera turns.
- **Breaking:** `useTween` hands back the record of its target, no copy,
  while nothing glides: read it, never write to it.

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

### Deprecated

- `renderer="webgl"`: it draws on the canvas, as `"canvas"` does, and the
  name goes in 1.0.0. Use `"canvas"`.

### Removed

- The webgl renderer. Measured, it drew no faster than the canvas, because
  projecting the marks on the CPU takes the time, not filling them: the
  globe's 2,500 tiles ran at about 25 fps on both. The chart no longer opens
  a WebGL context at all, so the limit of about 16 per page and the fallback
  on a lost context are gone.
- `chart-3d` no longer depends on `lucide-react`: the keyboard icon of the
  shortcut button is drawn in the core. A project that installed it for the
  charts alone may remove it.

### Fixed

- The box of `SurfaceChart3D` ends where its grid does: its x and z axes
  were rounded to nice ends, so 16 columns at 0 to 15 got a box running on
  to 20, empty beyond the surface, and a `domain` of 0.3 to 9.7 a box from
  0 to 10. The walls now stand half a cell beyond the outer columns and
  rows, or at the ends a `domain` names, with the ticks within.
- `SurfaceChart3D` counts its columns by its longest row, as the bar field
  does: a first row shorter than the others no longer leaves the columns
  beyond it outside the box.
- The globe turns faster with thousands of tiles: it reads every tile from
  its id once, places its corners on the globe once and lifts them by its
  height, and makes its tooltip once, not at every frame. The many demo,
  about 5,200 tiles on the canvas, went from 34 ms a frame to 20 ms (29 to
  50 fps; minified build, headless Chrome, median of five runs).
- A tap on a mark shows its tooltip on a phone, and lifting the finger
  keeps it until a tap elsewhere; before, a phone showed no tooltip at all.
- A tooltip tells the new value of its mark at the next move of the
  pointer once new data arrives, instead of the one it showed before.
- The cells of a surface keep their names as the grid grows, so the lit
  cell and its tooltip stay the same cell.
- Without `id`, a scatter point keeps its name when an entry before it
  gains or loses its place.
- The published types start with no `"use client"`, which broke projects
  with `skipLibCheck: false`, and load the GeoJSON types `land` names.
- The globe gathers the entries of a tile in one list, where it copied it
  per entry.
- Turning the camera no longer compares the data mark by mark: the charts
  build the numbers they glide once per change of the data, and `useTween`
  compares a record only when it is a new one. With 5,000 points the scatter
  chart spent about 4 ms of every frame on it. A chart now notices new data
  by a new `data` array: one changed in place does not redraw it.
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
  stands at the lowest of the others, and a cell it touches says nothing on
  hover: one such value wrote `NaN` into the whole chart. So did a bar chart
  without data and without series.
- A value of `Infinity` on the globe and the places chart stands as 0, as one
  that is not a number: the dot of that place drew at a radius of `NaN` and
  shrank every other dot to nothing, and on the globe the other tiles fell
  flat.
- A `step` on the globe that made no tiles - 0, below 0, `NaN`, `Infinity`
  or wider than 180 degrees - draws the tiles of the default, 5 degrees.
- More than one `Marks3D` in a container - a chart and marks of your own
  beside it - all draw and answer the hover, in their order in the tree on
  every renderer: the last one replaced the marks of the others in the
  scene, so on the canvas they were not drawn and on SVG they showed no
  tooltip.
- Entries of the same name are a bar, or a point of the area chart, of their
  own: two entries named "Jan" drew one bar, the last, where the axis named
  both. Their ticks and tooltips read the name as the data gives it, and
  the order of the data tells them apart through an update.
- A chart taken out of a container that stays takes its marks along: the
  hover showed the tooltips of its marks over the empty chart, and the canvas
  kept painting them.
- The canvas renderer clears its canvas between frames instead of sizing it
  again, which threw its buffer away and made a new one every frame.
- `renderer="webgl"` no longer leaves a chart blank on a page with more
  WebGL charts than the browser allows, or when the GPU resets (#22): it
  draws on the canvas and opens no WebGL context.
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
- `renderer="webgl"` no longer takes 50 ms and more a frame to cut detailed
  land, such as the countries at 1:50m, into triangles (#23): it draws on
  the canvas.
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
