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
 * The core declares the npm packages; a chart imports only those, React and
 * the core, and depends on the core in the registry.
 */
const allowed = new Set([
  "react",
  ...(core?.dependencies ?? []).map((d) => d.replace(/@[^@/]*$/, "")),
])

for (const file of files.filter((file) => file !== `${CORE}.tsx`)) {
  const name = basename(file, ".tsx")
  const component = pascalCase(name)
  const source = read(`${UI}/${file}`)

  if (!name.endsWith("-chart-3d")) {
    fail(`${UI}/${file}: a chart is named '<name>-chart-3d.tsx'`)
  }
  if (!new RegExp(`export\\s+function\\s+${component}\\b`).test(source)) {
    fail(`${UI}/${file}: must export a function '${component}'`)
  }
  if (!new RegExp(`export\\s+type\\s+${component}Props\\b`).test(source)) {
    fail(`${UI}/${file}: must export the type '${component}Props'`)
  }

  for (const [, specifier] of source.matchAll(/from\s+"([^"]+)"/g)) {
    if (specifier !== CORE_IMPORT && !allowed.has(specifier)) {
      fail(
        `${UI}/${file}: may import only React, ${[...allowed].join(", ")} and '${CORE_IMPORT}', not '${specifier}'`
      )
    }
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
  if (items.get(name)?.dependencies?.length) {
    fail(`registry.json: '${name}' must leave its npm dependencies to '${CORE}'`)
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

if (violations.length > 0) {
  console.error(`✗ ${violations.length} registry template violation(s):\n`)
  for (const violation of violations) {
    console.error(`  - ${violation}`)
  }
  console.error("")
  process.exit(1)
}

console.log("✓ registry template satisfied")
