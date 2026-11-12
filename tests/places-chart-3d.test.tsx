// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"
import { PlacesChart3D } from "@/registry/new-york/ui/places-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  city: { label: "City", color: "red" },
  capital: { label: "Capital", color: "blue" },
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
const LAND = "var(--chart-3d-land, var(--border))"
const OCEAN = "var(--chart-3d-ocean, var(--muted))"
const literal = (s: string) => s.replace(/[()]/g, "\\$&")
/** The dots of a series in the server HTML: their radii. */
const radii = (html: string, key = "city") =>
  [...html.matchAll(new RegExp(`<circle[^>]*\\br="([^"]+)"[^>]*var\\(--color-${key}\\)`, "g"))].map(
    (m) => Number(m[1])
  )

describe("PlacesChart3D", () => {
  test("draws a dot per place over the land and the ocean, as large as its share of the largest value, hidden on the far side", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: 0 }}>
        <PlacesChart3D
          data={[
            { lon: 15, lat: 15, people: 100 },
            { lon: -15, lat: 15, people: 25 },
            // On the far side of the globe.
            { lon: 170, lat: 0, people: 100 },
          ]}
          land={land}
          lon="lon"
          lat="lat"
          value="people"
          radius={8}
        />
      </ChartContainer3D>
    )
    expect(html.match(new RegExp(`fill="${literal(OCEAN)}"`, "g"))).toHaveLength(1)
    expect(html.match(new RegExp(`fill="${literal(LAND)}"`, "g"))).toHaveLength(1)
    // Area over value: a quarter of the people, half the radius.
    expect(radii(html)).toEqual([8, 4])
    // The land first, the dots over it.
    expect(html.indexOf(LAND)).toBeLessThan(html.indexOf("<circle"))
    expect(html).not.toContain("NaN")
  })

  test("without a value every dot is as large as the radius, and without an entry on the globe there is no dot", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <PlacesChart3D
          data={[
            { lon: 15, lat: 15 },
            { lon: 15, lat: 45 },
            { lon: "n/a", lat: 45 },
          ]}
          land={none}
          lon="lon"
          lat="lat"
        />
      </ChartContainer3D>
    )
    expect(radii(html)).toEqual([6, 6])
    expect(html).not.toContain("NaN")
  })

  test("series names the config key of the color of each dot; a value that is not a number stands as 0", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <PlacesChart3D
          data={[
            { lon: 15, lat: 15, people: 10, kind: "capital" },
            { lon: 15, lat: 45, people: "n/a", kind: "city" },
          ]}
          land={none}
          lon="lon"
          lat="lat"
          value="people"
          series="kind"
        />
      </ChartContainer3D>
    )
    expect(radii(html, "capital")).toEqual([6])
    expect(radii(html, "city")).toEqual([0])
  })

  test("places of no value at all draw dots of no size, not NaN", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <PlacesChart3D
          data={[{ lon: 15, lat: 15, people: 0 }]}
          land={none}
          lon="lon"
          lat="lat"
          value="people"
        />
      </ChartContainer3D>
    )
    expect(radii(html)).toEqual([0])
    expect(html).not.toContain("NaN")
  })

  test("the land and the dots share the camera: a dot lies on the corner of the square of land below it, turned and tilted", () => {
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0.7, tilt: 0.4 }}>
        <PlacesChart3D data={[{ lon: 30, lat: 30 }]} land={land} lon="lon" lat="lat" />
      </ChartContainer3D>
    )
    const [, cx, cy] = html.match(/<circle[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"/)!
    const ring = [
      ...html.matchAll(new RegExp(` d="M([^"]+)Z" fill="${literal(LAND)}`, "g")),
    ].flatMap((m) => m[1].split("L").map((c) => c.split(",").map(Number)))
    expect(ring.length).toBeGreaterThan(4)
    expect(
      Math.min(...ring.map(([x, y]) => Math.hypot(x - Number(cx), y - Number(cy))))
    ).toBeLessThan(0.02)
  })
})

