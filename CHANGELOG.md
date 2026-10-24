# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

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
