// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import {
  ChartContainer3D,
  type ChartConfig,
  type Renderer3D,
} from "@/registry/new-york/ui/chart-3d"
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

/**
 * The marks of the routes in paint order, without the ocean: the quads of the
 * legs, the circles on the stops and the symbols on the tips, each where it
 * lies, how far it is turned and the color of its outline.
 */
function marks(root: ParentNode) {
  const all = [...root.querySelectorAll('[data-slot="chart-3d-marks"] > *')].filter((m) =>
    m.outerHTML.includes("--color-")
  )
  const lie = (g: Element) =>
    g.getAttribute("transform")!.match(/translate\((\S+) (\S+)\) rotate\((\S+)\) scale\((\S+)\)/)!
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
    tips: all
      .filter((m) => m.tagName === "g")
      .map((m) => ({
        el: m,
        at: [Number(lie(m)[1]), Number(lie(m)[2])],
        turn: Number(lie(m)[3]),
        scale: Number(lie(m)[4]),
        color: m.lastElementChild!.getAttribute("stroke"),
      })),
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

    test.each([3, 5])(
      "of %i stops, those left behind while still on their way go on to the stop that stays, from where they are: nothing sweeps the globe, nothing goes at a stroke",
      async (stops) => {
        const view = await mount(tour(1))
        for (let count = 2; count <= stops; count += 1) {
          await view.render(tour(count))
          await glide(200)
        }
        const before = marks(view.host)
        // All but the last stop go.
        await view.render(tour(stops, stops - 1))
        await glide(16)
        let last = marks(view.host)
        expect(xs(last)).toHaveLength(stops)
        expect(Math.abs(last.quads.length - before.quads.length)).toBeLessThanOrEqual(2)
        for (const [i, x] of xs(last).entries()) expect(Math.abs(x - xs(before)[i])).toBeLessThan(4)
        // The route draws in towards the stop that stays: no stop goes back the way it came or
        // beyond the stop that stays, and no leg comes or goes at a stroke.
        const span = (m: ReturnType<typeof marks>) => Math.max(...xs(m)) - Math.min(...xs(m))
        // Where the stop that stays lies, once it has arrived.
        const [reach, end] = [span(last), xs(serverMarks(tour(stops, stops - 1)))[0] + 1]
        for (let ms = 0; ms < 560; ms += 16) {
          await glide(16)
          const now = marks(view.host)
          expect(Math.min(...xs(now))).toBeGreaterThan(Math.min(...xs(last)) - 1)
          expect(Math.max(...xs(now))).toBeLessThan(end)
          // Every leg draws in by a piece or so a frame, and there are up to four of them.
          expect(Math.abs(last.quads.length - now.quads.length)).toBeLessThanOrEqual(stops - 1)
          if (ms === 288) expect(span(now)).toBeLessThan(reach * 0.75)
          last = now
        }
        // Just before they go, they lie on the stop that stays.
        expect(span(last)).toBeLessThan(3)
        await glide(100)
        expect(xs(marks(view.host))).toHaveLength(1)
        expect(marks(view.host).quads).toHaveLength(0)
        await view.unmount()
      }
    )
  })

  test("a stop that comes from far away travels at an even pace over the globe: it does not leap half-way", async () => {
    // Two stops on the equator, a hundred and fifty degrees apart, both on the near side.
    const [from, to] = [-75, 75].map((lon, i) => ({ id: `s${i}`, lon, lat: 0 }))
    const view = await mount(chart([from, to], { id: "id" }))
    const [left, right] = xs(marks(view.host))
    const radius = (right - left) / 2 / Math.sin((75 * Math.PI) / 180)
    const lon = (x: number) => (Math.asin((x - 320) / radius) * 180) / Math.PI
    await view.render(chart([from], { id: "id" }))
    await glide(700)
    // The second stop comes back, out of the first.
    await view.render(chart([from, to], { id: "id" }))
    let last = -75
    const steps: number[] = []
    for (let ms = 0; ms < 640; ms += 16) {
      await glide(16)
      const now = lon(Math.max(...xs(marks(view.host))))
      steps.push(now - last)
      last = now
    }
    expect(last).toBeCloseTo(75, 0)
    // A hundred and fifty degrees in 600 ms, eased in and out: six degrees a frame at its fastest.
    expect(Math.max(...steps)).toBeLessThan(7)
    expect(Math.min(...steps)).toBeGreaterThan(-0.01)
    await view.unmount()
  })

  test("a stop on its way out is there until it has arrived, though other data comes meanwhile", async () => {
    const view = await mount(chart([west, mid, east], { id: "id" }))
    const settled = xs(marks(view.host))
    // The last stop goes; half-way, the first one moves a little, and nothing else changes.
    await view.render(chart([west, mid], { id: "id" }))
    await glide(300)
    await view.render(chart([{ ...west, lon: -44 }, mid], { id: "id" }))
    // When its own glide would have ended, it is still on its way, its leg with it.
    await glide(330)
    let now = marks(view.host)
    expect(xs(now)).toHaveLength(3)
    expect(xs(now)[2]).toBeGreaterThan(settled[1] + 3)
    expect(xs(now)[2]).toBeLessThan(settled[2])
    expect(now.quads.filter((q) => middle(q.corners)[0] > settled[1]).length).toBeGreaterThan(0)
    // It leaves when it has reached the stop that stays, its leg drawn back to nothing.
    await glide(240)
    now = marks(view.host)
    const legs = now.quads.filter((q) => middle(q.corners)[0] > settled[1] + 2)
    expect(legs).toHaveLength(0)
    await glide(100)
    expect(xs(marks(view.host))).toHaveLength(2)
    expect(view.host.innerHTML).not.toContain("NaN")
    await view.unmount()
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

describe("RoutesChart3D tip", () => {
  // A line as the symbol of the route: it points up as it is drawn, as the nose of a plane seen from above.
  const plane = { path: "M12 2v20", points: 0 }
  const flown = { a: { color: "red", symbol: plane }, b: { color: "blue" } }
  const tipped = (
    data: Stop[],
    props: Partial<RoutesChart3DProps<Stop>> = {},
    symbols: ChartConfig = flown
  ) => (
    <ChartContainer3D config={symbols} defaultView={{ yaw: 0, tilt: 0 }}>
      <RoutesChart3D data={data} land={land} lon="lon" lat="lat" {...props} />
    </ChartContainer3D>
  )
  const equator = [
    { lon: -30, lat: 0 },
    { lon: 0, lat: 0 },
    { lon: 30, lat: 0 },
  ]

  test("the last stop of a route is its tip: the symbol of its key, on the stop, turned along the leg that arrives", () => {
    const plain = serverMarks(chart(equator))
    const { stops, tips, all } = serverMarks(tipped(equator))
    // Every stop before the tip stays a circle, and the tip lies where its circle lay, over all else.
    const xs = (list: { at: number[] }[]) => list.map((s) => s.at[0]).sort((a, b) => a - b)
    expect(xs(stops)).toEqual(xs(plain.stops).slice(0, 2))
    expect(tips).toHaveLength(1)
    expect(tips[0].at[0]).toBeCloseTo(xs(plain.stops)[2], 1)
    expect(tips[0].at[1]).toBeCloseTo(200, 1)
    expect(all[all.length - 1]).toBe(tips[0].el)
    // A box of 24 on a disc 16 across, in the color of the route; the leg runs east, a quarter turn from up.
    expect(tips[0].scale).toBeCloseTo(16 / 24, 3)
    expect(tips[0].color).toBe("var(--color-a)")
    expect(tips[0].turn).toBeCloseTo(90, 0)
  })

  test("a tip points the way its leg arrives on the screen, less the way its symbol points as drawn", () => {
    const turn = (data: Stop[], symbol = plane) =>
      serverMarks(tipped(data, {}, { ...flown, a: { color: "red", symbol } })).tips[0].turn
    const here = { lon: 0, lat: 0 }
    // North is up, south down, west a quarter turn back.
    expect(turn([{ lon: 0, lat: -30 }, here])).toBeCloseTo(0, 0)
    expect(Math.abs(turn([{ lon: 0, lat: 30 }, here]))).toBeCloseTo(180, 0)
    expect(turn([{ lon: 30, lat: 0 }, here])).toBeCloseTo(-90, 0)
    // The plane of Lucide points up and to the right: it turns 45 degrees less.
    expect(turn([{ lon: -30, lat: 0 }, here], { ...plane, points: 45 })).toBeCloseTo(45, 0)
    // A great circle through the middle of the globe is a straight line on the screen. From 60 degrees
    // north and west the stop lies cos 60 x sin 60 to the left and sin 60 up: twice as far up as left,
    // so the leg arrives 26.57 degrees off straight down - not the 45 of a line on a flat map.
    expect(turn([{ lon: -60, lat: 60 }, here])).toBeCloseTo(180 - 26.57, 1)
  })

  test("a symbol that names no way stays upright, and the one stop of a route shows its symbol as it is drawn", () => {
    const car = { a: { color: "red", symbol: { path: "M2 12h20" } }, b: { color: "blue" } }
    expect(serverMarks(tipped(equator, {}, car)).tips.map((t) => t.turn)).toEqual([0])
    const alone = serverMarks(tipped([{ lon: 10, lat: 10 }]))
    expect(alone.stops).toHaveLength(0)
    expect(alone.tips.map((t) => t.turn)).toEqual([0])
  })

  test("a tip on the place of the stop before it has no leg to come along: it shows as it is drawn, at no NaN", () => {
    const twice = serverMarks(tipped([equator[0], equator[1], equator[1]]))
    expect(twice.tips.map((t) => t.turn)).toEqual([0])
    expect(twice.tips[0].at[0]).toBeCloseTo(320, 1)
    expect(twice.html).not.toContain("NaN")
  })

  test("a tip just this side of the horizon is drawn, though its leg comes from beyond it", () => {
    const { tips } = serverMarks(
      tipped([
        { lon: 150, lat: 0 },
        { lon: 89.9, lat: 0 },
      ])
    )
    expect(tips).toHaveLength(1)
    // It comes round the edge of the globe along the equator, towards the reader: level on the screen.
    expect(Math.abs(tips[0].turn)).toBeCloseTo(90, 0)
  })

  test("where the reader asks for reduced motion, a tip that passes to a new stop points along its leg at once", async () => {
    const view = await mount(tipped(equator.slice(0, 2), { id: "id" }))
    expect(marks(view.host).tips[0].turn).toBeCloseTo(90, 0)
    await view.render(tipped([...equator.slice(0, 2), { lon: 0, lat: 40 }], { id: "id" }))
    expect(marks(view.host).tips[0].turn).toBeCloseTo(0, 0)
    await view.unmount()
  })

  test("a route whose key has no symbol keeps the circle on its tip, beside one that has", () => {
    const { stops, tips } = serverMarks(
      tipped(
        [
          { lon: -20, lat: 10, s: "a" },
          { lon: -20, lat: -10, s: "b" },
          { lon: 20, lat: 10, s: "a" },
          { lon: 20, lat: -10, s: "b" },
        ],
        { series: "s" }
      )
    )
    expect(tips.map((t) => t.color)).toEqual(["var(--color-a)"])
    expect(stops.map((s) => s.el.getAttribute("fill")).sort()).toEqual([
      "var(--color-a)",
      "var(--color-b)",
      "var(--color-b)",
    ])
  })

  test("the tip takes the symbol of what colors it: the leg that arrives, where it names one, and else its route", () => {
    const ship = { path: "M3 20h18" }
    const modes = { a: { color: "red", symbol: plane }, sea: { color: "navy", symbol: ship } }
    const path = (data: Stop[]) => {
      const { tips } = serverMarks(tipped(data, { leg: "by" }, modes))
      return tips.map((t) => [t.el.lastElementChild!.getAttribute("d"), t.color])
    }
    expect(path([equator[0], { ...equator[1], by: "sea" }])).toEqual([
      ["M3 20h18", "var(--color-sea)"],
    ])
    expect(path([{ ...equator[0], by: "sea" }, equator[1]])).toEqual([
      ["M12 2v20", "var(--color-a)"],
    ])
  })

  test("a route broken by an entry without a place has one tip: the last stop that has a place", () => {
    const gap = { lon: 0, lat: null }
    const [west, mid, east] = equator
    const broken = serverMarks(tipped([west, mid, gap, east]))
    expect(broken.tips).toHaveLength(1)
    expect(broken.stops).toHaveLength(2)
    // Alone after the gap, no leg arrives: it shows as it is drawn.
    expect(broken.tips[0].turn).toBe(0)
    expect(broken.tips[0].at[0]).toBeGreaterThan(320)
    // A route that ends on a gap has its tip on the stop before it.
    const open = serverMarks(tipped([west, mid, gap]))
    expect(open.tips).toHaveLength(1)
    expect(open.tips[0].at[0]).toBeCloseTo(320, 1)
    expect(open.tips[0].turn).toBeCloseTo(90, 0)
  })

  test("pointing at a tip says its stop and lights its symbol alone", async () => {
    const named = equator.map((stop, i) => ({ ...stop, id: ["Quito", "Libreville", "Kampala"][i] }))
    const view = await mount(tipped(named, { id: "id" }))
    const [tip] = marks(view.host).tips
    // On its disc, off the middle; beyond the disc of radius 8 it says nothing.
    await view.point([tip.at[0] + 12, tip.at[1]])
    expect(view.tip()).toBe("")
    await view.point([tip.at[0] + 6, tip.at[1]])
    expect(view.tip()).toBe("Kampala0, 30")
    const lit = marks(view.host)
    expect(lit.tips[0].color).toContain("--chart-3d-focus")
    expect(lit.stops.every((s) => !s.el.getAttribute("fill")!.includes("focus"))).toBe(true)
    await view.unmount()
  })
})

describe("RoutesChart3D tip on its way", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const glide = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const flown = { a: { color: "red", symbol: { path: "M12 2v20", points: 0 } } }
  const tour = (data: Stop[]) => (
    <ChartContainer3D config={flown} defaultView={{ yaw: 0, tilt: 0 }}>
      <RoutesChart3D data={data} land={land} lon="lon" lat="lat" id="id" />
    </ChartContainer3D>
  )
  const west = { id: "west", lon: -40, lat: 0 }
  const mid = { id: "mid", lon: 0, lat: 0 }
  const east = { id: "east", lon: 40, lat: 0 }

  test("a stop added at the end is the tip at once: the symbol leaves the stop it stood on, whole and turned to where it heads, and flies its leg", async () => {
    const view = await mount(tour([west, mid]))
    expect(marks(view.host).tips[0].at[0]).toBeCloseTo(320, 1)
    await view.render(tour([west, mid, east]))
    // It has not set out yet, and its leg has no length: it heads east all the same, and is not faded.
    let now = marks(view.host)
    expect(now.tips).toHaveLength(1)
    expect(now.tips[0].at[0]).toBeCloseTo(320, 1)
    expect(now.tips[0].turn).toBeCloseTo(90, 0)
    expect(now.tips[0].color).toBe("var(--color-a)")
    // The stop it left is a circle again.
    expect(now.stops).toHaveLength(2)

    await glide(300)
    now = marks(view.host)
    const half = now.tips[0].at[0]
    expect(half).toBeGreaterThan(330)
    expect(now.tips[0].turn).toBeCloseTo(90, 0)
    expect(now.tips[0].color).toBe("var(--color-a)")

    await glide(400)
    now = marks(view.host)
    expect(now.tips[0].at[0]).toBeGreaterThan(half)
    expect(now.tips[0].turn).toBeCloseTo(90, 0)
    expect(now.stops).toHaveLength(2)
    expect(view.host.innerHTML).not.toContain("NaN")
    await view.unmount()
  })

  test("a tour moves on: the tip keeps the bearing it came with when the leg behind it has drawn back into it", async () => {
    const view = await mount(tour([mid]))
    expect(marks(view.host).tips[0].turn).toBe(0)
    await view.render(tour([mid, east]))
    await frames(view, 700)
    // The stop behind goes: its leg draws back towards the tip, to nothing, and the tip is alone.
    await view.render(tour([east]))
    const turns: number[] = []
    for (let ms = 0; ms < 800; ms += 50) {
      await glide(50)
      turns.push(...marks(view.host).tips.map((t) => t.turn))
    }
    expect(marks(view.host).stops).toHaveLength(0)
    expect(turns).toHaveLength(16)
    for (const turn of turns) expect(turn).toBeCloseTo(90, 0)
    await view.unmount()
  })

  /** The turn of the tip and how far up the screen it lies, on every frame for `ms`. */
  const frames = async (view: Awaited<ReturnType<typeof mount>>, ms: number) => {
    const seen: { turn: number; up: number }[] = []
    for (let at = 0; at <= ms; at += 16) {
      const [tip] = marks(view.host).tips
      seen.push({ turn: tip.turn, up: 200 - tip.at[1] })
      await glide(16)
    }
    return seen
  }
  const north = { id: "north", lon: 0, lat: 40 }

  test("when a stop joins, the tip turns from the bearing it had into the new one as it sets out, and has turned when a quarter of the leg is flown", async () => {
    const view = await mount(tour([west, mid]))
    expect(marks(view.host).tips[0].turn).toBeCloseTo(90, 0)
    await view.render(tour([west, mid, north]))
    const flown = await frames(view, 700)
    // It came from the west and points east, and so it still does as it sets out north.
    expect(flown[0].turn).toBeCloseTo(90, 0)
    // It turns one way only, a little on every frame, and ends pointing north.
    for (const [i, { turn }] of flown.entries()) {
      expect(turn).toBeLessThanOrEqual(flown[i && i - 1].turn + 0.01)
      expect(flown[i && i - 1].turn - turn).toBeLessThan(15)
    }
    expect(flown[flown.length - 1].turn).toBeCloseTo(0, 0)
    // The leg runs 40 degrees up the middle meridian: a point of it lies the sine of its latitude up.
    const top = flown[flown.length - 1].up
    const share = (up: number) =>
      Math.asin((up / top) * Math.sin((40 * Math.PI) / 180)) / ((40 * Math.PI) / 180)
    // Its leg shows its way a frame or two after it sets out, and so much later the turn is done.
    const early = flown.filter((f) => share(f.up) < 0.15)
    expect(early.length).toBeGreaterThan(3)
    expect(early[early.length - 1].turn).toBeGreaterThan(20)
    for (const { turn } of flown.filter((f) => share(f.up) >= 0.25)) expect(turn).toBeLessThan(5)
    for (const { turn } of flown.filter((f) => share(f.up) >= 0.35)) expect(turn).toBeCloseTo(0, 0)
    await view.unmount()
  })

  test("a tip turns the shorter way round, never by the long one", async () => {
    const view = await mount(tour([west, mid]))
    // From pointing east to pointing south-west: by way of south, 131 degrees, not by way of north.
    await view.render(tour([west, mid, { id: "south-west", lon: -30, lat: -30 }]))
    const turns = (await frames(view, 700)).map((f) => (f.turn + 360) % 360)
    expect(turns[0]).toBeCloseTo(90, 0)
    for (const [i, turn] of turns.entries())
      expect(turn).toBeGreaterThanOrEqual(turns[i && i - 1] - 0.01)
    // The stop lies cos 30 x sin 30 left of the middle and sin 30 below it.
    const bearing = 180 + (Math.atan2(Math.cos(Math.PI / 6) * 0.5, 0.5) * 180) / Math.PI
    expect(turns[turns.length - 1]).toBeCloseTo(bearing, 0)
    await view.unmount()
  })

  test("when a tip has left, the stop before it takes over on the bearing the tip had and turns into its own", async () => {
    const view = await mount(tour([west, mid, north]))
    await view.render(tour([west, mid]))
    const seen: { turn: number; whole: boolean; x: number; y: number }[] = []
    for (let ms = 0; ms <= 1400; ms += 16) {
      const [tip] = marks(view.host).tips
      seen.push({
        turn: tip.turn,
        whole: tip.color === "var(--color-a)",
        x: tip.at[0],
        y: tip.at[1],
      })
      await glide(16)
    }
    // Tail first the tip draws back, pointing north as it fades; then the stop in the middle is the tip.
    const fades = seen.findIndex((f) => !f.whole)
    const over = seen.findIndex((f, i) => i > fades && f.whole)
    expect(over).toBeGreaterThan(20)
    for (const f of seen.slice(0, over)) expect(f.turn).toBeCloseTo(0, 0)
    expect(seen[over].y).toBeCloseTo(200, 1)
    expect(seen[over].turn).toBeCloseTo(0, 0)
    // It came from the west: it turns east, one way, and there it stays.
    for (let i = over + 1; i < seen.length; i += 1) {
      expect(seen[i].turn).toBeGreaterThanOrEqual(seen[i - 1].turn - 0.01)
      expect(seen[i].turn - seen[i - 1].turn).toBeLessThan(15)
    }
    expect(seen[seen.length - 1].turn).toBeCloseTo(90, 0)
    await view.unmount()
  })

  test("a stop that joins while the tip still turns turns it on from where it points: no frame jumps", async () => {
    const view = await mount(tour([west, mid]))
    await view.render(tour([west, mid, north]))
    const first = await frames(view, 80)
    // A third of the way round, the next stop comes, back to the east of the one the tip left.
    expect(first[first.length - 1].turn).toBeGreaterThan(20)
    expect(first[first.length - 1].turn).toBeLessThan(85)
    await view.render(tour([west, mid, north, { id: "far", lon: 40, lat: 5 }]))
    const then = await frames(view, 900)
    const turns = [...first, ...then].map((f) => f.turn)
    for (const [i, turn] of turns.entries())
      expect(Math.abs(turn - turns[i && i - 1])).toBeLessThan(15)
    // It ends on the leg that arrives: from the north-west, down and to the right.
    expect(turns[turns.length - 1]).toBeGreaterThan(90)
    expect(turns[turns.length - 1]).toBeLessThan(180)
    await view.unmount()
  })

  test("a tour in a hurry: stops join faster than the tip arrives and drop behind it, and no frame jumps", async () => {
    const places = [
      { id: "a", lon: -50, lat: 10 },
      { id: "b", lon: -20, lat: 35 },
      { id: "c", lon: 10, lat: -20 },
      { id: "d", lon: 45, lat: 25 },
    ]
    const view = await mount(tour(places.slice(0, 1)))
    // A step every fifth of a glide; a glide after it came, a step drops what lies behind its stop.
    const steps = [0, 120, 240].map((at, i) => ({ at, data: places.slice(0, i + 2) }))
    const drops = [600, 720, 840].map((at, i) => ({ at, data: places.slice(i + 1) }))
    const turns: number[] = []
    for (let ms = 0; ms <= 1600; ms += 8) {
      for (const change of [...steps, ...drops]) {
        if (change.at === ms) await view.render(tour(change.data))
      }
      if (ms % 16 === 0) await glide(16)
      turns.push(marks(view.host).tips[0].turn)
    }
    for (const [i, turn] of turns.entries()) {
      expect(Math.abs(((turn - turns[i && i - 1] + 540) % 360) - 180)).toBeLessThan(15)
    }
    expect(marks(view.host).stops).toHaveLength(0)
    await view.unmount()
  })

  /** The largest turn from one frame to the next, in degrees, the shorter way round. */
  const jump = (turns: number[]) =>
    Math.max(...turns.slice(1).map((turn, i) => Math.abs(((turn - turns[i] + 540) % 360) - 180)))

  test("when the tip steps back to a stop no leg arrives at, its symbol turns into the way it is drawn", async () => {
    const view = await mount(tour([west, mid]))
    await view.render(tour([west]))
    const turns = (await frames(view, 1400)).map((f) => f.turn)
    expect(turns[0]).toBeCloseTo(90, 0)
    expect(jump(turns)).toBeLessThan(15)
    expect(turns[turns.length - 1]).toBe(0)
    expect(marks(view.host).stops).toHaveLength(0)
    await view.unmount()
  })

  test("a tip that leaves as another stop joins, at once or on its way out, hands on its bearing: no frame jumps", async () => {
    const far = { id: "far", lon: 40, lat: 5 }
    for (const wait of [0, 208]) {
      const view = await mount(tour([west, mid, north]))
      await view.render(tour([west, mid]))
      const leaving = wait ? (await frames(view, wait)).map((f) => f.turn) : []
      await view.render(tour([west, mid, far]))
      const turns = [...leaving, ...(await frames(view, 900)).map((f) => f.turn)]
      expect(jump(turns)).toBeLessThan(15)
      // The leg from the middle of the globe runs east and a little north.
      expect(turns[turns.length - 1]).toBeGreaterThan(75)
      expect(turns[turns.length - 1]).toBeLessThan(90)
      await view.unmount()
    }
  })

  test("a tip that flies back the way it came turns clockwise, wherever on the globe", async () => {
    const routes = [
      [-20, 13.7, 11.3, 27.9],
      [33.1, -41.2, -7.7, 8.4],
      [5.5, 5.5, 48.2, -30.9],
      [-44.4, 21.1, -3.3, -17.6],
    ]
    for (const [lon0, lat0, lon1, lat1] of routes) {
      const out = { id: "out", lon: lon0, lat: lat0 }
      const there = { id: "there", lon: lon1, lat: lat1 }
      const view = await mount(tour([out, there]))
      await view.render(tour([out, there, { ...out, id: "back" }]))
      const turns = (await frames(view, 300)).map((f) => f.turn)
      // Clockwise the turn grows, through half a turn and on from the other side. The leg
      // itself bends on its way, so it is how far round the symbol has come that tells:
      // never back by more than that bend, and soon most of the half turn.
      let round = 0
      const come = turns.slice(1).map((turn, i) => (round += ((turn - turns[i] + 540) % 360) - 180))
      expect(Math.min(...come)).toBeGreaterThan(-5)
      expect(Math.max(...come)).toBeGreaterThan(150)
      expect(Math.max(...come)).toBeLessThan(200)
      await view.unmount()
    }
  })

  test("a tip that kept the bearing of a leg and then moves turns into its way: no frame jumps", async () => {
    const view = await mount(tour([mid, east]))
    await view.render(tour([east]))
    await glide(700)
    expect(marks(view.host).tips[0].turn).toBeCloseTo(90, 0)
    await view.render(tour([{ ...east, lat: 40 }]))
    const turns = (await frames(view, 700)).map((f) => f.turn)
    expect(turns[0]).toBeCloseTo(90, 0)
    expect(jump(turns)).toBeLessThan(15)
    // It went north along its meridian, which leans to the left that far east.
    expect(turns[turns.length - 1]).toBeLessThan(0)
    expect(turns[turns.length - 1]).toBeGreaterThan(-45)
    await view.unmount()
  })

  test("a symbol that names no way stays upright through every step of a tour", async () => {
    const ship = { a: { color: "red", symbol: { path: "M3 20h18" } } }
    const sail = (data: Stop[]) => (
      <ChartContainer3D config={ship} defaultView={{ yaw: 0, tilt: 0 }}>
        <RoutesChart3D data={data} land={land} lon="lon" lat="lat" id="id" />
      </ChartContainer3D>
    )
    const view = await mount(sail([west, mid]))
    await view.render(sail([west, mid, north]))
    for (const { turn } of await frames(view, 700)) expect(turn).toBe(0)
    await view.unmount()
  })

  test("a tip that takes its first leg turns from the way it is drawn to where it heads, a little on every frame from the first", async () => {
    // Places whose point on the globe does not read back to the last digit.
    const from = { id: "from", lon: 12.34567, lat: -45.678 }
    const to = { id: "to", lon: 60.2, lat: 10.2 }
    const view = await mount(tour([from]))
    await view.render(tour([from, to]))
    const turns = [marks(view.host).tips[0].turn]
    for (let frame = 0; frame < 12; frame += 1) {
      await glide(16)
      turns.push(marks(view.host).tips[0].turn)
    }
    // Drawn it points up; it heads up and to the right, and turns there one way, no frame off it.
    expect(turns[0]).toBeCloseTo(0, 0)
    for (const [i, turn] of turns.entries()) {
      expect(turn).toBeGreaterThan(turns[i && i - 1] - 1)
      expect(turn - turns[i && i - 1]).toBeLessThan(15)
    }
    expect(turns[12]).toBeGreaterThan(30)
    expect(turns[12]).toBeLessThan(90)
    await view.unmount()
  })

  /** The way from one point of the screen to another, in degrees clockwise from up. */
  const way = (from: number[], to: number[]) =>
    (Math.atan2(to[0] - from[0], from[1] - to[1]) * 180) / Math.PI

  test("a tip whose place changes points along its leg as it is drawn, all the way", async () => {
    const view = await mount(tour([mid, east]))
    await view.render(tour([mid, { ...east, lon: 0, lat: 40 }]))
    // The stop before it lies in the middle of the globe, where every great circle is a
    // straight line on the screen: the leg arrives the way from the middle to the tip.
    for (let ms = 0; ms < 700; ms += 100) {
      await glide(100)
      const [tip] = marks(view.host).tips
      expect(tip.turn).toBeCloseTo(way([320, 200], tip.at), 0)
    }
    expect(marks(view.host).tips[0].turn).toBeCloseTo(0, 0)
    await view.unmount()
  })

  test("a tip without a leg points the way it moves, and keeps it where it comes to rest", async () => {
    const view = await mount(tour([east]))
    expect(marks(view.host).tips[0].turn).toBe(0)
    await view.render(tour([{ ...east, lon: -40, lat: 30 }]))
    // It sets out as it is drawn, and turns into its way from there.
    expect(marks(view.host).tips[0].turn).toBe(0)
    let was = marks(view.host).tips[0].at
    let turn = 0
    for (let ms = 100; ms <= 600; ms += 100) {
      await glide(100)
      const [tip] = marks(view.host).tips
      // Once it has turned from the way it is drawn it points along its way, which bends
      // a little over a tenth of a second: within a few degrees of the chord.
      if (ms > 300) expect(Math.abs(tip.turn - way(was, tip.at))).toBeLessThan(8)
      ;[was, turn] = [tip.at, tip.turn]
    }
    // Up and to the left it went, and so it stays, however often the chart draws again.
    expect(turn).toBeLessThan(-45)
    expect(turn).toBeGreaterThan(-90)
    await glide(200)
    await view.render(tour([{ ...east, lon: -40, lat: 30 }]))
    expect(marks(view.host).tips[0].turn).toBeCloseTo(turn, 0)
    await view.unmount()
  })

  test("a tip that comes round from the far side of the globe is drawn where it arrives", async () => {
    const view = await mount(tour([west, { ...east, lon: 130 }]))
    expect(marks(view.host).tips).toHaveLength(0)
    await view.render(tour([{ ...east, lon: 130 }]))
    await glide(700)
    await view.render(tour([{ ...east, lon: 0 }]))
    await glide(700)
    const { tips } = marks(view.host)
    expect(tips).toHaveLength(1)
    expect(tips[0].at[0]).toBeCloseTo(320, 1)
    await view.unmount()
  })

  test("when a tip that leaves has faded out, the stop before it is the tip, though the gone one is still on its way", async () => {
    const view = await mount(tour([west, mid, east]))
    await view.render(tour([west, mid]))
    await glide(300)
    // Other data comes: the gone stop travels on from where it is, for longer than it is seen.
    await view.render(tour([{ ...west, lon: -44 }, mid]))
    await glide(330)
    const now = marks(view.host)
    const seen = now.tips.filter((t) => t.color === "var(--color-a)")
    expect(seen).toHaveLength(1)
    expect(seen[0].at[0]).toBeCloseTo(320, 1)
    expect(seen[0].turn).toBeCloseTo(90, 0)
    await view.unmount()
  })

  test("a tip that leaves the data keeps its symbol while its leg draws back, fading, and the stop before it is the tip once it is gone", async () => {
    const view = await mount(tour([west, mid, east]))
    const from = marks(view.host).tips[0].at[0]
    await view.render(tour([west, mid]))
    await glide(300)
    // Tail first: it still points the way it came, east, as it draws back west.
    let now = marks(view.host)
    expect(now.tips).toHaveLength(1)
    expect(now.tips[0].at[0]).toBeLessThan(from)
    expect(now.tips[0].at[0]).toBeGreaterThan(320)
    expect(now.tips[0].turn).toBeCloseTo(90, 0)
    expect(now.tips[0].color).toMatch(/^color-mix/)
    expect(now.stops).toHaveLength(2)

    await glide(500)
    now = marks(view.host)
    expect(now.tips).toHaveLength(1)
    expect(now.tips[0].at[0]).toBeCloseTo(320, 1)
    expect(now.tips[0].color).toBe("var(--color-a)")
    expect(now.stops).toHaveLength(1)
    expect(view.host.innerHTML).not.toContain("NaN")
    await view.unmount()
  })
})

describe("RoutesChart3D renderers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("canvas paints the routes, every mark of the svg once", async () => {
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never)
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

    await view.unmount()
  })

  test("a canvas paints the tip as its symbol, where the svg draws it, and a circle on every stop before it", async () => {
    const names = ["setTransform", "clearRect", "beginPath", "lineTo", "closePath", "arc", "fill"]
    const lies = ["stroke", "fillRect", "save", "restore", "translate", "rotate", "scale"]
    const ctx = Object.fromEntries([...names, ...lies].map((name) => [name, vi.fn()]))
    ctx.getImageData = vi.fn(() => ({ data: [1, 2, 3, 255] }))
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never)
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    // jsdom has no Path2D: the outline of a symbol is its path data.
    vi.stubGlobal("Path2D", String)
    const scene = (renderer: Renderer3D) => (
      <ChartContainer3D
        config={{ a: { color: "red", symbol: { path: "M12 3v18", points: 0 } } }}
        renderer={renderer}
        defaultView={{ yaw: 0, tilt: 0 }}
      >
        <RoutesChart3D
          data={[
            { lon: -30, lat: 0 },
            { lon: 0, lat: 0 },
            { lon: 30, lat: 0 },
          ]}
          land={land}
          lon="lon"
          lat="lat"
        />
      </ChartContainer3D>
    )
    const view = await mount(scene("svg"))
    const [tip] = marks(view.host).tips
    await view.render(scene("canvas"))
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.translate.mock.calls[0][0]).toBeCloseTo(tip.at[0], 1)
    expect(ctx.translate.mock.calls[0][1]).toBeCloseTo(tip.at[1], 1)
    expect(ctx.rotate.mock.calls[0][0]).toBeCloseTo(Math.PI / 2, 2)
    // Its ring and, over it, its line.
    expect(ctx.stroke.mock.calls.filter(([outline]) => `${outline}` === "M12 3v18")).toHaveLength(2)
    await view.unmount()
  })
})
