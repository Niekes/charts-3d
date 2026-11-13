// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { AreaChart3D } from "@/registry/new-york/ui/area-chart-3d"
import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { label: "A", color: "red" }, b: { label: "B", color: "blue" } }
const data = [
  { name: "x", a: 1, b: 2 },
  { name: "y", a: 3, b: 1 },
  { name: "z", a: 2, b: 4 },
]
// Gentle slopes, so every segment of the top faces the camera from above.
const flat = [
  { name: "p", a: 10 },
  { name: "q", a: 11 },
  { name: "r", a: 10.5 },
  { name: "s", a: 11 },
]

/** The marks as drawn: the series of each, its corners in the view box and its fill. */
function marks(root: ParentNode) {
  return [...root.querySelectorAll('[data-slot="chart-3d-marks"] path')].map((el) => {
    const fill = el.getAttribute("fill")!
    const corners = el
      .getAttribute("d")!
      .slice(1, -1)
      .split("L")
      .map((c) => c.split(",").map(Number) as [number, number])
    return { el, fill, corners, series: fill.match(/--color-(\w+)/)?.[1] }
  })
}

/** The marks of `element` rendered on the server, read back through a DOM. */
function serverMarks(element: ReactElement) {
  const html = renderToString(element)
  const template = document.createElement("template")
  template.innerHTML = html
  return { html, marks: marks(template.content) }
}

const middle = (corners: [number, number][]) =>
  [0, 1].map((i) => corners.reduce((sum, c) => sum + c[i], 0) / corners.length) as [number, number]

const chart = (rows: Record<string, unknown>[], props: object = {}, view?: object) => (
  <ChartContainer3D config={config} defaultView={view as never}>
    <AreaChart3D data={rows} index="name" {...props} />
  </ChartContainer3D>
)

/** Renders `element` into the document, with an svg of the size of its view box. */
async function mount(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  const render = (next: ReactElement) => act(async () => root.render(next))
  const point = ([clientX, clientY]: number[]) =>
    act(() => svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY })))
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }
  return { host, svg, render, point, unmount }
}

describe("AreaChart3D", () => {
  test("draws a ribbon per series: the top, the front as one polygon and one end, as they face the camera", () => {
    const { html, marks: drawn } = serverMarks(chart(data))
    // Per ribbon two segments of the top, the front with a corner per entry
    // and two on the floor, and one end.
    expect(drawn.map((m) => `${m.series}:${m.corners.length}`)).toEqual([
      "a:4",
      "a:4",
      "a:5",
      "a:4",
      "b:4",
      "b:4",
      "b:5",
      "b:4",
    ])
    expect(html).toContain("color-mix(in oklch, var(--color-b)")
    expect(html).not.toContain("NaN")
  })

  test("keys picks the series", () => {
    const { html, marks: drawn } = serverMarks(chart(data, { keys: ["a"] }))
    expect(drawn).toHaveLength(4)
    expect(html).not.toContain("var(--color-b)")
  })

  test("an empty chart draws the box and no ribbons, and a single entry stays a number", () => {
    for (const rows of [[], data.slice(0, 1)]) {
      const { html, marks: drawn } = serverMarks(chart(rows))
      expect(drawn.length).toBeLessThanOrEqual(2)
      expect(html).not.toContain("NaN")
    }
  })

  test("a value that is not a number stands as 0, and the labels fall back to the keys", () => {
    const html = renderToString(
      <ChartContainer3D config={{ a: { color: "red" } }}>
        <AreaChart3D
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
  })

  test("x ticks about ten entries, not every one", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ name: `e${i}`, a: i }))
    const html = renderToString(chart(rows, { keys: ["a"] }, { yaw: 0, tilt: Math.PI / 6 }))
    expect(html).toMatch(/>e0<\/text>/)
    expect(html).toMatch(/>e35<\/text>/)
    expect(html).not.toMatch(/>e1<\/text>/)
  })

  test("paints the ribbons back to front, the top of each from its far end, and the faces of its box last", () => {
    // Seen from the front, b is the nearer ribbon; from behind, a is.
    const order = (yaw: number) =>
      serverMarks(chart(data, {}, { yaw, tilt: Math.PI / 6 })).marks.map((m) => m.series)
    expect(order(Math.PI / 6).join("")).toBe("aaaabbbb")
    expect(order(Math.PI - 0.5).join("")).toBe("bbbbaaaa")

    // The segments of the top run along x, from the end away from the camera.
    const tops = (yaw: number) => {
      const drawn = serverMarks(chart(flat, { keys: ["a"] }, { yaw, tilt: Math.PI / 6 })).marks
      const front = drawn.findIndex((m) => m.corners.length === flat.length + 2)
      expect(drawn.slice(front + 1).every((m) => m.corners.length === 4)).toBe(true)
      return drawn.slice(0, front).map((m) => middle(m.corners)[0])
    }
    const right = tops(Math.PI / 6)
    const left = tops(-Math.PI / 6)
    expect(right).toHaveLength(3)
    expect(left).toHaveLength(3)
    const rising = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1])
    const falling = (xs: number[]) => xs.every((x, i) => i === 0 || x < xs[i - 1])
    expect([rising(right), rising(left)]).toEqual([falling(left), falling(right)])
    expect(rising(right) !== rising(left)).toBe(true)
  })
})

