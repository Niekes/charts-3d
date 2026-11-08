// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D } from "@/registry/new-york/ui/chart-3d"
import { ScatterChart3D } from "@/registry/new-york/ui/scatter-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { color: "red" }, b: { color: "blue" } }

describe("ScatterChart3D", () => {
  test("draws a circle per entry in the color of its series", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <ScatterChart3D
          data={[
            { x: 0, y: 0, z: 0, s: "a" },
            { x: 1, y: 2, z: 3, s: "b" },
          ]}
          x="x"
          y="y"
          z="z"
          series="s"
        />
      </ChartContainer3D>
    )
    expect(html.match(/<circle /g)).toHaveLength(2)
    expect(html).toContain('fill="var(--color-a)"')
    expect(html).toContain('fill="var(--color-b)"')
  })

  test("a single point, an extent of zero width, stays a number", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <ScatterChart3D data={[{ x: 1, y: 1, z: 1 }]} x="x" y="y" z="z" />
      </ChartContainer3D>
    )
    expect(html).toContain('fill="var(--color-a)"')
    expect(html).not.toContain("NaN")
  })

  test("the tooltip of a point shows its values rounded", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <ScatterChart3D data={[{ x: 1 / 3, y: 2, z: 3 }]} x="x" y="y" z="z" />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const point = host.querySelector("circle")!
    const [clientX, clientY] = ["cx", "cy"].map((a) => Number(point.getAttribute(a)))
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    )
    expect(host.textContent).toContain((1 / 3).toLocaleString())
    expect(host.textContent).not.toContain("0.3333333")

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("ScatterChart3D tooltip", () => {
  const tip = (host: HTMLElement) =>
    host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""
  const data = [{ id: "p", x: 1, y: 2, z: 3, kind: "b" }]

  /** Mounts `element` and puts the pointer on its first point. */
  async function hovered(element: ReactElement) {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () => root.render(element))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const point = host.querySelector("circle")!
    const [clientX, clientY] = ["cx", "cy"].map((a) => Number(point.getAttribute(a)))
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    )
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { host, unmount }
  }

  test("tooltip makes what a point says from the default and the entry behind it", async () => {
    const seen: { entry: (typeof data)[number] }[] = []
    const titles: unknown[] = []
    const view = await hovered(
      <ChartContainer3D config={{ ...config, b: { label: "B", color: "blue" } }}>
        <ScatterChart3D
          data={data}
          id="id"
          x="x"
          y="y"
          z="z"
          series="kind"
          tooltip={(tip, point) => {
            seen.push(point)
            titles.push(tip.title)
            return { ...tip, title: point.entry.id, items: tip.items.slice(0, 1) }
          }}
        />
      </ChartContainer3D>
    )
    expect(seen).toEqual([{ entry: data[0] }])
    // The default names the series, where one does.
    expect(titles).toEqual(["B"])
    expect(tip(view.host)).toBe("px1")
    await view.unmount()
  })

  test("a tooltip of null shows none", async () => {
    const view = await hovered(
      <ChartContainer3D config={config}>
        <ScatterChart3D data={data} x="x" y="y" z="z" tooltip={() => null} />
      </ChartContainer3D>
    )
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })

  test("the tooltip names the values of a point as the ticks of each axis do, through format", async () => {
    const view = await hovered(
      <ChartContainer3D config={config}>
        <ScatterChart3D
          data={data}
          x="x"
          y="y"
          z="z"
          titles={{ y: "height" }}
          format={{ x: (v) => `x=${v}`, y: (v) => `${v}m`, z: (v) => `z${v}` }}
        />
      </ChartContainer3D>
    )
    expect(tip(view.host)).toBe("xx=1height2mzz3")
    await view.unmount()
  })
})

