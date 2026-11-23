// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D, type Tooltip3D } from "@/registry/new-york/ui/chart-3d"
import { BarFieldChart3D } from "@/registry/new-york/ui/bar-field-chart-3d"

const config = { low: { color: "blue" }, high: { color: "red" } }
// Every face drawn: a bar shows three faces from the default view, top and two sides.
const faces = (html: string) => html.match(/<path [^>]*fill="color-mix[^"]*black/g) ?? []

/** Mounts `element` with a stubbed layout; `hover` puts the pointer on the middle of a path. */
async function mount(element: ReactElement) {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = () => host.querySelector("svg")!
  svg().getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  const bars = () =>
    [...svg().querySelectorAll('[data-slot="chart-3d-marks"] path')] as SVGPathElement[]
  const move = (clientX: number, clientY: number) =>
    act(() =>
      svg().dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    )
  const hover = (path: Element) => {
    const corners = path.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
    )
    return move(x, y)
  }
  return {
    host,
    svg,
    bars,
    move,
    hover,
    tip: () => host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? "",
    render: (next: ReactElement) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe("BarFieldChart3D", () => {
  test("draws a bar per value, three faces each, ramped between the first two config colors", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarFieldChart3D
          data={[
            [1, 2, 3],
            [4, 5, 6],
          ]}
        />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(18)
    expect(html).toContain(
      "color-mix(in oklch, var(--color-high, currentColor) 100%, var(--color-low, currentColor))"
    )
    expect(html).toContain(
      "color-mix(in oklch, var(--color-high, currentColor) 0%, var(--color-low, currentColor))"
    )
  })

  test("colors names the config keys of the ramp", () => {
    const html = renderToString(
      <ChartContainer3D config={{ ...config, mid: { color: "green" } }}>
        <BarFieldChart3D data={[[1, 2]]} colors={["mid", "high"]} />
      </ChartContainer3D>
    )
    expect(html).toContain("var(--color-high, currentColor) 0%, var(--color-mid, currentColor)")
  })

  test("numbers given as text, as parsed CSV has them, draw what the numbers draw", () => {
    const html = (data: unknown) =>
      renderToString(
        <ChartContainer3D config={config}>
          <BarFieldChart3D data={data as number[][]} />
        </ChartContainer3D>
      )
    // Compared as text, "9" would top "100" and the axis would end at 10.
    expect(html([["10", "9", "100"]])).toBe(html([[10, 9, 100]]))
  })

  test("places given as text, as parsed CSV has them, stand the bars where the numbers do", () => {
    const html = (props: object) =>
      renderToString(
        <ChartContainer3D id="c" config={config}>
          <BarFieldChart3D
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

  test("a value that is no finite number draws no bar, and the rest stand", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={[[1, NaN, Infinity, 4]]} />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(6)
    expect(html).not.toContain("NaN")
  })

  test("an empty grid draws the box and no bar; a single bar has a cell to stand in", () => {
    for (const data of [[], [[]]]) {
      const html = renderToString(
        <ChartContainer3D config={config}>
          <BarFieldChart3D data={data} />
        </ChartContainer3D>
      )
      expect(faces(html)).toHaveLength(0)
      expect(html).not.toContain("NaN")
    }
    const single = renderToString(
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={[[3]]} />
      </ChartContainer3D>
    )
    expect(faces(single)).toHaveLength(3)
    expect(single).not.toContain("NaN")
  })

  test("the outer bars stay inside the walls, with a domain or without", async () => {
    for (const domain of [
      undefined,
      { x: [-1, 1] as [number, number], z: [-1, 1] as [number, number] },
    ]) {
      // At yaw 0 the screen follows x: the leftmost corner of a bar and of a wall.
      const view = await mount(
        <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
          <BarFieldChart3D
            data={[
              [1, 2, 3],
              [2, 3, 4],
              [3, 4, 5],
            ]}
            domain={domain}
          />
        </ChartContainer3D>
      )
      const left = (paths: Element[]) =>
        Math.min(
          ...paths.flatMap((p) =>
            [...p.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
          )
        )
      const walls = left([...view.host.querySelectorAll('[data-slot="chart-3d-axes"] > path')])
      expect(left(view.bars())).toBeGreaterThan(walls)
      await view.unmount()
    }
  })

  test("the box ends half a cell beyond the outer bars on both sides, not at a rounder tick", async () => {
    // 16 columns stand at 0 to 15: a nice axis would run on to 20, empty beyond the last bar.
    const view = await mount(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <BarFieldChart3D data={[Array.from({ length: 16 }, () => 1)]} />
      </ChartContainer3D>
    )
    const xs = (paths: Element[]) =>
      paths.flatMap((p) =>
        [...p.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
      )
    const walls = xs([...view.host.querySelectorAll('[data-slot="chart-3d-axes"] > path')])
    const bars = xs(view.bars())
    const left = Math.min(...bars) - Math.min(...walls)
    const right = Math.max(...walls) - Math.max(...bars)
    expect(right / left).toBeCloseTo(1, 0)
    const labels = [...view.host.querySelectorAll('[data-slot="chart-3d-axes"] text')].map(
      (t) => t.textContent
    )
    expect(labels).not.toContain("20")
    await view.unmount()
  })

  test("the y axis starts at 0, so the bars rise from the floor, and a domain names x and z", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={[[40, 50]]} domain={{ x: [10, 20], z: [5, 5] }} />
      </ChartContainer3D>
    )
    const labels = [...html.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1])
    expect(labels).toContain("0")
    expect(labels).toContain("10")
    expect(labels).toContain("20")
  })
})

describe("BarFieldChart3D places", () => {
  test("by default a column stands at its index, as x names it", () => {
    const html = (x?: number[]) =>
      renderToString(
        <ChartContainer3D config={config}>
          <BarFieldChart3D data={[[1, 2, 3]]} x={x} />
        </ChartContainer3D>
      )
    expect(html([0, 1, 2])).toBe(html())
  })

  test("x and z stand every column and row at its value, in any order, a footprint of the smallest gap", async () => {
    // From the side, at tilt 0, a bar shows its front alone: a rectangle along x.
    const view = await mount(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <BarFieldChart3D data={[[1, 1, 1]]} x={[10, 0, 1]} z={[5]} />
      </ChartContainer3D>
    )
    const spans = view
      .bars()
      .map((p) => [...p.getAttribute("d")!.matchAll(/(-?[\d.]+),/g)].map((m) => Number(m[1])))
      .map((xs) => [Math.min(...xs), Math.max(...xs)])
      .filter(([a, b]) => b - a > 1)
      .sort((a, b) => a[0] - b[0])
    expect(spans).toHaveLength(3)
    // The bars at 0 and 1 stand a cell apart, 0.8 of it wide: the gap a quarter of a bar.
    const [first, second, last] = spans
    expect((second[0] - first[1]) / (first[1] - first[0])).toBeCloseTo(0.25, 1)
    expect(last[0] - second[1]).toBeGreaterThan(5 * (second[1] - second[0]))

    const tips = []
    for (const bar of view.bars()) {
      await view.hover(bar)
      tips.push(view.tip())
    }
    expect(new Set(tips)).toEqual(new Set(["x0z5value1", "x1z5value1", "x10z5value1"]))
    await view.unmount()
  })

  test("a column or row without a finite place draws no bar", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarFieldChart3D
          data={[
            [1, 2, 3],
            [4, 5, 6],
          ]}
          x={[0, NaN, 2]}
          z={[0]}
        />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(6)
    expect(html).not.toContain("NaN")
  })
})

