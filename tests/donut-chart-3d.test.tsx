// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Tooltip3D } from "@/registry/new-york/ui/chart-3d"
import { DonutChart3D } from "@/registry/new-york/ui/donut-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  chrome: { label: "Chrome", color: "red" },
  safari: { label: "Safari", color: "blue" },
  firefox: { label: "Firefox", color: "green" },
}
const FROM_ABOVE = { yaw: 0, tilt: Math.PI / 2 }
const FROM_THE_FRONT = { yaw: 0, tilt: 0 }
const colorOf = (key: string) => `var(--color-${key}, currentColor)`

/** The faces of the slices in the server HTML: the config key of each and its corners on the screen. */
function faces(html: string) {
  return [...html.matchAll(/<path d="M([^"]+)Z" fill="([^"]+)"/g)].map((m) => ({
    key: m[2].match(/var\(--color-([\w-]+), currentColor\)/)?.[1],
    points: m[1].split("L").map((c) => c.split(",").map(Number) as [number, number]),
  }))
}

/** The corners of the faces of the slice of `key`. */
const cornersOf = (html: string, key: string) =>
  faces(html)
    .filter((f) => f.key === key)
    .flatMap((f) => f.points)

/** The middle of all corners: the axis of the ring, seen from above. */
function middle(html: string) {
  const all = faces(html).flatMap((f) => f.points)
  const [xs, ys] = [all.map(([x]) => x), all.map(([, y]) => y)]
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

/** The angle of a corner round the middle, clockwise from the top of the screen, in degrees. */
const angleOf = ([x, y]: [number, number], [cx, cy]: number[]) =>
  ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360

/** What the tooltip says, empty where none shows. */
const tipOf = (host: HTMLElement) =>
  host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""

const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
const marks = (svg: SVGSVGElement) => [
  ...svg.querySelectorAll<SVGPathElement>('[data-slot="chart-3d-marks"] path'),
]
const marksOf = (svg: SVGSVGElement, key: string) =>
  marks(svg).filter((m) => m.getAttribute("fill")!.includes(colorOf(key)))
const litOnes = (svg: SVGSVGElement) => marks(svg).filter((m) => isLit(m.getAttribute("fill")!))
const spread = (points: [number, number][]) =>
  Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x))

/** A point on the largest face of the slice of `key`: the middle of its corners. */
function on(svg: SVGSVGElement, key: string) {
  const [corners] = marksOf(svg, key)
    .map((m) => faces(`<path d="${m.getAttribute("d")}" fill="x"`)[0].points)
    .sort((a, b) => spread(b) - spread(a))
  return {
    clientX: corners.reduce((s, [x]) => s + x, 0) / corners.length,
    clientY: corners.reduce((s, [, y]) => s + y, 0) / corners.length,
  }
}

const browsers = [
  { browser: "chrome", visitors: 100 },
  { browser: "safari", visitors: 300 },
]

describe("DonutChart3D", () => {
  test("draws a slice per entry in the color its id keys in the config; a value of 0, below 0 or of no number draws none", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <DonutChart3D
          data={[
            ...browsers,
            { browser: "firefox", visitors: 0 },
            { browser: "edge", visitors: -5 },
            { browser: "opera", visitors: "n/a" },
            { browser: "brave", visitors: Infinity },
          ]}
          id="browser"
          value="visitors"
        />
      </ChartContainer3D>
    )
    expect(html).toContain(colorOf("chrome"))
    expect(html).toContain(colorOf("safari"))
    for (const key of ["firefox", "edge", "opera", "brave"]) {
      expect(html).not.toContain(colorOf(key))
    }
    expect(html).not.toContain("NaN")
  })

  test("a slice is as wide as its share: the first starts at the back and the ring runs clockwise seen from above", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
        <DonutChart3D data={browsers} id="browser" value="visitors" />
      </ChartContainer3D>
    )
    const at = middle(html)
    // A quarter of the whole: from 12 to 3 o'clock.
    const chrome = cornersOf(html, "chrome").map((p) => angleOf(p, at))
    expect(Math.min(...chrome)).toBeCloseTo(0, 0)
    expect(Math.max(...chrome)).toBeCloseTo(90, 0)
    // The other three quarters: from 3 o'clock round to 12.
    const safari = cornersOf(html, "safari")
      .map((p) => angleOf(p, at))
      // 12 o'clock may come out as 0 or as 360.
      .map((a) => (a < 1 ? a + 360 : a))
    expect(Math.min(...safari)).toBeCloseTo(90, 0)
    expect(Math.max(...safari)).toBeCloseTo(360, 0)
  })

  test("a slice is as tall as its value, relative to the largest", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={FROM_THE_FRONT}>
        <DonutChart3D
          data={[
            { browser: "chrome", visitors: 300 },
            { browser: "safari", visitors: 100 },
          ]}
          id="browser"
          value="visitors"
        />
      </ChartContainer3D>
    )
    // Seen from the front the floor is one line on the screen, the bottom of every face.
    const floor = Math.max(...faces(html).flatMap((f) => f.points.map(([, y]) => y)))
    const rise = (key: string) => floor - Math.min(...cornersOf(html, key).map(([, y]) => y))
    expect(rise("chrome")).toBeGreaterThan(0)
    expect(rise("safari") / rise("chrome")).toBeCloseTo(1 / 3, 2)
  })
})

