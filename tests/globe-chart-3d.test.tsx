// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import {
  ChartContainer3D,
  useChart3D,
  type Mark3D,
  type Renderer3D,
} from "@/registry/new-york/ui/chart-3d"
import { GlobeChart3D } from "@/registry/new-york/ui/globe-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  population: { label: "Population", color: "red" },
  quake: { label: "Earthquake", color: "blue" },
}
/** A square of land, `size` degrees wide, from its south-west corner, wound clockwise as d3-geo reads a region. */
const square = (lon: number, lat: number, size = 30): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lon, lat],
        [lon, lat + size],
        [lon + size, lat + size],
        [lon + size, lat],
        [lon, lat],
      ],
    ],
  },
})
/** One square of land, east of the prime meridian on the equator, in front of the default camera. */
const land: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [square(0, 0)] }
const none: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
/** The rings of the land: their token, falling back to the color of a gridline. */
const LAND = "var(--chart-3d-land, var(--border))"
const landOf = (html: string) => html.match(new RegExp(`fill="${literal(LAND)}"`, "g")) ?? []
/** The ocean disc: its token, falling back to the color of a wall. */
const OCEAN = "var(--chart-3d-ocean, var(--muted))"
const oceanOf = (html: string) => html.match(new RegExp(`fill="${literal(OCEAN)}"`, "g")) ?? []
const literal = (s: string) => s.replace(/[()]/g, "\\$&")
/** The faces of the tiles that rise, in the color of their series. */
const faces = (html: string, key = "population") =>
  html.match(new RegExp(`fill="[^"]*var\\(--color-${key}\\)`, "g")) ?? []

describe("GlobeChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the land on an ocean disc, flat in the colors of the walls, cut at the horizon", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <GlobeChart3D
          data={[]}
          land={{
            type: "FeatureCollection",
            // Facing the camera, across the horizon, and on the far side.
            features: [square(0, 0), square(75, 0), square(150, 0)],
          }}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    // The square across the horizon draws its near half, the far one nothing.
    expect(landOf(html)).toHaveLength(2)
    expect(oceanOf(html)).toHaveLength(1)
    expect(faces(html)).toHaveLength(0)
    expect(html).not.toContain("NaN")
  })

  test("the tile that holds an entry rises over the land: its top and the sides that face the camera, in the series color", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[{ lon: 15, lat: 45, population: 10 }]}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    // The top and one to three sides of the prism, painted after the land.
    expect(faces(html).length).toBeGreaterThanOrEqual(2)
    expect(faces(html).length).toBeLessThanOrEqual(4)
    expect(html.indexOf("var(--border)")).toBeLessThan(html.indexOf("var(--color-population)"))
    expect(html).toContain("color-mix(in oklch, var(--color-population)")
    expect(html).not.toContain("NaN")
  })

  test("a tile thinner than a pixel on screen draws its top alone: a side that thin draws nothing, and on a globe of flat tiles the sides are most of the faces", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[
            { lon: 15, lat: 45, people: 1000, kind: "population" },
            { lon: 15, lat: 15, people: 1, kind: "quake" },
          ]}
          land={none}
          lon="lon"
          lat="lat"
          value="people"
          series="kind"
          step={30}
        />
      </ChartContainer3D>
    )
    expect(faces(html).length).toBeGreaterThanOrEqual(2)
    expect(faces(html, "quake")).toHaveLength(1)
  })

  // Turned and tilted, so a wrong sign in either angle shows; with a
  // perspective too, which the globe ignores, so the tiles stay on the land.
  test.each([
    { yaw: 0.7, tilt: 0.4 },
    { yaw: 0.7, tilt: 0.4, perspective: 3 },
  ])(
    "the land and the tiles share the camera: a tile of no height lies on the square of land below it, corner on corner, at %o",
    (view) => {
      const html = renderToString(
        <ChartContainer3D config={config} defaultView={view}>
          <GlobeChart3D
            data={[{ lon: 15, lat: 45, population: 0 }]}
            land={{ type: "FeatureCollection", features: [square(0, 30)] }}
            lon="lon"
            lat="lat"
            value="population"
            step={30}
          />
        </ChartContainer3D>
      )
      const points = (fill: string) =>
        [...html.matchAll(new RegExp(` d="M([^"]+)Z" fill="${fill}`, "g"))].flatMap((m) =>
          m[1].split("L").map((c) => c.split(",").map(Number))
        )
      // d3-3d projects the four corners of the top; d3-geo the square, resampled, through its corners.
      const top = points("color-mix\\(in oklch, var\\(--color-population\\)")
      const ring = points(literal(LAND))
      expect(top).toHaveLength(4)
      expect(ring.length).toBeGreaterThan(4)
      for (const [x, y] of top) {
        expect(Math.min(...ring.map(([rx, ry]) => Math.hypot(rx - x, ry - y)))).toBeLessThan(0.02)
      }
    }
  )

  test("a tile on the far side of the globe is hidden by it: not even a side that turns to the camera shows through the ocean", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <GlobeChart3D
          data={[
            { lon: 165, lat: 15, population: 10 },
            { lon: -165, lat: -15, population: 10 },
            { lon: 15, lat: 15, population: 10 },
          ]}
          land={none}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    // The one tile in front: its top and at most three sides.
    expect(faces(html).length).toBeGreaterThanOrEqual(1)
    expect(faces(html).length).toBeLessThanOrEqual(4)
  })

  test("a point in the land is not a region: it draws nothing", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <GlobeChart3D
          data={[]}
          land={{
            type: "FeatureCollection",
            features: [
              square(0, 0),
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [10, 10] },
              },
            ],
          }}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    expect(landOf(html)).toHaveLength(1)
  })
})

