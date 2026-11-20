// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"
import { RoutesChart3D, type RoutesChart3DProps } from "@/registry/new-york/ui/routes-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  a: { color: "red" },
  b: { label: "B", color: "blue" },
  sea: { label: "By sea", color: "navy" },
  air: { color: "skyblue" },
}
const land: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

type Stop = { id?: string; lon: number; lat?: number | null; s?: string; by?: string }

/** A globe seen level from the prime meridian: the place at 0, 0 in the middle, at 320, 200. */
const chart = (data: Stop[], props: Partial<RoutesChart3DProps<Stop>> = {}) => (
  <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
    <RoutesChart3D data={data} land={land} lon="lon" lat="lat" {...props} />
  </ChartContainer3D>
)

/** The marks of the routes in paint order, without the ocean: the quads of the legs and the circles on the stops. */
function marks(root: ParentNode) {
  const all = [...root.querySelectorAll('[data-slot="chart-3d-marks"] > *')].filter((m) =>
    m.getAttribute("fill")!.includes("--color-")
  )
  const corners = (path: Element) =>
    [...path.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ])
  return {
    all,
    quads: all.filter((m) => m.tagName === "path").map((m) => ({ el: m, corners: corners(m) })),
    stops: all
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

describe("RoutesChart3D", () => {
  test("draws a route from stop to stop along the great circle, over the ocean, with a circle on every stop", () => {
    const { all, quads, stops, fills, html } = serverMarks(
      chart([
        { lon: -30, lat: 0 },
        { lon: 0, lat: 0 },
        { lon: 30, lat: 0 },
      ])
    )
    expect(stops).toHaveLength(3)
    expect(quads.length).toBeGreaterThan(10)
    expect(new Set(fills)).toEqual(new Set(["var(--color-a)"]))
    // The equator is a great circle, and from here a level line through the middle of the globe.
    for (const { corners } of quads) expect(middle(corners)[1]).toBeCloseTo(200, 0)
    expect(stops.map((s) => s.at[1])).toEqual([200, 200, 200])
    // The legs run from the first stop to the last, and the stops lie over them.
    const xs = quads.flatMap((q) => q.corners.map((c) => c[0]))
    const ends = stops.map((s) => s.at[0]).sort((a, b) => a - b)
    expect(Math.min(...xs)).toBeCloseTo(ends[0], 0)
    expect(Math.max(...xs)).toBeCloseTo(ends[2], 0)
    expect(ends[1]).toBe(320)
    expect(all.slice(-3).map((m) => m.tagName)).toEqual(["circle", "circle", "circle"])
    expect(html.indexOf('fill="var(--chart-3d-ocean')).toBeGreaterThan(-1)
    expect(html.indexOf('fill="var(--chart-3d-ocean')).toBeLessThan(
      html.indexOf('fill="var(--color-a)"')
    )
    expect(html).not.toContain("NaN")
  })

  test("a leg between two places on a meridian bends with the globe: it is no straight line through the stops", () => {
    const { quads, stops } = serverMarks(
      chart([
        { lon: 40, lat: -40 },
        { lon: 40, lat: 40 },
      ])
    )
    expect(stops[0].at[0]).toBeCloseTo(stops[1].at[0], 1)
    // Halfway, on the equator, the meridian lies farther from the middle of the globe.
    const widest = Math.max(...quads.map((q) => middle(q.corners)[0]))
    expect(widest).toBeGreaterThan(stops[0].at[0] + 10)
  })
  test("a route per series, each in its color, and an entry without a place ends its route before it", () => {
    const two = serverMarks(
      chart(
        [
          { lon: -20, lat: 10, s: "a" },
          { lon: 0, lat: 20, s: "b" },
          { lon: 20, lat: 10, s: "a" },
          { lon: 10, lat: -20, s: "b" },
        ],
        { series: "s" }
      )
    )
    expect(two.stops.map((s) => s.el.getAttribute("fill")).sort()).toEqual([
      "var(--color-a)",
      "var(--color-a)",
      "var(--color-b)",
      "var(--color-b)",
    ])
    expect(new Set(two.quads.map((q) => q.el.getAttribute("fill")))).toEqual(
      new Set(["var(--color-a)", "var(--color-b)"])
    )
    const whole = serverMarks(
      chart([
        { lon: -30, lat: 0 },
        { lon: -10, lat: 0 },
        { lon: 10, lat: 0 },
        { lon: 30, lat: 0 },
      ])
    )
    const broken = serverMarks(
      chart([
        { lon: -30, lat: 0 },
        { lon: -10, lat: 0 },
        { lon: 0, lat: null },
        { lon: 10, lat: 0 },
        { lon: 30, lat: 0 },
      ])
    )
    // Three legs of twenty degrees, the middle one missing where the route is broken.
    expect(whole.stops).toHaveLength(4)
    expect(broken.stops).toHaveLength(4)
    expect(broken.quads).toHaveLength((whole.quads.length * 2) / 3)
    expect(broken.html).not.toContain("NaN")
  })

  test("the globe hides what lies on its far side: a stop there, and the part of a leg beyond the horizon", () => {
    const far = serverMarks(
      chart([
        { lon: 150, lat: 0 },
        { lon: 170, lat: 0 },
      ])
    )
    expect(far.all).toHaveLength(0)
    const over = serverMarks(
      chart([
        { lon: 30, lat: 0 },
        { lon: 150, lat: 0 },
      ])
    )
    const near = serverMarks(
      chart([
        { lon: 30, lat: 0 },
        { lon: 90, lat: 0 },
      ])
    )
    // The leg ends at the horizon, at ninety degrees, wherever it heads beyond it.
    expect(over.stops).toHaveLength(1)
    expect(over.quads).toHaveLength(near.quads.length - 1)
  })

  test("a route may come back to a stop: with id, a name that repeats is a stop of its own, and the round closes", () => {
    const round = [
      { id: "home", lon: -20, lat: 0 },
      { id: "out", lon: 20, lat: 20 },
      { id: "on", lon: 20, lat: -20 },
      { id: "home", lon: -20, lat: 0 },
    ]
    const named = serverMarks(chart(round, { id: "id" }))
    const numbered = serverMarks(chart(round))
    expect(named.stops).toHaveLength(4)
    expect(named.quads).toHaveLength(numbered.quads.length)
  })

  test("a leg is as wide on the screen wherever it runs, and two stops at one place draw no leg at NaN", () => {
    const { quads } = serverMarks(
      chart([
        { lon: -60, lat: -30 },
        { lon: 50, lat: 40 },
      ])
    )
    for (const { corners } of quads) {
      const [a, , , d] = corners
      expect(Math.hypot(a[0] - d[0], a[1] - d[1])).toBeCloseTo(2, 1)
    }
    const same = serverMarks(
      chart([
        { lon: 10, lat: 10 },
        { lon: 10, lat: 10 },
      ])
    )
    expect(same.stops).toHaveLength(2)
    expect(same.html).not.toContain("NaN")
    expect(serverMarks(chart([])).all).toHaveLength(0)
  })
})

describe("RoutesChart3D legs of their own color", () => {
  // Three stops along the equator, the legs meeting in the middle of the globe at 320.
  const journey: Stop[] = [
    { id: "west", lon: -40, lat: 0 },
    { id: "mid", lon: 0, lat: 0, by: "sea" },
    { id: "east", lon: 40, lat: 0, by: "air" },
  ]
  const fillOf = (m: { el: Element }) => m.el.getAttribute("fill")!

  test("a leg takes the color its stop of arrival names, and so does that stop; the first stop takes that of the leg that leaves it", () => {
    const { quads, stops, fills } = serverMarks(chart(journey, { leg: "by" }))
    const first = quads.filter((q) => middle(q.corners)[0] < 320)
    const second = quads.filter((q) => middle(q.corners)[0] > 320)
    expect(new Set(first.map(fillOf))).toEqual(new Set(["var(--color-sea)"]))
    expect(new Set(second.map(fillOf))).toEqual(new Set(["var(--color-air)"]))
    const byPlace = [...stops].sort((a, b) => a.at[0] - b.at[0]).map(fillOf)
    expect(byPlace).toEqual(["var(--color-sea)", "var(--color-sea)", "var(--color-air)"])
    // Nothing is left in the color of the route.
    expect(fills).not.toContain("var(--color-a)")
  })

  test("a stop that names no leg keeps the color of its route, for its leg and for itself", () => {
    // No field at all, or a blank one: no leg is named.
    const plain = journey.map(({ by, ...stop }) => (stop.id === "mid" ? stop : { ...stop, by }))
    const blank = serverMarks(
      chart(
        journey.map((stop) => ({ ...stop, by: "" })),
        { leg: "by" }
      )
    )
    expect(new Set(blank.fills)).toEqual(new Set(["var(--color-a)"]))
    const { quads, stops } = serverMarks(
      chart(
        plain.map((stop) => ({ ...stop, s: "b" })),
        { leg: "by", series: "s" }
      )
    )
    const first = quads.filter((q) => middle(q.corners)[0] < 320)
    expect(new Set(first.map(fillOf))).toEqual(new Set(["var(--color-b)"]))
    const byPlace = [...stops].sort((a, b) => a.at[0] - b.at[0]).map(fillOf)
    expect(byPlace).toEqual(["var(--color-b)", "var(--color-b)", "var(--color-air)"])
  })

  test("a stop no leg touches has the color of its route, whatever it names: one alone, and one alone after a gap", () => {
    const alone = serverMarks(chart([{ lon: 0, lat: 0, by: "sea" }], { leg: "by" }))
    expect(alone.stops.map(fillOf)).toEqual(["var(--color-a)"])
    const { stops } = serverMarks(
      chart(
        [
          { lon: -40, lat: 0 },
          { lon: 0, lat: 0, by: "sea" },
          { lon: 20, lat: null },
          { lon: 40, lat: 0, by: "sea" },
        ],
        { leg: "by" }
      )
    )
    const byPlace = [...stops].sort((a, b) => a.at[0] - b.at[0]).map(fillOf)
    expect(byPlace).toEqual(["var(--color-sea)", "var(--color-sea)", "var(--color-a)"])
  })

  test("any value names a leg but a missing or a blank one: a number is read as its key, and spaces are no name", () => {
    const by = (value: unknown) =>
      serverMarks(
        chart(
          journey.map((stop) => ({ ...stop, by: value as string })),
          { leg: "by" }
        )
      ).fills
    expect(new Set(by(0))).toEqual(new Set(["var(--color-0)"]))
    expect(new Set(by("  "))).toEqual(new Set(["var(--color-a)"]))
    expect(new Set(by(null))).toEqual(new Set(["var(--color-a)"]))
    expect(new Set(by(" sea "))).toEqual(new Set(["var(--color-sea)"]))
  })

  test("the title of the tooltip names what the color means: the label of the leg, its key without one", async () => {
    const view = await mount(chart(journey, { leg: "by", id: "id" }))
    const { quads, stops } = marks(view.host)
    await view.point(middle(quads.filter((q) => middle(q.corners)[0] < 320)[3].corners))
    expect(view.tip()).toBe("By seawest0, -40mid0, 0")
    await view.point(middle(quads.filter((q) => middle(q.corners)[0] > 320)[3].corners))
    expect(view.tip()).toBe("airmid0, 0east0, 40")
    await view.point(stops.find((s) => s.at[0] === 320)!.at)
    expect(view.tip()).toBe("By seamid0, 0")
    await view.unmount()
  })

  test("a leg no stop names has the title of its route, where series names one, and none without", async () => {
    const unnamed = journey.map(({ by: _, ...stop }) => ({ ...stop, s: "b" }))
    const view = await mount(chart(unnamed, { leg: "by", id: "id" }))
    const at = middle(marks(view.host).quads[3].corners)
    await view.point(at)
    expect(view.tip()).toMatch(/^(west0, -40mid0, 0|mid0, 0east0, 40)$/)
    await view.render(chart(unnamed, { leg: "by", id: "id", series: "s" }))
    await view.point(at)
    expect(view.tip()).toMatch(/^B(west0, -40mid0, 0|mid0, 0east0, 40)$/)
    await view.unmount()
  })
})

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

describe("RoutesChart3D hover", () => {
  const lit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
  const route: Stop[] = [
    { id: "Lisbon", lon: -9, lat: 39, s: "b" },
    { id: "Recife", lon: -35, lat: -8, s: "b" },
    { id: "Accra", lon: 0, lat: 6, s: "a" },
    { id: "Cairo", lon: 31, lat: 30, s: "a" },
  ]

  test("a leg says its two stops, a stop itself, each by its name with its latitude and longitude", async () => {
    const view = await mount(chart(route, { id: "id", series: "s" }))
    const { quads, stops } = marks(view.host)
    const leg = quads.filter((q) => q.el.getAttribute("fill") === "var(--color-b)")
    await view.point(middle(leg[Math.floor(leg.length / 2)].corners))
    expect(view.tip()).toBe("BLisbon39, -9Recife-8, -35")
    const said: string[] = []
    for (const stop of stops) {
      await view.point(stop.at)
      said.push(view.tip())
    }
    // Without a label the series is named by its key.
    expect(said.sort()).toEqual(["BLisbon39, -9", "BRecife-8, -35", "aAccra6, 0", "aCairo30, 31"])
    await view.unmount()
  })

  test("pointing at a leg lights that leg alone - not the next leg, not its stops - and a stop itself alone; leaving clears it", async () => {
    // Two legs along the equator, meeting in the middle of the globe at 320.
    const view = await mount(
      chart(
        [
          { id: "west", lon: -40, lat: 0 },
          { id: "mid", lon: 0, lat: 0 },
          { id: "east", lon: 40, lat: 0 },
        ],
        { id: "id" }
      )
    )
    const before = marks(view.host)
    const first = before.quads.filter((q) => middle(q.corners)[0] < 320)
    expect(first.length).toBeGreaterThan(5)
    expect(first.length).toBe(before.quads.length / 2)

    await view.point(middle(first[3].corners))
    let now = marks(view.host)
    const litQuads = now.quads.filter((q) => lit(q.el.getAttribute("fill")!))
    expect(litQuads).toHaveLength(first.length)
    expect(litQuads.every((q) => middle(q.corners)[0] < 320)).toBe(true)
    expect(now.stops.filter((s) => lit(s.el.getAttribute("fill")!))).toHaveLength(0)

    // On a stop, the stop alone.
    await view.point(before.stops.find((s) => s.at[0] === 320)!.at)
    now = marks(view.host)
    expect(now.fills.filter(lit)).toHaveLength(1)
    expect(now.stops.filter((s) => lit(s.el.getAttribute("fill")!))).toHaveLength(1)

    await view.leave()
    expect(marks(view.host).fills.filter(lit)).toHaveLength(0)
    expect(view.tip()).toBe("")
    await view.unmount()
  })

  test("without id a stop is named by the fields of its place, and without series a route has no title", async () => {
    const view = await mount(chart(route.slice(0, 1)))
    await view.point(marks(view.host).stops[0].at)
    expect(view.tip()).toBe("lat, lon39, -9")
    await view.unmount()
  })

  test("tooltip makes what a route says from the default and the entries of its stops", async () => {
    const seen: Stop[][] = []
    const view = await mount(
      chart(route.slice(0, 2), {
        id: "id",
        tooltip: (tip, { entries }) => {
          seen.push(entries)
          return { ...tip, title: "Route", items: tip.items.slice(0, 1) }
        },
      })
    )
    const { quads, stops } = marks(view.host)
    await view.point(middle(quads[Math.floor(quads.length / 2)].corners))
    expect(seen).toEqual([route.slice(0, 2)])
    expect(view.tip()).toBe("RouteLisbon39, -9")
    await view.render(chart(route.slice(0, 2), { tooltip: () => null }))
    await view.point(stops[0].at)
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })
})

describe("RoutesChart3D transitions", () => {
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
  // Three stops on the equator, which runs level through the middle of the globe.
  const west = { id: "west", lon: -40, lat: 0 }
  const mid = { id: "mid", lon: 0, lat: 0 }
  const east = { id: "east", lon: 40, lat: 0 }
  const xs = (m: ReturnType<typeof marks>) => m.stops.map((s) => s.at[0]).sort((a, b) => a - b)
  const reach = (m: ReturnType<typeof marks>) => m.quads.flatMap((q) => q.corners.map((c) => c[0]))

  test("a stop added at the end grows its leg from the stop before it, along the great circle", async () => {
    const view = await mount(chart([west, mid], { id: "id" }))
    const [first, second] = xs(marks(view.host))
    const settled = marks(view.host).quads.length
    await view.render(chart([west, mid, east], { id: "id" }))
    // It starts on the stop before it, unseen, its leg without a length.
    let now = marks(view.host)
    expect(xs(now)).toEqual([first, second, second])
    expect(Math.max(...reach(now))).toBeCloseTo(second, 0)
    expect(view.host.innerHTML).not.toContain("NaN")

    await glide(300)
    now = marks(view.host)
    const tip = xs(now)[2]
    expect(tip).toBeGreaterThan(second)
    // On its way it stays on the equator, and the leg reaches as far as the stop has come.
    expect(now.stops.every((s) => Math.abs(s.at[1] - 200) < 0.01)).toBe(true)
    expect(Math.max(...reach(now))).toBeCloseTo(tip, 0)
    // The stop fades in as it travels; its leg, which grows out of a stop that stands, does not.
    expect(
      now.stops.filter((s) => s.el.getAttribute("fill")!.startsWith("color-mix"))
    ).toHaveLength(1)
    expect(new Set(now.quads.map((q) => q.el.getAttribute("fill")))).toEqual(
      new Set(["var(--color-a)"])
    )

    await glide(400)
    now = marks(view.host)
    expect(xs(now)[2]).toBeGreaterThan(tip)
    expect(now.quads).toHaveLength(settled * 2)
    expect(new Set(now.fills)).toEqual(new Set(["var(--color-a)"]))
    await view.unmount()
  })

  test("a tour moves on: the leg behind draws back towards the stop it led to, as the next one grows", async () => {
    const view = await mount(chart([west, mid], { id: "id" }))
    const [first, second] = xs(marks(view.host))
    await view.render(chart([mid, east], { id: "id" }))
    await glide(300)
    const now = marks(view.host)
    const [tail, , head] = xs(now)
    // The stop left behind is on its way to the one that stays, the new one on its way out of it.
    expect(tail).toBeGreaterThan(first)
    expect(tail).toBeLessThan(second)
    expect(head).toBeGreaterThan(second)
    expect(Math.min(...reach(now))).toBeCloseTo(tail, 0)
    // The stop on its way out has left the data: it says nothing, the others do.
    const gone = now.stops.find((s) => s.at[0] === tail)!
    await view.point(gone.at)
    expect(view.tip()).toBe("")
    await view.leave()

    await glide(400)
    expect(marks(view.host).stops).toHaveLength(2)
    expect(Math.min(...reach(marks(view.host)))).toBeCloseTo(second, 0)
    await view.unmount()
  })

  test("a route left with one stop draws its leg back into it, and one given a second stop grows it out", async () => {
    const view = await mount(chart([west, mid], { id: "id" }))
    const [first, second] = xs(marks(view.host))
    await view.render(chart([mid], { id: "id" }))
    await glide(300)
    let now = marks(view.host)
    expect(xs(now)).toHaveLength(2)
    expect(xs(now)[0]).toBeGreaterThan(first)
    expect(xs(now)[0]).toBeLessThan(second)
    expect(now.quads.length).toBeGreaterThan(0)
    await glide(400)
    now = marks(view.host)
    expect(xs(now)).toEqual([second])
    expect(now.quads).toHaveLength(0)

    await view.render(chart([mid, east], { id: "id" }))
    await glide(300)
    now = marks(view.host)
    expect(xs(now)).toHaveLength(2)
    expect(now.quads.length).toBeGreaterThan(0)
    await view.unmount()
  })

  test("a step that ends just as the leg has grown still draws the leg back", async () => {
    const view = await mount(chart([west], { id: "id" }))
    await view.render(chart([west, mid], { id: "id" }))
    // A frame short of the end of the glide, as a timer of the same length fires.
    await glide(590)
    const grown = marks(view.host).quads.length
    expect(grown).toBeGreaterThan(0)
    await view.render(chart([mid], { id: "id" }))
    await glide(16)
    expect(xs(marks(view.host))).toHaveLength(2)
    expect(marks(view.host).quads.length).toBeGreaterThan(grown - 3)
    await glide(300)
    expect(marks(view.host).quads.length).toBeGreaterThan(0)
    expect(marks(view.host).quads.length).toBeLessThan(grown)
    await glide(400)
    expect(marks(view.host).quads).toHaveLength(0)
    await view.unmount()
  })

  test("a tour that moves on before the last step is done goes on from where it is: nothing jumps back", async () => {
    const far = { id: "far", lon: 70, lat: 0 }
    const view = await mount(chart([west, mid], { id: "id" }))
    const [first] = xs(marks(view.host))
    await view.render(chart([mid, east], { id: "id" }))
    await glide(300)
    const before = marks(view.host)
    const tail = xs(before)[0]
    expect(tail).toBeGreaterThan(first)
    // The next step, half-way through this one.
    await view.render(chart([east, far], { id: "id" }))
    await glide(16)
    const after = marks(view.host)
    // The stop left behind first keeps drawing back from where it was, its leg no longer.
    expect(xs(after)).toHaveLength(4)
    expect(Math.abs(xs(after)[0] - tail)).toBeLessThan(3)
    expect(Math.min(...reach(after))).toBeGreaterThan(tail - 3)
    // The new stop starts on the stop before it where that one is now, not where it is
    // heading, so no leg is there before it has grown; and a leg that grows or draws back
    // is whole, not faded.
    const [, , head, tip] = xs(after)
    expect(tip - head).toBeLessThan(2)
    expect(new Set(after.quads.map((q) => q.el.getAttribute("fill")))).toEqual(
      new Set(["var(--color-a)"])
    )
    await glide(300)
    expect(xs(marks(view.host))[0]).toBeGreaterThan(tail)
    await glide(400)
    expect(marks(view.host).stops).toHaveLength(2)
    await view.unmount()
  })

  test("a leg keeps its color while it draws back, though the stop that named it has left the data", async () => {
    const stops = [west, { ...mid, by: "sea" }, { ...east, by: "air" }]
    const view = await mount(chart(stops, { id: "id", leg: "by" }))
    await view.render(chart(stops.slice(0, 2), { id: "id", leg: "by" }))
    await glide(300)
    const now = marks(view.host)
    const leaving = now.quads.filter((q) => middle(q.corners)[0] > 320)
    expect(leaving.length).toBeGreaterThan(0)
    expect(leaving.every((q) => q.el.getAttribute("fill")!.includes("var(--color-air)"))).toBe(true)
    const gone = now.stops.find((s) => s.at[0] > 321)!
    expect(gone.el.getAttribute("fill")).toMatch(/^color-mix\(in oklab, var\(--color-air\)/)
    await glide(400)
    expect(marks(view.host).fills.some((f) => f.includes("--color-air"))).toBe(false)
    await view.unmount()
  })

  describe("stops that come faster than they arrive", () => {
    // Five stops along the equator, thirty degrees apart, the globe seen from the third.
    const line = [-60, -30, 0, 30, 60].map((lon, i) => ({ id: `s${i}`, lon, lat: 0 }))
    const tour = (count: number, from = 0) => chart(line.slice(from, count), { id: "id" })
    /** The stop that has just come: the one not yet seen at all. */
    const unseen = (m: ReturnType<typeof marks>) =>
      m.stops.filter((s) => s.el.getAttribute("fill")!.includes(" 0%, transparent"))
    const near = (m: ReturnType<typeof marks>, at: number[]) =>
      m.stops.filter((s) => Math.hypot(s.at[0] - at[0], s.at[1] - at[1]) < 2).length

    test("each new stop starts on the stop before it, where that one is now, however many are on their way: no leg is there before it has grown", async () => {
      const view = await mount(tour(1))
      for (const count of [2, 3, 4, 5]) {
        const pieces = marks(view.host).quads.length
        await view.render(tour(count))
        const now = marks(view.host)
        const [fresh] = unseen(now)
        // It lies on another stop: the one before it, wherever that has come to.
        expect(unseen(now)).toHaveLength(1)
        expect(near(now, fresh.at)).toBe(2)
        // Its leg has no length yet: a piece for it, and nothing else is new.
        expect(now.quads.length - pieces).toBeLessThanOrEqual(1)
        await glide(200)
      }
      // They all arrive: five stops in a row, the legs between them whole.
      await glide(700)
      const done = marks(view.host)
      expect(xs(done)).toHaveLength(5)
      expect(new Set(done.fills)).toEqual(new Set(["var(--color-a)"]))
      // Four legs of thirty degrees, in pieces of two.
      expect(done.quads.length).toBeGreaterThanOrEqual(4 * 15)
      expect(done.quads.length).toBeLessThanOrEqual(4 * 16)
      await view.unmount()
    })

    test("stops left behind while still on their way go on to the stop that stays, from where they are: nothing sweeps the globe, nothing goes at a stroke", async () => {
      const view = await mount(tour(1))
      for (const count of [2, 3, 4, 5]) {
        await view.render(tour(count))
        await glide(200)
      }
      const before = marks(view.host)
      // All but the last stop go.
      await view.render(tour(5, 4))
      await glide(16)
      let last = marks(view.host)
      expect(xs(last)).toHaveLength(5)
      expect(Math.abs(last.quads.length - before.quads.length)).toBeLessThanOrEqual(2)
      for (const [i, x] of xs(last).entries()) expect(Math.abs(x - xs(before)[i])).toBeLessThan(4)
      // The route draws in towards the stop that stays: no stop goes back the way it came or
      // beyond the stop that stays, and no leg comes or goes at a stroke.
      const span = (m: ReturnType<typeof marks>) => Math.max(...xs(m)) - Math.min(...xs(m))
      // Where the stop that stays lies, once it has arrived.
      const [reach, end] = [span(last), xs(serverMarks(tour(5, 4)))[0] + 1]
      for (let ms = 0; ms < 560; ms += 40) {
        await glide(40)
        const now = marks(view.host)
        expect(Math.min(...xs(now))).toBeGreaterThan(Math.min(...xs(last)) - 1)
        expect(Math.max(...xs(now))).toBeLessThan(end)
        expect(Math.abs(last.quads.length - now.quads.length)).toBeLessThanOrEqual(10)
        if (ms === 280) expect(span(now)).toBeLessThan(reach * 0.75)
        last = now
      }
      // Just before they go, they lie on the stop that stays.
      expect(span(last)).toBeLessThan(3)
      await glide(100)
      expect(xs(marks(view.host))).toHaveLength(1)
      expect(marks(view.host).quads).toHaveLength(0)
      await view.unmount()
    })
  })

  test("a stop that moves across the antimeridian takes the short way: it stays on the near side", async () => {
    // The globe seen from the date line, at 180 degrees.
    const pacific = (lon: number) => (
      <ChartContainer3D config={config} defaultView={{ yaw: Math.PI, tilt: 0 }}>
        <RoutesChart3D
          data={[
            { id: "west", lon: 150, lat: 0 },
            { id: "ship", lon, lat: 0 },
          ]}
          land={land}
          lon="lon"
          lat="lat"
          id="id"
        />
      </ChartContainer3D>
    )
    const view = await mount(pacific(170))
    const from = xs(marks(view.host))
    await view.render(pacific(-170))
    await glide(300)
    const mid = xs(marks(view.host))
    // Twenty degrees over the date line, not three hundred and forty round the far side.
    expect(mid).toHaveLength(2)
    expect(mid[1]).toBeGreaterThan(from[1])
    await glide(400)
    expect(xs(marks(view.host))[1]).toBeGreaterThan(mid[1])
    await view.unmount()
  })

  test("a stop that moves glides to its new place, and a whole new route fades in where it lies", async () => {
    const view = await mount(chart([west, mid], { id: "id" }))
    const [first] = xs(marks(view.host))
    await view.render(chart([{ ...west, lon: -20 }, mid], { id: "id" }))
    await glide(300)
    const moving = xs(marks(view.host))[0]
    expect(moving).toBeGreaterThan(first)
    await glide(400)
    expect(xs(marks(view.host))[0]).toBeGreaterThan(moving)

    const other = [
      { id: "north", lon: 0, lat: 40, s: "b" },
      { id: "south", lon: 0, lat: -40, s: "b" },
    ]
    const a = [west, mid].map((d) => ({ ...d, s: "a" }))
    await view.render(chart(a, { id: "id", series: "s" }))
    await glide(700)
    await view.render(chart([...a, ...other], { id: "id", series: "s" }))
    const ofB = (m: ReturnType<typeof marks>) =>
      m.stops.filter((s) => s.el.getAttribute("fill")!.includes("var(--color-b)"))
    const start = ofB(marks(view.host)).map((s) => s.at)
    expect(start).toHaveLength(2)
    expect(start[0]).not.toEqual(start[1])
    await glide(300)
    const faded = ofB(marks(view.host))
    expect(faded.map((s) => s.at)).toEqual(start)
    expect(faded.every((s) => s.el.getAttribute("fill")!.startsWith("color-mix"))).toBe(true)
    // Its leg has no stop that stands to grow out of: it fades in with its stops.
    const legs = marks(view.host).quads.map((q) => q.el.getAttribute("fill")!)
    expect(
      legs.filter((f) => f.startsWith("color-mix(in oklab, var(--color-b)")).length
    ).toBeGreaterThan(0)
    expect(legs.filter((f) => f === "var(--color-b)")).toHaveLength(0)
    await view.unmount()
  })
})

describe("RoutesChart3D renderers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("canvas and webgl paint the same routes on the canvas, every mark of the svg once", async () => {
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
    const stops = [
      { lon: -30, lat: 10 },
      { lon: 0, lat: 0 },
      { lon: 30, lat: 10 },
    ]
    const scene = (renderer: Renderer3D) => (
      <ChartContainer3D config={config} renderer={renderer} defaultView={{ yaw: 0, tilt: 0 }}>
        <RoutesChart3D data={stops} land={land} lon="lon" lat="lat" />
      </ChartContainer3D>
    )
    const view = await mount(scene("svg"))
    const all = view.host.querySelectorAll('[data-slot="chart-3d-marks"] > *').length
    expect(marks(view.host).stops).toHaveLength(3)

    await view.render(scene("canvas"))
    expect(view.host.querySelector("canvas")).not.toBeNull()
    expect(view.host.querySelectorAll('[data-slot="chart-3d-marks"] > *')).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(all)
    // A circle per stop, the rest polygons: the ocean and the pieces of the legs.
    expect(ctx.arc).toHaveBeenCalledTimes(3)

    ctx.fill.mockClear()
    await view.render(scene("webgl"))
    expect(view.host.querySelectorAll('[data-slot="chart-3d-marks"] > *')).toHaveLength(0)
    expect(ctx.fill).toHaveBeenCalledTimes(all)
    await view.unmount()
  })
})