describe("BarFieldChart3D tooltip", () => {
  test("names the x, z and value of a bar as the ticks do, through format and titles", async () => {
    const view = await mount(
      <ChartContainer3D config={config}>
        <BarFieldChart3D
          data={[[7]]}
          domain={{ x: [3, 3], z: [4, 4] }}
          titles={{ x: "east" }}
          format={{ y: (v) => `${v} m` }}
        />
      </ChartContainer3D>
    )
    await view.hover(view.bars()[0])
    expect(view.tip()).toBe("east3z4value7 m")
    await view.unmount()
  })

  test("tooltip makes what a bar says from the default and its row, column and value; null shows none", async () => {
    const seen: unknown[] = []
    const grid = [[7]]
    const tooltip = (tip: Tooltip3D, bar: unknown) => (seen.push(bar), { ...tip, title: "bar" })
    const field = () => (
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={grid} tooltip={tooltip} />
      </ChartContainer3D>
    )
    const view = await mount(field())
    await view.hover(view.bars()[0])
    expect(seen).toEqual([{ row: 0, column: 0, x: 0, z: 0, value: 7 }])
    // A frame renders the chart again with the same props: what the bar says is not built again.
    await view.render(field())
    expect(seen).toHaveLength(1)
    expect(view.tip()).toMatch(/^bar/)
    await view.render(
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={[[7]]} tooltip={() => null} />
      </ChartContainer3D>
    )
    await view.move(1, 1)
    await view.hover(view.bars()[0])
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })
})

