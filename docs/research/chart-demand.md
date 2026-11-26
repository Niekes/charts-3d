# Chart demand and stacked 3D bars

Researched 2026-11-26. It builds on `competitors.md` (2026-11-13) and does not repeat that
landscape. All counts are from 2026-11-26. **[unverified]** marks a claim that no primary
source we could fetch confirms.

Method:

- **Stack Overflow.** `https://api.stackexchange.com/2.3/search/advanced?title=TERM&site=stackoverflow&filter=total`
  counts questions whose title contains the term. The same call with `tagged=matplotlib|plotly|highcharts|echarts|javascript`
  splits the count by library. "Views" is the sum of `view_count` over the first 100 title matches,
  sorted by votes. Some terms, "3d line", "3d surface", "3d mesh" and "3d map", also match geometry and
  graphics questions; they are marked ³ and the tagged counts are the cleaner signal for them.
- **GitHub.** `gh api search/issues` gives `total_count` for issues and PRs together. `in:title` matches
  the words, not the phrase. The top results come from `sort=reactions`. shadcn discussions come from
  GraphQL `search(type: DISCUSSION)` with `upvoteCount`. "r" means reactions and "up" means upvotes.
- **Galleries.** ECharts-GL: `apache/echarts-examples` `src/data/chart-list-data-gl.js` for the
  examples and `src/common/config.js` for the category order. Highcharts: `samples/highcharts/demo/*/demo.details`
  in `highcharts/highcharts`, filtered to category "3D charts". Plotly: its 3D charts page.
- **Plotly forum.** Discourse `community.plotly.com/search.json?q="TERM" in:title`. It returns at most
  50 topics.
- **Stacking.** Library source on GitHub, plus vendor docs.
- **Dropped.** GitHub code-search counts such as `bar3D grid3D`: tokenising and vendored library
  files make them meaningless.

## 1. Summary

**Demand.** 3D demand is concentrated on three types, and charts-3d already ships all three:
scatter, surface and bar, with "3D histogram" a request for a bar. They lead the Stack Overflow
counts: 365, 615 and about 236 question titles, which together draw about 3.2M views in their
top 100s.
They also make up most of the competitor galleries.

The one heavily demanded type charts-3d lacks is the classic **3D pie**. It has 84 Stack Overflow
titles and 165k views. It is the top 3D type in the `[highcharts]` tag (32 of 148 titles) and the
most-reacted 3D issue in apache/echarts, and Highcharts has more "3d pie" issues than any other
type (76). ADR-0015 rejects it; the value-height donut is the registry's answer.

