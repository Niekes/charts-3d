// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

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
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    // The middle of the face painted last, which nothing covers.
    const face = [...host.querySelectorAll('path[fill^="color-mix"]')].at(-1)!
    const corners = face.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
    )
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
    )
    expect(host.textContent).toMatch(/A\s*[13]/)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a value that is not a number stands as no bar, and the labels fall back to the keys", () => {
    const html = renderToString(
      <ChartContainer3D config={{ a: { color: "red" } }}>
        <BarChart3D
          data={[
            { name: "x", a: "n/a", b: 2 },
            { a: 1, b: 3 },
          ]}
          index="name"
          keys={["a", "b"]}
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("NaN")
    // `b` has no label in the config, the entry without a name has an empty one.
    expect(html).toMatch(/>b<\/text>/)
    expect(html).toMatch(/><\/text>/)
  })
})

describe("BarChart3D transitions", () => {
  afterEach(() => vi.useRealTimers())

  test("new data glides in over the animationDuration of the container", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (values: { name: string; a: number; b: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={values} index="name" />
          </ChartContainer3D>
        )
      )

    await render(data)
    await render([
      { name: "x", a: 10, b: -20 },
      { name: "y", a: 8, b: -15 },
    ])
    // The y axis still shows the ticks of the old values.
    expect(host.textContent).not.toContain("-20")
    await act(() => vi.advanceTimersByTime(700))
    expect(host.textContent).toContain("-20")

    await act(async () => root.unmount())
    host.remove()
  })
})