describe("DonutChart3D paint order", () => {
  test.each([Infinity, 3])(
    "the slices paint by how near they stand round the ring to the side the eye looks from: the one opposite first, then on either side towards the eye, the one it looks from last (perspective %s)",
    (perspective) => {
      const six = Object.fromEntries("abcdef".split("").map((key) => [key, { color: "red" }]))
      const html = renderToString(
        // The eye looks from 150° round the ring, inside `c`; 330°, inside `f`, lies opposite.
        <ChartContainer3D
          config={six}
          defaultView={{ yaw: -Math.PI / 6, tilt: Math.PI / 6, perspective }}
        >
          <DonutChart3D
            data={"abcdef".split("").map((name) => ({ name, v: 1 }))}
            id="name"
            value="v"
          />
        </ChartContainer3D>
      )
      // The slices in the order their first face paints.
      const painted = [...new Set(faces(html).map((face) => face.key))]
      const at = (key: string) => painted.indexOf(key)
      expect(painted).toHaveLength(6)
      expect(at("f")).toBe(0)
      expect(at("c")).toBe(5)
      // Clockwise from the eye: d, then e; the other way round: b, then a.
      expect(at("e")).toBeLessThan(at("d"))
      expect(at("a")).toBeLessThan(at("b"))
    }
  )
})

