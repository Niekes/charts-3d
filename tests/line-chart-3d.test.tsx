// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"
import { LineChart3D, type LineChart3DProps } from "@/registry/new-york/ui/line-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { color: "red" }, b: { label: "B", color: "blue" } }

type Entry = { id?: string; x: number; y?: number | null; z: number; s?: string }

const chart = (data: Entry[], props: Partial<LineChart3DProps<Entry>> = {}) => (
  <ChartContainer3D config={config}>
    <LineChart3D data={data} x="x" y="y" z="z" {...props} />
  </ChartContainer3D>
)

/** The marks of a chart in paint order: the quads of its half segments and the circles on its points. */
function marks(root: ParentNode) {
  const all = [...root.querySelectorAll('[data-slot="chart-3d-marks"] > *')]
  const corners = (path: Element) =>
    [...path.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ])
  return {
    all,
    quads: all.filter((m) => m.tagName === "path").map((m) => ({ el: m, corners: corners(m) })),
    dots: all
      .filter((m) => m.tagName === "circle")
      .map((m) => ({ el: m, at: ["cx", "cy"].map((a) => Number(m.getAttribute(a))) })),
    fills: all.map((m) => m.getAttribute("fill")!),
  }
}

/** The marks a chart draws on the server. */
function serverMarks(element: ReactElement) {
  const html = renderToString(element)
  const host = document.createElement("div")
  host.innerHTML = html
  return { html, ...marks(host) }
}

const middle = (corners: number[][]) =>
  [0, 1].map((a) => corners.reduce((sum, c) => sum + c[a], 0) / corners.length)

async function mount(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  const render = (next: ReactElement) => act(async () => root.render(next))
  const point = ([clientX, clientY]: number[]) =>
    act(() => svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY })))
  const leave = () => act(() => svg.dispatchEvent(new MouseEvent("pointerout", { bubbles: true })))
  const tip = () => host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }
  return { host, svg, render, point, leave, tip, unmount }
}

const helix: Entry[] = [
  { x: 0, y: 0, z: 0, s: "a" },
  { x: 4, y: 2, z: 6, s: "a" },
  { x: 8, y: 4, z: 0, s: "a" },
  { x: 0, y: 8, z: 8, s: "b" },
  { x: 8, y: 6, z: 2, s: "b" },
]

describe("LineChart3D", () => {
  test("draws a line per series: a quad per half segment and a circle per point, in its color", () => {
    const { quads, dots, fills, html } = serverMarks(chart(helix, { series: "s" }))
    // Three points are two segments, four halves; two points one segment, two halves.
    expect(quads).toHaveLength(6)
    expect(dots).toHaveLength(5)
    expect(fills.filter((f) => f === "var(--color-a)")).toHaveLength(4 + 3)
    expect(fills.filter((f) => f === "var(--color-b)")).toHaveLength(2 + 2)
    expect(html).not.toContain("NaN")
  })

  test("without series, all the entries are one line in the first color of the config", () => {
    const { quads, dots, fills } = serverMarks(chart(helix))
    expect(quads).toHaveLength(8)
    expect(dots).toHaveLength(5)
    expect(new Set(fills)).toEqual(new Set(["var(--color-a)"]))
  })

  test("a line is as wide on the screen wherever it runs, and its joints are as wide", () => {
    const { quads, dots } = serverMarks(chart(helix))
    for (const { corners } of quads) {
      // The corners run along one side and back along the other: the ends are the width.
      const [a, b, c, d] = corners
      expect(Math.hypot(b[0] - c[0], b[1] - c[1])).toBeCloseTo(2, 1)
      expect(Math.hypot(a[0] - d[0], a[1] - d[1])).toBeCloseTo(2, 1)
    }
    expect(dots.map((d) => d.el.getAttribute("r"))).toEqual(dots.map(() => "1"))
  })

  test("the halves of a segment meet in its middle, each at the point it belongs to", () => {
    const { quads, dots } = serverMarks(
      chart([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 10, z: 10 },
      ])
    )
    expect(quads).toHaveLength(2)
    const between = middle(dots.map((d) => d.at))
    // The middle of every half lies a quarter of the way from its point.
    const ends = quads.map(({ corners }) => middle(corners))
    for (const [i, a] of [0, 1].entries()) {
      expect((ends[0][a] + ends[1][a]) / 2).toBeCloseTo(between[a], 0)
      expect(ends[0][i]).not.toBeCloseTo(ends[1][i], 0)
    }
  })

  test("an entry without a place breaks its line: no segment bridges the gap", () => {
    const { quads, dots, html } = serverMarks(
      chart([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, y: null, z: 2 },
        { x: 3, y: 3, z: 3 },
        { x: 4, y: 4, z: 4 },
      ])
    )
    // Two runs of two points, a segment each.
    expect(quads).toHaveLength(4)
    expect(dots).toHaveLength(4)
    expect(html).not.toContain("NaN")
  })

  test("a gap breaks the line of its own series only", () => {
    const { quads } = serverMarks(
      chart(
        [
          { x: 0, y: 0, z: 0, s: "a" },
          { x: 1, z: 1, s: "b" },
          { x: 2, y: 2, z: 2, s: "a" },
        ],
        { series: "s" }
      )
    )
    expect(quads).toHaveLength(2)
  })

  test("a point alone between two gaps, or at the head of the data after one, is a circle of its own", () => {
    const { quads, dots } = serverMarks(
      chart([
        { x: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, z: 2 },
        { x: 3, y: 3, z: 3 },
      ])
    )
    expect(quads).toHaveLength(0)
    expect(dots).toHaveLength(2)
  })

  test("two entries at the same place draw a segment without a length, not one at NaN", () => {
    const { html, dots } = serverMarks(
      chart([
        { x: 1, y: 1, z: 1 },
        { x: 1, y: 1, z: 1 },
      ])
    )
    expect(dots).toHaveLength(2)
    expect(html).not.toContain("NaN")
  })

  test("no data draws nothing", () => {
    expect(serverMarks(chart([])).all).toHaveLength(0)
  })

  test("the axes take their titles and the format of their ticks", () => {
    const { html } = serverMarks(
      chart(helix, { titles: { y: "height" }, format: { y: (v) => `${v}m` } })
    )
    expect(html).toContain("height")
    expect(html).toContain(">8m<")
  })
})