Next comes the **geo set**: globe, map3D/geo3D and routes. It is ECharts-GL's first gallery
category and draws the most issue mentions there. charts-3d covers the set. **Value as height on
the earth** is covered in part: the globe's tiles rise to their value (ADR-0007), a binned form of
ECharts-GL `bar3D` on the globe. What the registry lacks is a spike at an exact place (the places
chart shows its value as the area of a dot) and regions extruded by value (`map3D`/`geo3D` region
height, plotly.js #7409). Both fit ADR-0015.

**3D network graphs** have the biggest npm reach of any 3D chart package: 3d-force-graph gets 845k
downloads a week. In a free force layout, though, the depth is a layout coordinate, not data.

The decorative forms get few requests. Funnel, pyramid and cylinder add up to 15 Highcharts issue
titles and 11 Stack Overflow titles.

The React and shadcn ecosystems almost never ask for 3D: shadcn has no such request, Nivo 0 and
Recharts 2.
Their chart-type requests are for 2D: sankey, candlestick, histogram, funnel, box plot, maps,
gantt and heatmap.

**Stacked 3D bars** are rarely asked for: 7 Stack Overflow titles against 141 for "3d bar", 6
Highcharts issue titles and one ECharts-GL request from 2017. Each competitor puts something
different on z when bars stack:

- **ECharts-GL and matplotlib** keep two categories on the floor, x × y, and stack the series in
  height.
- **Highcharts** puts nothing on z by default. Every stack stands in the front row with a fixed
  depth. `grouping: false` gives each *stack group* its own z row.
- **AnyChart, Excel and amCharts 4** stack with no depth axis; Excel's docs say so outright.
  amCharts' demo titled "3D Stacked Column" does not stack the values at all: it puts the series
  behind each other.

Highcharts, AnyChart, Excel and amCharts 4 have percent stacking built in; ECharts users
normalise the data themselves. Every tooltip shows the piece's own value by default. The running total and the
share are opt-in, for example Highcharts' `point.total` and `point.percentage`.

## 2. Demand, ranked

| #   | Type                                          | SO titles                                               | SO views     | GitHub signal                                                                                                                                            | Galleries                                                                | charts-3d                                 | ADR-0015: what the depth shows                                                          |
| --- | --------------------------------------------- | ------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | 3D scatter                                    | 365 (+107 "scatter3d")                                  | 1.47M        | plotly.js 3D-marker/selection asks, 5–6 r each                                                                                                            | Plotly tile 1 of 10; ECharts-GL 6 (+2 scatterGL); Highcharts 1 of 10      | **in** (scatter)                          | fits: z is a value                                                                      |
| 2   | 3D surface                                    | 615³ (196 matplotlib + 107 plotly)                      | 1.16M³       | Highcharts #13631 "3D Surface Chart", 6 r (Highcharts has none)                                                                                          | ECharts-GL 11; Plotly tile 3                                             | **in** (surface)                          | fits: height = value over an x × z grid                                                 |
| 3   | 3D bar / column / histogram                   | 141 + 63 histogram + 23 "bar3d" + 9 column              | 331k + 203k  | plotly.js #270 "add 3d bar chart", 31 👍, open since 2016, the most-reacted of its 147 "3d" titles; Highcharts 72 "3d column" titles                     | ECharts-GL 12, the most of any category; Highcharts 3 of 10              | **in** (bar, bar-field)                   | fits when z = series or a second category; Excel and Highcharts default depth is decoration |
| 4   | Globe / 3D map                                | 26 globe, 77 map³                                       | 39k (globe)  | ECharts-GL mentions geo3D 78, globe 53, map3D 45, its top 3; shadcn "Maps" discussion 28 up; Recharts "World Map" 21 r                                    | ECharts-GL first category: globe 10, map3D 4, geo3D 2                    | **in** (globe, places, choropleth)        | fits: the shape of the earth                                                            |
| 5   | 3D pie                                        | 84; 32 in `[highcharts]`, 23 in `[javascript]`          | 165k         | apache/echarts #9807, 5 r, the top-reacted 3D issue, + #20594 open; Highcharts 76 "3d pie" titles, the most of any type; Recharts #958                    | Highcharts 2 of 10 (pie, donut)                                          | –                                         | **rejected**: a constant thickness; the answer is the donut                             |
| 6   | 3D line                                       | 146³ (23 matplotlib, 7 plotly)                          | –            | –                                                                                                                                                        | Plotly tile 5; ECharts-GL 1                                              | **in** (line)                             | fits                                                                                    |
| 7   | 3D network / force graph                      | 0 ("3d network graph")                                  | –            | 3d-force-graph 6,596 ★ and 845,438 npm/wk; react-force-graph-3d 399,755/wk                                                                                | ECharts-GL graphGL 3 (a 2D layout)                                       | –                                         | **rejected** as a free layout (z is layout); fits only if z = a node attribute (DAG level, time) |
| 8   | Routes / flows on the globe                   | –                                                       | –            | ECharts-GL lines3D 25 mentions                                                                                                                           | ECharts-GL lines3D 4, flowGL 3, linesGL 1                                | **in** (routes)                           | fits                                                                                    |
| 9   | Bars or spikes on the globe, extruded regions | –                                                       | –            | plotly.js #7409 "Geographic maps 3d bars"; Plotly forum "Georef 3D bars on a map"; ECharts-GL #447, #256                                                  | ECharts-GL bar3D on the globe 1, map3D/geo3D height 2                    | part: globe tiles rise to value; no spike at a place, no extruded region | fits: height = value at a place                                                         |
| 10  | 3D area                                       | 4                                                       | –            | Highcharts 11 titles                                                                                                                                     | Highcharts 1; AnyChart; Excel (depth axis)                               | **in** (area)                             | fits when z = series                                                                    |
| 11  | Stacked 3D bar                                | 7 (10 anywhere in the text)                             | top Q 9.3k   | Highcharts 6 titles; ECharts-GL #45                                                                                                                      | ECharts-GL 1; Highcharts 1                                               | –                                         | fits only if z keeps a category (§4)                                                    |
| 12  | 3D donut (one thickness)                      | 6                                                       | 7k           | Highcharts 4 titles                                                                                                                                      | Highcharts 1                                                             | **in**, as a value-height donut           | the classic is **rejected**                                                             |
| 13  | 3D heatmap                                    | 11                                                      | –            | –                                                                                                                                                        | –                                                                        | **in**, as bar-field or surface           | fits                                                                                    |
| 14  | Funnel / pyramid / cylinder                   | 2 / 9³ / 0                                              | –            | Highcharts 8 / 5 / 2 titles; #14358 "make an actual 3d pyramid", 3 r                                                                                     | Highcharts 3 of 10                                                       | –                                         | **rejected**: decoration                                                                |
| 15  | Volume (mesh, isosurface, cone, streamtube)   | 282³ ("3d mesh")                                        | –            | –                                                                                                                                                        | Plotly 6 of 10 tiles                                                     | –                                         | fits (x, y, z are values); a scientific audience                                        |

The ranking weighs the Stack Overflow counts first, then GitHub reactions, then gallery space.
Gallery space is the weakest signal: 6 of ECharts-GL's 12 bar3D examples are art (voxelised
images, noise, "metal"), and 9 of its 11 surfaces are parametric shapes or material showcases (roses, shells,
"leather").

