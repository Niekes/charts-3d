#!/usr/bin/env node
/**
 * Checks the charts-3d registry template.
 *
 * The template is the shape of the registry, not just its behaviour:
 *
 *   registry.json                         one item per registry file
 *   registry/new-york/ui/chart-3d.tsx     the core every chart installs with it
 *   registry/new-york/ui/<n>-chart-3d.tsx one chart per file, exporting
 *                                         `<N>Chart3D` and `<N>Chart3DProps`
 *   tests/<item>.test.tsx                 one test file per item
 *   docs/content/components/<item>.mdx    one docs page per item
 *   docs/examples/<item>-demo.tsx         the example the page shows
 *   docs/examples/<chart>-update-demo.tsx data gliding in
 *   docs/examples/<chart>-enter-demo.tsx  marks entering and leaving
 *   docs/examples/<chart>-renderers-demo.tsx one scene on every renderer
 *   docs/examples/<chart>-many-demo.tsx   thousands of marks, staying interactive
 *
 * Fallow covers the parts that need a real dependency graph (layering, dead
 * code, test coverage). This script covers naming and shape, which are
 * cheaper to check by reading the source directly - and which keep working
 * without Fallow installed.
 *
 * Usage: node scripts/check-template.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const UI = "registry/new-york/ui"
const CORE = "chart-3d"
const CORE_IMPORT = `@/${UI}/${CORE}`
const CORE_DEPENDENCY = `niekes/charts-3d/${CORE}`

/** @type {string[]} */
const violations = []

/** @param {string} message */
const fail = (message) => violations.push(message)

/** @param {string} relativePath */
const read = (relativePath) => readFileSync(join(ROOT, relativePath), "utf8")

/** @param {string} relativePath */
const exists = (relativePath) => existsSync(join(ROOT, relativePath))

/** `bar-chart-3d` -> `BarChart3D` */
const pascalCase = (stem) =>
  stem
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
    .replace(/3d$/, "3D")

const files = readdirSync(join(ROOT, UI))
  .filter((entry) => entry.endsWith(".tsx"))
  .sort()
const registry = JSON.parse(read("registry.json"))
// The release commit pins the core to its own tag, `master` leaves it unpinned.
const RELEASE_DEPENDENCY = `${CORE_DEPENDENCY}#v${JSON.parse(read("package.json")).version}`
const items = new Map(registry.items.map((item) => [item.name, item]))
const core = items.get(CORE)

/**
 * The registry and the files agree: every file is an item of the same name,
 * every item is a file.
 */
for (const file of files) {
  const name = basename(file, ".tsx")
  const item = items.get(name)

  if (!item) {
    fail(`${UI}/${file}: has no item '${name}' in registry.json`)
    continue
  }
  if (item.type !== "registry:ui") {
    fail(`registry.json: '${name}' must be of type 'registry:ui'`)
  }
  if (item.files?.length !== 1 || item.files[0].path !== `${UI}/${file}`) {
    fail(`registry.json: '${name}' must list exactly the file '${UI}/${file}'`)
  }
}

for (const name of items.keys()) {
  if (!files.includes(`${name}.tsx`)) {
    fail(`registry.json: '${name}' has no file '${UI}/${name}.tsx'`)
  }
}

/**
 * Every registry file is a client module without a default export, and
 * every item has a test, a docs page and an example.
 */
