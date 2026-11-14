<!-- fallow:setup-hooks:start -->

## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` and `git push`. In Claude Code and Codex, a PreToolUse hook from `fallow agent install` runs this check and blocks the command when the verdict is `fail`. Other agents run the check themselves: `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ "error": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to...                                        | Run                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete an "unused" export or file                                    | `fallow dead-code --trace <file>:<export>`                                                                                                                    |
| prove a TypeScript symbol's exact consumers before refactoring       | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>`                                                                               |
| find how one module reaches another                                  | `fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.)       |
| delete an "unused" dependency                                        | `fallow dead-code --trace-dependency <name>`                                                                                                                  |
| migrate a dependency                                                 | `fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.) |
| commit or open a PR                                                  | `fallow audit --base <ref>`                                                                                                                                   |
| read a diff before approving it                                      | `fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row)                                        |
| prioritize refactoring                                               | `fallow health --hotspots --targets`                                                                                                                          |
| ask who owns code                                                    | `fallow health --ownership`                                                                                                                                   |
| check untested-but-reachable code                                    | `fallow health --coverage-gaps`                                                                                                                               |
| consolidate duplication                                              | `fallow dupes --trace dup:<fingerprint>`                                                                                                                      |
| find feature flags                                                   | `fallow flags`                                                                                                                                                |
| check which architecture rules apply to a file before changing it    | `fallow guard <files>`                                                                                                                                        |
| check import cycles, boundaries and policy rules after changing code | `fallow architecture`                                                                                                                                         |
| surface security candidates                                          | `fallow security`                                                                                                                                             |
| understand a finding                                                 | `fallow explain <issue-type>`                                                                                                                                 |
| scope a monorepo                                                     | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command)                                                                          |

<!-- fallow:setup-hooks:end -->

## Releasing

A release is a pull request that bumps the version in `package.json` and
updates `CHANGELOG.md` (for example the `release/0.3.0` branch). Merging it
into `master` triggers `.github/workflows/release.yml`, which stages the new
version on npm - but only when `package.json` changed and the version is not
on npm yet - and, if it is missing, tags the pinned release commit and creates
the `vX.Y.Z` release on GitHub. The version goes live once a maintainer
approves it with 2FA. Never run `npm publish`, `npm stage approve` or push a
version tag by hand.

## The registry template

`charts-3d` is a shadcn registry: its files are copied into other projects. Its
template is not a convention - it is enforced by `npm run lint`, which runs in
CI, in the Git pre-commit hook and in the agent hooks above.

```bash
npm run lint           # the whole gate
npm run lint:template  # naming and shape conventions
npm run lint:fallow    # layering, dead code, test coverage, duplication, health >= 98
```

### The health score

`fallow health --min-score 98` is part of the gate: the build fails when the
health score of the registry drops below 98. With about 80 functions, a
single function longer than 60 lines costs more than two points, so **no
function in the registry is longer than 60 lines**. Split a long component
along its seams, the way the registry does: a hook for behaviour (`useOrbit`,
`useCanvas`), a component for one part of the chart (`AxisEdge3D`,
`ChartShortcuts3D`), a function for a computation (`barBox`, `barMarks`,
`moved`).

### Test coverage

`npm run coverage` fails when the registry drops below **98 % in each of
statements, branches, functions and lines**, and CI runs it on every pull
request. Three rules keep the number honest:

- **New code comes with its tests.** A chart, a prop or a branch that no test
  reaches does not merge.
- **Unreachable code is deleted, not excluded.** Coverage ignore comments
  (`v8 ignore`, `istanbul ignore`) fail the template check; a guard for a case
  that cannot happen goes, with a comment that says why it cannot.
- **A fix comes with the test that fails without it.**

The tests drive the charts the way a user does: render them, send pointer and
keyboard events, read what they draw. jsdom has no layout and no canvas, so the
tests stub `getBoundingClientRect`, `setPointerCapture` and `getContext` where
they need them, see `mount` and `stubCanvas` in `tests/chart-3d.test.tsx`.

### The layers

Dependencies point inwards only. The zones are declared in `.fallowrc.jsonc`
and a violation fails the build.

| Zone         | Files                                 | May import                      |
| ------------ | ------------------------------------- | ------------------------------- |
| `public-api` | `index.ts`                            | `charts`, `core`                |
| `charts`     | `registry/new-york/ui/*-chart-3d.tsx` | `core`                          |
| `core`       | `registry/new-york/ui/chart-3d.tsx`   | `lib`                           |
| `lib`        | `lib/**`                              | nothing                         |
| `tests`      | `tests/**`                            | `public-api`, `charts`, `core`  |
| `docs`       | `docs/**`                             | `docs`, `charts`, `core`, `lib` |
| `tooling`    | `scripts/**`                          | nothing                         |

Two consequences worth remembering:

- **A chart builds on the core and never on another chart.** Every chart
  installs with `chart-3d` alone, so a user who adds the bar chart gets two
  files, not the whole registry.
- **The core knows nothing about the charts.** It holds the container, the
  camera and its shortcuts and gizmo, the axes, the marks and their
  renderers, the tooltip and the helpers (`axis`, `linear`, `worldBox`,
  `shade`, `faded`, `useSeries`).
  A helper that two charts need moves here.

### The chart template

`registry/new-york/ui/bar-chart-3d.tsx` is the reference. A chart module
named `<name>-chart-3d.tsx` owns exactly two exports:

```tsx
"use client"

import { box, cubes3D, sort, type AxesSpec } from "d3-3d"

import { Axes3D, Marks3D, axis, shade, useChart3D, worldBox } from "@/registry/new-york/ui/chart-3d"

// The props, a named type: the docs generate the API table from it, and
// every prop carries a comment and, if it has one, its @defaultValue.
export type BarChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per row of bars, with a value per series. */
  data: T[]
}

