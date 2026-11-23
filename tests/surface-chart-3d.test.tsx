// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Tooltip3D, type View3D } from "@/registry/new-york/ui/chart-3d"
import { SurfaceChart3D, type SurfaceChart3DProps } from "@/registry/new-york/ui/surface-chart-3d"

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
    expect(html).toMatch(
      /color-mix\(in oklch, var\(--color-high, currentColor\) \d+%, var\(--color-low, currentColor\)\)/
    )
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

  test("an empty grid, a single row, column or cell draws the box and no surface: a quad needs 2 × 2 heights", () => {
    for (const data of [[], [[]], [[1, 2, 3]], [[1], [2], [3]], [[5]]]) {
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
  async function room(data: number[][], props: Partial<SurfaceChart3DProps> = {}) {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
          <SurfaceChart3D data={data} {...props} />
        </ChartContainer3D>
      )
    )
    const xs = (elements: Element[]) =>
      elements.flatMap((el) =>
        [...(el as SVGPathElement).getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) =>
          Number(m[1])
        )
      )
    const grid = xs([...host.querySelectorAll('path[fill^="color-mix"]')])
    const walls = xs([
      ...host.querySelectorAll('[data-slot="chart-3d-axes"] > path[stroke-width="0.75"]'),
    ])
    const widths = [...host.querySelectorAll('path[fill^="color-mix"]')].map((quad) => {
      const corners = xs([quad])
      return Math.max(...corners) - Math.min(...corners)
    })
    const labels = [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')].map(
      (t) => t.textContent
    )
    await act(async () => root.unmount())
    host.remove()
    return {
      left: Math.min(...grid) - Math.min(...walls),
      right: Math.max(...walls) - Math.max(...grid),
      widths,
      labels,
    }
  }

  test("the box keeps half a cell of room between the grid and its walls", async () => {
    // Without the padding the grid fills the box exactly, half a cell with it.
    expect(
      await room([
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
      ]).then((r) => r.left)
    ).toBeGreaterThan(10)
  })

  test("the box ends half a cell beyond the outer points on both sides, not at a rounder tick", async () => {
    // 16 columns stand at 0 to 15: a nice axis would run on to 20, empty beyond the surface.
    const row = Array.from({ length: 16 }, (_, c) => c % 3)
    const { left, right, labels } = await room([row, row])
    expect(right / left).toBeCloseTo(1, 0)
    expect(labels).not.toContain("20")
  })

  test("a domain names the box exactly, its ticks within, never rounded out", async () => {
    const { left, labels } = await room(
      [
        [1, 2, 3],
        [2, 3, 4],
      ],
      { domain: { x: [0.3, 9.7] } }
    )
    expect(left).toBeLessThan(5)
    expect(labels).toContain("8")
    expect(labels).not.toContain("10")
  })

  test("a domain the reader hands the chart names the box, without room", async () => {
    expect(
      await room(
        [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
        { domain: { x: [0, 2], z: [0, 2] } }
      ).then((r) => r.left)
    ).toBeLessThan(5)
  })
})