describe("ScatterChart3D transitions", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
  )
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("new data glides in over the animationDuration of the container", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: { x: number; y: number; z: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <ScatterChart3D data={data} x="x" y="y" z="z" />
          </ChartContainer3D>
        )
      )

    await render([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 10, z: 10 },
    ])
    await render([
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 20, z: 20 },
    ])
    // The opacity of every axis label with `text`: out-of-range ticks stay mounted but faded out.
    const opacities = (text: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')]
        .filter((t) => t.textContent === text)
        .map((t) => (t as SVGTextElement).style.opacity)
    // Mid-glide, 20 is outside the gliding ends: present, but faded out.
    expect(opacities("20").length).toBeGreaterThan(0)
    expect(opacities("20").every((o) => o === "0")).toBe(true)
    await act(() => vi.advanceTimersByTime(700))
    expect(opacities("20").some((o) => o === "1")).toBe(true)

    await act(async () => root.unmount())
    host.remove()
  })

  test("keyed by id, a new point grows from nothing and a gone one shrinks away", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: { id: string; x: number; y: number; z: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <ScatterChart3D data={data} id="id" x="x" y="y" z="z" />
          </ChartContainer3D>
        )
      )
    const radii = () => [...host.querySelectorAll("circle")].map((c) => Number(c.getAttribute("r")))

    const p = { id: "p", x: 0, y: 0, z: 0 }
    const q = { id: "q", x: 10, y: 10, z: 10 }
    await render([p, q])
    await act(() => vi.advanceTimersByTime(700))
    expect(radii()).toEqual([4, 4])

    // q leaves: its point stays through the glide, shrinking to nothing - in
    // place, frozen in the box, not riding the rescaling axes out of it.
    const gone = () =>
      [...host.querySelectorAll("circle")].find((c) => Number(c.getAttribute("r")) < 4)
    await render([p])
    expect(radii()).toEqual([4, 4])
    await act(() => vi.advanceTimersByTime(300))
    const shrinking = gone()!
    expect(Number(shrinking.getAttribute("r"))).toBeGreaterThan(0)
    // It fades as it shrinks, its ring with it; the point that stays is opaque.
    expect(shrinking.getAttribute("fill")).toMatch(/^color-mix\(in oklab, var\(--color-a\) \d+%/)
    expect(shrinking.getAttribute("stroke")).toMatch(/^color-mix\(in oklab, var\(--background\)/)
    expect(host.querySelectorAll('circle[fill="var(--color-a)"]')).toHaveLength(1)
    const at = [shrinking.getAttribute("cx"), shrinking.getAttribute("cy")]
    await act(() => vi.advanceTimersByTime(150))
    expect([gone()!.getAttribute("cx"), gone()!.getAttribute("cy")]).toEqual(at)
    await act(() => vi.advanceTimersByTime(250))
    expect(radii()).toEqual([4])

    // A new point grows from nothing, at its place.
    await render([p, { id: "r", x: 5, y: 5, z: 5 }])
    expect(radii().filter((r) => r === 0)).toHaveLength(1)
    await act(() => vi.advanceTimersByTime(300))
    expect(radii().filter((r) => r > 0 && r < 4)).toHaveLength(1)
    await act(() => vi.advanceTimersByTime(400))
    expect(radii()).toEqual([4, 4])

    await act(async () => root.unmount())
    host.remove()
  })
  test("a point whose entry has left the data says nothing on hover; the others still do", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: { id: string; x: number; y: number; z: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <ScatterChart3D data={data} id="id" x="x" y="y" z="z" />
          </ChartContainer3D>
        )
      )
    const p = { id: "p", x: 0, y: 0, z: 0 }
    const q = { id: "q", x: 10, y: 10, z: 10 }
    await render([p, q])
    await act(() => vi.advanceTimersByTime(700))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const hover = (circle: Element) => {
      const [clientX, clientY] = ["cx", "cy"].map((a) => Number(circle.getAttribute(a)))
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }
    const tip = () => host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""

    // q leaves: mid-glide its point still shrinks away, and says nothing.
    await render([p])
    await act(() => vi.advanceTimersByTime(300))
    const circles = [...host.querySelectorAll("circle")]
    const gone = circles.find((c) => Number(c.getAttribute("r")) < 4)!
    expect(gone).toBeDefined()
    await hover(gone)
    expect(tip()).toBe("")
    await hover(circles.find((c) => c !== gone)!)
    expect(tip()).toBe("x0y0z0")

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("ScatterChart3D focus", () => {
  const edge = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`

  test("hovering a point highlights that point alone with an edge; the fill never changes; leaving clears it", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <ScatterChart3D
            data={[
              { x: 1, y: 1, z: 1, cluster: "a" },
              { x: 2, y: 2, z: 2, cluster: "b" },
              { x: 3, y: 3, z: 3, cluster: "a" },
            ]}
            x="x"
            y="y"
            z="z"
            series="cluster"
          />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const circles = () => [...svg.querySelectorAll("circle")]
    const fills = () => circles().map((c) => c.getAttribute("fill")!)
    const edged = () =>
      circles().filter((c) => c.getAttribute("stroke") === edge(c.getAttribute("fill")!))
    const move = (clientX: number, clientY: number) =>
      act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    const point = circles().find((c) => c.getAttribute("fill") === "var(--color-a)")!
    const [clientX, clientY] = ["cx", "cy"].map((a) => Number(point.getAttribute(a)))
    const before = fills()

    await move(clientX, clientY)
    // The single point alone gets the edge - not its series - and no fill changes.
    expect(edged()).toHaveLength(1)
    expect(fills()).toEqual(before)

    // Off the point, still inside the chart: no edge.
    await move(5, 5)
    expect(edged()).toHaveLength(0)

    // Hover again, then leave the chart.
    await move(clientX, clientY)
    expect(edged()).toHaveLength(1)
    await act(() =>
      svg.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
      )
    )
    expect(edged()).toHaveLength(0)

    await act(async () => root.unmount())
    host.remove()
  })
})
