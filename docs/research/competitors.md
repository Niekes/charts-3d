# Competitors and inspiration

Researched 2026-11-13. Stars are from `gh api repos/OWNER/REPO`. Weekly downloads are from
`https://api.npmjs.org/downloads/point/last-week/PKG`, for the week before that date. Last
release is the date the npm `latest` dist-tag was published (`https://registry.npmjs.org/PKG`).
**[unverified]** marks a claim that no primary source we could fetch confirms.

## 1. Summary

Interactive 3D charting on the web comes from two camps, and neither of them makes React-first
components. One is big imperative WebGL engines with a JSON option API: ECharts-GL, Plotly.js and
deck.gl, which are open source, and SciChart.js and LightningChart JS, which are commercial. The
other is three.js globe and scene kits: globe.gl and cobe, plus Magic UI's and Aceternity's globe
components, which wrap them. Highcharts, AnyChart and amCharts offer "3D" as fake depth on 2D
types or as a globe projection. The React and shadcn chart ecosystem is entirely 2D:
shadcn/ui charts, Tremor, EvilCharts, Bklit UI, Nivo, visx, Unovis and Vega-Lite. We found no
other shadcn registry, and no react-three-fiber kit, that ships 3D bar, scatter or surface
charts. charts-3d is alone in this niche: copy-in React components, SSR-able SVG first, CSS-token
theming, and no three.js. It is also small in reach, with 0 stars, 106 npm downloads a week and a
repo created on 2026-10-23. Against ECharts-GL and Plotly it has far fewer chart types and none of
their scale features: colour scales, lighting, data zoom and image export.

## 2. Comparison table

