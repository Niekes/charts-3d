// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import {
  Axes3D,
  ChartContainer3D,
  ChartLegend3D,
  Marks3D,
  axis,
  center,
  linear,
  shade,
  useChart3D,
  worldBox,
} from "@/registry/new-york/ui/chart-3d"

// React reports state updates outside act() unless the environment says it supports it.
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

/** Renders `element` into the document, with an svg of the size of its view box. */
async function mount(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  const send = (event: Event) => act(() => svg.dispatchEvent(event))
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }
  return { host, svg, send, unmount }
}

const key = (key: string, shiftKey = false) =>
  new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })

const marks = [
  {
    key: "square",
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    fill: "red",
    tooltip: { at: { x: 150, y: 150 }, items: [{ label: "Square", value: 1 }] },
  },
  {
    key: "dot",
    points: [{ x: 400, y: 100 }],
    r: 10,
    fill: "blue",
    stroke: "white",
    tooltip: { at: { x: 400, y: 100 }, items: [{ label: "Dot", value: 2 }] },
  },
]

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

  test("an arrow key marks the chart as orbiting until it is released", async () => {
    host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () => root.render(<ChartContainer3D config={{}}>{null}</ChartContainer3D>))
    const svg = host.querySelector("svg")!
    const send = (type: string) =>
      act(() => svg.dispatchEvent(new KeyboardEvent(type, { key: "ArrowLeft", bubbles: true })))

    expect(svg.dataset.orbiting).toBe("false")
    await send("keydown")
    expect(svg.dataset.orbiting).toBe("true")
    await send("keyup")
    expect(svg.dataset.orbiting).toBe("false")

    await act(async () => root.unmount())
  })
})

describe("shortcuts", () => {
  function Camera() {
    const { camera } = useChart3D()
    return (
      <text>
        {JSON.stringify({ origin: camera.origin(), scale: camera.scale(), yaw: camera.rotateY() })}
      </text>
    )
  }

  test("Shift and an arrow pan, + and - and Ctrl with the wheel zoom, 0 and a double click reset", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    const read = () => JSON.parse(chart.host.querySelector("text")!.textContent!)

    await chart.send(key("ArrowRight", true))
    expect(read()).toEqual({ origin: { x: 340, y: 200 }, scale: 120, yaw: 0 })
    // A pan moves the labels as they are, so they stay.
    expect(chart.svg.dataset.orbiting).toBe("false")

    await chart.send(key("+"))
    expect(read().scale).toBeCloseTo(144)
    await chart.send(key("-"))
    expect(read().scale).toBeCloseTo(120)
    const wheel = { deltaY: -200, bubbles: true, cancelable: true }
    await chart.send(new WheelEvent("wheel", wheel))
    expect(read().scale).toBeCloseTo(120)
    await chart.send(new WheelEvent("wheel", { ...wheel, ctrlKey: true }))
    expect(read().scale).toBeCloseTo(240)

    await chart.send(key("0"))
    expect(read()).toEqual({ origin: { x: 320, y: 200 }, scale: 120, yaw: 0 })
    await chart.send(key("ArrowRight"))
    expect(read().yaw).toBeCloseTo(Math.PI / 36)
    await chart.send(new MouseEvent("dblclick", { bubbles: true }))
    expect(read().yaw).toBe(0)

    await chart.unmount()
  })

  test("? lists the shortcuts, Escape hides them and the button shows them again", async () => {
    const chart = await mount(<ChartContainer3D config={{}}>{null}</ChartContainer3D>)
    const button = chart.host.querySelector("button")!

    const shortcuts = chart.svg.getAttribute("aria-keyshortcuts")!.split(" ")
    expect(shortcuts).toContain("Shift+ArrowLeft")
    expect(shortcuts).toContain("Plus")
    expect(shortcuts.at(-1)).toBe("?")

    await chart.send(key("?"))
    expect(chart.host.textContent).toContain("Pan")
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(chart.host.querySelector('[data-slot="kbd"]')!.textContent).toBe("Drag")
    await chart.send(key("Escape"))
    expect(chart.host.textContent).not.toContain("Pan")
    act(() => button.click())
    expect(chart.host.textContent).toContain("Space")

    await chart.unmount()
  })

  test("without the panel, ? is no shortcut", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} shortcuts={false}>
        {null}
      </ChartContainer3D>
    )
    expect(chart.svg.getAttribute("aria-keyshortcuts")!.split(" ")).not.toContain("?")

    await chart.unmount()
  })
})

describe("Marks3D", () => {
  test("draws a polygon as a path and a circle as a circle", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(html).toContain('d="M100,100L200,100L200,200L100,200Z" fill="red"')
    expect(html).toMatch(/<circle cx="400" cy="100" r="10" fill="blue" stroke="white"/)
  })

  test("the mark under the pointer shows its tooltip, the one painted last on top", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    const move = (clientX: number, clientY: number) =>
      chart.send(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))

    await move(150, 150)
    expect(chart.host.textContent).toContain("Square")
    await move(405, 100)
    expect(chart.host.textContent).toContain("Dot")
    await move(300, 300)
    expect(chart.host.textContent).not.toMatch(/Square|Dot/)

    await chart.unmount()
  })
})

describe("renderer", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("canvas draws as SVG where the browser has no canvas", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="canvas">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).toBeNull()
    expect(chart.svg.querySelector("path")).not.toBeNull()

    await chart.unmount()
  })

  test("canvas paints the marks on a canvas over the chart, and the hover still finds them", async () => {
    const ctx = Object.fromEntries(
      ["setTransform", "beginPath", "lineTo", "closePath", "arc", "fill", "stroke"].map((m) => [
        m,
        vi.fn(),
      ])
    )
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never)
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="canvas">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).not.toBeNull()
    expect(chart.svg.querySelector("path, circle")).toBeNull()
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 100)
    expect(ctx.arc).toHaveBeenCalledWith(400, 100, 10, 0, 2 * Math.PI)
    expect(ctx.stroke).toHaveBeenCalled()

    await chart.send(new MouseEvent("pointermove", { bubbles: true, clientX: 150, clientY: 150 }))
    expect(chart.host.textContent).toContain("Square")

    await chart.unmount()
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

describe("Axes3D", () => {
  test("hides a tick label that would cover another, so an axis seen end on keeps one", async () => {
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10) }
    // From above, the y axis points at the camera and its ticks fall on one point.
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: Math.PI / 2 }}>
        <Axes3D
          spec={spec}
          world={worldBox(spec)}
          format={{ x: (v) => `x${v}`, y: (v) => `y${v}` }}
        />
      </ChartContainer3D>
    )
    const shown = [...chart.host.querySelectorAll("text")]
      .filter((text) => !text.classList.contains("opacity-0"))
      .map((text) => text.textContent!)

    expect(shown.filter((label) => label.startsWith("y"))).toEqual(["y0"])
    expect(shown.filter((label) => label.startsWith("x"))).toHaveLength(spec.x.ticks.length)
    await chart.unmount()
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