**Demand that is really for 2D types**

- **"3D pie" and "3D column"** at Highcharts, Excel and AnyChart mostly mean a 2D chart with a
  tilt. Excel's 3-D clustered, stacked and 100% stacked columns "[don't] use a depth axis".
- **"3D heatmap" and "3D histogram"** ask for a grid of values: a bar-field or a surface.
- **The React/shadcn requests are all 2D:**
  - shadcn: Sankey #8090 (39 r), Scatterplot #7315 (17 r), Maps discussion #4882 (28 up), Gantt
    discussion #3828 (24 up) and #7477 (4 r), Calendar/Heatmap #7187 (5 r), Category Bar #6467
    (5 r), Candlestick #12719, Bubble #9077, Combo #9716, Dendrogram #10468.
  - Recharts: Candlestick #871 (36 r) and #1400 (16 r), Histogram #1580 (32 r), Funnel #925 (27 r),
    World Map & Word Cloud #1291 (21 r), Boxplot #2302 (18 r), Sunburst #576 (16 r).
  - Nivo: Grouped and stacked bars #535 (24 r), stacked bar + line #678 (15 r).
- **3D at those kits:** no shadcn request and 0 Nivo titles. Recharts has #479 "Support for 3D
  charts" (10 r) and #958 "3d pie" (2 r); Chart.js has 3 "3D charts?" issues (0 r).
- **Stacking is a heavy 2D need.** Issue titles with "stacked": Highcharts 293, apache/echarts
  136, Recharts 133, plotly.js 53, Nivo 24, shadcn 8. With "3d" as well: only Highcharts, with 6.

## 3. Per-source notes

- **Stack Overflow by tag.** Titles containing the term, per library tag:

  | Term       | matplotlib | plotly | highcharts | echarts | javascript |
  | ---------- | ---------- | ------ | ---------- | ------- | ---------- |
  | 3d scatter | 164        | 66     | 22         | 1       | 23         |
  | 3d surface | 196        | 107    | 1          | 1       | 11         |
  | 3d bar     | 68         | 4      | 4          | 0       | 14         |
  | 3d pie     | 2          | 0      | 32         | 0       | 23         |
  | 3d line    | 23         | 7      | 0          | 0       | 5          |
  | 3d stacked | 4          | 1      | 1          | 0       | 1          |
  | all "3d"   | 2,138      | 497    | 148        | 4       | 1,729      |

  Python users ask for surface, scatter and bar. JavaScript users ask for pie as often as for
  scatter. The pie demand comes from business charting (Highcharts), not from science.
- **Plotly.** plotly.js has no bar3d. #270 "add 3d bar chart" (feature, P2) has 31 👍 and has been
  open since 2016-02-22. #7003, a `bar3d` trace PR (P3), has been open since 2024-05-24; a user
  wrote there on 2025-04-01 that they are "using D3 for 3d bar chart right now". The forum has 5
  "3d bar" title topics, 2 "3d pie", 2 "3d histogram", and at least 50 each for surface and
  scatter, the search cap. The 3D page has 10 tiles: scatter, ribbon, surface, mesh, line,
  tri-surf, cluster, cone, streamtube and isosurface.
