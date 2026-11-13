// @vitest-environment jsdom
import { act, type ReactElement } from "react"
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

describe("SurfaceChart3D tooltip", () => {
  const tip = (host: HTMLElement) =>
    host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
  const data = [
    [1, 2],
    [3, 4],
  ]

  /** Mounts `element` and puts the pointer on its first cell. */
  async function hovered(element: ReactElement) {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () => root.render(element))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const quad = [...svg.querySelectorAll("path")].find((p) =>
      p.getAttribute("fill")?.startsWith("color-mix")
    )!
    const corners = quad.getAttribute("d")!.slice(1, -1).split("L")
    const [clientX, clientY] = [0, 1].map(
      (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
    )
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    )
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { host, unmount }
  }

  test("tooltip makes what a cell says from the default and the row, column and value behind it", async () => {
    const seen: { row: number; column: number; value: number }[] = []
    const view = await hovered(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={data}
          tooltip={(tip, cell) => {
            seen.push(cell)
            return { ...tip, title: `${cell.row},${cell.column}` }
          }}
        />
      </ChartContainer3D>
    )
    // The one cell spans the four heights, so its value is their mean.
    expect(seen).toEqual([{ row: 0, column: 0, value: 2.5 }])
    expect(tip(view.host)).toBe("0,0value2.5")
    await view.unmount()
  })

  test("a tooltip of null shows none", async () => {
    const view = await hovered(
      <ChartContainer3D config={config}>
        <SurfaceChart3D data={data} tooltip={() => null} />
      </ChartContainer3D>
    )
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })

  test("the tooltip names the height of a cell as the ticks of y do, through format", async () => {
    const view = await hovered(
      <ChartContainer3D config={config}>
        <SurfaceChart3D data={data} titles={{ y: "height" }} format={{ y: (v) => `${v} m` }} />
      </ChartContainer3D>
    )
    expect(tip(view.host)).toBe("height2.5 m")
    await view.unmount()
  })

  test("a cell on its way out of the data says nothing on hover; the others still do", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
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
      [1, 2, 3],
      [2, 3, 4],
    ])
    await act(() => vi.advanceTimersByTime(700))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const quads = () =>
      [...svg.querySelectorAll("path")].filter((p) =>
        p.getAttribute("fill")?.startsWith("color-mix")
      )
    const hover = (quad: Element) => {
      const corners = quad.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
      )
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }
    const tip = () => host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""

    // The last column leaves: mid-glide its cell still fades out, and says nothing.
    await render([
      [1, 2],
      [2, 3],
    ])
    await act(() => vi.advanceTimersByTime(300))
    const fading = quads().filter((p) => p.getAttribute("fill")!.includes("transparent"))
    expect(fading).toHaveLength(1)
    await hover(fading[0])
    expect(tip()).toBe("")
    await hover(quads().find((p) => !fading.includes(p))!)
    expect(tip()).toBe("value2")

    vi.useRealTimers()
    vi.unstubAllGlobals()
    await act(async () => root.unmount())
    host.remove()
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
    // The opacity of every axis label with `text`: out-of-range ticks stay mounted but faded out.
    const opacities = (text: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')]
        .filter((t) => t.textContent === text)
        .map((t) => (t as SVGTextElement).style.opacity)
    // Mid-glide, 15 is outside the gliding ends: present, but faded out.
    expect(opacities("15").length).toBeGreaterThan(0)
    expect(opacities("15").every((o) => o === "0")).toBe(true)
    await act(() => vi.advanceTimersByTime(700))
    expect(opacities("15").some((o) => o === "1")).toBe(true)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a grown grid fades in at its place, a shrunken one fades out before it goes", async () => {
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
    const quads = () => host.querySelectorAll('[data-slot="chart-3d-marks"] path')
    const sane = () => [...quads()].every((q) => !q.getAttribute("d")!.includes("NaN"))
    const faded = () =>
      [...quads()].filter((q) => q.getAttribute("fill")!.includes("transparent")).length

    const small = [
      [1, 2],
      [3, 4],
    ]
    const big = [
      [1, 2, 3],
      [3, 4, 5],
      [5, 6, 7],
    ]
    await render(small)
    await act(() => vi.advanceTimersByTime(700))
    expect(quads()).toHaveLength(1)

    // Grown, the border cells are there at once, in place, fading in; the
    // old cell keeps its full fill.
    await render(big)
    expect(quads()).toHaveLength(4)
    expect(faded()).toBe(3)
    expect(sane()).toBe(true)
    await act(() => vi.advanceTimersByTime(700))
    expect(quads()).toHaveLength(4)
    expect(faded()).toBe(0)

    // Shrunken, the border cells stay through the glide, fading out where
    // they stand, then leave.
    await render(small)
    expect(quads()).toHaveLength(4)
    expect(faded()).toBe(0)
    await act(() => vi.advanceTimersByTime(300))
    expect(quads()).toHaveLength(4)
    expect(faded()).toBe(3)
    expect(sane()).toBe(true)
    await act(() => vi.advanceTimersByTime(400))
    expect(quads()).toHaveLength(1)
    expect(faded()).toBe(0)

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("SurfaceChart3D focus", () => {
  const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")

  test("hovering a cell lights the fill of that cell alone; leaving clears it", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <SurfaceChart3D
            data={[
              [1, 2, 3],
              [2, 3, 4],
              [3, 4, 5],
            ]}
          />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const quads = () =>
      [...svg.querySelectorAll("path")].flatMap((p) => {
        const f = p.getAttribute("fill")
        return f?.startsWith("color-mix") || (f && isLit(f)) ? [p] : []
      })
    const fills = () => quads().map((p) => p.getAttribute("fill")!)
    const litOnes = () => fills().filter(isLit)
    const move = (clientX: number, clientY: number) =>
      act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    const quad = quads()[0]
    const corners = quad.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
    const before = fills()

    await move(x, y)
    // The hovered cell alone lights up, its own fill lightened; every other fill stays.
    expect(quads().length).toBeGreaterThan(1)
    expect(litOnes()).toHaveLength(1)
    const after = fills()
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f) : f)))

    // Off the cell, still inside the chart: nothing lit.
    await move(5, 5)
    expect(fills()).toEqual(before)

    // Hover again, then leave the chart.
    await move(x, y)
    expect(litOnes()).toHaveLength(1)
    await act(() =>
      svg.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
      )
    )
    expect(fills()).toEqual(before)

    await act(async () => root.unmount())
    host.remove()
  })
})