describe("GlobeChart3D paint order", () => {
  test("faces of the same depth paint in grid order, west before east, so the server and the client agree", () => {
    // Level with the prime meridian and every tile raised, every face has a
    // mirror image at the same depth. Node and the browser round sine and
    // cosine differently in the last bit, so a depth-only sort paints such a
    // pair in either order and the hydration of the server HTML fails: the
    // grid order has to decide.
    const data = Array.from({ length: 18 * 9 }, (_, i) => ({
      lon: -170 + (i % 18) * 20,
      lat: -80 + Math.floor(i / 18) * 20,
      population: 10,
    }))
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
        <GlobeChart3D data={data} land={none} lon="lon" lat="lat" value="population" step={20} />
      </ChartContainer3D>
    )
    const paths = [...html.matchAll(/ d="M([^"]+)Z" fill="color-mix/g)].map((m) => m[1].split("L"))
    const key = (corners: string[], mirror: boolean) =>
      corners
        .map((c) => c.split(",").map(Number))
        .map(([x, y]) => `${(mirror ? 640 - x : x).toFixed(2)},${y.toFixed(2)}`)
        .sort()
        .join(" ")
    const seen = new Map(paths.map((corners, i) => [key(corners, false), i]))
    const pairs = paths.flatMap((corners, i) => {
      const twin = seen.get(key(corners, true))
      const left = Math.min(...corners.map((c) => Number(c.split(",")[0])))
      return twin !== undefined && twin !== i && left < 320 ? [[i, twin]] : []
    })
    expect(pairs.length).toBeGreaterThan(40)
    expect(pairs.filter(([west, east]) => west > east)).toHaveLength(0)
  })
})

describe("GlobeChart3D props", () => {
  const html = (data: Record<string, unknown>[], props: Record<string, unknown> = {}) =>
    renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D data={data} land={none} lon="lon" lat="lat" value="n" step={30} {...props} />
      </ChartContainer3D>
    )

  test("series names the config key of the color of each tile", () => {
    const out = html(
      [
        { lon: 15, lat: 45, n: 3, type: "quake" },
        { lon: -15, lat: 15, n: 2, type: "population" },
      ],
      { series: "type" }
    )
    expect(faces(out, "quake").length).toBeGreaterThan(0)
    expect(faces(out, "population").length).toBeGreaterThan(0)
  })

  test("the last entry on a tile wins, whatever its series", () => {
    const out = html(
      [
        { lon: 10, lat: 40, n: 3, type: "quake" },
        { lon: 20, lat: 50, n: 2, type: "population" },
      ],
      { series: "type" }
    )
    expect(faces(out, "quake")).toHaveLength(0)
    expect(faces(out, "population").length).toBeGreaterThan(0)
  })

  test("the far edge and beyond fall into the last tile, an entry without a place has none, a value that is not a number stands as 0", () => {
    const out = html([
      { lon: 180, lat: 90, n: 1 },
      { lon: 400, lat: -100, n: 1 },
      { lon: "n/a", lat: 45, n: 1 },
      { lon: 15, lat: 45, n: "n/a" },
    ])
    expect(out).not.toContain("NaN")
    // The three entries with a place share no tile: the top of each is a face, at least.
    expect(faces(out).length).toBeGreaterThanOrEqual(2)
  })
})

