// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vite-plus/test"

import { BarChart3D } from "@/registry/new-york/ui/bar-chart-3d"
import { ChartContainer3D } from "@/registry/new-york/ui/chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { label: "A", color: "red" }, b: { label: "B", color: "blue" } }
const data = [
  { name: "x", a: 1, b: -2 },
  { name: "y", a: 3, b: 0.5 },
]
const faces = (html: string) => html.match(/<path d="[^"]*" fill="color-mix/g) ?? []

describe("BarChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the three faces of every bar that face the camera, a negative one too", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(12)
    expect(html).toContain("color-mix(in oklch, var(--color-b)")
    expect(html).not.toContain("NaN")
  })

  test("keys picks the series", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" keys={["a"]} />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(6)
    expect(html).not.toContain("var(--color-b)")
  })

  test("an empty chart draws the box and no bars", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={[]} index="name" />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(0)
    expect(html).not.toContain("NaN")
  })

  test("a bar under the pointer shows its entry and value in the tooltip", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <BarChart3D data={data} index="name" keys={["a"]} />
        </ChartContainer3D>
      )
    )
    const bar = host.querySelector("svg > g:last-of-type")!
    await act(() => bar.dispatchEvent(new MouseEvent("pointerover", { bubbles: true })))
    expect(host.textContent).toMatch(/A\s*[13]/)

    await act(async () => root.unmount())
    host.remove()
  })
})