describe("SurfaceChart3D places", () => {
  test("x and z stand the columns and rows at their values: evenly, as a domain does", () => {
    const html = (props: Partial<SurfaceChart3DProps>) =>
      renderToString(
        <ChartContainer3D config={config}>
          <SurfaceChart3D
            data={[
              [1, 2, 3],
              [2, 3, 4],
            ]}
            {...props}
          />
        </ChartContainer3D>
      )
    expect(html({ x: [0, 1, 2], z: [5, 6] })).toBe(html({ domain: { x: [0, 2], z: [5, 6] } }))
  })

  test("unevenly, a wide gap between two columns makes a wide cell", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 2.2 }}>
          <SurfaceChart3D
            data={[
              [1, 1, 1],
              [1, 1, 1],
            ]}
            x={[0, 1, 10]}
          />
        </ChartContainer3D>
      )
    )
    const widths = [...host.querySelectorAll('path[fill^="color-mix"]')]
      .map((quad) => {
        const xs = [...quad.getAttribute("d")!.matchAll(/(-?[\d.]+),/g)].map((m) => Number(m[1]))
        return Math.max(...xs) - Math.min(...xs)
      })
      .sort((a, b) => a - b)
    expect(widths).toHaveLength(2)
    expect(widths[1] / widths[0]).toBeGreaterThan(5)
    await act(async () => root.unmount())
    host.remove()
  })

  test("the longest row counts the columns: a short row's missing corners stand at the floor", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [1, 2],
            [1, 2, 3],
          ]}
        />
      </ChartContainer3D>
    )
    expect(quads(html)).toHaveLength(2)
    expect(html).not.toContain("NaN")
    // The cell with the missing corner is seen, not faded out to nothing.
    expect(html).not.toContain(" 0%, transparent")
  })

  test("heights given as text, as parsed CSV has them, draw what the numbers draw", () => {
    const html = (data: unknown) =>
      renderToString(
        <ChartContainer3D config={config}>
          <SurfaceChart3D data={data as number[][]} />
        </ChartContainer3D>
      )
    // Compared as text, "9" would top "100" and the y axis would run upside down.
    expect(
      html([
        ["10", "9"],
        ["100", "2"],
      ])
    ).toBe(
      html([
        [10, 9],
        [100, 2],
      ])
    )
  })

  test("places given as text, as parsed CSV has them, stand the surface where the numbers do", () => {
    const html = (props: object) =>
      renderToString(
        <ChartContainer3D id="c" config={config}>
          <SurfaceChart3D
            data={[
              [1, 2, 3],
              [4, 5, 6],
            ]}
            {...props}
          />
        </ChartContainer3D>
      )
    // Joined as text, "10" and half a cell would end the axis at "100.5".
    expect(html({ x: ["1", "2", "10"], z: ["0", "5"] })).toBe(html({ x: [1, 2, 10], z: [0, 5] }))
    expect(html({ domain: { x: ["0", "10"], z: ["2", "4"] } })).toBe(
      html({ domain: { x: [0, 10], z: [2, 4] } })
    )
  })

  test("a column or row without a finite place drops out, its neighbours join", () => {
    const html = (x?: number[], z?: number[]) =>
      renderToString(
        <ChartContainer3D config={config}>
          <SurfaceChart3D
            data={[
              [1, 2, 3],
              [2, 3, 4],
              [3, 4, 5],
            ]}
            x={x}
            z={z}
          />
        </ChartContainer3D>
      )
    expect(quads(html())).toHaveLength(4)
    expect(quads(html([0, NaN, 2]))).toHaveLength(2)
    expect(quads(html([0, NaN, 2], [0, 1, Infinity]))).toHaveLength(1)
    expect(html([0, NaN, 2])).not.toContain("NaN")
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
    const render = (next: ReactElement) => act(async () => root.render(next))
    return { host, render, unmount }
  }

  test("tooltip makes what a cell says from the default and the row, column, x, z and value behind it, as in the bar field", async () => {
    const seen: { row: number; column: number; x: number; z: number; value: number }[] = []
    const tooltip = (tip: Tooltip3D, cell: (typeof seen)[number]) => {
      seen.push(cell)
      return { ...tip, title: `${cell.row},${cell.column}` }
    }
    const surface = () => (
      <ChartContainer3D config={config}>
        <SurfaceChart3D data={data} tooltip={tooltip} />
      </ChartContainer3D>
    )
    const view = await hovered(surface())
    // The one cell spans the four heights, so its value is their mean.
    expect(seen).toEqual([{ row: 0, column: 0, x: 0, z: 0, value: 2.5 }])
    // A frame renders the chart again with the same props: what the cell says is not built again.
    await view.render(surface())
    expect(seen).toHaveLength(1)
    expect(tip(view.host)).toBe("0,0x0z0value2.5")
    await view.unmount()
  })

  test("a cell with a height that is no number says nothing, where its stand-in would make one up", async () => {
    const seen: unknown[] = []
    const view = await hovered(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [10, NaN],
            [20, 30],
          ]}
          tooltip={(tip, cell) => (seen.push(cell), tip)}
        />
      </ChartContainer3D>
    )
    expect(seen).toEqual([])
    expect(tip(view.host)).toBe("")
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

  test("the tooltip names the place and the height of a cell as the ticks do, through format", async () => {
    const view = await hovered(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={data}
          x={[10, 20]}
          z={[5, 7]}
          titles={{ x: "day", y: "height" }}
          format={{ y: (v) => `${v} m`, z: (v) => `${v} km` }}
        />
      </ChartContainer3D>
    )
    // The place the cell starts at: its first column and row.
    expect(tip(view.host)).toBe("day10z5 kmheight2.5 m")
    await view.unmount()
  })

  test("a cell under a resting pointer builds its tooltip once while the surface glides", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const seen: { row: number; column: number }[] = []
    const tooltip = (tip: Tooltip3D, cell: { row: number; column: number }) => (
      seen.push(cell),
      tip
    )
    const grid = (corner: number) => [
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 9],
      [3, 4, 5, corner],
    ]
    const surface = (data: number[][]) => (
      <ChartContainer3D config={config}>
        <SurfaceChart3D data={data} tooltip={tooltip} />
      </ChartContainer3D>
    )
    const view = await hovered(surface(grid(6)))
    expect(seen).toHaveLength(1)
    // New data far from the cell: it is said again once, not at every frame of the glide.
    await view.render(surface(grid(7)))
    for (let i = 0; i < 5; i++) await act(() => vi.advanceTimersByTime(50))
    expect(seen.length).toBeLessThanOrEqual(2)
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
    // It fades as every mark does, through the core's faded.
    expect(fading[0].getAttribute("fill")).toMatch(/^color-mix\(in oklab, /)
    await hover(fading[0])
    expect(tip()).toBe("")
    await hover(quads().find((p) => !fading.includes(p))!)
    // The cell that stays starts at the first column and row: x 0, z 0.
    expect(tip()).toBe("x0z0value2")

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

  test("new places of x glide the surface there", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (x: number[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <SurfaceChart3D
              data={[
                [1, 2, 3],
                [2, 3, 4],
              ]}
              x={x}
            />
          </ChartContainer3D>
        )
      )
    const outline = () =>
      [...host.querySelectorAll('path[fill^="color-mix"]')].map((p) => p.getAttribute("d")).join()
    await render([0, 1, 2])
    const start = outline()
    // The box scales with its places: only an uneven move shows.
    await render([0, 1, 5])
    expect(outline()).toBe(start)
    await act(() => vi.advanceTimersByTime(300))
    const mid = outline()
    expect(mid).not.toBe(start)
    await act(() => vi.advanceTimersByTime(400))
    expect(outline()).not.toBe(mid)
    await act(async () => root.unmount())
    host.remove()
  })

  test("new data while a column leaves: it never draws without a place", async () => {
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
      [1, 2, 3],
      [2, 3, 4],
    ])
    await render([
      [1, 2],
      [2, 3],
    ])
    await act(() => vi.advanceTimersByTime(300))
    // New heights restart the glide of the heights, not of the places.
    await render([
      [3, 1],
      [1, 3],
    ])
    await act(() => vi.advanceTimersByTime(400))
    expect(host.innerHTML).not.toContain("NaN")
    await act(async () => root.unmount())
    host.remove()
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

  test("cells that come or go stay inside the box while the axes glide: a grown grid fades in within it, a shrunken one fades out within it", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: number[][], view?: View3D) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} defaultView={view}>
            <SurfaceChart3D data={data} />
          </ChartContainer3D>
        )
      )
    /** The corners of the paths of a slot, as drawn. */
    const corners = (slot: string) =>
      [...host.querySelectorAll(`[data-slot="${slot}"] path`)].flatMap((path) =>
        [...path.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
          Number(m[1]),
          Number(m[2]),
        ])
      )
    /** How far the furthest corner of a cell lies outside the box the walls span on the screen. */
    const outside = () => {
      const [xs, ys] = [0, 1].map((i) => corners("chart-3d-axes").map((c) => c[i]))
      return Math.max(
        0,
        ...corners("chart-3d-marks").map(([x, y]) =>
          Math.max(
            Math.min(...xs) - x,
            x - Math.max(...xs),
            Math.min(...ys) - y,
            y - Math.max(...ys)
          )
        )
      )
    }
    /** The furthest any cell lies outside the box at any frame of a glide into `data`. */
    const furthest = async (data: number[][], view?: View3D) => {
      await render(data, view)
      let most = outside()
      for (let t = 0; t < 700; t += 16) {
        await act(() => vi.advanceTimersByTime(16))
        most = Math.max(most, outside())
      }
      return most
    }
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
    // The new cells stand far beyond the old axes - to the right and above - which glide to
    // make room for them.
    expect(await furthest(big)).toBeLessThanOrEqual(0.5)
    expect(await furthest(small)).toBeLessThanOrEqual(0.5)
    // In perspective a cell far beyond the axis would reach across the chart.
    const perspective = { yaw: Math.PI / 6, tilt: Math.PI / 6, perspective: 3 }
    expect(await furthest(small, perspective)).toBeLessThanOrEqual(0.5)
    expect(
      await furthest(
        [
          [1, 2, 30],
          [3, 4, 50],
          [5, 6, 70],
        ],
        perspective
      )
    ).toBeLessThanOrEqual(0.5)
    expect(await furthest(small, perspective)).toBeLessThanOrEqual(0.5)

    await act(async () => root.unmount())
    host.remove()
  }, 30_000)
})