for (const file of files) {
  const name = basename(file, ".tsx")
  const source = read(`${UI}/${file}`)

  if (!source.startsWith('"use client"')) {
    fail(`${UI}/${file}: must start with the "use client" directive`)
  }
  if (/(v8|c8|istanbul)\s+ignore/.test(source)) {
    fail(`${UI}/${file}: no coverage ignore comments; test the code or delete it`)
  }
  if (/^export\s+default\b/m.test(source)) {
    fail(`${UI}/${file}: the registry has no default exports`)
  }
  if (/^export\s+const\s+\w+\s*=\s*[(<]/m.test(source)) {
    fail(`${UI}/${file}: use 'export function' instead of 'export const' for components`)
  }

  for (const path of [
    `tests/${name}.test.tsx`,
    `docs/content/components/${name}.mdx`,
    `docs/examples/${name}-demo.tsx`,
  ]) {
    if (!exists(path)) fail(`${name}: is missing '${path}'`)
  }
}

/**
 * The core declares the npm packages every chart may import; a chart that
 * needs one of its own, as the globe needs d3-geo, declares it on its item,
 * so it lands only where that chart installs. A chart imports only those,
 * React and the core, and depends on the core in the registry.
 */
const unversioned = (dependencies) => dependencies.map((d) => d.replace(/@[^@/]*$/, ""))
const coreDependencies = unversioned(core?.dependencies ?? [])

for (const file of files.filter((file) => file !== `${CORE}.tsx`)) {
  const name = basename(file, ".tsx")
  const component = pascalCase(name)
  const source = read(`${UI}/${file}`)
  const allowed = new Set([
    "react",
    ...coreDependencies,
    ...unversioned(items.get(name)?.dependencies ?? []),
  ])

  if (!name.endsWith("-chart-3d")) {
    fail(`${UI}/${file}: a chart is named '<name>-chart-3d.tsx'`)
  }
  if (!new RegExp(`export\\s+function\\s+${component}\\b`).test(source)) {
    fail(`${UI}/${file}: must export a function '${component}'`)
  }
  if (!new RegExp(`export\\s+type\\s+${component}Props\\b`).test(source)) {
    fail(`${UI}/${file}: must export the type '${component}Props'`)
  }
  // What a mark says on hover is the reader's: a chart takes `tooltip`, a
  // function of what the mark would say and the data behind it (ADR-0006).
  const props = source.match(
    new RegExp(`export\\s+type\\s+${component}Props\\b[^{]*{([\\s\\S]*?)\\n}`)
  )
  if (!/\btooltip\?:\s*\(/.test(props?.[1] ?? "")) {
    fail(
      `${UI}/${file}: a chart takes 'tooltip', a function of what a mark would say and the data behind it`
    )
  }

  for (const [, specifier] of source.matchAll(/from\s+"([^"]+)"/g)) {
    if (specifier !== CORE_IMPORT && !allowed.has(specifier)) {
      fail(
        `${UI}/${file}: may import only React, ${[...allowed].join(", ")} and '${CORE_IMPORT}', not '${specifier}'`
      )
    }
  }

  // A chart projects its data with d3-3d, never by hand: it imports one of
  // the shape generators, calls it, and sorts the projected shapes with
  // d3-3d's `sort`, so every renderer draws the same scene in paint order.
  // `axes3D` and `iso3D` are not in the list: they do not project marks.
  const GENERATORS = new Set([
    "points3D",
    "lines3D",
    "lineStrips3D",
    "planes3D",
    "polygons3D",
    "gridPlanes3D",
    "triangles3D",
    "cubes3D",
  ])
  const clause = source.match(/import\s*{([^}]*)}\s*from\s+"d3-3d"/)?.[1] ?? ""
  const names = clause
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && !name.startsWith("type "))
  const generator = names.find((name) => GENERATORS.has(name))
  const body = source.replace(/import\s*{[^}]*}\s*from\s+"d3-3d"/, "")
  // The one other projection is d3-geo's (ADR-0007): a chart of regions
  // alone, as the choropleth, projects with `geoPath` - handed to the core's
  // `earth` - and has no shapes of d3-3d to sort.
  const geo = /import\s*{[^}]*\bgeoPath\b[^}]*}\s*from\s+"d3-geo"/.test(source)
  const regions = !generator && geo && /\bgeoPath\b/.test(body.replace(/import[^\n]*/g, ""))
  if (!regions && (!generator || !new RegExp(`${generator}\\s*[<(]`).test(body))) {
    fail(
      `${UI}/${file}: a chart projects with a d3-3d shape generator (${[...GENERATORS].join(", ")}), imported from "d3-3d" and called`
    )
  }
  if (!regions && (!names.includes("sort") || !/\bsort\b/.test(body))) {
    fail(`${UI}/${file}: a chart sorts its projected shapes with d3-3d's 'sort'`)
  }

  // A chart shows what the template promises: data gliding in (update), marks
  // entering and leaving (enter), one scene on every renderer (renderers),
  // thousands of marks (many).
  for (const demo of ["update", "enter", "renderers", "many"]) {
    const path = `docs/examples/${name}-${demo}-demo.tsx`
    if (!exists(path)) fail(`${name}: is missing '${path}'`)
  }

  // The core draws the marks with the renderer of the container, so a chart
  // that renders elements of its own would draw them with SVG only.
  const element = source.match(
    /<(svg|g|path|circle|rect|line|polyline|polygon|text|canvas|div|span)\b/
  )
  if (element) {
    fail(
      `${UI}/${file}: a chart draws through Axes3D and Marks3D, not with <${element[1]}> of its own, so every renderer can draw it`
    )
  }
  if (!source.includes("<Marks3D")) {
    fail(`${UI}/${file}: a chart hands its shapes to Marks3D`)
  }

  const dependencies = items.get(name)?.registryDependencies ?? []
  if (
    dependencies.length !== 1 ||
    (dependencies[0] !== CORE_DEPENDENCY && dependencies[0] !== RELEASE_DEPENDENCY)
  ) {
    fail(
      `registry.json: '${name}' must depend on '${CORE_DEPENDENCY}', or on '${RELEASE_DEPENDENCY}' in a release, and nothing else`
    )
  }
}

/**
 * The npm package and the registry ship the same files: `index.ts` re-exports
 * every registry file, and nothing else.
 */
const barrel = read("index.ts")
const reexports = [
  ...barrel.matchAll(/^export \* from "\.\/registry\/new-york\/ui\/([\w-]+)"$/gm),
].map(([, name]) => name)

for (const file of files) {
  if (!reexports.includes(basename(file, ".tsx"))) {
    fail(
      `index.ts: must re-export the registry file with 'export * from "./${UI}/${basename(file, ".tsx")}"'`
    )
  }
}
if (/^export (?!\* from "\.\/registry\/)/m.test(barrel)) {
  fail("index.ts: may only re-export the registry files")
}

/**
 * Every scene can be checked on every renderer: a demo carries the
 * RendererSelect below its chart, a renderers demo lays the scene out on all
 * of them with RendererGrid.
 */
for (const demo of readdirSync(join(ROOT, "docs/examples")).filter((f) =>
  f.endsWith("-demo.tsx")
)) {
  const control = demo.endsWith("-renderers-demo.tsx") ? "RendererGrid" : "RendererSelect"
  if (!read(`docs/examples/${demo}`).includes(`<${control}`)) {
    fail(`docs/examples/${demo}: a demo carries the ${control} of renderer-select.tsx`)
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} registry template violation(s):\n`)
  for (const violation of violations) {
    console.error(`  - ${violation}`)
  }
  console.error("")
  process.exit(1)
}

console.log("✓ registry template satisfied")