describe("GlobeChart3D hover", () => {
  const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
  const data = [{ lon: 15, lat: 45, population: 10 }]

  /** The center of a face on screen. */
  function center(face: Element) {
    const corners = face.getAttribute("d")!.slice(1, -1).split("L")
    return [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
  }

  /** The faces of the tile that rises, as elements, and the center of the one painted last. */
  function prism(svg: SVGSVGElement) {
    const faces = [...svg.querySelectorAll("path")].filter((p) =>
      p.getAttribute("fill")!.includes("var(--color-population)")
    )
    const [x, y] = center(faces.at(-1)!)
    return { faces, x, y }
  }

  test("a tile under the pointer names its series, its value and its center in the tooltip, the value formatted", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={data}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
          format={(v) => `${v} people`}
        />
      </ChartContainer3D>
    )
    const { x, y } = prism(chart.svg)
    await chart.send("pointermove", { clientX: x, clientY: y })
    const text = chart.host.textContent!
    expect(text).toContain("Population")
    expect(text).toContain("10 people")
    // The center of the 30° tile that holds 15°E 45°N, labeled by the fields.
    expect(text).toMatch(/lat\s*45/)
    expect(text).toMatch(/lon\s*15/)
    await chart.unmount()
  })

  test("label names the tile after its last entry in the title of the tooltip, in place of the series", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[
            { lon: 10, lat: 40, population: 3, name: "Rome" },
            { lon: 20, lat: 50, population: 10, name: "Prague" },
          ]}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          label="name"
          step={30}
        />
      </ChartContainer3D>
    )
    const { x, y } = prism(chart.svg)
    await chart.send("pointermove", { clientX: x, clientY: y })
    const text = chart.host.textContent!
    expect(text).toContain("Prague")
    expect(text).not.toContain("Rome")
    expect(text).not.toContain("Population")
    await chart.unmount()
  })

  test("hovering a tile lights its faces together, never the land, which says nothing; nothing else changes; leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D data={data} land={land} lon="lon" lat="lat" value="population" step={30} />
      </ChartContainer3D>
    )
    const paths = () => [...chart.svg.querySelectorAll('[data-slot="chart-3d-marks"] path')]
    const litOnes = () => paths().filter((p) => isLit(p.getAttribute("fill")!))
    const { faces, x, y } = prism(chart.svg)
    const before = paths().map((p) => p.getAttribute("fill"))

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(litOnes()).toHaveLength(faces.length)
    expect(litOnes().every((p) => p.getAttribute("fill")!.includes("--color-population"))).toBe(
      true
    )
    const after = paths().map((p) => p.getAttribute("fill")!)
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f!) : f)))

    // Off the globe, still inside the chart: nothing lit.
    await chart.send("pointermove", { clientX: 5, clientY: 5 })
    expect(litOnes()).toHaveLength(0)

    // On the land, east of the tile: the earth itself says nothing.
    const [fx, fy] = center(paths().find((p) => p.getAttribute("fill") === LAND)!)
    await chart.send("pointermove", { clientX: fx, clientY: fy })
    expect(litOnes()).toHaveLength(0)
    expect(chart.host.textContent).not.toContain("Population")

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(litOnes()).toHaveLength(faces.length)
    await chart.send("pointerout", { relatedTarget: document.body })
    expect(litOnes()).toHaveLength(0)
    await chart.unmount()
  })

  test("tooltip makes what a tile says of what it would say and the entries on the tile, and null says nothing", async () => {
    const both = [
      { lon: 10, lat: 40, population: 3 },
      { lon: 20, lat: 50, population: 7 },
    ]
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={both}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
          tooltip={(tip, { entries }) => ({ ...tip, title: `${entries.length} places` })}
        />
      </ChartContainer3D>
    )
    const { x, y } = prism(chart.svg)
    await chart.send("pointermove", { clientX: x, clientY: y })
    // Both entries lie on the one tile; the items stay what the tile would say.
    expect(chart.host.textContent).toContain("2 places")
    expect(chart.host.textContent).toMatch(/lat\s*45/)
    await chart.unmount()

    const silent = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={both}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
          tooltip={() => null}
        />
      </ChartContainer3D>
    )
    const at = prism(silent.svg)
    await silent.send("pointermove", { clientX: at.x, clientY: at.y })
    expect(silent.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await silent.unmount()
  })
})

