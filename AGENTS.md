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
  camera and its shortcuts, the axes, the marks and their renderers, the
  tooltip and the helpers (`axis`, `linear`, `worldBox`, `shade`, `center`).
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
  `registry.json`, and the core as `@/registry/new-york/ui/chart-3d`, which
  the shadcn CLI rewrites to the `ui` alias of the project;
- a chart renders no SVG or HTML elements of its own: it draws through
  `Axes3D` and `Marks3D`, so every renderer can draw it;
- a chart depends on `niekes/charts-3d/chart-3d` in the registry and leaves
  the npm dependencies to the core. On `master` the dependency is unpinned;
  only the release commit, which the release workflow makes beside `master`,
  pins it to `#v<version>`, the version in `package.json`;
- every item has `tests/<item>.test.tsx`, `docs/content/components/<item>.mdx`
  and `docs/examples/<item>-demo.tsx`;
- `index.ts` re-exports every registry file with `export *`, and nothing else.

How the charts draw, so that a new one draws the same way:

- **Marks.** A chart turns its projected shapes into `Mark3D`s - a polygon or
  a circle, a CSS fill and, if it has one, a tooltip - and hands them to
  `Marks3D`. The core draws them and finds the one under the pointer, so a
  chart has no pointer handlers.
- **Labels.** Text beside a mark, such as the name of a node, goes to
  `Labels3D` as `Label3D`s: the point in the view box and the end of the text
  there. The core draws it with every renderer, ringed by the background.
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

### Renderers

`ChartContainer3D` takes `renderer`: `"svg"`, the default, or `"canvas"`, for
charts with many marks. Only the marks change hands: the box, its labels, the
tooltip, the legend and the shortcut panel are SVG and HTML with every
renderer, so text stays sharp and the theme stays in CSS.

- **SVG first.** The server, the prerender and the first render on the client
  draw SVG. An effect then switches to the requested renderer if the browser
  has it, and stays on SVG where it has none, as in jsdom.
- **One scene.** `Marks3D` writes its marks into the scene of the container;
  the canvas paints the scene and the hover hit-tests it, whatever the
  renderer.
- **WebGL is the next link.** It joins the same chain: `"webgl"` probes
  `getContext("webgl")` and falls back to `"canvas"`. Its paint function
  triangulates the same marks - a fan per polygon, a fan of 12 segments per
  circle - draws them in paint order without a depth test, and takes its
  colors as bytes from a 1×1 canvas. Project on the GPU with `camera.matrix()`
  only once the projection on the CPU is what is slow.

### Interaction

The camera moves through one table, `SHORTCUTS` in the core: the keys of a
row move the camera, and the shortcut panel - the keyboard button and `?` -
lists every row. A new gesture is a new row, so the panel never misses one.

- **A step is a `Move`.** `moved(view, move)` applies it; the tilt and the
  zoom stop at their limits there and nowhere else.
- **The wheel zooms only with Ctrl or ⌘**, which is also how a trackpad
  pinches; the wheel alone scrolls the page. The listener is the core's own,
  because React listens to the wheel passively and cannot keep the browser
  from zooming the page.
- **`orbiting` is true while the camera turns**, not while it pans or zooms,
  which move the labels as they are. The axis labels read it from
  `data-orbiting` on the svg.

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
  and everything the docs and the tests need is a devDependency.
- **The props are semver.** Users of the registry own their copy, users of the
  package depend on the API: a change to a prop or an export of `index.ts`
  is a breaking change and needs a major version.

### Adding a chart

1. Create `registry/new-york/ui/<name>-chart-3d.tsx` following the template above.
2. Add its item to `registry.json`, with `niekes/charts-3d/chart-3d` as its
   only registry dependency.
3. Add `tests/<name>-chart-3d.test.tsx`, `docs/examples/<name>-chart-3d-demo.tsx`
   and `docs/content/components/<name>-chart-3d.mdx`, and list the page in
   `docs/content/components/meta.json`.
4. Add `export * from "./registry/new-york/ui/<name>-chart-3d"` to `index.ts`.
5. Run `npm run lint` and `npm test`.

### Adding a core helper

Add it to `registry/new-york/ui/chart-3d.tsx`, export it from the export list
at the end of the file and cover it with a test in `tests/chart-3d.test.tsx`.
`fallow health --coverage-gaps` reports an export that no test reaches.
