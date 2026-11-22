// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"
import { ChoroplethChart3D } from "@/registry/new-york/ui/choropleth-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  population: { label: "Population", color: "red" },
  quake: { label: "Earthquake", color: "blue" },
}
/** A square of land, `size` degrees wide, from its south-west corner, wound clockwise as d3-geo reads a region, named `id`. */
const square = (id: string | undefined, lon: number, lat: number, size = 30): GeoJSON.Feature => ({
  type: "Feature",
  id,
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
/** Two squares of land in front of the default camera: `a` on the equator east of the prime meridian, `b` west of it. */
const land: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [square("a", 0, 0), square("b", -40, 0)],
}
const LAND = "var(--chart-3d-land, var(--border))"
const OCEAN = "var(--chart-3d-ocean, var(--muted))"
const literal = (s: string) => s.replace(/[()]/g, "\\$&")
const landOf = (html: string) => html.match(new RegExp(`fill="${literal(LAND)}"`, "g")) ?? []
const oceanOf = (html: string) => html.match(new RegExp(`fill="${literal(OCEAN)}"`, "g")) ?? []
/** The rings of the regions with an entry, in the color of their series. */
const regions = (html: string, key = "population") =>
  html.match(new RegExp(`fill="[^"]*var\\(--color-${key}\\)`, "g")) ?? []

// South Africa around Lesotho, in the middle of the view at yaw and tilt 0: the hole is the enclave, wound the other way.
const [outer, enclave] = [square("za", -20, -20, 40), square("ls", -5, -5, 10)]
const around: GeoJSON.Feature = {
  ...outer,
  geometry: {
    type: "Polygon",
    coordinates: [
      (outer.geometry as GeoJSON.Polygon).coordinates[0],
      [...(enclave.geometry as GeoJSON.Polygon).coordinates[0]].reverse(),
    ],
  },
}

describe("ChoroplethChart3D", () => {
  test("a region under an opaque color is drawn once: its land ring is left out, the other regions keep theirs", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[{ region: "a", n: 5 }]}
          land={{ type: "FeatureCollection", features: [square("a", 0, 0), square("b", -45, 0)] }}
          id="region"
          value="n"
        />
      </ChartContainer3D>
    )
    expect(oceanOf(html)).toHaveLength(1)
    expect(landOf(html)).toHaveLength(1)
    expect(regions(html).length).toBeGreaterThanOrEqual(1)
  })

  test('a numeric code names its region whatever its leading zeros: 40 and "040" are one region, "0" stays "0"', () => {
    const html = (data: Record<string, unknown>[]) =>
      renderToString(
        <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
          <ChoroplethChart3D
            data={data}
            land={{
              type: "FeatureCollection",
              features: [square("040", 0, 0), square("0", -45, 0)],
            }}
            id="code"
            value="n"
          />
        </ChartContainer3D>
      )
    expect(regions(html([{ code: 40 }]))).toHaveLength(1)
    expect(regions(html([{ code: "0040" }]))).toHaveLength(1)
    expect(regions(html([{ code: 0 }]))).toHaveLength(1)
    expect(regions(html([{ code: 4 }]))).toHaveLength(0)
  })

  test("a region of several features, a mainland and its island, colors every one of them", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[{ region: "a", n: 5 }]}
          land={{
            type: "FeatureCollection",
            features: [square("a", 0, 0), square("a", -45, 0, 10)],
          }}
          id="region"
          value="n"
        />
      </ChartContainer3D>
    )
    // Both parts are left out of the land, and both are colored.
    expect(landOf(html)).toHaveLength(0)
    expect(regions(html)).toHaveLength(2)
  })

  test("draws the land on the ocean, then the region of an entry in its series color, cut at the horizon; an unknown or far region draws nothing", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[
            { code: "a", n: 5 },
            // Across the horizon, on the far side, unknown to the land, and the id of a feature without one.
            { code: "c", n: 1 },
            { code: "d", n: 2 },
            { code: "zz", n: 3 },
            { code: "undefined", n: 4 },
          ]}
          land={{
            type: "FeatureCollection",
            features: [
              ...land.features,
              square("c", 75, 0),
              square("d", 150, 0),
              square(undefined, 0, 40),
            ],
          }}
          id="code"
          value="n"
        />
      </ChartContainer3D>
    )
    // Four squares in front, the one across the horizon cut to its near half;
    // the two with a color draw no land ring of their own, so b and the one
    // without an id remain.
    expect(landOf(html)).toHaveLength(2)
    expect(oceanOf(html)).toHaveLength(1)
    // The regions a and c, over the land without an id, which lies under every region.
    expect(regions(html)).toHaveLength(2)
    expect(html.indexOf(LAND)).toBeLessThan(html.indexOf("var(--color-population)"))
    expect(html).not.toContain("NaN")
  })

  test("series names the config key of the color, and the last entry on a region wins", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D
          data={[
            { code: "a", n: 1, type: "quake" },
            { code: "a", n: 2, type: "population" },
            { code: "b", n: 3, type: "quake" },
          ]}
          land={land}
          id="code"
          value="n"
          series="type"
        />
      </ChartContainer3D>
    )
    expect(regions(html, "population")).toHaveLength(1)
    expect(regions(html, "quake")).toHaveLength(1)
  })

  test("a region inside another is painted after it, whatever the order of the data, and the hole it lies in is not filled", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[
            { code: "ls", n: 1, type: "quake" },
            { code: "za", n: 2, type: "population" },
          ]}
          land={{ type: "FeatureCollection", features: [enclave, around] }}
          id="code"
          value="n"
          series="type"
        />
      </ChartContainer3D>
    )
    expect(regions(html, "population")).toHaveLength(1)
    expect(regions(html, "quake")).toHaveLength(1)
    expect(html.indexOf("var(--color-population)")).toBeLessThan(html.indexOf("var(--color-quake)"))

    // Without an entry of its own, the enclave's land lies over the region around it, where the pointer finds it.
    const alone = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[{ code: "za", n: 2 }]}
          land={{ type: "FeatureCollection", features: [enclave, around] }}
          id="code"
          value="n"
        />
      </ChartContainer3D>
    )
    expect(landOf(alone)).toHaveLength(1)
    expect(alone.indexOf("var(--color-population)")).toBeLessThan(alone.indexOf(`fill="${LAND}"`))
  })
})

