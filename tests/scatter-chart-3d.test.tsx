// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vite-plus/test"

import { ChartContainer3D } from "@/registry/new-york/ui/chart-3d"
import { ScatterChart3D } from "@/registry/new-york/ui/scatter-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { color: "red" }, b: { color: "blue" } }

describe("ScatterChart3D", () => {
  test("draws a circle per entry in the color of its series", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <ScatterChart3D
          data={[
            { x: 0, y: 0, z: 0, s: "a" },
            { x: 1, y: 2, z: 3, s: "b" },
          ]}
          x="x"
          y="y"
          z="z"
          series="s"
        />
      </ChartContainer3D>
    )
    expect(html.match(/<circle /g)).toHaveLength(2)
    expect(html).toContain('fill="var(--color-a)"')
    expect(html).toContain('fill="var(--color-b)"')
  })

  test("a single point, an extent of zero width, stays a number", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <ScatterChart3D data={[{ x: 1, y: 1, z: 1 }]} x="x" y="y" z="z" />
      </ChartContainer3D>
    )
    expect(html).toContain('fill="var(--color-a)"')
    expect(html).not.toContain("NaN")
  })

  test("the tooltip of a point shows its values rounded", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <ScatterChart3D data={[{ x: 1 / 3, y: 2, z: 3 }]} x="x" y="y" z="z" />
        </ChartContainer3D>
      )
    )
    const point = host.querySelector("circle")!
    await act(() => point.dispatchEvent(new MouseEvent("pointerover", { bubbles: true })))
    expect(host.textContent).toContain((1 / 3).toLocaleString())
    expect(host.textContent).not.toContain("0.3333333")

    await act(async () => root.unmount())
    host.remove()
  })
})
