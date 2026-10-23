import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vite-plus/test"

import * as pkg from "@/index"
import * as bar from "@/registry/new-york/ui/bar-chart-3d"
import * as core from "@/registry/new-york/ui/chart-3d"
import * as scatter from "@/registry/new-york/ui/scatter-chart-3d"
import * as surface from "@/registry/new-york/ui/surface-chart-3d"

describe("the npm package", () => {
  // `export *` drops a name that two files export, without a word.
  test("exports everything the registry files export", () => {
    const registry = [core, bar, scatter, surface].flatMap((module) => Object.keys(module))
    expect(Object.keys(pkg).sort()).toEqual(registry.sort())
  })

  test("renders a chart from its entry on the server", () => {
    const html = renderToString(
      <pkg.ChartContainer3D config={{ a: { color: "red" } }}>
        <pkg.BarChart3D data={[{ name: "x", a: 1 }]} index="name" />
      </pkg.ChartContainer3D>
    )
    expect(html).toContain('<svg viewBox="0 0 640 400"')
    expect(html).toContain("color-mix(in oklch, var(--color-a)")
  })
})