describe("PlacesChart3D hover", () => {
  const edge = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const data = [
    { lon: 15, lat: 15, people: 100, name: "Rome", kind: "capital" },
    { lon: 15, lat: 45, people: 50, name: "Oslo", kind: "city" },
  ]
  /** The dot of a series, as an element, and its center. */
  function dot(svg: SVGSVGElement, key: string) {
    const circle = [...svg.querySelectorAll("circle")].find((c) =>
      c.getAttribute("fill")!.includes(`var(--color-${key})`)
    )!
    return { circle, x: Number(circle.getAttribute("cx")), y: Number(circle.getAttribute("cy")) }
  }

  test("a dot under the pointer is named in the tooltip, over its value formatted and its place", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <PlacesChart3D
          data={data}
          land={land}
          lon="lon"
          lat="lat"
          value="people"
          series="kind"
          id="name"
          format={(v) => `${v} people`}
        />
      </ChartContainer3D>
    )
    const { x, y } = dot(chart.svg, "capital")
    await chart.send("pointermove", { clientX: x, clientY: y })
    const text = chart.host.textContent!
    expect(text).toContain("Rome")
    expect(text).not.toContain("Capital")
    expect(text).toContain("100 people")
    expect(text).toMatch(/lat\s*15/)
    expect(text).toMatch(/lon\s*15/)
    await chart.unmount()
  })

  test("without id the tooltip is titled by the series and shows the place alone without a value; hovering edges the dot, never the land, and leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <PlacesChart3D data={data} land={land} lon="lon" lat="lat" series="kind" />
      </ChartContainer3D>
    )
    const marks = () => [...chart.svg.querySelectorAll('[data-slot="chart-3d-marks"] *')]
    const edged = () =>
      marks().filter((m) => m.getAttribute("stroke") === edge(m.getAttribute("fill")!))
    const { circle, x, y } = dot(chart.svg, "city")
    const before = marks().map((m) => m.getAttribute("fill"))

    await chart.send("pointermove", { clientX: x, clientY: y })
    const text = chart.host.textContent!
    expect(text).toContain("City")
    expect(text).not.toContain("Oslo")
    expect(text).not.toContain("people")
    expect(text).toMatch(/lat\s*45/)
    expect(edged()).toEqual([circle])
    expect(marks().map((m) => m.getAttribute("fill"))).toEqual(before)

    await chart.send("pointerout", { relatedTarget: document.body })
    expect(edged()).toHaveLength(0)
    expect(chart.host.textContent).not.toContain("City")
    await chart.unmount()
  })
})

describe("PlacesChart3D labels", () => {
  test("a series without a config entry is named by its key", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <PlacesChart3D
          data={[{ lon: 15, lat: 15, kind: "town" }]}
          land={none}
          lon="lon"
          lat="lat"
          series="kind"
        />
      </ChartContainer3D>
    )
    const circle = chart.svg.querySelector("circle")!
    await chart.send("pointermove", {
      clientX: Number(circle.getAttribute("cx")),
      clientY: Number(circle.getAttribute("cy")),
    })
    expect(chart.host.textContent).toContain("town")
    await chart.unmount()
  })
})

describe("PlacesChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("a new dot grows from nothing as it fades in, a gone one shrinks as it fades out, then leaves", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (data: Record<string, unknown>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <PlacesChart3D data={data} land={none} lon="lon" lat="lat" value="people" id="name" />
          </ChartContainer3D>
        )
      )
    const dots = () => [...host.querySelectorAll('[data-slot="chart-3d-marks"] circle')]
    const r = () => Number(dots()[0].getAttribute("r"))
    const transparent = () => dots().filter((c) => c.getAttribute("fill")!.includes("transparent"))

    await render([{ lon: 15, lat: 15, people: 100, name: "Rome" }])
    await act(() => vi.advanceTimersByTime(700))
    expect(dots()).toHaveLength(1)
    expect(r()).toBe(6)
    expect(transparent()).toHaveLength(0)

    // Rome goes, Oslo comes.
    await render([{ lon: 15, lat: 45, people: 100, name: "Oslo" }])
    await act(() => vi.advanceTimersByTime(300))
    // Mid-glide both are there, faded: the gone one shrinking, the new one growing.
    expect(dots()).toHaveLength(2)
    expect(transparent()).toHaveLength(2)
    const mid = dots().map((c) => Number(c.getAttribute("r")))
    expect(mid.every((v) => v > 0 && v < 6)).toBe(true)
    await act(() => vi.advanceTimersByTime(500))
    // Done: one dot, opaque, full size.
    expect(dots()).toHaveLength(1)
    expect(transparent()).toHaveLength(0)
    expect(r()).toBe(6)

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("PlacesChart3D renderer switch", () => {
  test("svg to canvas to webgl and back repaints each time, without error", async () => {
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
      getParameter: vi.fn(() => null),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      DEPTH_TEST: 1,
      BLEND: 2,
      SRC_ALPHA: 3,
      ONE_MINUS_SRC_ALPHA: 4,
      ARRAY_BUFFER: 5,
      DYNAMIC_DRAW: 6,
      FLOAT: 7,
      TRIANGLES: 8,
      VERTEX_SHADER: 9,
      FRAGMENT_SHADER: 10,
    }
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
      return (type === "webgl" ? gl : ctx) as never
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
            <PlacesChart3D
              data={[{ lon: 15, lat: 15, people: 10 }]}
              land={land}
              lon="lon"
              lat="lat"
              value="people"
            />
          </ChartContainer3D>
        )
      )

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector("svg circle")).not.toBeNull()

    await render("canvas")
    expect(host.querySelector("canvas")).not.toBeNull()
    expect(host.querySelector("svg circle")).toBeNull()
    expect(ctx.arc).toHaveBeenCalled()

    await render("webgl")
    expect(gl.drawArrays).toHaveBeenCalled()

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector("svg circle")).not.toBeNull()

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