// The component: reads the camera from the container, projects the data
// with d3-3d on every render and hands its shapes to the core as marks.
export function BarChart3D<T extends Record<string, unknown>>({ data }: BarChart3DProps<T>) {
  const { config, camera } = useChart3D()
  // ...
  return (
    <>
      <Axes3D spec={spec} world={world} />
      <Marks3D marks={marks} />
    </>
  )
}
```

The rules that `scripts/check-template.mjs` enforces:

- every file in `registry/new-york/ui/` is an item of the same name in
  `registry.json`, of type `registry:ui`, and every item is a file;
- every registry file starts with `"use client"` and has no default export;
- a chart exports `<Name>Chart3D` with `export function` and the type
  `<Name>Chart3DProps`;
- a chart imports only React, the npm packages that `chart-3d` declares in
  `registry.json` or its own item declares there, and the core as
  `@/registry/new-york/ui/chart-3d`, which the shadcn CLI rewrites to the
  `ui` alias of the project;
- a chart renders no SVG or HTML elements of its own: it draws through
  `Axes3D` and `Marks3D` - through `Marks3D` alone where it has no axes, as
  the globe (ADR-0007) - so every renderer can draw it;
- a chart depends on `niekes/charts-3d/chart-3d` in the registry and leaves
  the npm dependencies to the core, unless it alone needs one: then its item
  declares it, as the globe declares `d3-geo`, and it lands only where that
  chart installs. On `master` the dependency is unpinned; only the release
  commit, which the release workflow makes beside `master`, pins it to
  `#v<version>`, the version in `package.json`;
- a chart projects its data with a d3-3d generator (`points3D`, `cubes3D`,
  `gridPlanes3D`, ...), imported from `d3-3d` and called, and sorts the
  projected shapes with d3-3d's `sort`; a chart of regions alone, as the
  choropleth, projects with d3-geo's `geoPath` instead and has nothing of
  d3-3d to sort;
- every item has `tests/<item>.test.tsx`, `docs/content/components/<item>.mdx`
  and `docs/examples/<item>-demo.tsx`; a chart also has the four other demos:
  `-update-demo` (data gliding in), `-enter-demo` (marks entering and
  leaving), `-renderers-demo` (one scene on every renderer) and `-many-demo`
  (thousands of marks, staying interactive);
- every demo carries the `RendererSelect` of
  `docs/examples/renderer-select.tsx` below the chart, so every scene can be
  checked visually on every renderer; the `-renderers-demo` instead lays the
  same scene out on every renderer at once, with `RendererGrid` from the
  same file;
- `index.ts` re-exports every registry file with `export *`, and nothing else.

How the charts draw, so that a new one draws the same way:

- **Projection with d3-3d**
  ([ADR-0003](docs/adr/0003-one-scene-renderer-parity.md)). A chart projects
  with a d3-3d generator, never with mathematics of its own: fallow forbids a
  chart trigonometry, the DOM, a canvas and the event loop - the core owns
  them. The one other projection is d3-geo's, for the land of the globe,
  built from the same camera (ADR-0007). The import whitelist is the ladder: reach for a core helper first,
  then for d3-3d or an allowed d3 module, and never write your own. A new d3
  module is a deliberate change to the dependencies of `chart-3d` in
  `registry.json`, and it lands in every installing project, so it has to
  earn its place; one that a single chart needs goes on that chart's item
  instead, as the globe's `d3-geo` (ADR-0007).