describe("ChoroplethChart3D hover", () => {
  const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")

  /** The rings of the region in `key`, as elements, and the center of the first on screen. */
  function region(svg: SVGSVGElement, key = "population") {
    const rings = [...svg.querySelectorAll('[data-slot="chart-3d-marks"] path')].filter((p) =>
      p.getAttribute("fill")!.includes(`var(--color-${key})`)
    )
    const corners = rings[0].getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
    return { rings, x, y }
  }

  test("a region inside another without an entry says nothing, where it named the region around it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[{ code: "za", n: 2, name: "South Africa" }]}
          land={{ type: "FeatureCollection", features: [enclave, around] }}
          id="code"
          value="n"
          label="name"
        />
      </ChartContainer3D>
    )
    // Lesotho, in the middle of the view box.
    await chart.send("pointermove", { clientX: 320, clientY: 200 })
    expect(chart.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    // South Africa around it still says itself: 12° east, between the two borders.
    await chart.send("pointermove", { clientX: 350, clientY: 200 })
    expect(chart.host.textContent).toContain("South Africa")
    await chart.unmount()
  })

  test("a region under the pointer names its series and its value, formatted; label names it after its entry instead; a value that is not a number is missing, not 0", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D
          data={[
            { code: "a", n: 5 },
            { code: "b", n: "n/a", name: "Beta" },
          ]}
          land={land}
          id="code"
          value="n"
          format={{ value: (v) => `${v} people` }}
        />
      </ChartContainer3D>
    )
    const a = region(chart.svg)
    await chart.send("pointermove", { clientX: a.x, clientY: a.y })
    expect(chart.host.textContent).toContain("Population")
    expect(chart.host.textContent).toContain("5 people")
    await chart.unmount()

    const named = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D
          data={[{ code: "a", n: "n/a", name: "Alpha", type: "mystery" }]}
          land={land}
          id="code"
          value="n"
          series="type"
          label="name"
        />
      </ChartContainer3D>
    )
    const alpha = region(named.svg, "mystery")
    await named.send("pointermove", { clientX: alpha.x, clientY: alpha.y })
    expect(named.host.textContent).toContain("Alpha")
    const tip = named.host.querySelector('[data-slot="chart-3d-tooltip"]')!
    expect(tip.textContent).toBe("Alpha")
    await named.unmount()
  })

  test.each([undefined, null])(
    "a region whose label is %s is titled by its series, not by the word",
    async (name) => {
      const chart = await mount(
        <ChartContainer3D config={config}>
          <ChoroplethChart3D
            data={[{ code: "a", n: 5, name }]}
            land={land}
            id="code"
            value="n"
            label="name"
          />
        </ChartContainer3D>
      )
      const a = region(chart.svg)
      await chart.send("pointermove", { clientX: a.x, clientY: a.y })
      const tip = chart.host.querySelector('[data-slot="chart-3d-tooltip"]')!.textContent!
      expect(tip).toContain("Population")
      expect(tip).not.toContain(String(name))
      await chart.unmount()
    }
  )

  test("a series without a config entry is named by its key", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D
          data={[{ code: "a", n: 1, type: "mystery" }]}
          land={land}
          id="code"
          value="n"
          series="type"
        />
      </ChartContainer3D>
    )
    const { x, y } = region(chart.svg, "mystery")
    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(chart.host.textContent).toContain("mystery")
    await chart.unmount()
  })

  test("hovering a region lights its rings, never the land, which says nothing; nothing else changes; leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D data={[{ code: "a", n: 5 }]} land={land} id="code" value="n" />
      </ChartContainer3D>
    )
    const paths = () => [...chart.svg.querySelectorAll('[data-slot="chart-3d-marks"] path')]
    const litOnes = () => paths().filter((p) => isLit(p.getAttribute("fill")!))
    const { rings, x, y } = region(chart.svg)
    const before = paths().map((p) => p.getAttribute("fill"))

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(litOnes()).toHaveLength(rings.length)
    expect(litOnes().every((p) => p.getAttribute("fill")!.includes("--color-population"))).toBe(
      true
    )
    const after = paths().map((p) => p.getAttribute("fill")!)
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f!) : f)))

    // On the land of b, which has no entry - the only land ring left, since
    // a is drawn in its color alone: the earth itself says nothing.
    const b = [...chart.svg.querySelectorAll("path")].filter(
      (p) => p.getAttribute("fill") === LAND
    )[0]
    const corners = b.getAttribute("d")!.slice(1, -1).split("L")
    const [bx, by] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
    await chart.send("pointermove", { clientX: bx, clientY: by })
    expect(litOnes()).toHaveLength(0)
    expect(chart.host.textContent).not.toContain("Population")

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(litOnes()).toHaveLength(rings.length)
    await chart.send("pointerout", { relatedTarget: document.body })
    expect(litOnes()).toHaveLength(0)
    expect(chart.host.textContent).not.toContain("Population")
    await chart.unmount()
  })

  test("tooltip makes what a region says of what it would say and the entry behind it, and null says nothing", async () => {
    const data = [{ code: "a", n: 5, capital: "Alpha City" }]
    const chart = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D
          data={data}
          land={land}
          id="code"
          value="n"
          tooltip={(tip, { entry }) => ({ ...tip, title: entry.capital })}
        />
      </ChartContainer3D>
    )
    const a = region(chart.svg)
    await chart.send("pointermove", { clientX: a.x, clientY: a.y })
    // The items stay what the region would say.
    expect(chart.host.textContent).toContain("Alpha City")
    expect(chart.host.textContent).toMatch(/n\s*5/)
    await chart.unmount()

    const silent = await mount(
      <ChartContainer3D config={config}>
        <ChoroplethChart3D data={data} land={land} id="code" value="n" tooltip={() => null} />
      </ChartContainer3D>
    )
    const at = region(silent.svg)
    await silent.send("pointermove", { clientX: at.x, clientY: at.y })
    expect(silent.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await silent.unmount()
  })
})

