// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, test } from "vite-plus/test"

import {
  ChartContainer3D,
  ChartLegend3D,
  axis,
  center,
  linear,
  shade,
  useChart3D,
  worldBox,
} from "@/registry/new-york/ui/chart-3d"

// React reports state updates outside act() unless the environment says it supports it.
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const point = (x: number, y: number, z: number) => ({
  x,
  y,
  z,
  rotated: { x, y, z },
  projected: { x, y },
})

describe("ChartContainer3D", () => {
  test("writes a color variable per config key, for each theme", () => {
    const html = renderToString(
      <ChartContainer3D
        id="t"
        config={{ a: { color: "red" }, b: { theme: { light: "white", dark: "black" } } }}
      >
        {null}
      </ChartContainer3D>
    )
    expect(html).toContain("[data-chart=chart-t]")
    expect(html).toContain("--color-a: red;")
    expect(html).toContain("--color-b: white;")
    expect(html).toContain(".dark [data-chart=chart-t]")
    expect(html).toContain("--color-b: black;")
  })

  test("useChart3D outside a container throws", () => {
    function Orphan() {
      useChart3D()
      return null
    }
    expect(() => renderToString(<Orphan />)).toThrow("within a <ChartContainer3D />")
  })
})

describe("keyboard", () => {
  let host: HTMLDivElement
  afterEach(() => host.remove())

  function Tilt() {
    return <text>{useChart3D().camera.rotateX()}</text>
  }

  test("the arrow keys turn the camera, and the tilt stops at the zenith", async () => {
    host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
          <Tilt />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    const press = (key: string) =>
      act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })))

    await press("ArrowDown")
    expect(Number(host.querySelector("text")!.textContent)).toBeCloseTo(-Math.PI / 36)

    for (let i = 0; i < 40; i += 1) await press("ArrowDown")
    expect(Number(host.querySelector("text")!.textContent)).toBeCloseTo(-Math.PI / 2)

    await act(async () => root.unmount())
  })
})

describe("helpers", () => {
  test("axis ends on nice ticks and widens an empty extent", () => {
    expect(axis(3, 97)).toEqual({ domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100] })
    expect(axis(5, 5).domain[1]).toBeGreaterThan(5)
  })

  test("linear maps a domain to a range and survives a domain of zero width", () => {
    expect(linear([0, 10], [-1, 1])(5)).toBe(0)
    expect(linear([2, 2], [-1, 1])(2)).toBe(-1)
  })

  test("shade does not depend on the winding of the face", () => {
    const face = [point(0, 0, 0), point(1, 0, 0), point(1, 1, 0)]
    expect(shade(face, "red")).toMatch(/^color-mix\(in oklch, red \d+%, black\)$/)
    expect(shade([...face].reverse(), "red")).toBe(shade(face, "red"))
  })

  test("center is the mean of the projected points", () => {
    expect(center([point(0, 0, 0), point(2, 4, 0)])).toEqual({ x: 1, y: 2 })
  })
})

describe("ChartLegend3D", () => {
  test("shows the label of every config key, with its icon or a swatch of its color", () => {
    const Icon = () => <svg data-icon="" />
    const html = renderToString(
      <ChartLegend3D
        config={{ a: { label: "Apples", icon: Icon }, b: { label: "Bananas" }, c: {} }}
      />
    )
    expect(html).toContain("Apples")
    expect(html).toContain("data-icon")
    expect(html).toContain("Bananas")
    expect(html).toContain("background:var(--color-b)")
    // A key without a label shows the key.
    expect(html).toContain(">c<")
  })
})

describe("worldBox", () => {
  test("maps every axis into the box, y up and z as deep as asked", () => {
    const spec = {
      x: { domain: [0, 10], ticks: [] },
      y: { domain: [0, 10], ticks: [] },
      z: { domain: [0, 10], ticks: [] },
    }
    const world = worldBox(spec, 0.5)
    expect([world.x(0), world.x(10)]).toEqual([-1, 1])
    expect([world.y(0), world.y(10)]).toEqual([1, -1])
    expect([world.z(0), world.z(10)]).toEqual([-0.5, 0.5])
  })
})