describe("BarFieldChart3D paint order", () => {
  test("a bar below the floor paints in the order of its footprint, as one above it: the order does not follow the values", () => {
    // The bars in paint order, far to near, each named by the middle of its three faces along x:
    // a bar stands as far left on the screen whatever its height.
    const order = (data: number[][]) => {
      const html = renderToString(
        <ChartContainer3D config={config}>
          <BarFieldChart3D data={data} />
        </ChartContainer3D>
      )
      const xs = faces(html).map((face) =>
        [...face.match(/ d="([^"]*)"/)![1].matchAll(/(-?[\d.]+),/g)].map((m) => Number(m[1]))
      )
      expect(xs).toHaveLength(12)
      return [0, 3, 6, 9].map((i) => {
        const bar = xs.slice(i, i + 3).flat()
        return Math.round((Math.min(...bar) + Math.max(...bar)) / 2)
      })
    }
    // Four bars in the same cells, whatever their values.
    const above = order([
      [1, 10],
      [10, 1],
    ])
    expect(new Set(above).size).toBe(4)
    // All below the floor, the deep ones near, then far; then above and below it mixed.
    expect(
      order([
        [-1, -1],
        [-10, -10],
      ])
    ).toEqual(above)
    expect(
      order([
        [-10, -10],
        [-1, -1],
      ])
    ).toEqual(above)
    expect(
      order([
        [-10, 1],
        [10, -1],
      ])
    ).toEqual(above)
    expect(
      order([
        [10, -1],
        [-10, 1],
      ])
    ).toEqual(above)
  })
  test("bars that stand equally deep paint in the order of the data, so the server and the browser agree", () => {
    // Seen along a diagonal of the grid, the bars of every diagonal across it stand equally
    // deep. Node and the browser round sine and cosine differently in the last bit, so the
    // depth alone paints such bars in either order and the hydration of the server HTML
    // fails: the order of the data has to decide.
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: Math.PI / 4, tilt: Math.PI / 6 }}>
        <BarFieldChart3D
          data={[
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
          ]}
        />
      </ChartContainer3D>
    )
    // The values of the bars in paint order, each read off its share of the high color.
    const painted = [
      ...new Set(
        [...html.matchAll(/<path d="[^"]*" fill="[^"]*?var\(--color-high[^)]*\) (\d+)%/g)].map(
          (face) => 1 + Math.round((Number(face[1]) * 15) / 100)
        )
      ),
    ]
    // Far to near, diagonal by diagonal, and within one from the first row on.
    expect(painted).toEqual([4, 3, 8, 2, 7, 12, 1, 6, 11, 16, 5, 10, 15, 9, 14, 13])
  })
})