describe("ChoroplethChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("a new region fades in, a gone one fades out and leaves, and one that changes series leaves as one and enters as the other", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (data: Record<string, unknown>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <ChoroplethChart3D data={data} land={land} id="code" value="n" series="type" />
          </ChartContainer3D>
        )
      )
    const rings = (key: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-marks"] path')].filter((p) =>
        p.getAttribute("fill")!.includes(`--color-${key}`)
      )
    const faded = (key: string) =>
      rings(key).filter((p) => p.getAttribute("fill")!.includes("transparent"))

    // On mount the data stands as it is: nothing enters.
    await render([{ code: "a", n: 1, type: "population" }])
    await act(() => vi.advanceTimersByTime(700))
    expect(rings("population")).toHaveLength(1)
    expect(faded("population")).toHaveLength(0)

    // b arrives as a goes: mid-glide both are there, both faded.
    await render([{ code: "b", n: 1, type: "population" }])
    await act(() => vi.advanceTimersByTime(300))
    expect(rings("population")).toHaveLength(2)
    expect(faded("population")).toHaveLength(2)
    await act(() => vi.advanceTimersByTime(500))
    expect(rings("population")).toHaveLength(1)
    expect(faded("population")).toHaveLength(0)

    // b changes its series: it leaves as population and enters as quake.
    await render([{ code: "b", n: 1, type: "quake" }])
    await act(() => vi.advanceTimersByTime(300))
    expect(faded("population")).toHaveLength(1)
    expect(faded("quake")).toHaveLength(1)
    await act(() => vi.advanceTimersByTime(500))
    expect(rings("population")).toHaveLength(0)
    expect(rings("quake")).toHaveLength(1)
    expect(faded("quake")).toHaveLength(0)

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("ChoroplethChart3D renderer switch", () => {
  test("svg to canvas and back repaints each time, without error", async () => {
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

    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (renderer: Renderer3D) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} renderer={renderer}>
            <ChoroplethChart3D data={[{ code: "a", n: 5 }]} land={land} id="code" value="n" />
          </ChartContainer3D>
        )
      )

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector('svg path[fill*="--color-population"]')).not.toBeNull()

    await render("canvas")
    expect(host.querySelector("canvas")).not.toBeNull()
    expect(host.querySelector('svg path[fill*="--color-population"]')).toBeNull()
    expect(ctx.fill).toHaveBeenCalled()

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector('svg path[fill*="--color-population"]')).not.toBeNull()

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

describe("a missing series", () => {
  test("a region whose entry has no series takes the first color of the config, over its land", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <ChoroplethChart3D
          data={[
            { code: "a", n: 1, type: "quake" },
            { code: "b", n: 3 },
          ]}
          land={land}
          id="code"
          value="n"
          series="type"
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("--color-undefined")
    expect(regions(html, "population")).toHaveLength(1)
    expect(regions(html, "quake")).toHaveLength(1)
  })
})