describe("GlobeChart3D labels", () => {
  test("a series without a config entry is named by its key", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[{ lon: 15, lat: 45, n: 3, type: "wildfire" }]}
          land={none}
          lon="lon"
          lat="lat"
          value="n"
          series="type"
          step={30}
        />
      </ChartContainer3D>
    )
    const face = [...chart.svg.querySelectorAll("path")]
      .filter((p) => p.getAttribute("fill")!.includes("var(--color-wildfire)"))
      .at(-1)!
    const corners = face.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(chart.host.textContent).toContain("wildfire")
    await chart.unmount()
  })
})

describe("GlobeChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("a new tile grows from the globe as it fades in, a gone one shrinks back as it fades out, then leaves", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (data: Record<string, number>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <GlobeChart3D
              data={data}
              land={none}
              lon="lon"
              lat="lat"
              value="population"
              step={30}
            />
          </ChartContainer3D>
        )
      )
    const faces = (key: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-marks"] path')].filter((p) =>
        p.getAttribute("fill")!.includes(`--color-${key}`)
      )
    const transparent = (key: string) =>
      faces(key).filter((p) => p.getAttribute("fill")!.includes("transparent"))
    const lift = (key: string) => {
      // The top of the tile: the face painted last. Its highest corner on
      // screen lies the higher, the taller the tile.
      const d = faces(key).at(-1)!.getAttribute("d")!
      return Math.min(...[...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1])))
    }

    await render([{ lon: 15, lat: 45, population: 10 }])
    await act(() => vi.advanceTimersByTime(700))
    const tall = lift("population")
    expect(transparent("population")).toHaveLength(0)

    // A new tile of another series beside it, the old one gone.
    await render([{ lon: 45, lat: 45, population: 10 }])
    await act(() => vi.advanceTimersByTime(300))
    // Mid-glide both are there, faded: the gone one shrinking, the new one growing.
    expect(transparent("population").length).toBe(faces("population").length)
    expect(faces("population").length).toBeGreaterThanOrEqual(2)
    expect(lift("population")).toBeGreaterThan(tall - 1)
    await act(() => vi.advanceTimersByTime(500))
    // Done: one tile, opaque, as tall as the first was.
    expect(transparent("population")).toHaveLength(0)
    expect(faces("population").length).toBeLessThanOrEqual(4)
    expect(Math.abs(lift("population") - tall)).toBeLessThan(20)

    await act(async () => root.unmount())
    host.remove()
  })

  test("the ceiling glides with the data: a tile that keeps its value sinks as a taller one enters", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (data: Record<string, number>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
            <GlobeChart3D
              data={data}
              land={none}
              lon="lon"
              lat="lat"
              value="population"
              step={30}
            />
          </ChartContainer3D>
        )
      )
    // The highest point on screen of the faces of the tile at 15°W.
    const top = () => {
      const ds = [...host.querySelectorAll('[data-slot="chart-3d-marks"] path')]
        .filter((p) => p.getAttribute("fill")!.includes("--color-population"))
        .map((p) => p.getAttribute("d")!)
      return Math.min(
        ...ds.flatMap((d) => [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1])))
      )
    }
    await render([{ lon: -15, lat: 75, population: 10 }])
    await act(() => vi.advanceTimersByTime(700))
    const alone = top()
    await render([
      { lon: -15, lat: 75, population: 10 },
      { lon: 15, lat: -75, population: 100 },
    ])
    await act(() => vi.advanceTimersByTime(300))
    const gliding = top()
    await act(() => vi.advanceTimersByTime(500))
    const settled = top()
    // Lower on screen is a larger y: the tile sinks gradually, never at once.
    expect(gliding).toBeGreaterThan(alone)
    expect(settled).toBeGreaterThan(gliding)

    await act(async () => root.unmount())
    host.remove()
  })

  test("mid-glide a tile tells the value of the data, not the gliding height, and a tile on its way out says nothing", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (data: Record<string, number>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <GlobeChart3D
              data={data}
              land={none}
              lon="lon"
              lat="lat"
              value="population"
              step={30}
            />
          </ChartContainer3D>
        )
      )
    /** Points at the center of the face painted last, the top of the tile. */
    const point = () => {
      const svg = host.querySelector("svg")!
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
      const top = [...svg.querySelectorAll('[data-slot="chart-3d-marks"] path')]
        .filter((p) => p.getAttribute("fill")!.includes("--color-population"))
        .at(-1)!
      const corners = top.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
      )
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }
    const leave = () =>
      act(() =>
        host
          .querySelector("svg")!
          .dispatchEvent(
            new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
          )
      )

    await render([{ lon: 15, lat: 45, population: 10 }])
    await render([{ lon: 15, lat: 45, population: 20 }])
    await act(() => vi.advanceTimersByTime(300))
    await point()
    expect(host.textContent).toMatch(/population\s*20/)
    await leave()

    await render([])
    await act(() => vi.advanceTimersByTime(300))
    await point()
    expect(host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("GlobeChart3D renderer switch", () => {
  test("svg to canvas to webgl, which draws on the canvas, and back repaints each time, without error", async () => {
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

    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (renderer: Renderer3D) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} renderer={renderer}>
            <GlobeChart3D
              data={[{ lon: 15, lat: 45, population: 10 }]}
              land={land}
              lon="lon"
              lat="lat"
              value="population"
              step={30}
            />
          </ChartContainer3D>
        )
      )

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector('svg path[fill^="color-mix"]')).not.toBeNull()

    await render("canvas")
    expect(host.querySelector("canvas")).not.toBeNull()
    expect(host.querySelector('svg path[fill^="color-mix"]')).toBeNull()
    expect(ctx.fill).toHaveBeenCalled()

    const fills = ctx.fill.mock.calls.length
    await render("webgl")
    // "webgl" draws on the same canvas as "canvas".
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(fills)

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector('svg path[fill^="color-mix"]')).not.toBeNull()

    await act(async () => root.unmount())
    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