- **Marks.** A chart turns its projected shapes into `Mark3D`s - a polygon or
  a circle, a CSS fill and, if it has one, a tooltip, or a function that
  builds it when the pointer arrives, so a chart of thousands of marks pays
  for one - and hands them to `Marks3D`. The core draws them and finds the one under the pointer, so a
  chart has no pointer handlers.
- **Tooltips.** What a mark says is built from the data behind it, its
  values as the ticks name them through `format`, and handed to the chart's
  `tooltip` prop with that data, so the reader can say otherwise. A mark
  carries it as a function the core calls when the pointer lands on it,
  never built per frame, and a mark whose entry has left the data says
  nothing (ADR-0006).
- **Labels.** Text beside a mark, such as the name of a node, goes to
  `Labels3D` as `Label3D`s: the point in the view box and the side of it the
  text lies on, `toward`, a unit vector. The core draws it with every
  renderer, ringed by the background. Give a direction that turns with the
  camera, not an anchor that flips from start to end: `beside` slides the box
  round its point, where a flipping anchor makes it jump.
- **Focus** ([ADR-0002](docs/adr/0002-hover-highlight.md),
  [ADR-0008](docs/adr/0008-hover-lights-the-fill.md)). A mark names the marks
  of the same element in `groups`: the faces of a bar. Pointing at a mark, the
  core fills exactly those with the focus color - `--chart-3d-focus`, or their
  own fill lightened - until the pointer leaves the mark; a stroke of their
  own stays and nothing else changes, with every renderer, and a chart never
  highlights anything itself.
- **Axis labels.** `Axes3D` lays out the labels of all four edges of every
  axis from `axes3D().edges(spec)` and shows those of the `chosen` edge, so an
  axis fades from one edge to the next. `fit` gives the tick labels of an
  edge their room along it - one row, slid along the edge up to `DODGE`, two
  rows, then every 2nd, 4th… label - and `labelAxes` lets a label fade as it
  nears one of an axis with fewer ticks. Whatever follows the camera is
  geometry, in `x` and `y`; only a change of edge, row or stride moves in the
  CSS transition, through `opacity` and `translate`. The title of an axis is
  upright: the y title stands over the top end of its line on the box's side,
  its edge on the line, a gap clear of the top of the box wherever the box is
  highest under the text, rising with it by up to `LIFT`, so a steep edge
  crosses the text rather than carrying it off its axis; the title of a floor
  axis, whose ends are corners the other axes label, sits beyond its tick
  labels at the middle of its edge.
- **Depth by order.** Neither SVG nor the canvas has a depth buffer. Sort the
  projected shapes with d3-3d's `sort` and give the marks stable keys, so
  React moves the DOM nodes.
- **Culling.** The faces of `cubes3D` point outwards: draw the ones that are
  `ccw`, the ones that face the camera.
- **Shading in CSS.** `shade(face, color)` returns a `color-mix()`. A chart
  never computes a color, it hands CSS colors to the core: SVG leaves them to
  the browser, so a face follows the theme without a re-render, and the
  canvas resolves them in the core, through the DOM, and repaints when the
  theme changes.
- **The world box.** `worldBox(spec)` maps the axes into the box from -1 to 1,
  y up. Use it instead of building the scales by hand.
- **Transitions.** A chart glides into new data by tweening its numbers with
  `useTween`, before it projects - never the projected marks: every frame
  reprojects, and the camera answers at once. A new key starts at `enter`, a
  gone one glides back to it - the mirror of its entering - and leaves when
  the glide is done. A mark that grows from its enter value fades in as it
  grows and out as it shrinks - its opacity a tween of its own, 1 with the
  enter value 0, handed to `faded` after `shade` - so a flat bar or a dot
  never pops in or out at the end of a glide. A point of a line - the area
  chart - unfolds from its neighbour instead, as far as its presence, and folds
  back into it, so the line opens and closes without a notch. Build the axes from the data the chart glides into
  and hand them to `useTweenAxes`, which glides their ends with the marks:
  axes rounded from the numbers on screen would jump from one round end to
  the next, and the box with them. The tick labels are keyed by value, so a
  tick that stays glides on. Every part of the axes that enters - a label, a
  tick mark, a gridline, a wall - fades in through the `chart-3d-axes-in`
  keyframe, which covers `text`, `line` and `path` of the axes slot; a part
  the data drops leaves as the mirror of its entering (see Enter in
  GLOSSARY.md): a gone mark glides back to its enter value before it goes,
  and a dropped tick stays until the glide is done and fades out - within
  the new ends in place, beyond them as the gliding end sweeps past it. The
  line of an axis is geometry: it runs the gliding span of its outermost
  ticks, so it grows to a new tick and shrinks from a dropped one.