| Library                     | 3D types                                                                                                                   | Renderers                                          | SSR                         | React                                    | License                                                | Stars                      | npm/wk                 | Last release                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------ | -------------------------- | ---------------------- | --------------------------------------- |
| **charts-3d**               | bar, scatter, surface, area, globe, places, choropleth                                                                     | SVG (default), canvas, WebGL                       | yes (SVG first)             | native, shadcn registry                  | BSD-3-Clause                                           | 0                          | 106                    | 0.6.0, 2026-11-05                       |
| d3-3d                       | primitives (points, lines, cubes, grid planes, polygons, axes)                                                             | none (you draw: SVG/canvas, `.matrix()` for WebGL) | yes (pure math)             | no                                       | BSD-3-Clause                                           | 417                        | 3,171                  | 2.4.1, 2026-10-27                       |
| ECharts-GL                  | bar3D, line3D, scatter3D, surface, map3D, lines3D, polygons3D, scatterGL, graphGL, flowGL, linesGL; globe, geo3D, mapbox3D | WebGL                                              | no **[unverified]**         | via wrappers (echarts-for-react 2.1M/wk) | BSD-3-Clause on GitHub, `MIT` in npm metadata          | 2,713                      | 200,819                | 2.1.0, 2026-05-28                       |
| Plotly.js                   | scatter3d, surface, mesh3d, line, ribbon, cone, streamtube, isosurface, …                                                  | WebGL (gl3d)                                       | no **[unverified]**         | react-plotly.js (980k/wk)                | MIT                                                    | 18,382                     | 977,061                | 4.3.0, 2026-11-10                       |
| Highcharts 3D               | column, pie, scatter, area ("limited 3D")                                                                                  | SVG **[unverified for 3D]**                        | no **[unverified]**         | official wrapper **[unverified]**        | commercial; public websites need a paid license        | 12,502                     | 3,434,557              | 13.1.1, 2026-09-20                      |
| amCharts 5                  | globe via map projection; no true 3D series **[unverified]**                                                               | canvas **[unverified]**                            | no **[unverified]**         | yes **[unverified]**                     | commercial (`SEE LICENSE IN LICENSE`)                  | 451                        | 449,454                | 5.21.5, 2026-10-26                      |
| AnyChart                    | 3D surface plus pseudo-3D types **[unverified]**                                                                           | SVG/VML **[unverified]**                           | –                           | –                                        | commercial (license field links to /buy)               | 396                        | 14,385                 | 9.0.0, 2026-10-12                       |
| SciChart.js                 | 3D surface: scatter, bubble, surface mesh, …                                                                               | WebGL/WebGPU + WebAssembly                         | no                          | React demos                              | commercial; free community tier for non-commercial use | 117 (examples repo)        | 73,957                 | 6.0.16, 2026-11-06                      |
| LightningChart JS           | Chart3D: line, point, point-line, point cloud, box, surface                                                                | WebGL                                              | no **[unverified]**         | –                                        | commercial; license key required since v5              | n/a (no public repo found) | 15,215                 | 9.1.0, 2026-11-03                       |
| deck.gl                     | 3D layers on maps; GlobeView (experimental)                                                                                | WebGL2 / WebGPU                                    | no                          | yes (`@deck.gl/react`)                   | MIT                                                    | 14,757                     | 260,938                | 9.4.1, 2026-10-28                       |
| globe.gl / react-globe.gl   | globe with points, arcs, polygons, paths, heatmaps, hex bins, tiles, rings, labels, HTML, 3D objects                       | three.js WebGL                                     | no (needs `window`)         | react-globe.gl                           | MIT                                                    | 3,229 / 1,472              | 362,031 / 247,688      | 2.46.2, 2026-08-22 / 2.38.0, 2026-05-16 |
| cobe                        | globe with markers and arcs                                                                                                | WebGL (~5 KB)                                      | no                          | no (vanilla)                             | MIT                                                    | 6,065                      | 1,018,644              | 2.0.1, 2026-03-19                       |
| MapLibre GL JS              | globe projection for maps                                                                                                  | WebGL                                              | no                          | community wrappers                       | BSD-3-Clause                                           | 12,084                     | 10,308,235             | 6.18.0, 2026-11-11                      |
| Mapbox GL JS                | globe projection **[unverified]**                                                                                          | WebGL                                              | no                          | –                                        | proprietary (`SEE LICENSE IN LICENSE.txt`)             | 12,497                     | 5,904,850              | 3.35.0, 2026-11-13                      |
| shadcn/ui charts (Recharts) | none (2D)                                                                                                                  | SVG                                                | yes **[unverified]**        | native, copy-in                          | MIT                                                    | 128,127 / 27,711           | recharts 65,011,242    | recharts 3.10.1, 2026-07-25             |
| Tremor                      | none                                                                                                                       | SVG (Recharts)                                     | –                           | copy-in                                  | Apache-2.0                                             | 3,702                      | 522,801                | 3.18.7, 2025-01-13                      |
| Magic UI (Globe)            | globe (cobe)                                                                                                               | WebGL                                              | no                          | shadcn registry                          | MIT                                                    | 23,263                     | –                      | –                                       |
| Aceternity (GitHub Globe)   | globe                                                                                                                      | WebGL (three-style scene, **[unverified]**)        | no                          | shadcn registry                          | site "All Rights Reserved"; terms unclear              | –                          | –                      | –                                       |
| EvilCharts                  | none (Recharts)                                                                                                            | SVG                                                | –                           | shadcn registry                          | MIT                                                    | 3,176                      | –                      | –                                       |
| Bklit UI                    | none (visx + motion, per repo topics)                                                                                      | SVG                                                | –                           | shadcn registry (`@bklit/…`)             | MIT                                                    | 1,966                      | –                      | –                                       |
| Unovis                      | none (2D, TopoJSON map)                                                                                                    | SVG                                                | –                           | React/Angular/Svelte/Vue/Solid           | Apache-2.0                                             | 2,870                      | 361,095 (`@unovis/ts`) | 1.8.1, 2026-11-10                       |
| Nivo                        | none                                                                                                                       | SVG, canvas, HTML                                  | yes (SSR + HTTP API)        | native                                   | MIT                                                    | 14,138                     | 1,977,535              | 0.99.0, 2025-05-23                      |
| visx                        | none (primitives)                                                                                                          | SVG                                                | yes **[unverified]**        | native                                   | MIT                                                    | 21,107                     | 141,122 (`@visx/visx`) | 4.0.0, 2026-06-11                       |
| Vega-Lite                   | none (no 3D mark)                                                                                                          | SVG/canvas                                         | yes (vega) **[unverified]** | react-vega                               | BSD-3-Clause                                           | 5,554                      | 2,261,116              | 6.5.0, 2026-10-08                       |
| Chart.js                    | none (no maintained 3D plugin found on npm search)                                                                         | canvas                                             | no                          | react-chartjs-2                          | MIT                                                    | 67,795                     | 16,406,697             | 4.6.1, 2026-10-22                       |
| three.js / r3f / Babylon    | general 3D engines; no chart kit found                                                                                     | WebGL/WebGPU                                       | no                          | r3f 9.1M/wk                              | MIT / MIT / Apache-2.0                                 | 118,321 / 33,711 / 26,342  | 35.7M / 9.1M / 371k    | –                                       |