describe("DonutChart3D hover", () => {
  test("a slice under the pointer names itself in the tooltip, with its value formatted and its share of the whole; it lights whole, and leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={browsers}
          id="browser"
          value="visitors"
          format={{ value: (v) => `${v} visits` }}
        />
      </ChartContainer3D>
    )
    const before = marks(chart.svg).map((m) => m.getAttribute("fill")!)
    await chart.send("pointermove", on(chart.svg, "chrome"))
    const text = tipOf(chart.host)
    expect(text).toContain("chrome")
    expect(text).toMatch(/visitors\s*100 visits/)
    expect(text).toMatch(/share\s*25%/)
    expect(text).not.toContain("safari")
    expect(litOnes(chart.svg)).toEqual(marksOf(chart.svg, "chrome"))
    // The slice takes its own fill lightened; every other fill stays.
    const after = marks(chart.svg).map((m) => m.getAttribute("fill")!)
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f) : f)))

    // Off the slice, over the hole of the ring: the focus and the tooltip go.
    const [x, y] = middle(chart.svg.innerHTML)
    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(litOnes(chart.svg)).toHaveLength(0)
    expect(tipOf(chart.host)).toBe("")

    // Back on it, then off the chart.
    await chart.send("pointermove", on(chart.svg, "chrome"))
    expect(litOnes(chart.svg)).toEqual(marksOf(chart.svg, "chrome"))
    await chart.send("pointerout", { relatedTarget: document.body })
    expect(litOnes(chart.svg)).toHaveLength(0)
    expect(tipOf(chart.host)).toBe("")
    await chart.unmount()
  })

  test("series names the config key of the color of a slice, and the swatch of its value; the tooltip is titled by its id", async () => {
    const regions = {
      europe: { label: "Europe", color: "red" },
      asia: { label: "Asia", color: "blue" },
    }
    const chart = await mount(
      <ChartContainer3D config={regions} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={[
            { country: "France", people: 10, continent: "europe" },
            { country: "Spain", people: 10, continent: "europe" },
            { country: "Japan", people: 20, continent: "asia" },
          ]}
          id="country"
          value="people"
          series="continent"
        />
      </ChartContainer3D>
    )
    expect(marksOf(chart.svg, "europe").length).toBeGreaterThan(0)
    expect(chart.svg.innerHTML).not.toContain("--color-France")
    await chart.send("pointermove", on(chart.svg, "asia"))
    expect(tipOf(chart.host)).toMatch(/^Japan.*people\s*20.*share\s*50%/)
    expect(chart.host.querySelector('[data-slot="chart-3d-tooltip"]')!.innerHTML).toContain(
      colorOf("asia")
    )
    await chart.unmount()
  })

  test.each([undefined, null])(
    "a slice whose id is %s is titled by the label of its series, and without id every slice takes the first key of the config",
    async (name) => {
      const chart = await mount(
        <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
          <DonutChart3D
            data={[
              { name, visitors: 1 },
              { name: "also", visitors: 3 },
            ]}
            id={name === undefined ? undefined : "name"}
            value="visitors"
            series={name === undefined ? undefined : "name"}
          />
        </ChartContainer3D>
      )
      await chart.send("pointermove", on(chart.svg, "chrome"))
      expect(tipOf(chart.host)).toMatch(/^Chrome/)
      expect(tipOf(chart.host)).not.toMatch(/null|undefined/)
      await chart.unmount()
    }
  )

  test("a slice of a series the config gives no label is titled by its key", async () => {
    const chart = await mount(
      <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={[
            { kind: "chrome", v: 1 },
            { kind: "unknown", v: 3 },
          ]}
          value="v"
          series="kind"
        />
      </ChartContainer3D>
    )
    await chart.send("pointermove", on(chart.svg, "unknown"))
    expect(tipOf(chart.host)).toMatch(/^unknown/)
    await chart.unmount()
  })

  test("a name that repeats is a slice of its own: pointing at one lights it alone", async () => {
    const chart = await mount(
      <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={[
            { browser: "chrome", visitors: 1 },
            { browser: "chrome", visitors: 1 },
          ]}
          id="browser"
          value="visitors"
        />
      </ChartContainer3D>
    )
    await chart.send("pointermove", on(chart.svg, "chrome"))
    expect(litOnes(chart.svg).length).toBeGreaterThan(0)
    expect(litOnes(chart.svg).length).toBeLessThan(marksOf(chart.svg, "chrome").length)
    await chart.unmount()
  })

  test("tooltip says what the page makes of what a slice would say, from its entry; null shows none", async () => {
    const seen: [Tooltip3D, unknown][] = []
    const chart = await mount(
      <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={browsers}
          id="browser"
          value="visitors"
          tooltip={(tip, { entry }) => {
            seen.push([tip, entry])
            return entry.browser === "chrome" ? { title: "Mine", items: [] } : null
          }}
        />
      </ChartContainer3D>
    )
    await chart.send("pointermove", on(chart.svg, "chrome"))
    expect(tipOf(chart.host)).toBe("Mine")
    expect(seen.at(-1)).toEqual([
      expect.objectContaining({ title: "chrome" }),
      { browser: "chrome", visitors: 100 },
    ])
    await chart.send("pointermove", on(chart.svg, "safari"))
    expect(tipOf(chart.host)).toBe("")
    await chart.unmount()
  })
})

describe("DonutChart3D on the canvas", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("the slices paint on the canvas, and the pointer finds them there as on the svg", async () => {
    const element = (renderer: "svg" | "canvas") => (
      <ChartContainer3D config={config} defaultView={FROM_ABOVE} renderer={renderer}>
        <DonutChart3D data={browsers} id="browser" value="visitors" />
      </ChartContainer3D>
    )
    // Where Chrome lies, read from the svg: every renderer draws the one scene.
    const svgChart = await mount(element("svg"))
    const [face] = faces(svgChart.svg.innerHTML).filter((f) => f.key === "chrome")
    const point = {
      clientX: face.points.reduce((s, [x]) => s + x, 0) / face.points.length,
      clientY: face.points.reduce((s, [, y]) => s + y, 0) / face.points.length,
    }
    await svgChart.unmount()

    const ctx = {
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never)
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    const chart = await mount(element("canvas"))
    expect(chart.host.querySelector("canvas")).not.toBeNull()
    expect(chart.svg.querySelectorAll('[data-slot="chart-3d-marks"] path')).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalled()
    await chart.send("pointermove", point)
    expect(tipOf(chart.host)).toMatch(/^chrome/)
    await chart.unmount()
  })
})

describe("DonutChart3D without data", () => {
  test.each([[[]], [[{ browser: "chrome", visitors: 0 }]]])(
    "%j draws no slice, and no NaN",
    (data) => {
      const html = renderToString(
        <ChartContainer3D config={config}>
          <DonutChart3D data={data} id="browser" value="visitors" />
        </ChartContainer3D>
      )
      expect(faces(html)).toHaveLength(0)
      expect(html).not.toContain("NaN")
    }
  )
})