- **Motion only where the reader allows it.** `animates()` is true only where
  the browser says `prefers-reduced-motion: no-preference`; elsewhere, on the
  server and in jsdom too, the tweens and the camera jump. A test that wants
  a glide stubs `matchMedia` and fakes `requestAnimationFrame`.

### Renderers

`ChartContainer3D` takes `renderer`: `"svg"`, the default, or `"canvas"`, for
charts with many marks. Only the marks change hands: the box, its labels, the
tooltip, the legend, the shortcut panel and the gizmo are SVG and HTML with
every renderer, so text stays sharp and the theme stays in CSS.

- **SVG first.** The server, the prerender and the first render on the client
  draw SVG. An effect then switches to the requested renderer if the browser
  has it, and stays on SVG where it has none, as in jsdom.
- **One scene.** Every `Marks3D` places its marks into the scene of the
  container, a set per `Marks3D`, in their order in the tree, as SVG paints
  them;
  the canvas paints the scene and the hover hit-tests it, whatever the
  renderer.
- **Parity is behavioural and gated**
  ([ADR-0003](docs/adr/0003-one-scene-renderer-parity.md)). Every mark of the
  scene draws on every renderer, and hover, tooltip and focus act the same;
  pixels may differ, such as the width of a ring (ADR-0002). The parity test in
  `tests/chart-3d.test.tsx` drives one scene with every mark shape - a polygon
  and a circle - over every renderer. A third mark shape turns `Mark3D`
  into a discriminated union with an exhaustive switch everywhere the core
  draws - `Marks3D`, `paint` - so a shape one renderer misses fails to
  compile.
- **No WebGL.** `"webgl"` draws as `"canvas"`, deprecated until 1.0.0
  removes it: measured, it drew no faster, because projecting the marks on
  the CPU takes the time, not filling them (the globe's 2,500 tiles ran at
  about 25 fps on both). A GPU renderer earns its place again only with the
  projection on the GPU, through `camera.matrix()`, and a measurement that
  shows it faster.

### Interaction

The camera moves through one table, `SHORTCUTS` in the core: an action per
row, with its default keys, or the hint of its gesture, and its label. The
keys of an action move the camera, and the shortcut panel - the keyboard
button and `?` - lists every action that is on, one row per label. A new
gesture is a new action, so the panel never misses one.

- **`keymap` lays itself over the table.** `keymapOf` merges it per action:
  `false` turns an action off, keys replace its keys, a label renames it.
  Everything that reads the keys - the handlers, `aria-keyshortcuts`, the
  panel, the default `aria-label` - reads them from `keymapOf`.
- **Keys are in the syntax of `aria-keyshortcuts`**, and `combo` brings a
  binding and a press into one form, so they match exactly: a press with a
  modifier the binding lacks goes to the browser.

- **A step is a `Move`.** `moved(view, move)` applies it; the tilt and the
  zoom stop at their limits there and nowhere else, and a turn - a key or a
  drag - is divided by the zoom there, so the picture moves as far under the
  pointer zoomed in as out.
- **The gestures follow the 3D viewers of the browser, gated by the platform
  modifier** ([ADR-0001](docs/adr/0001-navigation.md)): ⌘ on a Mac, Ctrl on
  Windows and Linux, and a drag rotates; a plain drag only inspects, with the
  default cursor. Alt - ⌥ on a Mac - and a drag pans, and a double click
  resets. The panel
  shows each gesture with its hint, so a chart needs no gesture of its own.
- **The wheel zooms only with the platform modifier** - ⌘ on a Mac, Ctrl
  elsewhere, and the panel says so - while Ctrl keeps zooming on a Mac too,
  because a trackpad pinch arrives as Ctrl and the wheel; the wheel alone
  scrolls the page. The listener is the core's own, because React listens to
  the wheel passively and cannot keep the browser from zooming the page.
- **The wheel zooms to the cursor.** The handler hands `moved` the cursor as
  `at`, and `moved` moves the pan by the zoom after its limits, so the point
  under the cursor stays and the chart stands still at them. A key has no
  cursor: `+` and `-` zoom to the middle of the chart.
- **The cursor names the gesture**: a hand while the platform modifier is
  held, `grabbing` while the drag turns, the four arrows (`move`) while Alt
  is held, `zoom-in`/`zoom-out` while the wheel zooms, falling back
  `ZOOM_CURSOR` after the last tick.