describe("AreaChart3D focus", () => {
  const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
  const tip = (host: HTMLElement) =>
    host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""

  test("pointing at a face lights the fill of that face alone; leaving clears it", async () => {
    const view = await mount(chart(data))
    const before = marks(view.host).map((m) => m.fill)
    const litOnes = () =>
      marks(view.host)
        .filter((m) => isLit(m.fill))
        .map((m) => m.el)
    // Just above the floor edge of the front of b, the nearer ribbon: the
    // front runs from the first entry down to the floor, along it, and back
    // along the line.
    const front = marks(view.host).filter((m) => m.series === "b" && m.corners.length === 5)[0]
    const [x, y] = middle(front.corners.slice(1, 3))
    const inside = [x, y - 3]

    await view.point(inside)
    // The front alone lights up, its own fill lightened; every other fill stays.
    expect(litOnes()).toEqual([front.el])
    const after = marks(view.host).map((m) => m.fill)
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f) : f)))
    // The front names the series alone.
    expect(tip(view.host)).toBe("B")

    // A segment of the top lights alone, the front goes dark.
    const top = marks(view.host).filter((m) => m.series === "b" && m.corners.length === 4)[1]
    await view.point(middle(top.corners))
    expect(litOnes()).toEqual([top.el])

    await view.point([5, 5])
    expect(litOnes()).toEqual([])
    await view.point(inside)
    await act(() =>
      view.svg.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
      )
    )
    expect(litOnes()).toEqual([])
    await view.unmount()
  })

  test("a segment of the top tells the values at its two ends, an end of the ribbon only its series", async () => {
    const seen: string[] = []
    for (const yaw of [Math.PI / 6, -Math.PI / 6]) {
      const view = await mount(chart(flat, { keys: ["a"] }, { yaw, tilt: Math.PI / 6 }))
      const drawn = marks(view.host)
      const front = drawn.findIndex((m) => m.corners.length === flat.length + 2)
      // The segment painted last, which nothing of the top covers.
      await view.point(middle(drawn[front - 1].corners))
      seen.push(tip(view.host))
      // The end of the ribbon, painted after the front.
      await view.point(middle(drawn[front + 1].corners))
      seen.push(tip(view.host))
      await view.unmount()
    }
    // From one side the first segment, from the other the last; either end names the series alone.
    expect(seen).toEqual(["Ap10q11", "A", "Ar10.5s11", "A"])
  })
})

describe("AreaChart3D tooltip", () => {
  const tip = (host: HTMLElement) =>
    host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
  const tops = (host: HTMLElement) =>
    marks(host).filter((m) => m.series === "b" && m.corners.length === 4)
  const front = (host: HTMLElement) =>
    marks(host).find((m) => m.series === "b" && m.corners.length === 5)!

  test("tooltip makes what a face says from the default and the series and entries behind it", async () => {
    type Entry = (typeof data)[number]
    const seen: { key: string; entries: Entry[] }[] = []
    const given: { title: unknown; items: unknown[] }[] = []
    const view = await mount(
      chart(data, {
        tooltip: (
          tip: { title: unknown; items: unknown[] },
          face: { key: string; entries: Entry[] }
        ) => {
          seen.push(face)
          given.push(tip)
          return { title: `${face.key}:${face.entries.map((e) => e.name).join("")}`, items: [] }
        },
      })
    )
    // A segment of the top spans two entries in a row, a side none.
    await view.point(middle(tops(view.host)[1].corners))
    expect(seen).toHaveLength(1)
    expect(seen[0].key).toBe("b")
    expect(seen[0].entries).toHaveLength(2)
    expect(data.indexOf(seen[0].entries[1])).toBe(data.indexOf(seen[0].entries[0]) + 1)
    // The default it was handed: the series, and an item per spanned entry with its value of b.
    expect(given[0].title).toBe("B")
    expect(given[0].items).toEqual(
      seen[0].entries.map((e) => ({ label: e.name, value: e.b, color: "var(--color-b)" }))
    )
    expect(tip(view.host)).toBe(`b:${seen[0].entries.map((e) => e.name).join("")}`)
    const [x, y] = middle(front(view.host).corners.slice(1, 3))
    await view.point([x, y - 3])
    expect(seen[1]).toEqual({ key: "b", entries: [] })
    expect(tip(view.host)).toBe("b:")
    await view.unmount()
  })

  test("a tooltip of null shows none", async () => {
    const view = await mount(chart(data, { tooltip: () => null }))
    await view.point(middle(tops(view.host)[1].corners))
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })

  test("the tooltip names the entries and their values as the ticks do, through format; a series without a label by its key", async () => {
    const view = await mount(
      <ChartContainer3D config={{ b: { color: "blue" } }}>
        <AreaChart3D
          data={data}
          index="name"
          format={{ x: (label) => label.toUpperCase(), y: (value) => `${value}%` }}
        />
      </ChartContainer3D>
    )
    await view.point(middle(tops(view.host)[1].corners))
    expect(tip(view.host)).toMatch(/^b([XYZ]\d%){2}$/)
    await view.unmount()
  })
})