describe("BarFieldChart3D focus", () => {
  test("hovering a face lights the faces of its bar alone; leaving clears them", async () => {
    const view = await mount(
      <ChartContainer3D config={config}>
        <BarFieldChart3D
          data={[
            [1, 2],
            [3, 4],
          ]}
        />
      </ChartContainer3D>
    )
    const fills = () => view.bars().map((p) => p.getAttribute("fill")!)
    const lit = () => fills().filter((f) => f.startsWith("var(--chart-3d-focus"))
    const before = fills()

    // The last face painted is in front of all others.
    await view.hover(view.bars().at(-1)!)
    expect(lit()).toHaveLength(3)

    await view.move(1, 1)
    expect(fills()).toEqual(before)

    await view.hover(view.bars().at(-1)!)
    await act(() =>
      view
        .svg()
        .dispatchEvent(
          new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
        )
    )
    expect(fills()).toEqual(before)
    await view.unmount()
  })
})

describe("BarFieldChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const chart = (data: number[][]) => (
    <ChartContainer3D config={config}>
      <BarFieldChart3D data={data} />
    </ChartContainer3D>
  )

  test("new values glide in, and the y axis follows", async () => {
    const view = await mount(chart([[1, 2]]))
    const outline = () =>
      view
        .bars()
        .map((p) => p.getAttribute("d"))
        .join()
    const ticks = () =>
      [...view.host.querySelectorAll('[data-slot="chart-3d-axes"] text')]
        .filter((t) => (t as SVGTextElement).style.opacity === "1")
        .map((t) => t.textContent)
    const start = outline()

    await view.render(chart([[1, 20]]))
    expect(outline()).toBe(start)
    await act(() => vi.advanceTimersByTime(300))
    const mid = outline()
    expect(mid).not.toBe(start)
    await act(() => vi.advanceTimersByTime(400))
    expect(outline()).not.toBe(mid)
    expect(ticks()).toContain("20")
    await view.unmount()
  })

  test("under a domain a grown grid glides its bars to their new places, no bar jumps", async () => {
    const field = (data: number[][]) => (
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={data} domain={{ x: [0, 2], z: [0, 0] }} />
      </ChartContainer3D>
    )
    const view = await mount(field([[1, 1, 1]]))
    const outlines = () => view.bars().map((p) => p.getAttribute("d"))
    const before = outlines()

    // Five columns in the same span: at the first frame every old bar still stands where it stood.
    await view.render(field([[1, 1, 1, 1, 1]]))
    expect(outlines()).toEqual(expect.arrayContaining(before))
    await act(() => vi.advanceTimersByTime(700))
    expect(outlines()).not.toEqual(expect.arrayContaining(before))
    await view.unmount()
  })

  test("new places of x glide the bars there", async () => {
    const placed = (x: number[]) => (
      <ChartContainer3D config={config}>
        <BarFieldChart3D data={[[1, 1, 1]]} x={x} />
      </ChartContainer3D>
    )
    const view = await mount(placed([0, 1, 2]))
    const outline = () =>
      view
        .bars()
        .map((p) => p.getAttribute("d"))
        .join()
    const start = outline()

    // The box scales with its places: only an uneven move shows.
    await view.render(placed([0, 1, 5]))
    expect(outline()).toBe(start)
    await act(() => vi.advanceTimersByTime(300))
    const mid = outline()
    expect(mid).not.toBe(start)
    await act(() => vi.advanceTimersByTime(400))
    expect(outline()).not.toBe(mid)
    await view.unmount()
  })

  test("new values while a bar leaves: it fades out, never black", async () => {
    const view = await mount(chart([[5, 3]]))
    await view.render(chart([[NaN, 3]]))
    await act(() => vi.advanceTimersByTime(300))
    // New values restart the glide of the values, not of the presence.
    await view.render(chart([[NaN, 4]]))
    await act(() => vi.advanceTimersByTime(400))
    const fills = view.bars().map((p) => p.getAttribute("fill"))
    expect(fills.join()).not.toContain("NaN")
    await view.unmount()
  })

  test("new data while a column leaves: it never draws without a place or at full opacity", async () => {
    const view = await mount(chart([[1, 2, 3]]))
    await view.render(chart([[1, 2]]))
    await act(() => vi.advanceTimersByTime(300))
    // New values restart the glide of the values, not of the places or the presence.
    await view.render(chart([[2, 1]]))
    await act(() => vi.advanceTimersByTime(400))
    const paths = view.bars().map((p) => `${p.getAttribute("d")} ${p.getAttribute("fill")}`)
    expect(paths.join()).not.toContain("NaN")
    expect(view.bars()).toHaveLength(6)
    await view.unmount()
  })

  test("a bar keeps its color while others enter and leave from 0", async () => {
    // The share of the high color in each bar's ramp, of the bars at full opacity.
    const ramps = (view: Awaited<ReturnType<typeof mount>>) =>
      view
        .bars()
        .map((p) => p.getAttribute("fill")!)
        .filter((f) => !f.includes("transparent"))
        .map((f) => f.match(/var\(--color-high, currentColor\) (-?\d+)%/)![1])
    const view = await mount(chart([[900, 1000]]))
    const before = [...new Set(ramps(view))].sort()
    expect(before).toEqual(["0", "100"])

    // A row enters from 0 and leaves back to it: the bars that stay keep their colors.
    await view.render(chart([[900, 1000], [950]]))
    await act(() => vi.advanceTimersByTime(100))
    expect(ramps(view).every((t) => Number(t) >= 0 && Number(t) <= 100)).toBe(true)
    expect(ramps(view)).toEqual(expect.arrayContaining(before))
    await act(() => vi.advanceTimersByTime(600))
    await view.render(chart([[900, 1000]]))
    await act(() => vi.advanceTimersByTime(700))
    expect([...new Set(ramps(view))].sort()).toEqual(before)
    await view.unmount()
  })

  test("a new bar grows from the floor as it fades in, a gone one shrinks away and says nothing", async () => {
    const view = await mount(chart([[5]]))
    const faded = () => view.bars().filter((p) => p.getAttribute("fill")!.includes("transparent"))

    // At 0 a bar is flat, its top alone; mid-glide it stands, faded.
    await view.render(chart([[5], [5]]))
    expect(faded()).toHaveLength(1)
    await act(() => vi.advanceTimersByTime(300))
    expect(faded()).toHaveLength(3)
    await act(() => vi.advanceTimersByTime(400))
    expect(faded()).toHaveLength(0)
    expect(view.bars()).toHaveLength(6)

    await view.render(chart([[5]]))
    await act(() => vi.advanceTimersByTime(300))
    const leaving = faded()
    expect(leaving).toHaveLength(3)
    await view.hover(leaving.at(-1)!)
    expect(view.tip()).toBe("")
    await act(() => vi.advanceTimersByTime(400))
    expect(view.bars()).toHaveLength(3)
    await view.unmount()
  })
})

describe("BarFieldChart3D renderers", () => {
  test("svg and canvas draw the same bars", async () => {
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (type: string) => (type === "2d" ? ctx : null) as never
    )
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    const chart = (renderer: Renderer3D) => (
      <ChartContainer3D config={config} renderer={renderer}>
        <BarFieldChart3D data={[[1, 2]]} />
      </ChartContainer3D>
    )

    const view = await mount(chart("svg"))
    expect(view.bars()).toHaveLength(6)
    await view.render(chart("canvas"))
    expect(view.host.querySelector("canvas")).not.toBeNull()
    expect(view.bars()).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(6)
    await view.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
