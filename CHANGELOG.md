# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
