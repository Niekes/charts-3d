---
name: new-chart
description: Load when adding a new 3D chart to the charts-3d registry ("make chart X", "new chart for ...", "add a <name> chart"). Walks the whole template end to end: registry file, registry.json, index.ts, tests, the three docs demos (base, update, renderers), the mdx page, and the gates.
---

# New chart

Adds `<name>-chart-3d` to this registry. Read `AGENTS.md` first ("Adding a
chart", "The chart template", "How the charts draw", "Renderers",
"Interaction") and use `registry/new-york/ui/bar-chart-3d.tsx` as the
reference. Terms are in `GLOSSARY.md` (mark, scene, renderer, hover, focus).

## 1. The chart file: `registry/new-york/ui/<name>-chart-3d.tsx`

- Starts with `"use client"`, has no default export, exports
  `export function <Name>Chart3D` and the type `<Name>Chart3DProps`, with a
  comment (and `@defaultValue` where one exists) on every prop.
- Imports only React, the npm packages `chart-3d` declares in
  `registry.json`, and the core as `@/registry/new-york/ui/chart-3d`.
- Renders no SVG or HTML of its own: it draws through `Axes3D`, `Marks3D`
  and `Labels3D`.
- **Data-driven, one scene.** Project the data with d3-3d on every render
  and hand the shapes to the core as `Mark3D`s (`Marks3D`) and `Label3D`s
  (`Labels3D`). The scene is the single data store - the d3 "bind data to
  virtual elements" idea for canvas/webgl is the scene here: the canvas and
  the webgl renderer paint it and the hover hit-tests it, whatever the
  renderer. Never draw on a canvas yourself and never keep a copy of the
  data in the chart.
- **Hover comes from the core.** Give marks a `tooltip` and `groups`; while
  the pointer is on a mark its tooltip shows and the marks and labels that
  share none of its groups fade; when the pointer leaves the mark or the
  chart, both clear. A chart never fades anything itself and has no pointer
  handlers.
- **Interaction only through the container.** A chart adds no key or gesture
  handlers; the camera moves through `SHORTCUTS`/`keymap` of
  `ChartContainer3D`. In the demos the standard gestures stay on - a drag
  rotates, Space and a drag pans, Ctrl or ⌘ with the wheel (a trackpad pinch)
  zooms, a double click resets - and so do the keys (arrows rotate,
  Shift+arrows pan, `+`/`-` zoom, `0` reset, `?` help). A demo turns a gesture
  off only as an explicit opt-out, e.g. `keymap={{ wheelZoom: false }}`.
- Sort projected shapes with d3-3d's `sort` and give marks stable keys;
  cull cube faces to the `ccw` ones; shade with `shade`, fade with the core,
  hand CSS colors to the core; build the world with `worldBox`; tween numbers
  with `useTween`/`useTweenAxes`, never the projected marks.
- Style: shadcn/ui - two spaces, double quotes, no semicolons. Every function
  at most 60 lines; split along seams (hook / component / computation).

## 2. Registry wiring

- `registry.json`: item `<name>-chart-3d`, type `registry:ui`, file
  `registry/new-york/ui/<name>-chart-3d.tsx`, `registryDependencies`:
  `["niekes/charts-3d/chart-3d"]` only, `categories: ["charts", "3d"]`.
- `index.ts`: add `export * from "./registry/new-york/ui/<name>-chart-3d"`.

## 3. Tests: `tests/<name>-chart-3d.test.tsx`

Drive the chart the way a user does: render it, send pointer and keyboard
events, read what it draws. Copy `mount`, `stubCanvas` and `stubGL` from
`tests/chart-3d.test.tsx` (jsdom has no layout and no canvas). Cover at
least: the marks draw as SVG, on the canvas (`renderer="canvas"`) and on
webgl (`renderer="webgl"`, mock GL); hovering a mark shows its tooltip and
fades the groups it does not share, and moving off the mark or leaving the
chart clears both; new data glides in (`useTween`); the axes follow. New code
comes with its tests - the coverage gate is 98% in each metric.

## 4. Docs

- `docs/examples/<name>-chart-3d-demo.tsx` - the base example, with the
  gesture-off `keymap` above.
- `docs/examples/<name>-chart-3d-update-demo.tsx` - a button that swaps the
  data, so the chart glides.
- `docs/examples/<name>-chart-3d-renderers-demo.tsx` - the same chart with a
  SVG / Canvas / WebGL switch (`renderer` prop), showing one scene on every
  renderer. See `docs/examples/bar-chart-3d-renderers-demo.tsx`.
- `docs/content/components/<name>-chart-3d.mdx` - sections Preview,
  Installation, Update, Renderers, API Reference; add the page to
  `docs/content/components/meta.json`.

## 5. Gates

Run `npm run lint`, `npm test` and `npm run coverage` and fix until all are
green: template check (`npm run lint:template`), fallow (layers, dead code,
health >= 98, no function over 60 lines), formatting (`vp fmt`). A new chart
that fails a gate does not merge.