describe("SurfaceChart3D keys", () => {
  test("a cell keeps its name as the grid grows: the one hovered stays lit and still tells its own value", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const draw = (data: number[][]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <SurfaceChart3D data={data} />
          </ChartContainer3D>
        )
      )
    await draw([
      [1, 2, 9],
      [3, 4, 9],
    ])
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const tip = () => host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
    const cells = () =>
      [...svg.querySelectorAll("path")].filter((p) => {
        const fill = p.getAttribute("fill") ?? ""
        return fill.startsWith("color-mix") || fill.startsWith("var(--chart-3d-focus")
      })
    const hover = (path: Element) => {
      const corners = path.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
      )
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }
    // The first cell, of the corners 1, 2, 3 and 4, the one that says 2.5.
    const first = async () => {
      for (const cell of cells()) {
        await hover(cell)
        if (tip().includes("2.5")) return cell.getAttribute("d")
      }
    }
    expect(await first()).toBeDefined()

    // A column more renumbers the quads of d3-3d; the cell lit is still the first.
    await draw([
      [1, 2, 9, 9],
      [3, 4, 9, 9],
    ])
    const lit = cells().filter((p) => p.getAttribute("fill")!.startsWith("var(--chart-3d-focus"))
    expect(lit).toHaveLength(1)
    const outline = lit[0].getAttribute("d")
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 5, clientY: 5 }))
    )
    expect(await first()).toBe(outline)

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

