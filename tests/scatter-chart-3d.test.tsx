// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

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
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const point = host.querySelector("circle")!
    const [clientX, clientY] = ["cx", "cy"].map((a) => Number(point.getAttribute(a)))
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    )
    expect(host.textContent).toContain((1 / 3).toLocaleString())
    expect(host.textContent).not.toContain("0.3333333")

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("ScatterChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
  )
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("new data glides in over the animationDuration of the container", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: { x: number; y: number; z: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <ScatterChart3D data={data} x="x" y="y" z="z" />
          </ChartContainer3D>
        )
      )

    await render([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 10, z: 10 },
    ])
    await render([
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 20, z: 20 },
    ])
    // The opacity of every axis label with `text`: out-of-range ticks stay mounted but faded out.
    const opacities = (text: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')]
        .filter((t) => t.textContent === text)
        .map((t) => (t as SVGTextElement).style.opacity)
    // Mid-glide, 20 is outside the gliding ends: present, but faded out.
    expect(opacities("20").length).toBeGreaterThan(0)
    expect(opacities("20").every((o) => o === "0")).toBe(true)
    await act(() => vi.advanceTimersByTime(700))
    expect(opacities("20").some((o) => o === "1")).toBe(true)

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("ScatterChart3D focus", () => {
  const edge = "var(--foreground)"

  test("hovering a point highlights that point alone with an edge; the fill never changes; leaving clears it", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <ScatterChart3D
            data={[
              { x: 1, y: 1, z: 1, cluster: "a" },
              { x: 2, y: 2, z: 2, cluster: "b" },
              { x: 3, y: 3, z: 3, cluster: "a" },
            ]}
            x="x"
            y="y"
            z="z"
            series="cluster"
          />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const circles = () => [...svg.querySelectorAll("circle")]
    const fills = () => circles().map((c) => c.getAttribute("fill")!)
    const edged = () => circles().filter((c) => c.getAttribute("stroke") === edge)
    const move = (clientX: number, clientY: number) =>
      act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    const point = circles().find((c) => c.getAttribute("fill") === "var(--color-a)")!
    const [clientX, clientY] = ["cx", "cy"].map((a) => Number(point.getAttribute(a)))
    const before = fills()

    await move(clientX, clientY)
    // The single point alone gets the edge - not its series - and no fill changes.
    expect(edged()).toHaveLength(1)
    expect(fills()).toEqual(before)

    // Off the point, still inside the chart: no edge.
    await move(5, 5)
    expect(edged()).toHaveLength(0)

    // Hover again, then leave the chart.
    await move(clientX, clientY)
    expect(edged()).toHaveLength(1)
    await act(() =>
      svg.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
      )
    )
    expect(edged()).toHaveLength(0)

    await act(async () => root.unmount())
    host.remove()
  })
})