- **ECharts-GL.** It has 528 issues. The gallery holds 59 examples in this category order: globe,
  bar3D, scatter3D, surface, map3D, lines3D, line3D, scatterGL, linesGL, flowGL, graphGL. Counts
  per category: bar3D 12, surface 11, globe 10, scatter3D 6, lines3D 4, map3D 4, flowGL 3,
  graphGL 3, geo3D 2, scatterGL 2, line3D 1, linesGL 1. Mentions in issues (title or body): geo3D
  78, scatter3D 67, bar3D 59, globe 53, map3D 45, lines3D 25, surface 18, graphGL 17, scatterGL
  12, line3D 7, stack 6. Its most-reacted issues are about maintenance (ECharts 6 support, 13 r),
  not about chart types.
- **apache/echarts (3D).** 163 titles contain "3D". The top-reacted is #9807 "does echarts support
  a 3d pie chart" (5 r). #20594 "hope 3D pie is supported in future" is open. #9832 asks for a
  "立体柱形图 3D Column Chart".
- **Highcharts.** The "3D charts" demo category has 10 demos: 3D column (interactive, null values,
  stacking and grouping), pie, donut, area, scatter, cylinder, funnel and pyramid. Five of the 10
  (pie, donut, cylinder, funnel, pyramid) are forms ADR-0015 rejects; the site's order is
  **[unverified]**. Issue titles with "3d" plus the type: pie 76, column 72, scatter 22, stack 13,
  area 11, bar 9, funnel 8, pyramid 5, donut 4, cylinder 2, surface 2. The top-reacted 3D issues
  are zooming (8 r), a 3D surface (6 r) and a real pyramid (3 r).
- **3d-force-graph** (vasturiano) has 6,596 ★ and 845,438 downloads a week, from 2026-11-19 to
  2026-11-25. Its React wrapper, react-force-graph-3d, gets 399,755 a week and depends on it, so
  the two numbers overlap. That is more than echarts-gl (200k) or globe.gl (362k) in
  `competitors.md`. Its `dagMode` puts depth on the DAG level **[unverified]**.

## 4. Stacked 3D bars at competitors