## 3. Per-library notes

- **ECharts-GL.** Has the broadest 3D chart catalogue: bar3D, line3D, scatter3D, surface, map3D,
  lines3D and polygons3D, plus GL versions of scatter, graph, flow and lines for large data, and
  the globe, geo3D, mapbox3D and maptalks3D coordinate systems (repo `src/chart`,
  `src/component`). Its option API is imperative JSON, not React. The README targets ECharts 5
  (GL 2.x), but npm has ECharts 6.1. Repo activity is slow: the last release, 2.1.0, came out in
  May 2026.
- **Plotly.js.** Covers science-grade 3D: surface with contours, lighting and a colour scale,
  hover projections of contour lines onto the axis planes, and mesh, cone, streamtube and
  isosurface (surface reference). Scenes take `dragmode` (orbit, turntable, zoom, pan), a
  camera eye/up/center, an orthographic or perspective projection, and an `aspectmode` (cube,
  data, manual). Its modebar has a PNG/SVG export and `scrollZoom` is opt-in (configuration
  options). It is heavy: plotly.js-dist-min weighs 1.41 MB gzipped (bundlephobia).
- **Highcharts 3D.** Adds depth to column, pie, scatter and area charts, set through `alpha` and
  `beta` angles, and its own docs call it "limited 3D". It has the strongest accessibility
  module in the field: keyboard navigation through the data, screen-reader descriptions, ARIA,
  sonification, low-vision features and a data table through export-data. A public website
  needs a paid licence.
- **amCharts 5.** Its globe is an orthographic map projection **[unverified; docs URL 404]**.
  It is commercial, and all tiers can remove the branding (licenses explained).
- **AnyChart.** Its overview names a 3D surface chart. Other 3D types and the renderer are
  **[unverified]**. It is commercial.
- **SciChart.js.** Ships one WebAssembly engine for 2D and 3D, with the 3D part loaded lazily,
  and renders with WebGPU on Apple Silicon and WebGL elsewhere (npm README). Its 3D camera
  works as `OrbitModifier3D` (left drag), `MouseWheelZoomModifier3D` and a double-click reset,
  and allows a single x, y and z axis. 2D+3D costs about $1,765 per developer per year, and the
  community licence is non-commercial only.
- **LightningChart JS.** Offers 3D line, point, point-line, point-cloud, box and surface series.
  Since v5 it needs a licence key even for non-commercial use; without one it shows a
  watermark (vendor notice, via search).
- **deck.gl.** Designed for big geo data. Its GlobeView is explicitly experimental: no heatmap
  or contour layers, and drag moves longitude and latitude while shift-drag rotates freely.
- **globe.gl.** The richest globe layer set. It wraps three-globe/three.js with OrbitControls,
  weighs about 559 KB gzipped (bundlephobia) and needs a browser canvas.
- **cobe.** A ~5 KB gzipped WebGL globe with markers, arcs and CSS anchor positioning. Its
  visibility variable makes markers fade behind the globe. It rotates through an `onRender`
  callback, with no built-in drag. Magic UI's globe wraps it and installs through shadcn
  (`@magicui/globe`), so it is the most visible "globe in a shadcn project" today.
- **Aceternity GitHub Globe.** Installs through shadcn (`@aceternity/globe`) and needs a
  downloaded `globe.json`. Its licence terms are unclear.
- **shadcn/ui charts.** The pattern charts-3d copies. They compose Recharts rather than wrap it,
  take a `ChartConfig` with `--chart-N` / `--color-KEY` tokens, and ship `ChartTooltipContent`
  and `ChartLegendContent`. An `accessibilityLayer` prop adds keyboard access and screen-reader
  support.
- **Tremor, EvilCharts, Bklit UI.** 2D copy-in kits. Tremor is "joining Vercel", but its npm
  package has had no release since January 2025. Bklit ships about 19 2D types, choropleth
  among them, plus a "Studio" with animation controls. None of them has 3D.
- **Nivo.** Has the best documentation pattern among the 2D kits: SVG, canvas and HTML
  variants of each chart, filterable by renderer, plus SSR and an HTTP rendering API.
