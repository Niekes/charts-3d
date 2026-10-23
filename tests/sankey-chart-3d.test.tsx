// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vite-plus/test"

import { ChartContainer3D, type View3D } from "@/registry/new-york/ui/chart-3d"
import { SankeyChart3D, type SankeyChart3DProps } from "@/registry/new-york/ui/sankey-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  a: { label: "A", color: "red" },
  b: { label: "B", color: "blue" },
  c: { label: "C", color: "green" },
}

const chart = (data: SankeyChart3DProps["data"], defaultView?: View3D) => (
  <ChartContainer3D config={config} defaultView={defaultView}>
    <SankeyChart3D data={data} format={(value) => `${value} kWh`} />
  </ChartContainer3D>
)

/** The faces in paint order, each with its corners. */
const faces = (html: string) =>
  [...html.matchAll(/<path d="M([^"]*)Z" fill="(color-mix[^"]*)"/g)].map(([, d, fill]) => ({
    fill,
    corners: d.split("L").map((c) => c.split(",").map(Number)),
  }))

describe("SankeyChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the nodes, labelled, and the flows between them in the colors of their ends", () => {
    const html = renderToString(
      chart([
        { source: "a", target: "b", value: 2 },
        { source: "a", target: "c", value: 1 },
      ])
    )
    expect(faces(html).length).toBeGreaterThan(0)
    expect(html).toMatch(/color-mix\(in oklch, var\(--color-b\) \d+%, var\(--color-a\)\)/)
    expect(html).toMatch(/color-mix\(in oklch, var\(--color-c\) \d+%, var\(--color-a\)\)/)
    for (const label of ["A", "B", "C"]) expect(html).toContain(`>${label}</text>`)
    expect(html).not.toContain("NaN")
  })

  test("an empty chart, or one whose flows have no value, draws nothing", () => {
    for (const data of [[], [{ source: "a", target: "b", value: 0 }]]) {
      const html = renderToString(chart(data))
      expect(faces(html)).toHaveLength(0)
      expect(html).not.toContain("NaN")
    }
  })

  test("flows that form a cycle throw", () => {
    const cycle = [
      { source: "a", target: "b", value: 1 },
      { source: "b", target: "a", value: 1 },
    ]
    expect(() => renderToString(chart(cycle))).toThrow("cycle")
  })

  test("the node farther from the eye paints first, also in perspective", () => {
    const data = [{ source: "a", target: "b", value: 1 }]
    const first = (view: View3D) => {
      const html = renderToString(chart(data, view))
      return html.indexOf("var(--color-a)") < html.indexOf("var(--color-b)") ? "a" : "b"
    }
    for (const perspective of [Infinity, 3]) {
      // A positive yaw turns the eye to the left of the chart, a negative one to the right.
      expect(first({ yaw: Math.PI / 3, tilt: Math.PI / 6, perspective })).toBe("b")
      expect(first({ yaw: -Math.PI / 3, tilt: Math.PI / 6, perspective })).toBe("a")
    }
  })

  test("a thin flow off the top of a tall node paints behind it, seen from the side of the node", () => {
    // From the left and above, the default view. By its center alone, the slice
    // next to the top of a would be nearer than a, and paint over it.
    const html = renderToString(
      chart([
        { source: "a", target: "b", value: 1 },
        { source: "a", target: "c", value: 9 },
      ])
    )
    const fills = faces(html).map((face) => face.fill)
    const lastSlice = fills
      .map((fill) => fill.startsWith("color-mix(in oklch, color-mix"))
      .lastIndexOf(true)
    const firstOfA = fills.findIndex((fill) =>
      fill.startsWith("color-mix(in oklch, var(--color-a) ")
    )
    expect(lastSlice).toBeGreaterThan(-1)
    expect(firstOfA).toBeGreaterThan(lastSlice)
  })

  test("a flow that skips a column passes it beside the nodes there, not through them", () => {
    const html = renderToString(
      chart(
        [
          { source: "a", target: "b", value: 1 },
          { source: "b", target: "c", value: 1 },
          { source: "a", target: "c", value: 3 },
        ],
        // From the front, every piece shows only its front face.
        { yaw: 0, tilt: 0 }
      )
    )
    const span = (match: (fill: string) => boolean) => {
      const ys = faces(html)
        .filter((face) => match(face.fill))
        .flatMap((face) => face.corners.map(([, y]) => y))
      return [Math.min(...ys), Math.max(...ys)]
    }
    const [b0, b1] = span((fill) => fill.startsWith("color-mix(in oklch, var(--color-b) "))
    // The waypoint of a → c in the middle column, halfway between the colors of its ends.
    const [w0, w1] = span((fill) => fill.includes("var(--color-c) 50%, var(--color-a)"))
    expect(b0).toBeLessThan(b1)
    expect(w0).toBeLessThan(w1)
    expect(b1 <= w0 || w1 <= b0).toBe(true)
  })

  test("a flow under the pointer shows its ends and its value in the tooltip", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () => root.render(chart([{ source: "a", target: "b", value: 2 }])))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    // A face in the middle of the flow, away from the nodes.
    const slices = [...host.querySelectorAll('path[fill^="color-mix(in oklch, color-mix"]')]
    const corners = slices[slices.length >> 1].getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
    )
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
    )
    expect(host.textContent).toContain("A → B")
    expect(host.textContent).toContain("2 kWh")

    await act(async () => root.unmount())
    host.remove()
  })
})
