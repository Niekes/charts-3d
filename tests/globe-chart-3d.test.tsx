// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type Renderer3D } from "@/registry/new-york/ui/chart-3d"
import { GlobeChart3D } from "@/registry/new-york/ui/globe-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  population: { label: "Population", color: "red" },
  quake: { label: "Earthquake", color: "blue" },
}
/** The flat tiles of the globe, in the wall color. */
const tiles = (html: string) => html.match(/fill="color-mix\(in oklch, var\(--muted\)/g) ?? []
/** The faces of the tiles that rise, in the color of their series. */
const faces = (html: string, key = "population") =>
  html.match(new RegExp(`fill="[^"]*var\\(--color-${key}\\)`, "g")) ?? []

describe("GlobeChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the tiles of the grid that face the camera, flat in the wall color", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D data={[]} lon="lon" lat="lat" value="population" step={30} />
      </ChartContainer3D>
    )
    // 12 × 6 tiles of 30°, about half of them turned to the camera.
    expect(tiles(html).length).toBeGreaterThanOrEqual(30)
    expect(tiles(html).length).toBeLessThanOrEqual(42)
    expect(faces(html)).toHaveLength(0)
    expect(html).not.toContain("NaN")
  })

  test("the tile that holds an entry rises: its top and the sides that face the camera, in the series color", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[{ lon: 15, lat: 45, population: 10 }]}
          lon="lon"
          lat="lat"
          value="population"
          step={30}
        />
      </ChartContainer3D>
    )
    // The top and one to three sides of the prism; the flat tile stays beneath it.
    expect(faces(html).length).toBeGreaterThanOrEqual(2)
    expect(faces(html).length).toBeLessThanOrEqual(4)
    expect(tiles(html).length).toBeGreaterThanOrEqual(30)
    expect(html).toContain("color-mix(in oklch, var(--color-population)")
    expect(html).not.toContain("NaN")
  })
})

describe("GlobeChart3D paint order", () => {
  test("tiles of the same depth paint in grid order, west before east, so the server and the client agree", () => {
    // Level with the prime meridian, every tile has a mirror image at the same
    // depth. Node and the browser round sine and cosine differently in the
    // last bit, so a depth-only sort paints such a pair in either order and
    // the hydration of the server HTML fails: the grid order has to decide.
    const html = renderToString(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
        <GlobeChart3D data={[]} lon="lon" lat="lat" value="population" step={10} />
      </ChartContainer3D>
    )
    const paths = [...html.matchAll(/ d="M([^"]+)Z"/g)].map((m) => m[1].split("L"))
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
    expect(pairs.length).toBeGreaterThan(100)
    expect(pairs.filter(([west, east]) => west > east)).toHaveLength(0)
  })
})

describe("GlobeChart3D props", () => {
  const html = (data: Record<string, unknown>[], props: Record<string, unknown> = {}) =>
    renderToString(
      <ChartContainer3D config={config}>
        <GlobeChart3D data={data} lon="lon" lat="lat" value="n" step={30} {...props} />
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
  const edge = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const data = [{ lon: 15, lat: 45, population: 10 }]

  /** The faces of the tile that rises, as elements, and the center of the one painted last. */
  function prism(svg: SVGSVGElement) {
    const faces = [...svg.querySelectorAll("path")].filter((p) =>
      p.getAttribute("fill")!.includes("var(--color-population)")
    )
    const corners = faces.at(-1)!.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )
    return { faces, x, y }
  }

  test("a tile under the pointer names its series, its value and its center in the tooltip, the value formatted", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={data}
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

  test("hovering a tile highlights its faces together with an edge, never a flat tile; the fill never changes; leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D data={data} lon="lon" lat="lat" value="population" step={30} />
      </ChartContainer3D>
    )
    const paths = () => [...chart.svg.querySelectorAll('[data-slot="chart-3d-marks"] path')]
    const edged = () =>
      paths().filter((p) => p.getAttribute("stroke") === edge(p.getAttribute("fill")!))
    const { faces, x, y } = prism(chart.svg)
    const before = paths().map((p) => p.getAttribute("fill"))

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(edged()).toHaveLength(faces.length)
    expect(edged().every((p) => p.getAttribute("fill")!.includes("--color-population"))).toBe(true)
    expect(paths().map((p) => p.getAttribute("fill"))).toEqual(before)

    // Off the globe, still inside the chart: no edge.
    await chart.send("pointermove", { clientX: 5, clientY: 5 })
    expect(edged()).toHaveLength(0)

    await chart.send("pointermove", { clientX: x, clientY: y })
    expect(edged()).toHaveLength(faces.length)
    await chart.send("pointerout", { relatedTarget: document.body })
    expect(edged()).toHaveLength(0)
    await chart.unmount()
  })
})

describe("GlobeChart3D labels", () => {
  test("a series without a config entry is named by its key", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <GlobeChart3D
          data={[{ lon: 15, lat: 45, n: 3, type: "wildfire" }]}
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
            <GlobeChart3D data={data} lon="lon" lat="lat" value="population" step={30} />
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
            <GlobeChart3D data={data} lon="lon" lat="lat" value="population" step={30} />
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
})

describe("GlobeChart3D renderer switch", () => {
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
            <GlobeChart3D
              data={[{ lon: 15, lat: 45, population: 10 }]}
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

    await render("webgl")
    expect(gl.drawArrays).toHaveBeenCalled()

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