- **Unovis, visx, Vega-Lite, Chart.js.** All 2D only. Vega-Lite has no 3D mark (mark docs).
- **d3-3d.** The projection layer under charts-3d. It provides points3D, lines3D, lineStrips3D,
  triangles3D, planes3D, polygons3D, gridPlanes3D, cubes3D, iso3D and axes3D, plus `camera3D`,
  `sort` (painter's algorithm), and orthographic projection by default with optional
  perspective and `.matrix()` for WebGL (API docs). We could not list its dependents: the npm
  search API does not support a dependents query **[unverified]**.

## 4. What charts-3d could learn (ranked)

1. **Data-level keyboard and screen-reader access** (Highcharts accessibility module, shadcn
   `accessibilityLayer`). charts-3d moves the camera from the keyboard but has no way to step
   through the marks, and no text alternative: the core has one `role="img"` and an
   `aria-label` but no description or data table. A focusable "next mark" that drives the
   existing hover, focus and tooltip path, plus an `sr-only` table of the data, would make it
   ahead of every 3D library here, since none of the WebGL engines document either.
2. **A colour scale and its legend for the surface and choropleth** (Plotly `colorscale`,
   `showscale`; ECharts visualMap **[unverified]**). The surface takes a two-colour `colors` ramp
   and draws no legend for it. A gradient legend built from CSS tokens stays within the
   "looks are CSS" rule.
3. **Contour lines projected onto the axis walls on hover** (Plotly `contours.project` with
   `highlight`). They make the value under the pointer readable in 3D, and they fit the
   existing walls and focus.
4. **Camera presets and an aspect mode** (Plotly `camera.eye`, `projection.type`,
   `aspectmode`). charts-3d already has `perspective`. A documented "front / top / iso" preset,
   reachable from the gizmo, would answer the most common 3D complaint, that bars cover each
   other.
5. **Image export** (Plotly modebar `toImage`, PNG/SVG). The SVG renderer makes this almost
   free: serialise the svg. It belongs in docs as a recipe first, not as a prop (ADR-0004: a
   knob nobody turns is debt).
6. **More chart types that d3-3d already supports** (ECharts-GL line3D and lines3D, Plotly
   mesh3d). A 3D line or path chart (`lineStrips3D`) and arcs between places, as in globe.gl
   and cobe, would round out the geo set.
7. **Docs: filter the gallery by renderer and show each demo's code** (Nivo's svg/canvas
   filter). charts-3d already has `-renderers-demo` per chart; a renderer filter on the
   components index would make the three-renderer story visible.
8. **Markers that fade behind the globe through CSS** (cobe's visibility variable with anchor
   positioning). If places/globe labels don't already do this, exposing the occlusion as a CSS
   variable on the `data-slot` fits the "looks are CSS" rung.
9. **Bundle-size and performance numbers on the docs** (cobe "5 KB", SciChart and
   LightningChart benchmarks). bundlephobia gives @niekes/charts-3d at 27.5 KB gzipped,
   against recharts at 150 KB, echarts-gl at 172 KB, globe.gl at 559 KB and plotly at 1.41 MB.
   This is a strong selling point that the README does not state.
10. **Distribution: get listed where shadcn users look.** Magic UI and Aceternity are found
    through the shadcn registry index (`@magicui/…`, `@aceternity/…`). Registering a
    `@charts-3d` namespace **[unverified: process not checked]** would allow
    `npx shadcn add @charts-3d/bar-chart-3d`.

## 5. Where charts-3d differentiates, and the weak spots

**Differentiates**

- It is the only 3D chart kit that is native React, copy-in through shadcn and also on npm.
  Every other 3D option is an imperative engine, a wrapper around one, or a globe only.
- It renders on the server and draws SVG first. Every WebGL competitor (ECharts-GL, Plotly 3D,
  SciChart, LightningChart, deck.gl, globe.gl, cobe) needs a browser, so they show nothing
  until hydration.
- It draws one scene with three renderers, SVG, canvas and WebGL, behind one prop. Nivo does
  this for 2D; no 3D library does.
- It themes through shadcn tokens and `data-slot`s, so dark mode needs no re-render. The
  engines theme through JS option objects.
- It is small: about 27.5 KB gzipped with d3-3d (bundlephobia), against 170 KB to 1.4 MB for
  the alternatives.
- It has a designed navigation model: a gesture behind a modifier so the page still scrolls, a
  keymap, a shortcut panel, a gizmo and `aria-keyshortcuts`. Plotly makes `scrollZoom`
  opt-in, but no competitor documents a shortcut panel or a remappable keymap.
- It is BSD-3-Clause, where Highcharts, amCharts, AnyChart, SciChart and LightningChart are
  commercial.

**Weak spots (honest)**