| Library                 | What z shows when bars stack                                                                                                                                                       | Data shape                                                                                                       | Percent                                                              | Negatives                                                                                                     | Tooltip for a piece                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECharts-GL `bar3D`      | **A second category.** The floor stays x × y and the series stack in height. ECharts-GL's `z` is the vertical value axis: bars stand on the `xy` plane (`onGridPlane: 'xy'`).        | One series per layer with `stack: 'name'`; each item is `[x, y, value]`. Stacked **by data index**, so items must line up across series. | none built in; ECharts' own examples normalise the data, "There should not be negative values in rawData" | `stackStrategy`: `'samesign'` (default, positive and negative stack apart), `'all'`, `'positive'`, `'negative'` | series name plus the raw item ("- x: …, - y: …, - z: …"): its own value. No total or share without a `formatter`. Users report category indices instead of labels (#93) |
| Highcharts 3D column    | **Nothing** by default: `grouping: true` sets z = 0, so stacks stand side by side in the front row with a fixed `depth` (25 px). With `grouping: false`, **the stack group**: z = `stack` × (`depth` + `groupZPadding`), and the docs ask for "a stack number for each series". Unstacked with `grouping: false`, z = the series index. | A series of y values per x category, plus `stack` per series                                                    | `stacking: 'percent'`; positive and negative stacks share one total | a separate negative stack per x (`'-' + stackKey`); stack labels go below negative columns                    | default `{series.name}: {point.y}`. `point.total` (stack total) and `point.percentage` ("stacked series and pies only") are opt-in; the official 3D demo shows `{point.y} / {point.stackTotal}` |
| AnyChart 3D column      | **Nothing**: `zDistribution` (series along z) is off by default for bar and column, so stacked series share one row **[unverified]** for stacking with `zDistribution` on                | `chart.column3d()`, one series per layer, `yScale().stackMode('value')`                                           | `stackMode('percent')`                                                | **[unverified]**                                                                                              | the token `{%yPercentOfCategory}` is documented for stacked charts; the default **[unverified]**                                                           |
| amCharts 4 (legacy)     | **Nothing** when stacked: only non-clustered `ColumnSeries3D` get their own depth slot (`depthIndex`). The demo named "3D Stacked Column" sets `clustered = false` without `stacked`, so z = **the series** and the values are not summed. | One data object per category with a field per series; `series.stacked = true`                                    | calculated values `total` and `totalPercent`; the placeholder syntax is **[unverified]** | `stackToNegative` (since 4.9.34): `true` (default) stacks negatives from the baseline; `false` stacks them on the previous value | the demo shows `{valueY}` only                                                                                                                            |
| amCharts 5              | no 3D series; no demo title contains "3D", "cylinder" or "cone"                                                                                                                    | –                                                                                                                | –                                                                    | –                                                                                                             | –                                                                                                                                                         |
| Excel                   | **Nothing**: 3-D stacked and 3-D 100% stacked columns "[don't] use a depth axis". Only the unstacked "3-D column" has one, with series along depth.                                  | a sheet range                                                                                                    | 3-D 100% stacked column                                              | –                                                                                                             | –                                                                                                                                                         |
| matplotlib `bar3d`      | **A second category**: anchors at (x, y) on the floor; you stack by passing the running total as `z`                                                                                 | `bar3d(x, y, z, dx, dy, dz)`                                                                                    | manual                                                               | manual                                                                                                        | static                                                                                                                                                    |
| Plotly                  | no bar3d at all; users build bars from `mesh3d` **[unverified]**                                                                                                                  | –                                                                                                                | –                                                                    | –                                                                                                             | –                                                                                                                                                         |

**How ECharts-GL stacks** (`src/chart/common/createList.js`, `bar3D/cartesian3DLayout.js`). It
calls the core `enableDataStack` with `{byIndex: true, stackedCoordDimension: 'z'}`; the comment
reads "Only support 'z' and `byIndex` now". Each piece is drawn from `stackedValue - z` to
`stackedValue`. Its single stacked gallery example, `stacked-bar3d`, has 10 series of noise on an
11 × 11 grid. The core processor (`src/processor/dataStack.ts`) applies `stackStrategy`, with
`'samesign'` as the default. An issue from 2022, #447 on echarts-gl 1.1.2 and still open, reports
that `bar3D` does not stack on `geo3D`, and #256 reports the same on mapbox.

**How Highcharts places stacks** (`ts/Series/Column3D/Column3DComposition.ts`). It computes
`stack = stacking ? (options.stack || 0) : series.index` and `z = stack * (depth + groupZPadding)`,
then resets z to 0 when `grouping !== false`. The docs say: with grouping, "the columns will be
standing next to each other on the front row"; without it, they are "placed behind each other in
order of appearance". Its official demo, "3D column with stacking and grouping", uses string
stacks ('Asia', 'Europe') with grouping on, so its depth carries nothing.

**How often stacked 3D bars are asked for**

- **Stack Overflow:** 7 titles; 10 questions with the phrase anywhere. The leading questions are
  "Stacked 3d bar chart" (matplotlib, score 14, 9,261 views), "3D stacked bars in Matlab"
  (5, 4,747), "How to stack 3d bar charts" (6, 2,305), a JFreeChart one (3, 3,152), "Stack color
  on bar3d plot" (486) and "How to plot a stacked 3D barplot" (214).
- **GitHub:** Highcharts has 6 issue titles with "stacked" and "3d" (all of them bugs in 3D
  stacking), ECharts-GL has #45 "can bar3D get stacking?" (2017, 1 r, since implemented) plus
  #447 and #256, and plotly.js, Recharts, Nivo and shadcn have 0.
- **Compared with plain 3D bars**, that is about 1/20 of the 141 "3d bar" titles. Compared with
  2D stacking (293 Highcharts and 133 Recharts "stacked" titles), it is close to 1/50.

**What this means for charts-3d** (inference). The bar chart spends z on the series. Stacking the
series takes them off z and leaves the depth empty, which is the Highcharts, AnyChart and Excel
default that ADR-0015 rejects. Competitors show two forms that keep data in the depth:

1. **Two categories on the floor, series stacked in height**, as in ECharts-GL and matplotlib.
   That is bar-field's x × z shape with layers.
2. **Each stack group in its own z row**, as in Highcharts with `grouping: false`: for example,
   continents along z and countries stacked within each.

Everywhere, the tooltip shows the piece's own value by default. The total, and the share for
percent stacking, are opt-in fields; Highcharts' 3D demo prints both the value and the stack
total.

## 5. Sources

- Stack Exchange API: https://api.stackexchange.com/2.3/search/advanced (`title`, `q`, `tagged`, `filter=total`, `sort=votes`); questions 38086972, 35246780, 13156133, 18866767, 66679221, 67451002
- GitHub search: `gh api search/issues` (repos plotly/plotly.js, plotly/plotly.py, ecomfe/echarts-gl, apache/echarts, highcharts/highcharts, shadcn-ui/ui, recharts/recharts, plouc/nivo, chartjs/Chart.js); GraphQL `search(type: DISCUSSION)` for shadcn-ui/ui
- Plotly: https://github.com/plotly/plotly.js/issues/270 · https://github.com/plotly/plotly.js/pull/7003 · https://github.com/plotly/plotly.js/issues/7409 · https://plotly.com/javascript/3d-charts/ · https://community.plotly.com/search.json
- ECharts-GL: https://github.com/ecomfe/echarts-gl (`src/chart/common/createList.js`, `src/chart/bar3D/cartesian3DLayout.js`, `src/chart/bar3D/bar3DLayout.js`, `src/chart/bar3D/Bar3DSeries.js`, `src/chart/common/formatTooltip.js`, `test/bar3D-stack.html`; issues #45, #93, #256, #447)
- ECharts examples: https://github.com/apache/echarts-examples (`src/data/chart-list-data-gl.js`, `src/common/config.js`, `public/examples/ts/gl/stacked-bar3d.js`, `public/examples/ts/bar-stack-normalization.ts`)
- ECharts docs and core: https://github.com/apache/echarts-doc (`en/option-gl/series/bar3D.md`, `en/option-gl/partial/stack.md`, `en/option/partial/stack.md`) · https://github.com/apache/echarts `src/processor/dataStack.ts` · issues #9807, #20594, #9832
- Highcharts: https://www.highcharts.com/docs/chart-concepts/3d-charts · https://github.com/highcharts/highcharts (`ts/Series/Column3D/Column3DComposition.ts`, `ts/Core/Series/SeriesDefaults.ts`, `ts/Core/TooltipOptions.ts`, `ts/Core/Defaults.ts`, `ts/Core/Axis/Stacking/StackingAxis.ts`, `ts/Core/Axis/Stacking/StackingOptions.ts`, `samples/highcharts/demo/3d-*`, `cylinder`, `funnel3d`, `pyramid3d`; issues #13631, #14358)
- AnyChart: https://docs.anychart.com/Basic_Charts/3D/Overview · https://docs.anychart.com/Basic_Charts/3D/Column_Chart · https://docs.anychart.com/Basic_Charts/Stacked/Overview · https://docs.anychart.com/Basic_Charts/Stacked/Value/3D_Column_Chart · https://docs.anychart.com/Basic_Charts/Stacked/Percent/3D_Column_Chart · https://api.anychart.com/anychart.charts.Cartesian3d
- amCharts: https://www.amcharts.com/demos-v4/3d-stacked-column-chart-v4/ · https://www.amcharts.com/demos/ · https://github.com/amcharts/amcharts4 (`src/.internal/charts/types/XYChart3D.ts`, `src/.internal/charts/series/XYSeries.ts`, `src/.internal/core/Component.ts`); the v4 3D docs page https://docs.amcharts.com/v4/chart-types/3d-charts/ returned 404
- Excel: https://support.microsoft.com/en-us/office/available-chart-types-in-office-a6187218-807e-4103-9e0a-27cdb19afb90
- matplotlib: https://matplotlib.org/stable/api/_as_gen/mpl_toolkits.mplot3d.axes3d.Axes3D.bar3d.html
- shadcn/ui: issues #8090, #7315, #6467, #7187, #7477, #12719, #9077, #9716, #10468; discussions #4882, #3828
- Recharts: issues #871, #1400, #1580, #925, #1291, #2302, #576, #472, #479, #958 · Nivo: #535, #678 · Chart.js: #966, #2583, #5523
- 3d-force-graph: https://github.com/vasturiano/3d-force-graph · https://api.npmjs.org/downloads/point/last-week/3d-force-graph · https://api.npmjs.org/downloads/point/last-week/react-force-graph-3d
