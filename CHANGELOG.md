# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `aria-keyshortcuts` on the chart, from the same table as the shortcut panel,
  and `data-slot="kbd"` on the keys of the panel, so a project restyles them
  the way it restyles the Kbd of shadcn/ui.

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
