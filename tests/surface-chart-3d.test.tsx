import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vite-plus/test"

import { ChartContainer3D } from "@/registry/new-york/ui/chart-3d"
import { SurfaceChart3D } from "@/registry/new-york/ui/surface-chart-3d"

const config = { low: { color: "blue" }, high: { color: "red" } }
const quads = (html: string) => html.match(/d="M[^"]*" fill="color-mix/g) ?? []

describe("SurfaceChart3D", () => {
  test("cuts a grid of n × m heights into (n − 1) × (m − 1) quads", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [0, 1, 2, 3],
            [1, 2, 3, 4],
            [2, 3, 4, 5],
          ]}
        />
      </ChartContainer3D>
    )
    expect(quads(html)).toHaveLength(6)
  })

  test("ramps between the first two config colors", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [0, 1],
            [1, 2],
          ]}
        />
      </ChartContainer3D>
    )
    expect(html).toMatch(/color-mix\(in oklch, var\(--color-high\) \d+%, var\(--color-low\)\)/)
  })

  test("a flat surface stays a number", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [1, 1],
            [1, 1],
          ]}
        />
      </ChartContainer3D>
    )
    expect(quads(html)).toHaveLength(1)
    expect(html).not.toContain("NaN")
  })

  test("an empty grid draws the box and no surface", () => {
    for (const data of [[], [[]]]) {
      const html = renderToString(
        <ChartContainer3D config={config}>
          <SurfaceChart3D data={data} />
        </ChartContainer3D>
      )
      expect(quads(html)).toHaveLength(0)
      expect(html).not.toContain("NaN")
    }
  })
})