- **Reach.** 0 stars and 106 npm downloads a week, against 200k for echarts-gl and 1M for
  cobe. Nobody knows about it yet.
- **Breadth.** 7 chart types against more than 15 in ECharts-GL and Plotly. There is no 3D
  line, mesh, contour, colour-scale legend or data zoom.
- **Scale.** Rendering is CPU-bound: projection runs in JS every frame, and WebGL only fills
  the polygons. SciChart, LightningChart, deck.gl and ECharts scatterGL project on the GPU.
  The project's own notes put the SVG renderer at about 20 ms plus 0.04 ms per path a frame.
- **Accessibility of the data.** Only the camera is accessible. Highcharts is far ahead on
  data navigation, descriptions and tables.
- **Painter's-algorithm depth.** There is no depth buffer, so intersecting faces can sort
  wrongly. GPU engines don't have this class of artefact.
- **Single maintainer**, as the README itself says.

## 6. Sources

- charts-3d: https://github.com/Niekes/charts-3d · https://www.npmjs.com/package/@niekes/charts-3d · `registry/new-york/ui/chart-3d.tsx` (this repo)
- d3-3d: https://github.com/Niekes/d3-3d · https://niekes.github.io/d3-3d/api/
- ECharts-GL: https://github.com/ecomfe/echarts-gl (README; `src/chart`, `src/component` via `gh api repos/ecomfe/echarts-gl/contents/…`) · https://www.npmjs.com/package/echarts-gl
- Plotly.js: https://plotly.com/javascript/3d-charts/ · https://plotly.com/javascript/reference/layout/scene/ · https://plotly.com/javascript/reference/surface/ · https://plotly.com/javascript/configuration-options/ · https://github.com/plotly/plotly.js
- Highcharts: https://www.highcharts.com/docs/chart-concepts/3d-charts · https://www.highcharts.com/docs/accessibility/accessibility-module · https://shop.highcharts.com/license
- amCharts: https://www.amcharts.com/online-store/licenses-explained/ · https://github.com/amcharts/amcharts5 (projection docs URL https://docs.amcharts.com/v5/charts/map-chart/map-projections/ returned 404)
- AnyChart: https://www.anychart.com/products/anychart/overview/
- SciChart.js: https://www.npmjs.com/package/scichart (README) · https://www.scichart.com/documentation/js/current/3d-charts/scichart-3d-basics/scichart-3d-basics-overview/ · https://www.scichart.com/shop/
- LightningChart JS: https://www.npmjs.com/package/@lightningchart/lcjs · https://www.lightningchart.com/community-license/ · https://lightningchart.com/js-charts/non-commercial-license/ (vendor pages returned 403 to direct fetch; facts via search snippets)
- deck.gl: https://deck.gl/docs/api-reference/core/globe-view · https://github.com/visgl/deck.gl
- globe.gl: https://github.com/vasturiano/globe.gl · https://github.com/vasturiano/react-globe.gl
- cobe: https://github.com/shuding/cobe
- MapLibre: https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/
- Mapbox GL JS: https://github.com/mapbox/mapbox-gl-js
- shadcn/ui charts: https://ui.shadcn.com/docs/components/chart
- Tremor: https://www.tremor.so/ · https://github.com/tremorlabs/tremor
- Magic UI Globe: https://magicui.design/docs/components/globe
- Aceternity Globe: https://ui.aceternity.com/components/github-globe
- EvilCharts: https://github.com/legions-developer/evilcharts
- Bklit UI: https://github.com/bklit/bklit-ui
- Unovis: https://github.com/f5/unovis
- Nivo: https://github.com/plouc/nivo · https://nivo.rocks/
- visx: https://github.com/airbnb/visx
- Vega-Lite: https://vega.github.io/vega-lite/docs/mark.html
- Chart.js: https://github.com/chartjs/Chart.js · https://registry.npmjs.org/-/v1/search?text=chartjs%203d
- three.js / r3f / Babylon: https://github.com/mrdoob/three.js · https://github.com/pmndrs/react-three-fiber · https://github.com/BabylonJS/Babylon.js
- Bundle sizes: https://bundlephobia.com/api/size?package=PKG@VERSION (@niekes/charts-3d@0.6.0, recharts@3.10.1, echarts-gl@2.1.0, globe.gl@2.46.2, cobe@2.0.1, plotly.js-dist-min@4.3.0, highcharts@13.1.1)
- Downloads: https://api.npmjs.org/downloads/point/last-week/PKG · Releases: https://registry.npmjs.org/PKG