describe("LineChart3D hover", () => {
  const lit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
  const two: Entry[] = [
    { x: 1, y: 2, z: 3, s: "b" },
    { x: 10, y: 20, z: 30, s: "b" },
    { x: 5, y: 5, z: 5, s: "a" },
    { x: 9, y: 1, z: 9, s: "a" },
  ]

  test("a half segment says the point it belongs to, the nearer one, as the point itself does", async () => {
    const view = await mount(chart(two.slice(0, 2), { series: "s" }))
    const { quads, dots } = marks(view.host)
    const said: string[] = []
    for (const dot of dots) {
      await view.point(dot.at)
      said.push(view.tip())
    }
    expect(new Set(said)).toEqual(new Set(["Bx1y2z3", "Bx10y20z30"]))
    for (const quad of quads) {
      const at = middle(quad.corners)
      const nearest = dots
        .map((d, i) => ({ i, far: Math.hypot(d.at[0] - at[0], d.at[1] - at[1]) }))
        .sort((p, q) => p.far - q.far)[0]
      await view.point(at)
      expect(view.tip()).toBe(said[nearest.i])
    }
    await view.unmount()
  })

  test("pointing at a line lights the whole line and no other; leaving clears it", async () => {
    const view = await mount(chart(two, { series: "s" }))
    const before = marks(view.host)
    const ofB = before.fills.filter((f) => f === "var(--color-b)").length
    expect(ofB).toBe(4)
    const quad = before.quads.find((q) => q.el.getAttribute("fill") === "var(--color-b)")!
    await view.point(middle(quad.corners))
    const fills = marks(view.host).fills
    expect(fills.filter(lit)).toHaveLength(ofB)
    expect(fills.filter((f) => f === "var(--color-a)")).toHaveLength(4)
    expect(fills.filter(lit).every((f) => f.includes("var(--color-b)"))).toBe(true)
    await view.leave()
    expect(marks(view.host).fills.filter(lit)).toHaveLength(0)
    expect(view.tip()).toBe("")
    await view.unmount()
  })

  test("the title is the label of the series, its key without one, and none without series", async () => {
    const view = await mount(chart(two, { series: "s" }))
    const a = marks(view.host).dots.find((d) => d.el.getAttribute("fill") === "var(--color-a)")!
    await view.point(a.at)
    expect(view.tip()).toMatch(/^ax/)
    await view.render(chart(two))
    await view.point(marks(view.host).dots[0].at)
    expect(view.tip()).toMatch(/^x/)
    await view.unmount()
  })

  test("tooltip makes what a line says from the default and the entry behind the point", async () => {
    const seen: Entry[] = []
    const view = await mount(
      chart(two.slice(0, 1), {
        series: "s",
        titles: { y: "height" },
        format: { y: (v) => `${v}m` },
        tooltip: (tip, { entry }) => {
          seen.push(entry)
          return { ...tip, items: tip.items.slice(1, 2) }
        },
      })
    )
    await view.point(marks(view.host).dots[0].at)
    expect(seen).toEqual([two[0]])
    expect(view.tip()).toBe("Bheight2m")
    await view.render(chart(two.slice(0, 1), { tooltip: () => null }))
    await view.point(marks(view.host).dots[0].at)
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })
})

