import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { renderToString } from "react-dom/server"
import { describe, expect, expectTypeOf, test } from "vite-plus/test"

import * as pkg from "@/index"
import * as area from "@/registry/new-york/ui/area-chart-3d"
import * as bar from "@/registry/new-york/ui/bar-chart-3d"
import * as barField from "@/registry/new-york/ui/bar-field-chart-3d"
import * as core from "@/registry/new-york/ui/chart-3d"
import * as choropleth from "@/registry/new-york/ui/choropleth-chart-3d"
import * as globe from "@/registry/new-york/ui/globe-chart-3d"
import * as line from "@/registry/new-york/ui/line-chart-3d"
import * as places from "@/registry/new-york/ui/places-chart-3d"
import * as routes from "@/registry/new-york/ui/routes-chart-3d"
import * as scatter from "@/registry/new-york/ui/scatter-chart-3d"
import * as surface from "@/registry/new-york/ui/surface-chart-3d"

describe("the npm package", () => {
  // `export *` drops a name that two files export, without a word.
  test("exports everything the registry files export", () => {
    const registry = [
      core,
      area,
      bar,
      barField,
      choropleth,
      globe,
      line,
      places,
      routes,
      scatter,
      surface,
    ].flatMap((module) => Object.keys(module))
    expect(Object.keys(pkg).sort()).toEqual(registry.sort())
  })

  describe("stability", () => {
    // The two lists of the Stability section of the chart-3d page: what semver covers, and what a chart is built from.
    const page = readFileSync("docs/content/components/chart-3d.mdx", "utf8")
    const section = page.slice(page.indexOf("## Stability"), page.indexOf("## API Reference"))
    const [stable, built] = section
      .split("\n\n")
      .filter((p) => p.includes("`"))
      .map((p) => [...p.matchAll(/`(\w+)`/g)].map((m) => m[1]))
    const source = readFileSync("registry/new-york/ui/chart-3d.tsx", "utf8")
    /** The doc comment right above the declaration of `name`, if it has one. */
    const docOf = (name: string) => {
      const at = source.search(new RegExp(`^(export )?(function|const|type) ${name}\\b`, "m"))
      return source.slice(0, at).match(/\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*$/)?.[0] ?? ""
    }

    test("every name a chart is built from says in its doc comment that a minor version may change it", () => {
      expect(built.length).toBeGreaterThan(40)
      expect(built.filter((name) => !docOf(name).includes("@experimental"))).toEqual([])
      expect(stable.filter((name) => docOf(name).includes("@experimental"))).toEqual([])
    })

    test("every export of the core stands on one side of the line", () => {
      const listed = new Set([...stable, ...built])
      expect(Object.keys(core).filter((name) => !listed.has(name))).toEqual([])
    })
  })

  // An interface has no index signature, as a type alias has one of its own: both declare
  // the entries of a chart. What fails here is the type check - of the lint and of
  // `npm run typecheck` - not the run.
  test("every chart takes entries declared as an interface, and hands its tooltip entries of that type", () => {
    interface Sale {
      month: string
      revenue: number
    }
    interface Point {
      x: number
      y: number
      z: number
    }
    interface City {
      id: string
      lon: number
      lat: number
      population: number
    }
    const sales: Sale[] = [
      { month: "Jan", revenue: 1 },
      { month: "Feb", revenue: 2 },
    ]
    const points: Point[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ]
    const cities: City[] = [{ id: "276", lon: 13.4, lat: 52.5, population: 3.7 }]
    const land: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    // The type of what a tooltip is handed, read where the chart hands it over.
    const charts = [
      <pkg.BarChart3D
        data={sales}
        index="month"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entry: Sale; key: string }>()
          return tip
        }}
      />,
      <pkg.AreaChart3D
        data={sales}
        index="month"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ key: string; entries: Sale[] }>()
          return tip
        }}
      />,
      <pkg.LineChart3D
        data={points}
        x="x"
        y="y"
        z="z"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entry: Point }>()
          return tip
        }}
      />,
      <pkg.ScatterChart3D
        data={points}
        x="x"
        y="y"
        z="z"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entry: Point }>()
          return tip
        }}
      />,
      <pkg.GlobeChart3D
        data={cities}
        land={land}
        lon="lon"
        lat="lat"
        value="population"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entries: City[] }>()
          return tip
        }}
      />,
      <pkg.PlacesChart3D
        data={cities}
        land={land}
        lon="lon"
        lat="lat"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entry: City }>()
          return tip
        }}
      />,
      <pkg.RoutesChart3D
        data={cities}
        land={land}
        lon="lon"
        lat="lat"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entries: City[] }>()
          return tip
        }}
      />,
      <pkg.ChoroplethChart3D
        data={cities}
        land={land}
        id="id"
        value="population"
        tooltip={(tip, data) => {
          expectTypeOf(data).toEqualTypeOf<{ entry: City }>()
          return tip
        }}
      />,
    ]
    for (const chart of charts) {
      const html = renderToString(
        <pkg.ChartContainer3D config={{ revenue: { color: "red" } }}>{chart}</pkg.ChartContainer3D>
      )
      expect(html).toContain('<svg viewBox="0 0 640 400"')
      expect(html).not.toContain("NaN")
    }
  })

  test("require finds the package by its name, as import does: Jest and other tools resolve with it", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"))
    // A project that installed the package: its manifest and its entry under node_modules.
    const project = realpathSync(mkdtempSync(join(tmpdir(), "charts-3d-")))
    try {
      const installed = join(project, "node_modules", manifest.name)
      mkdirSync(join(installed, "dist"), { recursive: true })
      writeFileSync(join(installed, "package.json"), JSON.stringify(manifest))
      writeFileSync(join(installed, manifest.module), "")
      // Node's own resolution, under the conditions of require.
      const resolve = createRequire(join(project, "app.cjs")).resolve
      expect(resolve(manifest.name)).toBe(join(installed, manifest.module))
    } finally {
      rmSync(project, { recursive: true })
    }
  })

  test("renders a chart from its entry on the server", () => {
    const html = renderToString(
      <pkg.ChartContainer3D config={{ a: { color: "red" } }}>
        <pkg.BarChart3D data={[{ name: "x", a: 1 }]} index="name" />
      </pkg.ChartContainer3D>
    )
    expect(html).toContain('<svg viewBox="0 0 640 400"')
    expect(html).toContain("color-mix(in oklch, var(--color-a, currentColor)")
  })
})