/** Renders `element` into the document, with an svg of the size of its view box. */
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
  return { host, svg, send, unmount }
}

describe("GlobeChart3D missing values", () => {
  test("an entry whose place is null or empty has no tile, and none rises at 0°, 0°", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[
            { lon: null, lat: null, population: 3 },
            { lon: "", lat: "", population: 3 },
          ]}
          land={{ type: "FeatureCollection", features: [] }}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(0)
  })
})

describe("GlobeChart3D values that are no numbers", () => {
  test("an infinite value stands as 0, as one that is not a number: the globe draws as with 0", () => {
    const html = (population: number) =>
      renderToString(
        <ChartContainer3D config={config}>
          <GlobeChart3D
            data={[
              { lon: 15, lat: 45, population },
              { lon: -15, lat: 15, population: 3 },
            ]}
            land={land}
            lon="lon"
            lat="lat"
            value="population"
            step={30}
          />
        </ChartContainer3D>
      )
    expect(html(Infinity)).toBe(html(0))
  })
})

describe("GlobeChart3D step", () => {
  test("a step that makes no tiles - 0, below 0, NaN, Infinity, wider than 180 - draws the tiles of the default", () => {
    const html = (step?: number) =>
      renderToString(
        <ChartContainer3D config={config}>
          <GlobeChart3D
            data={[{ lon: 15, lat: 45, population: 3 }]}
            land={land}
            lon="lon"
            lat="lat"
            value="population"
            step={step}
          />
        </ChartContainer3D>
      )
    expect(faces(html()).length).toBeGreaterThan(0)
    for (const step of [0, -5, NaN, Infinity, 400]) expect(html(step)).toBe(html())
  })
})