describe("LineChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const glide = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const p = { id: "p", x: 0, y: 0, z: 0 }
  const q = { id: "q", x: 10, y: 10, z: 10 }
  const r = { id: "r", x: 20, y: 0, z: 20 }
  const faded = (fill: string) => fill.startsWith("color-mix(in oklab, var(--color-a)")
  /** The one dot that stands on no other. */
  const alone = (dots: { at: number[] }[]) =>
    dots.filter((d) => dots.filter((o) => o.at.join() === d.at.join()).length === 1)[0]
  /** How many of the dots stand on another one. */
  const stacked = (dots: { at: number[] }[]) =>
    dots.filter((d, i) => dots.some((o, j) => i !== j && o.at.join() === d.at.join())).length

  test("a point added at the end unfolds from the point before it, fading in, and the axes follow", async () => {
    const view = await mount(chart([p, q], { id: "id" }))
    await view.render(chart([p, q, r], { id: "id" }))
    // It starts on the point before it, unseen, its segment without a length.
    let now = marks(view.host)
    expect(now.dots).toHaveLength(3)
    expect(stacked(now.dots)).toBe(2)
    expect(now.fills.filter((f) => f.includes("0%, transparent"))).toHaveLength(2)
    expect(view.host.innerHTML).not.toContain("NaN")
    // The point that stands alone is the first one: the new one lies on the second.
    await view.point(alone(now.dots).at)
    expect(view.tip()).toBe("x0y0z0")
    await view.leave()

    await glide(300)
    now = marks(view.host)
    expect(stacked(now.dots)).toBe(0)
    // Its half of the new segment and its dot fade in; the rest of the line stays as it is.
    expect(now.fills.filter(faded)).toHaveLength(2)
    expect(now.fills.filter((f) => f === "var(--color-a)")).toHaveLength(3 + 2)

    await glide(400)
    now = marks(view.host)
    expect(now.quads).toHaveLength(4)
    expect(now.fills.filter(faded)).toHaveLength(0)
    expect(view.host.querySelector('[data-slot="chart-3d-axes"]')!.textContent).toContain("20")
    await view.unmount()
  })

  test("a point added at the start unfolds from the point after it", async () => {
    const view = await mount(chart([q, r], { id: "id" }))
    await view.render(chart([p, q, r], { id: "id" }))
    expect(stacked(marks(view.host).dots)).toBe(2)
    // The point that stands alone is the last one: the new one lies on the one after it.
    await view.point(alone(marks(view.host).dots).at)
    expect(view.tip()).toBe("x20y0z20")
    await view.leave()
    await glide(700)
    expect(stacked(marks(view.host).dots)).toBe(0)
    expect(marks(view.host).quads).toHaveLength(4)
    await view.unmount()
  })

  test("a gone point folds back into the point before it and leaves when the glide is done", async () => {
    const view = await mount(chart([p, q, r], { id: "id" }))
    await view.render(chart([p, q], { id: "id" }))
    await glide(300)
    let now = marks(view.host)
    // Still joined to the point it followed, on its way to it.
    expect(now.dots).toHaveLength(3)
    expect(now.quads).toHaveLength(4)
    expect(now.fills.filter(faded)).toHaveLength(2)
    await glide(400)
    now = marks(view.host)
    expect(now.dots).toHaveLength(2)
    expect(now.quads).toHaveLength(2)
    await view.unmount()
  })

  test("points gone from the start keep their order and fold into the first that stays", async () => {
    const s = { id: "s", x: 30, y: 10, z: 0 }
    const view = await mount(chart([p, q, r, s], { id: "id" }))
    await view.render(chart([r, s], { id: "id" }))
    await glide(300)
    const now = marks(view.host)
    expect(now.dots).toHaveLength(4)
    expect(now.quads).toHaveLength(6)
    expect(now.fills.filter(faded)).toHaveLength(2 + 3)
    // The two halves of a segment meet off the points. Joined p to q to r to
    // s, one segment lies between the two fading points, one between the two
    // that stay and one between a fading point and a staying one.
    const ends = now.quads.flatMap(({ el, corners: [a, b, c, d] }) =>
      [middle([a, d]), middle([b, c])]
        .filter(
          (end) => !now.dots.some((dot) => Math.hypot(dot.at[0] - end[0], dot.at[1] - end[1]) < 1)
        )
        .map((end) => ({ end, fades: faded(el.getAttribute("fill")!) }))
    )
    expect(ends).toHaveLength(6)
    const segments = ends.flatMap((one, i) =>
      ends
        .slice(i + 1)
        .filter((other) => Math.hypot(one.end[0] - other.end[0], one.end[1] - other.end[1]) < 1)
        .map((other) => Number(one.fades) + Number(other.fades))
    )
    expect(segments.sort((a, b) => a - b)).toEqual([0, 1, 2])
    await glide(400)
    expect(marks(view.host).quads).toHaveLength(2)
    await view.unmount()
  })

  test("a point gone from the middle keeps its place between its neighbours", async () => {
    const view = await mount(chart([p, q, r], { id: "id" }))
    await view.render(chart([p, r], { id: "id" }))
    await glide(300)
    expect(marks(view.host).quads).toHaveLength(4)
    await glide(400)
    expect(marks(view.host).quads).toHaveLength(2)
    await view.unmount()
  })

  test("a whole new line stands in place and only fades in", async () => {
    const a = [p, q].map((d) => ({ ...d, s: "a" }))
    const b = [
      { id: "u", x: 0, y: 10, z: 10, s: "b" },
      { id: "v", x: 10, y: 0, z: 0, s: "b" },
    ]
    const view = await mount(chart(a, { id: "id", series: "s" }))
    await view.render(chart([...a, ...b], { id: "id", series: "s" }))
    const ofB = (m: ReturnType<typeof marks>) =>
      m.dots.filter((d) => d.el.getAttribute("fill")!.includes("var(--color-b)"))
    const start = ofB(marks(view.host))
    expect(start).toHaveLength(2)
    expect(stacked(marks(view.host).dots)).toBe(0)
    await glide(300)
    const mid = ofB(marks(view.host))
    expect(mid.map((d) => d.at)).toEqual(start.map((d) => d.at))
    expect(mid.every((d) => d.el.getAttribute("fill")!.startsWith("color-mix"))).toBe(true)
    await glide(400)
    expect(marks(view.host).fills.filter((f) => f === "var(--color-b)")).toHaveLength(4)
    await view.unmount()
  })

  test("without id a point is named by its place in the data: new values glide, the line stays whole", async () => {
    const view = await mount(chart([p, q, r]))
    const from = marks(view.host).dots.map((d) => d.at.join())
    await view.render(chart([p, { ...q, y: 0 }, { ...r, y: 10 }]))
    await glide(300)
    const mid = marks(view.host)
    expect(mid.dots).toHaveLength(3)
    expect(mid.fills.filter(faded)).toHaveLength(0)
    expect(mid.dots.map((d) => d.at.join())).not.toEqual(from)
    await view.unmount()
  })
})

describe("LineChart3D renderers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("canvas and webgl paint the same lines on the canvas, every mark of the svg once", async () => {
    const ctx = {
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      getImageData: vi.fn(() => ({ data: [1, 2, 3, 255] })),
    }
    // A canvas gives out one context only: another type on the same element is null.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement & { ctxType?: string },
      type: string
    ) {
      if (this.ctxType && this.ctxType !== type) return null
      this.ctxType = type
      return (type === "2d" ? ctx : null) as never
    })
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    const scene = (renderer: Renderer3D) => (
      <ChartContainer3D config={config} renderer={renderer}>
        <LineChart3D data={helix} x="x" y="y" z="z" series="s" />
      </ChartContainer3D>
    )
    const view = await mount(scene("svg"))
    const svg = marks(view.host).all.length
    expect(svg).toBe(11)

    await view.render(scene("canvas"))
    expect(view.host.querySelector("canvas")).not.toBeNull()
    expect(marks(view.host).all).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(svg)
    // A circle per point, the rest polygons.
    expect(ctx.arc).toHaveBeenCalledTimes(5)

    ctx.fill.mockClear()
    await view.render(scene("webgl"))
    expect(marks(view.host).all).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(svg)
    await view.unmount()
  })
})