describe("SurfaceChart3D paint order", () => {
  /** The cells in paint order, far to near, each named by its share of the high color: its height on the ramp. */
  const order = (data: number[][]) =>
    [
      ...renderToString(
        <ChartContainer3D config={config}>
          <SurfaceChart3D data={data} />
        </ChartContainer3D>
      ).matchAll(/<path d="[^"]*" fill="[^"]*?var\(--color-high, currentColor\) (\d+)%/g),
    ].map((cell) => Number(cell[1]))

  test("the cells paint in the order of their footprints, far to near, however high each reaches: a cell behind never paints over the one before it", () => {
    // From the default view the far row paints first, and in a row the cell on the right.
    expect(
      order([
        [0, 0, 0],
        [0, 0, 0],
        [1, 0, 2],
      ])
    ).toEqual([0, 0, 25, 13])
    // The far cells tower over the near ones, and paint first all the same.
    expect(
      order([
        [0, 8, 8],
        [0, 0, 0],
        [1, 0, 0],
      ])
    ).toEqual([50, 25, 0, 3])
  })

  test("a stepped surface paints its cells in the order a flat one does, from every side", () => {
    // The cells in paint order, each named by where its corners stand along the screen: a
    // corner stands as far left whatever its height.
    const cells = (data: number[][], view: View3D) =>
      [
        ...renderToString(
          <ChartContainer3D config={config} defaultView={view}>
            <SurfaceChart3D data={data} />
          </ChartContainer3D>
        ).matchAll(/<path d="M([^"]*)Z" fill="color-mix/g),
      ].map((cell) =>
        cell[1]
          .split("L")
          .map((corner) => Number(corner.split(",")[0]).toFixed(1))
          .sort()
          .join(" ")
      )
    // Blocks of three heights, a cliff between any two.
    const stepped = Array.from({ length: 7 }, (_, r) =>
      Array.from({ length: 7 }, (_, c) => ((Math.floor(r / 2) * 2 + Math.floor(c / 2)) % 3) * 5)
    )
    const flat = stepped.map((row) => row.map(() => 1))
    // From the front right and left, from behind, steeply from above and from below.
    for (const view of [
      { yaw: 0.5, tilt: 0.5 },
      { yaw: -0.6, tilt: 0.3 },
      { yaw: 2.4, tilt: 0.35 },
      { yaw: 1.1, tilt: 1.2 },
      { yaw: -2, tilt: -0.4 },
    ]) {
      const order = cells(flat, view)
      expect(new Set(order).size).toBe(36)
      expect(cells(stepped, view)).toEqual(order)
    }
  })
  test("in perspective a wide cell the eye stands before paints after its narrow neighbour: the nearest point of a footprint orders it, not its middle", () => {
    // One row of cells, the fifth sixteen times as wide as the others. The eye stands before
    // it, near its left edge: its sight passes over that cell first and its left neighbour
    // after, though the middle of the neighbour is the nearer one.
    const heights = [0, 1, 2, 3, 4, 5, 6, 7]
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0.158, tilt: 0.4, perspective: 3 }}>
        <SurfaceChart3D data={[heights, heights]} x={[0, 1, 2, 3, 4, 20, 21, 22]} />
      </ChartContainer3D>
    )
    // The cells in paint order, each named by its share of the high color: 50 the neighbour, 64 the wide one.
    const painted = [
      ...html.matchAll(/<path d="[^"]*" fill="[^"]*?var\(--color-high, currentColor\) (\d+)%/g),
    ].map((cell) => Number(cell[1]))
    expect([...painted].sort((a, b) => a - b)).toEqual([7, 21, 36, 50, 64, 79, 93])
    expect(painted.indexOf(50)).toBeLessThan(painted.indexOf(64))
  })
})

describe("SurfaceChart3D without a config", () => {
  test("an empty config has no keys for the color ramp: the surface draws all the same, in the color of the text", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <SurfaceChart3D
          data={[
            [1, 2],
            [3, 4],
          ]}
        />
      </ChartContainer3D>
    )
    expect(html.match(/<path [^>]*currentColor/g)).toHaveLength(1)
    expect(html).not.toContain("--color-undefined")
  })
})

describe("SurfaceChart3D heights that are no numbers", () => {
  test("a cell of NaN or Infinity stands at the floor of the others, and the surface still draws", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SurfaceChart3D
          data={[
            [1, NaN, 3],
            [4, Infinity, 6],
          ]}
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("NaN")
    expect(html).not.toContain("Infinity")
    // Two rows of three corners make two cells.
    expect(html.match(/<path [^>]*var\(--color-(low|high), currentColor\)/g)).toHaveLength(2)
  })
})