describe("GlobeChart3D while the camera turns", () => {
  test("no tile is read from its id again: the data has not changed", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const data = [
      { lon: 10, lat: 10, v: 1 },
      { lon: 40, lat: -20, v: 2 },
    ]
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <GlobeChart3D data={data} land={land} lon="lon" lat="lat" value="v" />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    const before = host.innerHTML
    const split = vi.spyOn(String.prototype, "split")
    await act(() =>
      svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }))
    )
    // A tile's id is its center and its series: "12.5,12.5,population".
    const read = split.mock.contexts.filter((id) => /^-?[\d.]+,-?[\d.]+,/.test(String(id)))
    split.mockRestore()
    expect(host.innerHTML).not.toBe(before)
    expect(read).toEqual([])
    await act(async () => root.unmount())
    host.remove()
  })
})

describe("GlobeChart3D with a new step", () => {
  test("a tile whose center stays draws at the width of the new step", async () => {
    // At 1° and at 3° alike the tile of 1.5°, 1.5° is centered there, so its id stays.
    const data = [{ lon: 1.5, lat: 1.5, v: 1 }]
    const globeOf = (step: number) => (
      <ChartContainer3D config={config}>
        <GlobeChart3D data={data} land={land} lon="lon" lat="lat" value="v" step={step} />
      </ChartContainer3D>
    )
    const mounted = async (step: number) => {
      const host = document.body.appendChild(document.createElement("div"))
      const root = createRoot(host)
      await act(async () => root.render(globeOf(step)))
      const paths = () => [...host.querySelectorAll("path")].map((p) => p.getAttribute("d"))
      const unmount = async () => {
        await act(async () => root.unmount())
        host.remove()
      }
      return { root, paths, unmount }
    }
    const turned = await mounted(1)
    const narrow = turned.paths()
    await act(async () => turned.root.render(globeOf(3)))
    const fresh = await mounted(3)
    expect(turned.paths()).not.toEqual(narrow)
    expect(turned.paths()).toEqual(fresh.paths())
    await turned.unmount()
    await fresh.unmount()
  })
})

describe("GlobeChart3D while the camera turns, its tiles", () => {
  // Thirty tiles of 5° on the near side of the globe, each entry at the
  // center of its tile. Their corners keep clear of the angles the globe
  // takes the cosine of anyway: the margin of half a tile, 2.5°, and the
  // tilt of the camera, 35°.
  const rows = [12.5, 22.5, 42.5, 52.5, 62.5]
  const data = Array.from({ length: 30 }, (_, i) => ({
    lon: 2.5 + (i % 6) * 10,
    lat: rows[Math.floor(i / 6)],
    v: i + 1,
  }))

  /** Mounts the globe with a reader of its scene, and turns it by a key. */
  async function turning() {
    let scene: { current: Mark3D[] } = { current: [] }
    function Scene() {
      scene = useChart3D().scene
      return null
    }
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <GlobeChart3D data={data} land={land} lon="lon" lat="lat" value="v" />
          <Scene />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    const turn = () =>
      act(() =>
        svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }))
      )
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { scene: () => scene.current, turn, unmount }
  }

  test("keep the tooltip of every tile: none is made again for the turn", async () => {
    const globe = await turning()
    const before = new Map(globe.scene().map((m) => [m.key, m.tooltip]))
    await globe.turn()
    const after = globe.scene().filter((m) => before.get(m.key))
    expect(after.length).toBeGreaterThan(0)
    expect(after.every((m) => m.tooltip === before.get(m.key))).toBe(true)
    await globe.unmount()
  })

  test("stand where they stood: no corner is placed on the globe again for the turn", async () => {
    const globe = await turning()
    // The latitudes of the corners, in radians: half a tile, 2.5°, north and south of each center.
    const corners = new Set(
      data.flatMap((d) => [d.lat - 2.5, d.lat + 2.5]).map((lat) => (lat * Math.PI) / 180)
    )
    const cos = vi.spyOn(Math, "cos")
    await globe.turn()
    const placed = cos.mock.calls.filter(([angle]) => corners.has(angle))
    cos.mockRestore()
    expect(placed).toEqual([])
    await globe.unmount()
  })
})
