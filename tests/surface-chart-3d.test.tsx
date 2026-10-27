// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

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

  /**
   * How far the surface stays from the walls of the box along the screen, at
   * a view where the screen follows the x of the box, so the room between
   * the grid and the walls is there to read off.
   */
  async function room(data: number[][], domain?: { x?: [number, number]; z?: [number, number] }) {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
          <SurfaceChart3D data={data} domain={domain} />
        </ChartContainer3D>
      )
    )
    const xs = (elements: Element[]) =>
      elements.flatMap((el) =>
        [...(el as SVGPathElement).getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) =>
          Number(m[1])
        )
      )
    const grid = Math.min(...xs([...host.querySelectorAll('path[fill^="color-mix"]')]))
    const walls = Math.min(...xs([...host.querySelectorAll('[data-slot="chart-3d-axes"] > path')]))
    await act(async () => root.unmount())
    host.remove()
    return grid - walls
  }

  test("the box keeps half a cell of room between the grid and its walls", async () => {
    // Without the padding the grid fills the box exactly, half a cell with it.
    expect(
      await room([
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
      ])
    ).toBeGreaterThan(10)
  })

  test("a domain the reader hands the chart names the box, without room", async () => {
    expect(
      await room(
        [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
        { x: [0, 2], z: [0, 2] }
      )
    ).toBeLessThan(5)
  })
})

describe("SurfaceChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
  )
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("new data glides in over the animationDuration of the container", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: number[][]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <SurfaceChart3D data={data} />
          </ChartContainer3D>
        )
      )

    await render([
      [0, 1],
      [2, 3],
    ])
    await render([
      [0, 5],
      [10, 15],
    ])
    // The y axis still shows the ticks of the old heights.
    expect(host.textContent).not.toContain("15")
    await act(() => vi.advanceTimersByTime(700))
    expect(host.textContent).toContain("15")

    await act(async () => root.unmount())
    host.remove()
  })
})