- **A key glides, a drag jumps.** `useGlide` moves the view to the step of a
  key in `GLIDE` milliseconds, and a key pressed on the way heads on from
  there; a drag and the wheel follow the pointer at once and stop a glide.
  Where `animates()` is false, as in jsdom, a glide jumps, so the tests read
  the view right after a key.
- **`orbiting` is true while the camera turns**, not while it pans or zooms.
  Nothing in the core reads it; `data-orbiting` on the svg is there to style.

### Customization

Customization climbs a ladder
([ADR-0004](docs/adr/0004-customization-ladder.md)), and every new knob
chooses a rung:

- **Behaviour is a prop**: keys and gestures (`keymap`), renderer, durations,
  what shows (`legend`, `shortcuts`, `gizmo`), the data props of the charts.
  Documented with `@defaultValue`, tested, semver (an added knob is a minor).
- **Looks are CSS**: the theme tokens and the slots - every visible part
  carries a `data-slot`, listed on the theming page of the docs. Never style
  props.
- **Identity is fixed**: the hover (ADR-0002), the gestures (ADR-0001), one
  scene on every renderer (ADR-0003). Changing identity means editing the
  owned registry copy, not a prop.

A knob nobody turns is API debt: motion constants, camera steps and limits,
tick density, the walls and gridlines, and the focus color stay fixed until a
user asks.

### Code style

The registry uses the style of shadcn/ui - two spaces, double quotes, no
semicolons - because its files land in shadcn projects and should read like
the code around them there. `vp fmt` enforces it for the whole repository.
This differs from d3-3d on purpose.

### The docs

The docs site is Fumadocs on React Router, built with Vite+ and prerendered to
static HTML for GitHub Pages. Pages live in `docs/content`, the examples they
show in `docs/examples`. The examples import the charts as
`@/components/ui/<item>`, the way a project that installed them does; Vite and
TypeScript resolve that alias to the registry.

The docs have their own server entry, `docs/entry.server.tsx`: without it,
React Router's default entry needs `isbot` in `dependencies`, and the React
Router CLI adds it there and runs `npm install` with `NODE_ENV=production`,
which removes every devDependency. Keep the entry.

### The npm package

The same files ship as the npm package `@niekes/charts-3d`. `index.ts` is its
public API: one `export *` per registry file and nothing else, which the
template check enforces, so the package cannot drift from the registry.
`tests/package.test.tsx` checks that no name gets lost in the re-exports.

`npm run build:pack` bundles it with `vp pack` into `dist/`: ESM, the type
definitions and a `"use client"` banner, because the bundler drops the
directive of every registry file and Next.js has to load the components on
the client. The npm dependencies stay external.

- **The dependencies are the runtime of the package.** `dependencies` holds
  what the registry files import at runtime, `react` is a peer dependency,
  and everything the docs and the tests need is a devDependency. One
  exception: a `@types` package whose global namespace the public types name,
  as `@types/geojson` for the `land` of the globe, is a dependency too, or
  the published `index.d.ts` cannot resolve it.
- **The props are semver.** Users of the registry own their copy, users of the
  package depend on the API: a change to a prop or an export of `index.ts`
  is a breaking change and needs a major version. Before 1.0.0 the minor
  version is the major one: a breaking change goes from 0.4 to 0.5, which
  `^0.4.0` does not pick up. Semver covers what a chart is used with - the
  charts, `ChartContainer3D`, `ChartLegend3D`, their props and the types they
  take; what a chart is built from - `Axes3D`, `Marks3D`, the hooks, `Mark3D`
  and the helpers - may change in a minor version, with a changelog entry.
  The list is on the Stability section of the `chart-3d` docs page: a new
  export goes on one side of it.

### Adding a chart

1. Create `registry/new-york/ui/<name>-chart-3d.tsx` following the template above.
2. Add its item to `registry.json`, with `niekes/charts-3d/chart-3d` as its
   only registry dependency.
3. Add `tests/<name>-chart-3d.test.tsx`, the five demos in `docs/examples/`
   (`<name>-chart-3d-demo.tsx`, `-update-demo`, `-enter-demo`,
   `-renderers-demo`, `-many-demo`) and `docs/content/components/<name>-chart-3d.mdx`, and list
   the page in `docs/content/components/meta.json`.
4. Add `export * from "./registry/new-york/ui/<name>-chart-3d"` to `index.ts`.
5. Run `npm run lint` and `npm test`.

### Adding a core helper

Add it to `registry/new-york/ui/chart-3d.tsx`, export it from the export list
at the end of the file and cover it with a test in `tests/chart-3d.test.tsx`.
`fallow health --coverage-gaps` reports an export that no test reaches.

## Agent skills

### Issue tracker

Issues live in GitHub Issues of Niekes/charts-3d, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