describe("DonutChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const donut = (data: Record<string, unknown>[]) => (
    <ChartContainer3D config={config} defaultView={FROM_ABOVE}>
      <DonutChart3D data={data} id="browser" value="visitors" />
    </ChartContainer3D>
  )
  /** How far round the ring the slice of `key` reaches, and from where, in degrees clockwise from the back. */
  function span(svg: SVGSVGElement, key: string, { last = false } = {}) {
    const html = svg.innerHTML
    const at = middle(html)
    // The back comes out as 0 or as 360: the start of the first slice, the end of the last.
    const angles = cornersOf(html, key)
      .map((p) => angleOf(p, at))
      .map((a) => (last ? (a < 1 ? a + 360 : a) : a > 359 ? a - 360 : a))
    return { from: Math.min(...angles), to: Math.max(...angles) }
  }
  const fadedOnes = (svg: SVGSVGElement, key: string) =>
    faces(svg.innerHTML).filter((f) => f.key === key).length &&
    [...svg.querySelectorAll('[data-slot="chart-3d-marks"] path')]
      .map((p) => p.getAttribute("fill")!)
      .filter((fill) => fill.includes(colorOf(key)))
      .every((fill) => fill.includes("transparent"))

  test("a slice glides to its new share as the data changes", async () => {
    const chart = await mount(donut(browsers))
    await act(() => vi.advanceTimersByTime(700))
    expect(span(chart.svg, "chrome").to).toBeCloseTo(90, 0)

    await chart.render(
      donut([
        { browser: "chrome", visitors: 300 },
        { browser: "safari", visitors: 100 },
      ])
    )
    await act(() => vi.advanceTimersByTime(300))
    const mid = span(chart.svg, "chrome").to
    expect(mid).toBeGreaterThan(100)
    expect(mid).toBeLessThan(260)
    await act(() => vi.advanceTimersByTime(500))
    expect(span(chart.svg, "chrome").to).toBeCloseTo(270, 0)
    await chart.unmount()
  })

  test("a new slice widens out of its neighbours as it fades in; a gone one narrows back into them as it fades out, where it stood, then leaves", async () => {
    const chart = await mount(
      donut([
        { browser: "chrome", visitors: 100 },
        { browser: "safari", visitors: 100 },
      ])
    )
    await act(() => vi.advanceTimersByTime(700))
    // Safari leaves from the second half; Firefox comes in before Chrome.
    await chart.render(
      donut([
        { browser: "firefox", visitors: 100 },
        { browser: "chrome", visitors: 100 },
      ])
    )
    await act(() => vi.advanceTimersByTime(300))
    const [firefox, chrome] = ["firefox", "chrome"].map((k) => span(chart.svg, k))
    const safari = span(chart.svg, "safari", { last: true })
    // In the order of the ring: the new one first, then Chrome, then the gone one at its end.
    expect(firefox.from).toBeCloseTo(0, 0)
    expect(firefox.to).toBeGreaterThan(10)
    expect(firefox.to).toBeCloseTo(chrome.from, 0)
    expect(chrome.to).toBeCloseTo(safari.from, 0)
    expect(safari.to).toBeGreaterThan(350)
    expect(safari.to - safari.from).toBeLessThan(170)
    expect(fadedOnes(chart.svg, "firefox")).toBe(true)
    expect(fadedOnes(chart.svg, "safari")).toBe(true)
    expect(fadedOnes(chart.svg, "chrome")).toBe(false)

    await act(() => vi.advanceTimersByTime(500))
    expect(cornersOf(chart.svg.innerHTML, "safari")).toHaveLength(0)
    expect(span(chart.svg, "firefox").from).toBeCloseTo(0, 0)
    expect(span(chart.svg, "firefox").to).toBeCloseTo(180, 0)
    expect(fadedOnes(chart.svg, "firefox")).toBe(false)
    await chart.unmount()
  })

  test("a slice that takes the place of a gone one widens before it, as the gone one narrows after it", async () => {
    const chart = await mount(donut(browsers))
    await act(() => vi.advanceTimersByTime(700))
    // Firefox comes where Safari stood.
    await chart.render(
      donut([
        { browser: "chrome", visitors: 100 },
        { browser: "firefox", visitors: 300 },
      ])
    )
    await act(() => vi.advanceTimersByTime(300))
    const [chrome, firefox] = ["chrome", "firefox"].map((k) => span(chart.svg, k))
    const safari = span(chart.svg, "safari", { last: true })
    expect(firefox.from).toBeCloseTo(chrome.to, 0)
    expect(firefox.to).toBeGreaterThan(firefox.from + 10)
    expect(safari.from).toBeCloseTo(firefox.to, 0)
    expect(safari.to).toBeCloseTo(360, 0)
    await act(() => vi.advanceTimersByTime(500))
    expect(cornersOf(chart.svg.innerHTML, "safari")).toHaveLength(0)
    expect(span(chart.svg, "firefox", { last: true }).to).toBeCloseTo(360, 0)
    await chart.unmount()
  })

  test("a slice on its way out keeps its place and its fade while new values glide the others: a feed faster than the glide", async () => {
    const three = [
      { browser: "chrome", visitors: 100 },
      { browser: "safari", visitors: 100 },
      { browser: "firefox", visitors: 100 },
    ]
    const chart = await mount(donut(three))
    await act(() => vi.advanceTimersByTime(700))
    // Safari leaves; before its glide is done, Chrome's value changes.
    await chart.render(donut([three[0], three[2]]))
    await act(() => vi.advanceTimersByTime(250))
    await chart.render(donut([{ browser: "chrome", visitors: 120 }, three[2]]))
    await act(() => vi.advanceTimersByTime(450))
    expect(marks(chart.svg).filter((m) => m.getAttribute("fill")!.includes("NaN"))).toEqual([])
    // Still narrowing, faded, where it stood: between Chrome and Firefox.
    const [chrome, safari, firefox] = ["chrome", "safari", "firefox"].map((k) =>
      span(chart.svg, k, { last: k === "firefox" })
    )
    expect(fadedOnes(chart.svg, "safari")).toBe(true)
    expect(safari.from).toBeCloseTo(chrome.to, 0)
    expect(firefox.from).toBeCloseTo(safari.to, 0)
    await chart.unmount()
  })

  test("slices whose values glide to 0 fade out as they go, and fade back in as they come: no slice pops, and none speaks on its way out", async () => {
    const chart = await mount(donut(browsers))
    await act(() => vi.advanceTimersByTime(700))
    await chart.render(donut(browsers.map((d) => ({ ...d, visitors: 0 }))))
    await act(() => vi.advanceTimersByTime(300))
    expect(fadedOnes(chart.svg, "chrome")).toBe(true)
    expect(fadedOnes(chart.svg, "safari")).toBe(true)
    await chart.send("pointermove", on(chart.svg, "safari"))
    expect(tipOf(chart.host)).toBe("")
    await act(() => vi.advanceTimersByTime(500))
    expect(marks(chart.svg)).toHaveLength(0)

    await chart.render(donut(browsers))
    await act(() => vi.advanceTimersByTime(300))
    expect(fadedOnes(chart.svg, "chrome")).toBe(true)
    await act(() => vi.advanceTimersByTime(500))
    expect(fadedOnes(chart.svg, "chrome")).toBe(false)
    expect(chart.svg.innerHTML).not.toContain("NaN")
    await chart.unmount()
  })

  test("while it glides, a slice says the value of its entry, not the one on screen, and a gone one says nothing", async () => {
    const chart = await mount(donut(browsers))
    await act(() => vi.advanceTimersByTime(700))
    await chart.render(donut([{ browser: "chrome", visitors: 300 }]))
    await act(() => vi.advanceTimersByTime(300))
    await chart.send("pointermove", on(chart.svg, "chrome"))
    expect(tipOf(chart.host)).toMatch(/visitors\s*300.*share\s*100%/)
    await chart.send("pointermove", on(chart.svg, "safari"))
    expect(tipOf(chart.host)).toBe("")
    await chart.unmount()
  })

  test("an id is its own within its series: an entry that changes its series leaves as the slice of one and enters as the other", async () => {
    const two = { a: { color: "red" }, b: { color: "blue" } }
    const keyed = (kind: string) => (
      <ChartContainer3D config={two} defaultView={FROM_ABOVE}>
        <DonutChart3D
          data={[
            { browser: "chrome", visitors: 100, kind },
            { browser: "safari", visitors: 100, kind: "b" },
          ]}
          id="browser"
          value="visitors"
          series="kind"
        />
      </ChartContainer3D>
    )
    const chart = await mount(keyed("a"))
    await act(() => vi.advanceTimersByTime(700))
    await chart.render(keyed("b"))
    await act(() => vi.advanceTimersByTime(300))
    // Chrome of `a` fades out as Chrome of `b` fades in.
    expect(fadedOnes(chart.svg, "a")).toBe(true)
    await act(() => vi.advanceTimersByTime(500))
    expect(marksOf(chart.svg, "a")).toHaveLength(0)
    await chart.unmount()
  })
})

async function mount(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  svg.setPointerCapture = () => {}
  const send = (type: string, init: object) =>
    act(() => svg.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init })))
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }
  const render = (next: ReactElement) => act(async () => root.render(next))
  return { host, svg, send, render, unmount }
}