describe("AreaChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const top = (host: HTMLElement) =>
    Math.min(...marks(host).flatMap((m) => m.corners.map(([, y]) => y)))
  /** The shapes of the marks, in paint order. */
  const shapes = (root: ParentNode) => marks(root).map((m) => m.el.getAttribute("d"))
  /** The shapes of `element` drawn at once, without a glide. */
  const fresh = (element: ReactElement) =>
    serverMarks(element).marks.map((m) => m.el.getAttribute("d"))
  /** The area the front of the ribbon covers on the screen, so a notch or a step shows as a change. */
  const front = (host: HTMLElement) => {
    const { corners } = marks(host).find((m) => m.corners.length >= 5)!
    const twice = corners.reduce((sum, [x, y], i) => {
      const [u, v] = corners[(i + 1) % corners.length]
      return sum + x * v - u * y
    }, 0)
    return Math.abs(twice / 2)
  }

  test("new data glides in, the y axis with it, and settles on the data", async () => {
    const higher = flat.map((d, i) => ({ ...d, a: i === 1 ? 30 : d.a }))
    const label = (text: string) =>
      [...view.host.querySelectorAll<SVGTextElement>('[data-slot="chart-3d-axes"] text')].some(
        (t) => t.textContent === text && t.style.opacity === "1"
      )
    const view = await mount(chart(flat, { keys: ["a"] }))
    const start = shapes(view.host)
    await view.render(chart(higher, { keys: ["a"] }))
    await act(() => vi.advanceTimersByTime(300))
    const mid = shapes(view.host)
    // Mid-glide 30 lies beyond the gliding end of the y axis, still faded out.
    expect(label("30")).toBe(false)
    await act(() => vi.advanceTimersByTime(400))
    const end = fresh(chart(higher, { keys: ["a"] }))
    expect(mid).not.toEqual(start)
    expect(mid).not.toEqual(end)
    expect(shapes(view.host)).toEqual(end)
    expect(label("30")).toBe(true)
    await view.unmount()
  })

  /**
   * Swaps `from` for `to` and back: the ribbon stands as it stood at the start
   * of each glide, has moved in the middle, and is all but where it settles
   * just before the end, so nothing steps or notches when a point comes or goes.
   */
  async function unfolds(from: typeof flat, to: typeof flat) {
    const view = await mount(chart(from, { keys: ["a"] }))
    for (const end of [to, from]) {
      const before = front(view.host)
      await view.render(chart(end, { keys: ["a"] }))
      expect(front(view.host)).toBeCloseTo(before, 0)
      await act(() => vi.advanceTimersByTime(300))
      expect(Math.abs(front(view.host) - before)).toBeGreaterThan(1)
      await act(() => vi.advanceTimersByTime(260))
      const late = front(view.host)
      await act(() => vi.advanceTimersByTime(140))
      expect(Math.abs(late - front(view.host))).toBeLessThan(front(view.host) / 50)
      expect(shapes(view.host)).toEqual(fresh(chart(end, { keys: ["a"] })))
    }
    await view.unmount()
  }

  test("an added last entry unfolds from the one before it, and folds back into it when removed", async () => {
    await unfolds(flat.slice(0, 3), flat)
  })

  test("an entry inserted between two unfolds from its neighbour without a notch, and folds back into it", async () => {
    await unfolds([flat[0], flat[1], flat[3]], flat)
  })

  test("an entry that comes or goes never dips below the line it unfolds from", async () => {
    // Level with the front: the screen follows the height of the line.
    const level = { yaw: 0, tilt: 0 }
    const gap = [flat[0], flat[1], flat[3]]
    const view = await mount(chart(gap, { keys: ["a"] }, level))
    /** The screen y of the lowest point of the line, the floor of the front left out. */
    const deepest = () => {
      const ys = marks(view.host)
        .find((m) => m.corners.length >= 5)!
        .corners.map(([, y]) => y)
      const floor = Math.max(...ys)
      return Math.max(...ys.filter((y) => y < floor - 0.01))
    }
    // p, the lowest entry, stays: r unfolds from q at 11 into 10.5 and folds back.
    const lowest = deepest()
    for (const rows of [flat, gap]) {
      await view.render(chart(rows, { keys: ["a"] }, level))
      for (const _ of [1, 2, 3, 4, 5, 6, 7]) {
        await act(() => vi.advanceTimersByTime(100))
        expect(deepest()).toBeLessThan(lowest + 0.5)
      }
    }
    await view.unmount()
  })

  test("the box deepens with a new series gradually, never at once", async () => {
    // From the side the screen follows the z of the box, so the walls span its depth.
    const side = { yaw: Math.PI / 2, tilt: Math.PI / 6 }
    const view = await mount(chart(data, { keys: ["a"] }, side))
    const depth = () => {
      const xs = [...view.host.querySelectorAll('[data-slot="chart-3d-axes"] > path')].flatMap(
        (el) =>
          [...el.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
      )
      return Math.max(...xs) - Math.min(...xs)
    }
    const shallow = depth()
    await view.render(chart(data, { keys: ["a", "b"] }, side))
    expect(depth()).toBeCloseTo(shallow, 0)
    await act(() => vi.advanceTimersByTime(300))
    const mid = depth()
    await act(() => vi.advanceTimersByTime(400))
    expect(mid).toBeGreaterThan(shallow + 1)
    expect(depth()).toBeGreaterThan(mid + 1)
    await view.unmount()
  })

  test("a face of the top keeps its mark when an entry is inserted before it", async () => {
    const view = await mount(chart(flat.slice(1), { keys: ["a"] }))
    const segment = async (el: Element) => {
      const [x, y] = middle(marks(view.host).find((m) => m.el === el)!.corners)
      await view.point([x, y])
      return view.host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent
    }
    // The face of the segment from r to s, found by what it tells.
    const tops = marks(view.host).filter((m) => m.corners.length === 4)
    let face: Element | undefined
    for (const m of tops) if ((await segment(m.el)) === "Ar10.5s11") face = m.el
    expect(face).toBeDefined()

    await view.render(chart(flat, { keys: ["a"] }))
    await act(() => vi.advanceTimersByTime(700))
    // The same element still draws the segment from r to s, not the one before it.
    expect(face!.isConnected).toBe(true)
    expect(await segment(face!)).toBe("Ar10.5s11")
    await view.unmount()
  })

  test("mid-glide, a segment tells the values of the data, not the gliding numbers", async () => {
    const view = await mount(chart(flat, { keys: ["a"] }))
    const says = async (el: Element) => {
      await view.point(middle(marks(view.host).find((m) => m.el === el)!.corners))
      return view.host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
    }
    const tops = () => marks(view.host).filter((m) => m.corners.length === 4)
    let last: Element | undefined
    for (const m of tops()) if ((await says(m.el)) === "Ar10.5s11") last = m.el
    expect(last).toBeDefined()

    // s rises to 12: mid-glide the segment tells 12 at once.
    await view.render(
      chart(
        flat.map((p) => (p.name === "s" ? { ...p, a: 12 } : p)),
        { keys: ["a"] }
      )
    )
    await act(() => vi.advanceTimersByTime(300))
    expect(await says(last!)).toBe("Ar10.5s12")
    await view.unmount()
  })

  test("a segment whose entry has left the data says nothing on hover; the others still do", async () => {
    const view = await mount(chart(flat, { keys: ["a"] }))
    const says = async (el: Element) => {
      await view.point(middle(marks(view.host).find((m) => m.el === el)!.corners))
      return view.host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
    }
    const tops = () => marks(view.host).filter((m) => m.corners.length === 4)
    let last: Element | undefined
    for (const m of tops()) if ((await says(m.el)) === "Ar10.5s11") last = m.el
    expect(last).toBeDefined()

    // s leaves: mid-glide its segment still folds back into r, and says nothing.
    await view.render(chart(flat.slice(0, 3), { keys: ["a"] }))
    await act(() => vi.advanceTimersByTime(300))
    expect(last!.isConnected).toBe(true)
    expect(await says(last!)).toBe("")
    const told = []
    for (const m of tops()) told.push(await says(m.el))
    expect(told).toContain("Ap10q11")
    await view.unmount()
  })

  test("entries and series swapped together: a point only one tween knows stays unseen, no number breaks", async () => {
    const view = await mount(chart(data, { keys: ["a"] }))
    // z leaves while the series swaps from a to b: the leaving entry has no
    // value of b to show, so the line of b leaves it out instead of breaking.
    await view.render(chart(data.slice(0, 2), { keys: ["b"] }))
    await act(() => vi.advanceTimersByTime(300))
    expect(marks(view.host).map((m) => m.series)).toEqual(["b", "b", "b"])
    expect(marks(view.host).some((m) => m.el.getAttribute("d")!.includes("NaN"))).toBe(false)
    await view.unmount()
  })

  test("a chart that was empty rises out of the floor inside the box, never beyond its walls", async () => {
    // Level with the front, the screen follows the x of the box.
    const level = { yaw: 0, tilt: Math.PI / 6 }
    const view = await mount(chart([], { keys: ["a"] }, level))
    const xs = (selector: string) =>
      [...view.host.querySelectorAll(selector)].flatMap((el) =>
        [...el.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
      )
    await view.render(chart(flat, { keys: ["a"] }, level))
    for (const _ of [1, 2, 3]) {
      await act(() => vi.advanceTimersByTime(150))
      const walls = xs('[data-slot="chart-3d-axes"] > path')
      const ribbon = xs('[data-slot="chart-3d-marks"] path')
      expect(Math.min(...ribbon)).toBeGreaterThan(Math.min(...walls))
      expect(Math.max(...ribbon)).toBeLessThan(Math.max(...walls))
    }
    const mid = top(view.host)
    await act(() => vi.advanceTimersByTime(300))
    // On the screen y grows downwards: the settled top lies higher.
    expect(top(view.host)).toBeLessThan(mid)
    await view.unmount()
  })
})

describe("AreaChart3D renderers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("canvas and webgl paint the same ribbons, the front of each filled through the stencil", async () => {
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
    const gl = {
      viewport: vi.fn(),
      disable: vi.fn(),
      enable: vi.fn(),
      blendFunc: vi.fn(),
      useProgram: vi.fn(),
      uniform2f: vi.fn(),
      uniform4f: vi.fn(),
      getUniformLocation: vi.fn(() => ({})),
      getAttribLocation: vi.fn(() => 0),
      enableVertexAttribArray: vi.fn(),
      bindBuffer: vi.fn(),
      vertexAttribPointer: vi.fn(),
      bufferData: vi.fn(),
      drawArrays: vi.fn(),
      lineWidth: vi.fn(),
      colorMask: vi.fn(),
      stencilFunc: vi.fn(),
      stencilOp: vi.fn(),
      getParameter: vi.fn(() => [1, 1]),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      getExtension: vi.fn(() => null),
      isContextLost: vi.fn(() => false),
      TRIANGLE_FAN: 6,
    }
    // A canvas gives out one context only: another type on the same element is null.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement & { ctxType?: string },
      type: string
    ) {
      if (this.ctxType && this.ctxType !== type) return null
      this.ctxType = type
      return (type === "webgl" ? gl : ctx) as never
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
        <AreaChart3D data={data} index="name" />
      </ChartContainer3D>
    )
    const view = await mount(scene("svg"))
    const svg = marks(view.host).length
    expect(svg).toBe(8)

    await view.render(scene("canvas"))
    expect(view.host.querySelector("canvas")).not.toBeNull()
    expect(marks(view.host)).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(svg)

    await view.render(scene("webgl"))
    const counts = gl.drawArrays.mock.calls.map(([, , count]) => count)
    // A quad is one fan of 4; the front of three entries and two floor corners
    // is a fan of 5 drawn twice: into the stencil, then as its cover.
    expect(counts.filter((c) => c === 5)).toHaveLength(4)
    expect(counts.filter((c) => c === 4)).toHaveLength(6)
    expect(counts).toHaveLength(10)
    expect(gl.stencilOp).toHaveBeenCalledTimes(4)
    await view.unmount()
  })
})

describe("AreaChart3D values that are no numbers", () => {
  test("an infinite value stands as 0, as one that is not a number", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <AreaChart3D
          data={[
            { name: "x", a: Infinity, b: 2 },
            { name: "y", a: 3, b: -Infinity },
          ]}
          index="name"
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("NaN")
    expect(html).not.toContain("Infinity")
    expect(html).toContain(">3<")
  })
})
