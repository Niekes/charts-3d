// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { box, camera3D, cubes3D, points3D, type AxisSpec } from "d3-3d"

import {
  Axes3D,
  ChartContainer3D,
  ChartLegend3D,
  GLOBE_RADIUS,
  Labels3D,
  Marks3D,
  axis,
  cubeMarks,
  earth,
  faded,
  globe,
  intoWorld,
  linear,
  orthographic,
  pad,
  shade,
  useChart3D,
  useSeries,
  useTween,
  useTweenAxes,
  worldBox,
  type ChartContainer3DProps,
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
    tooltip: { items: [{ label: "Square", value: 1 }] },
  },
  {
    key: "dot",
    points: [{ x: 400, y: 100 }],
    r: 10,
    fill: "blue",
    stroke: "white",
    tooltip: { items: [{ label: "Dot", value: 2 }] },
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
    expect(html).toContain("chart-3d-axes-in")
    expect(html).toContain("cursor: grab")
    expect(html).toContain("cursor: move")
    expect(html).toContain("cursor: zoom-in")
    expect(html).toContain("cursor: zoom-out")
    expect(html).toContain("--color-a: red;")
    expect(html).toContain("--color-b: white;")
    expect(html).toContain(".dark [data-chart=chart-t]")
    expect(html).toContain("--color-b: black;")
  })

  test("a theme without a color for one theme leaves the variable out there", () => {
    const html = renderToString(
      <ChartContainer3D id="t" config={{ b: { theme: { light: "white", dark: "" } } }}>
        {null}
      </ChartContainer3D>
    )
    expect(html).toContain("--color-b: white;")
    expect(html.split(".dark [data-chart=chart-t]")[1]).not.toContain("--color-b")
  })

  test("legend shows the config below the chart", () => {
    const html = renderToString(
      <ChartContainer3D config={{ a: { label: "Apples", color: "red" } }} legend>
        {null}
      </ChartContainer3D>
    )
    expect(html).toContain("Apples")
    expect(html).toContain('data-slot="chart-3d-legend"')
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

/** The view of the camera, written into the chart, where `view` reads it back. */
function Camera() {
  const { camera } = useChart3D()
  return (
    <text>
      {JSON.stringify({ origin: camera.origin(), scale: camera.scale(), yaw: camera.rotateY() })}
    </text>
  )
}
const view = (host: HTMLElement) => JSON.parse(host.querySelector("text")!.textContent!)

const pointer = (
  type: string,
  clientX: number,
  clientY: number,
  relatedTarget?: EventTarget,
  init: MouseEventInit = {}
) =>
  new MouseEvent(type, {
    bubbles: true,
    clientX,
    clientY,
    relatedTarget: relatedTarget ?? null,
    ...init,
  })

/** A 2D context of spies on every canvas, and a ResizeObserver that never fires. */
function stubCanvas() {
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
  return ctx
}

/** A webgl context of spies, and a 2D context that reads colors back as bytes, on every canvas. */
function stubGL() {
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
    colorMask: vi.fn(),
    stencilFunc: vi.fn(),
    stencilOp: vi.fn(),
    getParameter: vi.fn(() => [1, 1]),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    DEPTH_TEST: 0x0b71,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    ARRAY_BUFFER: 0x8892,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    TRIANGLE_FAN: 0x0006,
    LINE_LOOP: 0x0002,
    STENCIL_TEST: 0x0b90,
    ALWAYS: 0x0207,
    NOTEQUAL: 0x0205,
    KEEP: 0x1e00,
    INVERT: 0x150a,
    ZERO: 0,
    ALIASED_LINE_WIDTH_RANGE: 0x846e,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
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
    getImageData: vi.fn(() => ({ data: [10, 20, 30, 255] })),
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (type: string) => (type === "webgl" ? gl : ctx) as never
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  return { gl, ctx }
}

describe("shortcuts", () => {
  test("the wheel zooms to the cursor, stands still at the limits, and the keys zoom to the middle", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    // The svg is drawn at half its view box, so the cursor at (220, 200)
    // is the point (420, 300) of the view box.
    chart.svg.getBoundingClientRect = () =>
      ({ left: 10, top: 50, width: 320, height: 200 }) as DOMRect
    const read = () => view(chart.host)
    const wheel = (deltaY: number) =>
      new WheelEvent("wheel", {
        deltaY,
        ctrlKey: true,
        cancelable: true,
        clientX: 220,
        clientY: 200,
      })

    // Twice as close: the origin, 100 left of and above the cursor, is now 200 away.
    await chart.send(wheel(-200))
    expect(read()).toEqual({ origin: { x: 220, y: 100 }, scale: 240, yaw: 0 })
    // And back out, onto the view it came from.
    await chart.send(wheel(200))
    expect(read()).toEqual({ origin: { x: 320, y: 200 }, scale: 120, yaw: 0 })

    // The zoom stops at 8, after three doublings, and the chart with it.
    for (let i = 0; i < 4; i++) await chart.send(wheel(-200))
    expect(read()).toEqual({ origin: { x: -380, y: -500 }, scale: 960, yaw: 0 })
    await chart.send(wheel(-200))
    expect(read()).toEqual({ origin: { x: -380, y: -500 }, scale: 960, yaw: 0 })

    // And at 1/4, five halvings on: the origin is 25 from the cursor and stays.
    for (let i = 0; i < 5; i++) await chart.send(wheel(200))
    expect(read()).toEqual({ origin: { x: 395, y: 275 }, scale: 30, yaw: 0 })
    await chart.send(wheel(200))
    expect(read()).toEqual({ origin: { x: 395, y: 275 }, scale: 30, yaw: 0 })

    // A key has no cursor: it zooms to the middle of the chart, and a panned
    // chart stays where it is.
    await chart.send(key("0"))
    await chart.send(key("ArrowRight", true))
    await chart.send(key("+"))
    expect(read().origin).toEqual({ x: 340, y: 200 })
    expect(read().scale).toBeCloseTo(144)
    await chart.send(key("-"))
    await chart.send(key("-"))
    expect(read().origin).toEqual({ x: 340, y: 200 })
    expect(read().scale).toBeCloseTo(100)

    await chart.unmount()
  })

  test("Shift and an arrow pan, + and - and Ctrl with the wheel zoom, 0 and a double click reset", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    const read = () => view(chart.host)

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
    // The cursor on the origin of the panned chart, the zoom moves nothing else.
    await chart.send(
      new WheelEvent("wheel", { ...wheel, ctrlKey: true, clientX: 340, clientY: 200 })
    )
    expect(read()).toEqual({ origin: { x: 340, y: 200 }, scale: 240, yaw: 0 })

    await chart.send(key("0"))
    expect(read()).toEqual({ origin: { x: 320, y: 200 }, scale: 120, yaw: 0 })
    await chart.send(key("ArrowRight"))
    expect(read().yaw).toBeCloseTo(Math.PI / 36)
    await chart.send(new MouseEvent("dblclick", { bubbles: true }))
    expect(read().yaw).toBe(0)

    await chart.unmount()
  })

  test("zoomed in, a key and a drag turn less: the picture moves as far on screen as zoomed out", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0, zoom: 2 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(key("ArrowRight"))
    expect(view(chart.host).yaw).toBeCloseTo(Math.PI / 72)
    await chart.send(pointer("pointerdown", 150, 150, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 196, 150, undefined, { ctrlKey: true }))
    expect(view(chart.host).yaw).toBeCloseTo(Math.PI / 72 + (46 * Math.PI) / 460)

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
    const kbds = [...chart.host.querySelectorAll('[data-slot="kbd"]')].map((k) => k.textContent)
    expect(kbds).toContain("Ctrl")
    await chart.send(key("Escape"))
    expect(chart.host.textContent).not.toContain("Pan")
    act(() => button.click())
    expect(chart.host.textContent).toContain("Scroll")

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

  test("the panel lists an action by its label, its keys grouped by their modifiers", async () => {
    const chart = await mount(<ChartContainer3D config={{}}>{null}</ChartContainer3D>)
    expect(chart.svg.getAttribute("aria-label")).toBe(
      "3D chart. Ctrl and drag to rotate it. Press ? for all shortcuts."
    )
    await chart.send(key("?"))

    expect(rows(chart.host)).toEqual([
      ["Rotate", "←→↑↓", "CtrlDrag"],
      ["Pan", "Shift←→↑↓", "AltDrag"],
      ["Zoom", "+−", "CtrlScroll"],
      ["Reset", "0", "Double-click"],
      ["Keyboard shortcuts", "?"],
    ])

    await chart.unmount()
  })

  test("keymap rebinds an action, and a press matches its keys exactly", async () => {
    const chart = await mount(
      <ChartContainer3D
        config={{}}
        defaultView={{ yaw: 0, tilt: 0 }}
        keymap={{
          rotateLeft: ["a"],
          zoomIn: { keys: ["Control+Plus"] },
          panLeft: ["Shift+Control+ArrowLeft"],
        }}
      >
        <Camera />
      </ChartContainer3D>
    )
    const read = () => view(chart.host)
    const press = (key: string, init: KeyboardEventInit) =>
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })

    await chart.send(key("ArrowLeft"))
    expect(read().yaw).toBe(0)
    await chart.send(key("a"))
    expect(read().yaw).toBeCloseTo(-Math.PI / 36)

    await chart.send(key("+"))
    expect(read().scale).toBe(120)
    // Shift is in the + of most keyboards already, so it does not count.
    await chart.send(press("+", { ctrlKey: true, shiftKey: true }))
    expect(read().scale).toBeCloseTo(144)
    await chart.send(press("ArrowLeft", { ctrlKey: true, shiftKey: true }))
    expect(read().origin.x).toBe(300)

    // A modifier the keys lack leaves the press to the browser, which resets its zoom on Ctrl and 0.
    const reset = press("0", { ctrlKey: true })
    await chart.send(reset)
    expect(reset.defaultPrevented).toBe(false)
    expect(read().scale).toBeCloseTo(144)
    const back = press("ArrowRight", { altKey: true, metaKey: true })
    await chart.send(back)
    expect(back.defaultPrevented).toBe(false)
    expect(read().yaw).toBeCloseTo(-Math.PI / 36)

    const keys = chart.svg.getAttribute("aria-keyshortcuts")!.split(" ")
    expect(keys).toContain("Control+Plus")
    expect(keys).toContain("Control+Shift+ArrowLeft")
    expect(keys).not.toContain("ArrowLeft")

    await chart.unmount()
  })

  test("an action turned off does nothing and leaves its event to the browser", async () => {
    const chart = await mount(
      <ChartContainer3D
        config={{}}
        defaultView={{ yaw: 0, tilt: 0 }}
        aria-label="Sales"
        keymap={{
          zoomIn: [],
          reset: false,
          doubleClickReset: false,
          wheelZoom: false,
          dragRotate: false,
          dragPan: false,
        }}
      >
        <Camera />
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    const read = () => view(chart.host)
    chart.svg.setPointerCapture = vi.fn()
    expect(chart.svg.getAttribute("aria-label")).toBe("Sales")
    expect(chart.svg.getAttribute("class")).not.toContain("touch-none")

    await chart.send(key("ArrowRight"))
    expect(read().yaw).toBeCloseTo(Math.PI / 36)
    await chart.send(key("0"))
    await chart.send(new MouseEvent("dblclick", { bubbles: true }))
    expect(read().yaw).toBeCloseTo(Math.PI / 36)

    await chart.send(key("+"))
    const wheel = new WheelEvent("wheel", { deltaY: -200, ctrlKey: true, cancelable: true })
    await chart.send(wheel)
    expect(wheel.defaultPrevented).toBe(false)
    expect(read().scale).toBe(120)

    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    await chart.send(space)
    expect(space.defaultPrevented).toBe(false)
    // Without a drag, a press and a move hover the marks.
    await chart.send(pointer("pointerdown", 150, 150, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 196, 150, undefined, { ctrlKey: true }))
    expect(read().yaw).toBeCloseTo(Math.PI / 36)
    expect(chart.host.textContent).toContain("Square")

    await chart.send(key("?"))
    expect(rows(chart.host).map(([label]) => label)).toEqual([
      "Rotate",
      "Pan",
      "Zoom",
      "Keyboard shortcuts",
    ])

    await chart.unmount()
  })

  test("keymap={false} stands the chart still, out of the tab order and without a panel", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} keymap={false}>
        {null}
      </ChartContainer3D>
    )
    expect(chart.svg.getAttribute("aria-label")).toBe("3D chart.")
    expect(chart.svg.hasAttribute("tabindex")).toBe(false)
    expect(chart.svg.hasAttribute("aria-keyshortcuts")).toBe(false)
    expect(chart.host.querySelector("button")).toBeNull()

    await chart.unmount()
  })

  test("keymap names the help keys and the labels of the panel", async () => {
    const chart = await mount(
      <ChartContainer3D
        config={{}}
        keymap={{
          help: { keys: ["h"], label: "Tastenkürzel" },
          rotateLeft: { label: "Links drehen" },
        }}
      >
        {null}
      </ChartContainer3D>
    )
    const button = chart.host.querySelector("button")!
    expect(button.getAttribute("aria-label")).toBe("Tastenkürzel")
    expect(chart.svg.getAttribute("aria-label")).toBe(
      "3D chart. Ctrl and drag to rotate it. Press h for all shortcuts."
    )

    await chart.send(key("?"))
    expect(button.getAttribute("aria-expanded")).toBe("false")
    expect(button.hasAttribute("aria-controls")).toBe(false)
    await chart.send(key("h"))
    expect(button.getAttribute("aria-expanded")).toBe("true")
    const panel = chart.host.querySelector('[data-slot="chart-3d-shortcuts-panel"]')!
    expect(button.getAttribute("aria-controls")).toBe(panel.id)

    expect(rows(chart.host).slice(0, 2)).toEqual([
      ["Rotate", "→↑↓", "CtrlDrag"],
      ["Links drehen", "←"],
    ])
    expect(rows(chart.host).at(-1)).toEqual(["Tastenkürzel", "h"])

    await chart.unmount()
  })

  test("Drag is written out as a chip, and a rule parts the keys of a row from its gestures", async () => {
    const chart = await mount(<ChartContainer3D config={{}}>{null}</ChartContainer3D>)
    await chart.send(key("?"))

    const panel = chart.host.querySelector('[data-slot="chart-3d-shortcuts-panel"]')!
    const chips = [...panel.querySelectorAll('[data-slot="kbd"]')]
    const drag = chips.find((k) => k.textContent === "Drag")!
    expect(drag.querySelector("svg")).toBeNull()

    const [rotate, ...rest] = [...panel.querySelectorAll("dd")]
    expect(rotate.querySelectorAll('[data-slot="chart-3d-shortcuts-rule"]')).toHaveLength(1)
    // The keys sit left of the rule, the gestures right of it.
    expect(rotate.firstElementChild!.textContent).toBe("←→↑↓")
    // The help row has no gesture, so no rule.
    expect(rest.at(-1)!.querySelector('[data-slot="chart-3d-shortcuts-rule"]')).toBeNull()

    await chart.unmount()
  })

  test("a pointer down outside the corner closes the panel and still works the chart", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(key("?"))
    const panel = () => chart.host.querySelector('[data-slot="chart-3d-shortcuts-panel"]')

    // Inside the corner, the list stays open.
    await act(async () => panel()!.dispatchEvent(pointer("pointerdown", 0, 0)))
    expect(panel()).not.toBeNull()

    // Outside, it closes, and the press is not swallowed: the drag still rotates.
    await chart.send(pointer("pointerdown", 150, 150, undefined, { ctrlKey: true }))
    expect(panel()).toBeNull()
    await chart.send(pointer("pointermove", 196, 150, undefined, { ctrlKey: true }))
    expect(view(chart.host).yaw).toBeCloseTo((46 * Math.PI) / 230)

    await chart.unmount()
  })
})

/** The rows of the open shortcut panel: the label, then the text of each group of keys. */
function rows(host: HTMLElement) {
  const panel = host.querySelector('[data-slot="chart-3d-shortcuts-panel"]')!
  return [...panel.querySelectorAll("dt")].map((dt) => [
    dt.textContent,
    ...[...dt.nextElementSibling!.querySelectorAll('[data-slot="kbd-group"]')].map(
      (group) => group.textContent
    ),
  ])
}

describe("pointer", () => {
  test("a press that wanders a few pixels stays a click, a drag turns the camera", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointermove", 150, 150))
    expect(chart.host.textContent).toContain("Square")

    await chart.send(pointer("pointerdown", 150, 150, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 152, 151, undefined, { ctrlKey: true }))
    expect(view(chart.host).yaw).toBe(0)
    expect(chart.svg.setPointerCapture).not.toHaveBeenCalled()

    await chart.send(pointer("pointermove", 196, 150, undefined, { ctrlKey: true }))
    expect(chart.svg.setPointerCapture).toHaveBeenCalledTimes(1)
    expect(view(chart.host).yaw).toBeCloseTo((46 * Math.PI) / 230)
    // The drag takes the tooltip away and marks the chart as orbiting.
    expect(chart.host.textContent).not.toContain("Square")
    expect(chart.svg.dataset.orbiting).toBe("true")

    await chart.send(pointer("pointermove", 200, 150, undefined, { ctrlKey: true }))
    expect(chart.svg.setPointerCapture).toHaveBeenCalledTimes(1)
    await chart.send(pointer("pointerup", 200, 150))
    expect(chart.svg.dataset.orbiting).toBe("false")

    await chart.unmount()
  })

  test("held Space does not pan: the drag only inspects, and Space scrolls the page", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    await chart.send(space)
    expect(space.defaultPrevented).toBe(false)
    await chart.send(pointer("pointerdown", 100, 100))
    await chart.send(pointer("pointermove", 130, 110))
    expect(view(chart.host)).toMatchObject({ origin: { x: 320, y: 200 }, yaw: 0 })
    expect(chart.svg.setPointerCapture).not.toHaveBeenCalled()

    await chart.unmount()
  })

  test("held Alt turns a drag into a pan, until Alt is let go", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { altKey: true }))
    await chart.send(pointer("pointermove", 130, 110, undefined, { altKey: true }))
    expect(view(chart.host)).toMatchObject({ origin: { x: 350, y: 210 }, yaw: 0 })
    expect(chart.svg.dataset.orbiting).toBe("false")

    // Alt released mid-drag: the pan ends, the chart stays where it is.
    await chart.send(pointer("pointermove", 160, 110))
    expect(view(chart.host).origin).toEqual({ x: 350, y: 210 })

    await chart.unmount()
  })

  test("keymap={{ dragPan: false }} leaves an Alt drag inspecting and takes it off the panel", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }} keymap={{ dragPan: false }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { altKey: true }))
    await chart.send(pointer("pointermove", 130, 110, undefined, { altKey: true }))
    expect(view(chart.host).origin).toEqual({ x: 320, y: 200 })
    expect(chart.svg.setPointerCapture).not.toHaveBeenCalled()

    await chart.send(key("?"))
    expect(rows(chart.host)[1]).toEqual(["Pan", "Shift←→↑↓"])

    await chart.unmount()
  })

  test("a plain drag does not rotate and keeps the default cursor; the platform modifier and a drag do", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    expect(chart.svg.getAttribute("class")).not.toContain("cursor-grab")

    // Without the modifier, a press and a move only hover the marks.
    await chart.send(pointer("pointermove", 150, 150))
    await chart.send(pointer("pointerdown", 150, 150))
    await chart.send(pointer("pointermove", 196, 150))
    expect(view(chart.host).yaw).toBe(0)
    expect(chart.svg.setPointerCapture).not.toHaveBeenCalled()
    expect(chart.host.textContent).toContain("Square")

    // With the platform modifier (Ctrl off Mac), the same drag rotates.
    await chart.send(pointer("pointerup", 196, 150))
    await chart.send(pointer("pointerdown", 150, 150, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 196, 150, undefined, { ctrlKey: true }))
    expect(view(chart.host).yaw).toBeCloseTo((46 * Math.PI) / 230)

    await chart.unmount()
  })

  test("holding the platform modifier shows the hand, a rotate drag shows grabbing", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    expect(chart.svg.dataset.mod).toBeUndefined()
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" })))
    expect(chart.svg.dataset.mod).toBe("true")
    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" })))
    expect(chart.svg.dataset.mod).toBeUndefined()
    // A missed keyup (window blur while held) must not stick the hand.
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" })))
    act(() => window.dispatchEvent(new Event("blur")))
    expect(chart.svg.dataset.mod).toBeUndefined()

    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 130, 100, undefined, { ctrlKey: true }))
    expect(chart.svg.dataset.orbiting).toBe("true")
    expect(view(chart.host).yaw).toBeGreaterThan(0)

    await chart.unmount()
  })

  test("holding Alt shows the pan arrows, which blur and keymap dragPan off take away", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    expect(chart.svg.dataset.alt).toBeUndefined()
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })))
    expect(chart.svg.dataset.alt).toBe("true")
    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })))
    expect(chart.svg.dataset.alt).toBeUndefined()
    // A missed keyup (window blur while held) must not stick the arrows.
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })))
    act(() => window.dispatchEvent(new Event("blur")))
    expect(chart.svg.dataset.alt).toBeUndefined()
    await chart.unmount()

    const off = await mount(
      <ChartContainer3D config={{}} keymap={{ dragPan: false }}>
        <Camera />
      </ChartContainer3D>
    )
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })))
    expect(off.svg.dataset.alt).toBeUndefined()
    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })))
    await off.unmount()
  })

  test("a wheel zoom shows its direction as the cursor, and the hand returns after the last tick", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    vi.useFakeTimers()
    const wheel = { deltaY: -200, bubbles: true, cancelable: true, ctrlKey: true }
    await chart.send(new WheelEvent("wheel", wheel))
    expect(chart.svg.dataset.zoom).toBe("in")
    await chart.send(new WheelEvent("wheel", { ...wheel, deltaY: 200 }))
    expect(chart.svg.dataset.zoom).toBe("out")
    act(() => vi.advanceTimersByTime(400))
    expect(chart.svg.dataset.zoom).toBeUndefined()
    vi.useRealTimers()
    await chart.unmount()
  })

  test("a rotate drag stops when the platform modifier is released mid-drag", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 130, 100, undefined, { ctrlKey: true }))
    const turned = view(chart.host).yaw
    expect(turned).toBeGreaterThan(0)

    // Modifier released mid-drag: the drag ends, the camera stops.
    await chart.send(pointer("pointermove", 160, 100))
    expect(view(chart.host).yaw).toBe(turned)
    expect(chart.svg.dataset.orbiting).toBe("false")

    await chart.unmount()
  })

  test("on a Mac the platform modifier is ⌘: the hint and the label show it, and Meta+drag rotates", async () => {
    Object.defineProperty(navigator, "userAgentData", {
      value: { platform: "MacIntel" },
      configurable: true,
    })
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    expect(chart.svg.getAttribute("aria-label")).toContain("⌘ and drag to rotate it")
    await chart.send(key("?"))
    expect(chart.host.textContent).toContain("⌘")
    // The Alt key of the pan gesture reads as Option there.
    expect(chart.host.textContent).toContain("⌥")
    expect(chart.host.textContent).not.toContain("Alt")
    // The zoom hint follows the modifier too: no Ctrl anywhere on a Mac.
    expect(chart.host.textContent).not.toContain("Ctrl")

    // ⌘ and the wheel zooms, and so does Ctrl and the wheel, how a pinch arrives.
    const wheel = { deltaY: -200, bubbles: true, cancelable: true }
    await chart.send(new WheelEvent("wheel", { ...wheel, metaKey: true }))
    expect(view(chart.host).scale).toBeCloseTo(240)
    await chart.send(new WheelEvent("wheel", { ...wheel, deltaY: 200, ctrlKey: true }))
    expect(view(chart.host).scale).toBeCloseTo(120)

    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { metaKey: true }))
    await chart.send(pointer("pointermove", 130, 100, undefined, { metaKey: true }))
    expect(view(chart.host).yaw).toBeCloseTo((30 * Math.PI) / 230)

    delete (navigator as { userAgentData?: unknown }).userAgentData
    await chart.unmount()
  })

  test("a move within a mark keeps its tooltip, leaving the chart takes it away", async () => {
    const said = {
      ...marks[0],
      tooltip: { items: [{ label: "Note", value: "n/a" }] },
    }
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={[said]} />
      </ChartContainer3D>
    )
    await chart.send(pointer("pointermove", 150, 150))
    await chart.send(pointer("pointermove", 160, 160))
    // A value that is not a number shows as it is.
    expect(chart.host.textContent).toContain("Noten/a")
    await chart.send(pointer("pointerout", 160, 160, chart.host))
    expect(chart.host.textContent).not.toContain("Note")

    await chart.unmount()
  })
})

describe("glide", () => {
  /** A browser that can tell whether the reader asks for reduced motion. */
  const motion = (reduced: boolean) =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: query.includes("no-preference") !== reduced }),
    })
  const frames = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(window, "matchMedia")
  })

  test("a key glides the camera to its view, a held key heads on from where it is, a drag stops it", async () => {
    motion(false)
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] })
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    const yaw = () => view(chart.host).yaw

    await chart.send(key("ArrowRight"))
    expect(yaw()).toBe(0)
    await frames(50)
    expect(yaw()).toBeGreaterThan(0)
    expect(yaw()).toBeLessThan(Math.PI / 36)
    await chart.send(key("ArrowRight"))
    await frames(250)
    expect(yaw()).toBe((2 * Math.PI) / 36)

    await chart.send(key("ArrowRight"))
    await frames(50)
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(pointer("pointerdown", 100, 100, undefined, { ctrlKey: true }))
    await chart.send(pointer("pointermove", 123, 100, undefined, { ctrlKey: true }))
    const dragged = yaw()
    await frames(250)
    expect(yaw()).toBe(dragged)
    await chart.unmount()
  })

  test("a reset glides the short way round, and where the reader asks for reduced motion, a key jumps", async () => {
    motion(false)
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] })
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    const yaw = () => view(chart.host).yaw
    for (let i = 0; i < 71; i += 1) await chart.send(key("ArrowRight"))
    await frames(250)
    expect(yaw()).toBeCloseTo((71 * Math.PI) / 36)

    // From 355°, the camera turns on through 360° instead of back through 180°.
    await chart.send(key("0"))
    await frames(50)
    expect(yaw()).toBeGreaterThan(-Math.PI / 36)
    expect(yaw()).toBeLessThan(0)
    await frames(250)
    expect(yaw()).toBe(0)

    motion(true)
    await chart.send(key("ArrowRight"))
    expect(yaw()).toBeCloseTo(Math.PI / 36)
    // A glide that the chart leaves on its way does not move it any more.
    motion(false)
    await chart.send(key("ArrowRight"))
    await chart.unmount()
    await frames(250)
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
    expect(html).toContain('data-slot="chart-3d-marks"')
  })

  test("a circle without a stroke has no outline", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <Marks3D marks={[{ key: "c", points: [{ x: 1, y: 2 }], r: 3, fill: "red" }]} />
      </ChartContainer3D>
    )
    expect(html).toContain('<circle cx="1" cy="2" r="3" fill="red">')
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
    expect(chart.host.querySelector('[data-slot="chart-3d-tooltip"]')).not.toBeNull()
    await move(405, 100)
    expect(chart.host.textContent).toContain("Dot")
    await move(300, 300)
    expect(chart.host.textContent).not.toMatch(/Square|Dot/)

    await chart.unmount()
  })
  test("a tooltip given as a function is made when the pointer lands on the mark; null shows none", async () => {
    const lazy = vi.fn(() => ({ items: [{ label: "Lazy", value: 1 }] }))
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D
          marks={[
            { ...marks[0], tooltip: lazy },
            { ...marks[1], tooltip: () => null },
          ]}
        />
      </ChartContainer3D>
    )
    const move = (clientX: number, clientY: number) =>
      chart.send(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
    const tip = () => chart.host.querySelector('[data-slot="chart-3d-tooltip"]')

    // Rendering never calls it; the hover does, once per mark it lands on.
    expect(lazy).not.toHaveBeenCalled()
    await move(150, 150)
    await move(160, 160)
    expect(lazy).toHaveBeenCalledTimes(1)
    expect(tip()?.textContent).toContain("Lazy")
    await move(405, 100)
    expect(tip()).toBeNull()

    await chart.unmount()
  })
})

describe("tooltip", () => {
  afterEach(() => vi.restoreAllMocks())

  /** A mark the full height of the chart from `from` to `to`, whose tooltip says `key`. */
  const column = (key: string, from = 0, to = 640) => ({
    key,
    points: [
      { x: from, y: 0 },
      { x: to, y: 0 },
      { x: to, y: 400 },
      { x: from, y: 400 },
    ],
    fill: "red",
    tooltip: { items: [{ label: key, value: 1 }] },
  })

  /** Gives every tooltip a size in pixels, as jsdom lays nothing out. */
  const size = (width: number, height: number) => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width)
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height)
  }

  /** Mounts a chart of `marks`, 640 by 400, and hands back where its tooltip sits for the pointer at x, y. */
  async function tooltipAt(props: Partial<ChartContainer3DProps> = {}, marks = [column("all")]) {
    const chart = await mount(
      <ChartContainer3D config={{}} {...props}>
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    const move = async (x: number, y: number) => {
      await chart.send(pointer("pointermove", x, y))
      const tip = chart.host.querySelector<HTMLElement>('[data-slot="chart-3d-tooltip"]')!
      const { left, top, translate } = tip.style
      return { left, top, translate, placement: tip.dataset.placement }
    }
    return { move, unmount: chart.unmount }
  }

  // The shift of the tooltip on an axis: before the pointer by its size and the gap, or after it.
  const before = "calc(-100% - 12px)"
  const after = "12px"

  test("follows the pointer, above and to its right", async () => {
    const chart = await tooltipAt()
    expect(await chart.move(150, 150)).toEqual({
      left: "150px",
      top: "150px",
      translate: `${after} ${before}`,
      placement: "top-right",
    })
    // A move within the mark moves the tooltip with it.
    expect(await chart.move(160, 170)).toMatchObject({ left: "160px", top: "170px" })

    await chart.unmount()
  })

  test("flips to the other side on each axis alone where it would leave the chart", async () => {
    size(120, 60)
    const chart = await tooltipAt()
    // The tooltip needs 132 by 72 with the gap.
    expect(await chart.move(600, 200)).toMatchObject({
      placement: "top-left",
      translate: `${before} ${before}`,
    })
    expect(await chart.move(100, 30)).toMatchObject({
      placement: "bottom-right",
      translate: `${after} ${after}`,
    })
    expect(await chart.move(600, 30)).toMatchObject({
      placement: "bottom-left",
      translate: `${before} ${after}`,
    })
    expect(await chart.move(100, 200)).toMatchObject({ placement: "top-right" })

    await chart.unmount()
  })

  test("a tooltip too wide for either side stays where it has more room", async () => {
    size(400, 60)
    const chart = await tooltipAt()
    // 340 to the right, 300 to the left: neither fits, the right has more.
    expect(await chart.move(300, 200)).toMatchObject({ placement: "top-right" })
    expect(await chart.move(400, 200)).toMatchObject({ placement: "top-left" })

    await chart.unmount()
  })

  test("tooltip sets the placement, which flips the same way", async () => {
    size(120, 60)
    const chart = await tooltipAt({ tooltip: "bottom-left" })
    expect(await chart.move(300, 200)).toMatchObject({ placement: "bottom-left" })
    expect(await chart.move(50, 200)).toMatchObject({ placement: "bottom-right" })
    expect(await chart.move(300, 380)).toMatchObject({ placement: "top-left" })

    await chart.unmount()
  })

  test("a wider tooltip of the next mark flips as soon as it shows", async () => {
    // Two marks side by side, as on a surface; the tooltip of the right one is wider.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      return this.textContent!.includes("wide") ? 200 : 50
    })
    const chart = await tooltipAt({}, [column("narrow", 0, 505), column("wide", 505, 640)])
    expect(await chart.move(500, 200)).toMatchObject({ placement: "top-right" })
    expect(await chart.move(510, 200)).toMatchObject({ placement: "top-left" })

    await chart.unmount()
  })
})

describe("Labels3D", () => {
  test("writes every label at its point, ringed by the background", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <Labels3D labels={[{ key: "a", at: { x: 10, y: 20 }, text: "Apples", anchor: "end" }]} />
      </ChartContainer3D>
    )
    expect(html).toMatch(
      /<text x="10" y="20" text-anchor="end"[^>]*paint-order="stroke"[^>]*>Apples<\/text>/
    )
  })

  test("lays a label toward a side of its point, touching it from there", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <Labels3D
          labels={[
            { key: "a", at: { x: 100, y: 50 }, text: "Apples", toward: { x: -1, y: 0 } },
            { key: "b", at: { x: 100, y: 50 }, text: "Pears", toward: { x: 0, y: -1 } },
          ]}
        />
      </ChartContainer3D>
    )
    // Six letters of 6px each end at the point; a line of 10px stands on it.
    expect(html).toMatch(/<text x="82" y="50" text-anchor="middle"[^>]*>Apples<\/text>/)
    expect(html).toMatch(/<text x="100" y="45" text-anchor="middle"[^>]*>Pears<\/text>/)
  })
})

describe("gizmo", () => {
  /** The end of every axis of the gizmo, in paint order. */
  const ends = (host: HTMLElement) =>
    [...host.querySelectorAll('[data-slot="chart-3d-gizmo"] [data-axis]')].map((axis) => {
      const text = axis.querySelector("text")!
      return [axis.getAttribute("data-axis"), +text.getAttribute("x")!, +text.getAttribute("y")!]
    })

  test("draws the axes in the lower left, turned with the camera but neither panned nor zoomed, the nearest on top", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        {null}
      </ChartContainer3D>
    )
    const gizmo = chart.host.querySelector('[data-slot="chart-3d-gizmo"]')!
    expect(gizmo.getAttribute("class")).toContain("bottom-2 left-2")
    // Seen from the front, x points right, y up and z at the camera, painted last.
    const front = [
      ["x", 42, 24],
      ["y", 24, 6],
      ["z", 24, 24],
    ]
    expect(ends(chart.host)).toEqual(front)

    await chart.send(key("+"))
    await chart.send(key("ArrowRight", true))
    expect(ends(chart.host)).toEqual(front)

    await chart.send(key("ArrowRight"))
    expect(ends(chart.host)).not.toEqual(front)
    await chart.unmount()
  })

  test("sits in the corner it is given, and false hides it", () => {
    const corner = renderToString(
      <ChartContainer3D config={{}} gizmo="top-right">
        {null}
      </ChartContainer3D>
    )
    expect(corner).toContain("top-2 right-2")
    const hidden = renderToString(
      <ChartContainer3D config={{}} gizmo={false}>
        {null}
      </ChartContainer3D>
    )
    expect(hidden).not.toContain("chart-3d-gizmo")
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
    const ctx = stubCanvas()
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="canvas">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).not.toBeNull()
    expect(chart.host.querySelector("canvas")!.dataset.slot).toBe("chart-3d-canvas")
    expect(chart.svg.querySelector("path, circle")).toBeNull()
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 100)
    expect(ctx.arc).toHaveBeenCalledWith(400, 100, 10, 0, 2 * Math.PI)
    expect(ctx.stroke).toHaveBeenCalled()

    await chart.send(new MouseEvent("pointermove", { bubbles: true, clientX: 150, clientY: 150 }))
    expect(chart.host.textContent).toContain("Square")

    await chart.unmount()
  })
  test("canvas outlines a circle only with a stroke, and paints again when the theme changes", async () => {
    const ctx = stubCanvas()
    const bare = { key: "bare", points: [{ x: 300, y: 300 }], r: 5, fill: "green" }
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="canvas">
        <Marks3D marks={[bare]} />
      </ChartContainer3D>
    )
    expect(ctx.arc).toHaveBeenCalledWith(300, 300, 5, 0, 2 * Math.PI)
    expect(ctx.stroke).not.toHaveBeenCalled()

    const painted = ctx.fill.mock.calls.length
    await act(async () => {
      document.documentElement.classList.add("dark")
      // A MutationObserver reports after the change, not during it.
      await new Promise((resolve) => setTimeout(resolve))
    })
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(painted)

    document.documentElement.classList.remove("dark")
    await chart.unmount()
  })

  test("webgl draws as SVG where the browser has neither webgl nor a canvas", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).toBeNull()
    expect(chart.svg.querySelector("path")).not.toBeNull()

    await chart.unmount()
  })

  test("webgl falls back to canvas where the browser has no webgl but a 2D context", async () => {
    const ctx = stubCanvas()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (type: string) => (type === "2d" ? ctx : null) as never
    )
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).not.toBeNull()
    expect(chart.svg.querySelector("path, circle")).toBeNull()
    expect(ctx.fill).toHaveBeenCalled()

    await chart.unmount()
  })

  test("webgl paints the marks as fans, in paint order, without a depth test, and the hover still finds them", async () => {
    const { gl, ctx } = stubGL()
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    expect(chart.host.querySelector("canvas")).not.toBeNull()
    expect(chart.svg.querySelector("path, circle")).toBeNull()
    expect(gl.disable).toHaveBeenCalledWith(gl.DEPTH_TEST)
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND)
    // The square is a fan of its 4 corners, the dot one of its 12 ring
    // points, and its white ring a line loop over the same 12.
    expect(gl.drawArrays.mock.calls).toEqual([
      [gl.TRIANGLE_FAN, 0, 4],
      [gl.TRIANGLE_FAN, 0, 12],
      [gl.LINE_LOOP, 0, 12],
    ])
    // Nothing here has a dent, so nothing goes through the stencil.
    expect(gl.stencilOp).not.toHaveBeenCalled()
    // The color of a mark as bytes from the 1×1 canvas, over 255.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1, 1)
    expect(gl.uniform4f).toHaveBeenCalledWith({}, 10 / 255, 20 / 255, 30 / 255, 1)

    await chart.send(new MouseEvent("pointermove", { bubbles: true, clientX: 150, clientY: 150 }))
    expect(chart.host.textContent).toContain("Square")

    await chart.unmount()
  })

  test("webgl strokes a polygon that carries a stroke as a line loop over its corners", async () => {
    const { gl } = stubGL()
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={[{ ...marks[0], stroke: "white" }]} />
      </ChartContainer3D>
    )
    // The square's fan, then its outline as a loop of the same 4 corners.
    expect(gl.drawArrays.mock.calls).toEqual([
      [gl.TRIANGLE_FAN, 0, 4],
      [gl.LINE_LOOP, 0, 4],
    ])
    await chart.unmount()
  })

  test("webgl fills a polygon with a dent through the stencil: its fan marks the inside without color, then covers it once", async () => {
    const { gl } = stubGL()
    // The front of a ribbon: down from the first point, along the floor, and
    // back along a line that dips between its two last points.
    const ribbon = [
      { x: 100, y: 200 },
      { x: 100, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 100 },
      { x: 300, y: 250 },
      { x: 200, y: 100 },
    ]
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={[{ key: "ribbon", points: ribbon, fill: "red" }]} />
      </ChartContainer3D>
    )
    // The fill needs a stencil buffer, which a context has only if asked for one.
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("webgl", { stencil: true })
    expect(gl.enable).toHaveBeenCalledWith(gl.STENCIL_TEST)
    // The ring goes to the GPU as it is, once, and no triangle is cut on the CPU.
    expect(gl.bufferData.mock.calls.map(([, xy]) => [...xy])).toEqual([
      ribbon.flatMap((p) => [p.x, p.y]),
    ])
    expect(gl.drawArrays.mock.calls).toEqual([
      [gl.TRIANGLE_FAN, 0, 6],
      [gl.TRIANGLE_FAN, 0, 6],
    ])
    // The first fan flips the stencil with the color off, the second paints
    // where it is left set - under an odd number of triangles - and clears it.
    expect(gl.colorMask.mock.calls).toEqual([
      [false, false, false, false],
      [true, true, true, true],
    ])
    expect(gl.stencilOp.mock.calls).toEqual([
      [gl.KEEP, gl.KEEP, gl.INVERT],
      [gl.KEEP, gl.KEEP, gl.ZERO],
    ])
    expect(gl.stencilFunc.mock.calls.map(([when]) => when)).toEqual([gl.ALWAYS, gl.NOTEQUAL])
    const order = [gl.colorMask, gl.drawArrays].map((spy) => spy.mock.invocationCallOrder)
    expect(order[0][0]).toBeLessThan(order[1][0])
    expect(order[1][0]).toBeLessThan(order[0][1])
    expect(order[0][1]).toBeLessThan(order[1][1])
    expect(gl.disable).toHaveBeenLastCalledWith(gl.STENCIL_TEST)

    await chart.unmount()
  })

  test("webgl fills a polygon that crosses itself through the stencil too, so it fills as the hover finds it", async () => {
    const { gl } = stubGL()
    // A bowtie of four corners, and a star whose five corners all turn one way.
    const bowtie = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 200, y: 100 },
      { x: 100, y: 200 },
    ]
    const star = [0, 2, 4, 1, 3].map((k) => ({
      x: 300 + 50 * Math.sin((k * 2 * Math.PI) / 5),
      y: 200 - 50 * Math.cos((k * 2 * Math.PI) / 5),
    }))
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D
          marks={[
            { key: "bowtie", points: bowtie, fill: "red" },
            { key: "star", points: star, fill: "blue" },
          ]}
        />
      </ChartContainer3D>
    )
    expect(gl.drawArrays.mock.calls.map(([, , count]) => count)).toEqual([4, 4, 5, 5])
    expect(gl.stencilOp).toHaveBeenCalledTimes(4)

    await chart.unmount()
  })

  test("webgl reads a color once and serves later repaints from the cache", async () => {
    const { ctx } = stubGL()
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = () =>
      act(async () =>
        root.render(
          <ChartContainer3D config={{}} renderer="webgl">
            <Marks3D marks={marks} />
          </ChartContainer3D>
        )
      )
    await render()
    const reads = ctx.getImageData.mock.calls.length
    await render()
    expect(ctx.getImageData.mock.calls.length).toBe(reads)

    await act(async () => root.unmount())
    host.remove()
  })

  test("webgl compiles its program and buffer once, and repaints when the theme changes", async () => {
    const { gl } = stubGL()
    const chart = await mount(
      <ChartContainer3D config={{}} renderer="webgl">
        <Marks3D marks={marks} />
      </ChartContainer3D>
    )
    const drawn = gl.drawArrays.mock.calls.length
    await act(async () => {
      document.documentElement.classList.add("dark")
      // A MutationObserver reports after the change, not during it.
      await new Promise((resolve) => setTimeout(resolve))
    })
    expect(gl.drawArrays.mock.calls.length).toBeGreaterThan(drawn)
    expect(gl.createProgram).toHaveBeenCalledTimes(1)
    expect(gl.createBuffer).toHaveBeenCalledTimes(1)

    document.documentElement.classList.remove("dark")
    await chart.unmount()
  })
})

describe("parity", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // One scene with every mark shape: the shared square and dot, each its own group.
  const scene = marks.map((mark) => ({ ...mark, groups: [mark.key] }))

  test("one scene draws every mark and hovers the same on svg, canvas and webgl", async () => {
    for (const renderer of ["svg", "canvas", "webgl"] as const) {
      const ctx = renderer === "canvas" ? stubCanvas() : null
      const gl = renderer === "webgl" ? stubGL().gl : null
      let read: { current: { fill: string; stroke?: string }[] } = { current: [] }
      function Scene() {
        read = useChart3D().scene
        return null
      }
      const chart = await mount(
        <ChartContainer3D config={{}} renderer={renderer}>
          <Marks3D marks={scene} />
          <Scene />
        </ChartContainer3D>
      )

      // Every shape of the scene is drawn, whatever the renderer.
      if (ctx) {
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 100)
        expect(ctx.arc).toHaveBeenCalledWith(400, 100, 10, 0, 2 * Math.PI)
      } else if (gl) {
        // The square is a fan of its 4 corners, the dot one of its 12 ring
        // points, and its white ring a line loop over the same 12.
        expect(gl.drawArrays.mock.calls).toEqual([
          [gl.TRIANGLE_FAN, 0, 4],
          [gl.TRIANGLE_FAN, 0, 12],
          [gl.LINE_LOOP, 0, 12],
        ])
      } else {
        expect(chart.svg.querySelector('path[fill="red"]')).not.toBeNull()
        expect(chart.svg.querySelector('circle[fill="blue"]')).not.toBeNull()
      }

      // The pointer on the square: the same tooltip, and the same lit fill in
      // the scene, on every renderer (ADR-0008).
      const painted = ctx ? ctx.fill.mock.calls.length : gl ? gl.drawArrays.mock.calls.length : 0
      await chart.send(pointer("pointermove", 150, 150))
      expect(chart.host.textContent).toContain("Square")
      expect(read.current.map((mark) => mark.fill)).toEqual([
        "var(--chart-3d-focus, color-mix(in oklch, red 60%, white))",
        "blue",
      ])
      // The hover reaches the reader: a canvas repaints, the SVG fills the square lit.
      if (ctx) expect(ctx.fill.mock.calls.length).toBeGreaterThan(painted)
      else if (gl) expect(gl.drawArrays.mock.calls.length).toBeGreaterThan(painted)
      else
        expect(
          chart.svg.querySelector(
            'path[fill="var(--chart-3d-focus, color-mix(in oklch, red 60%, white))"]'
          )
        ).not.toBeNull()

      // Off the marks, tooltip and focus clear the same everywhere.
      await chart.send(pointer("pointermove", 300, 300))
      expect(chart.host.textContent).not.toMatch(/Square|Dot/)
      expect(read.current.map((mark) => mark.fill)).toEqual(["red", "blue"])

      await chart.unmount()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })
})

describe("helpers", () => {
  test("axis ends on nice ticks and widens an empty extent", () => {
    expect(axis(3, 97)).toEqual({ domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100] })
    expect(axis(5, 5).domain[1]).toBeGreaterThan(5)
  })

  test("pad widens the domain by half a cell and leaves the ticks where they are", () => {
    expect(pad({ domain: [-0.5, 1.5], ticks: [0, 1] }, 1)).toEqual({
      domain: [-1, 2],
      ticks: [0, 1],
    })
  })

  test("linear maps a domain to a range and survives a domain of zero width", () => {
    expect(linear([0, 10], [-1, 1])(5)).toBe(0)
    expect(linear([2, 2], [-1, 1])(2)).toBe(-1)
  })

  test("faded mixes a color with transparent to its opacity, in whole percents, and leaves it opaque as it is", () => {
    expect(faded("red", 1)).toBe("red")
    expect(faded("red", 0.5)).toBe("color-mix(in oklab, red 50%, transparent)")
    expect(faded("red", 0.004)).toBe("color-mix(in oklab, red 0%, transparent)")
    // After shade, so the face keeps its light as it fades.
    expect(faded("color-mix(in oklch, red 80%, black)", 0.25)).toBe(
      "color-mix(in oklab, color-mix(in oklch, red 80%, black) 25%, transparent)"
    )
  })

  test("globe puts a lon/lat on the sphere: the prime meridian faces the viewer, east is right, north is up", () => {
    // Rounded, and -0 made 0, so the points compare as plain numbers.
    const at = (lon: number, lat: number, radius?: number) =>
      Object.fromEntries(
        Object.entries(globe(lon, lat, radius)).map(([a, v]) => [a, Math.round(v * 1e6) / 1e6 + 0])
      )
    expect(at(0, 0)).toEqual({ x: 0, y: 0, z: 1 })
    expect(at(90, 0)).toEqual({ x: 1, y: 0, z: 0 })
    // The box counts y downwards, so up is -y.
    expect(at(0, 90)).toEqual({ x: 0, y: -1, z: 0 })
    expect(at(180, -90, 2)).toEqual({ x: 0, y: 2, z: 0 })
  })

  test("shade does not depend on the winding of the face", () => {
    const face = [point(0, 0, 0), point(1, 0, 0), point(1, 1, 0)]
    expect(shade(face, "red")).toMatch(/^color-mix\(in oklch, red \d+%, black\)$/)
    expect(shade([...face].reverse(), "red")).toBe(shade(face, "red"))
  })

  test("cubeMarks shades the faces of a cube that look at the camera, each with the tooltip", () => {
    // Seen from the front, the left and above.
    const [cube] = cubes3D()
      .rotateY(Math.PI / 6)
      .rotateX(-Math.PI / 6)
      .data([box({ x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1 })])
    const tooltip = { items: [] }
    const marks = cubeMarks("c", cube.faces, "red", tooltip)

    expect(marks.map((m) => m.key).sort()).toEqual(["c-front", "c-left", "c-top"])
    for (const mark of marks) {
      expect(mark.fill).toMatch(/^color-mix\(in oklch, red \d+%, black\)$/)
      expect(mark.points).toHaveLength(4)
      expect(mark.tooltip).toBe(tooltip)
    }
  })

  test("useSeries keys every cell by its entry and series, and names the ticks of x and z", () => {
    let read: ReturnType<typeof useSeries> | undefined
    function Probe(props: Parameters<typeof useSeries>[0]) {
      read = useSeries(props)
      return null
    }
    renderToString(
      <ChartContainer3D config={{ a: { label: "A", color: "red" }, b: { color: "blue" } }}>
        <Probe
          data={[
            { name: "x", a: 1, b: "n/a" },
            { name: "y", a: 2, b: 3 },
          ]}
          index="name"
          format={{ x: (name) => name.toUpperCase() }}
        />
      </ChartContainer3D>
    )
    // The series are the keys of the config; a value that is not a number stands as 0.
    expect(read!.series).toEqual(["a", "b"])
    expect(read!.target).toEqual({ "x-a": 1, "x-b": 0, "y-a": 2, "y-b": 3 })
    expect(read!.values).toEqual(read!.target)
    expect(read!.rows).toEqual({ x: 0, y: 1 })
    expect([...read!.entries]).toEqual([
      ["x", { name: "x", a: 1, b: "n/a" }],
      ["y", { name: "y", a: 2, b: 3 }],
    ])
    expect(read!.presence).toEqual({ x: 1, y: 1 })
    // A tick of x names its entry, one beyond them none; a series without a label shows its key.
    expect([0, 1, 2].map(read!.labels.x)).toEqual(["X", "Y", ""])
    expect([0, 1].map(read!.labels.z)).toEqual(["A", "b"])
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
  test("the line of an axis runs the gliding span of its ticks, not its outermost tick", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const lengths = async (span?: number[]) => {
      const spec = { x: { ...axis(0, 4, 4), span }, y: axis(0, 10), z: axis(0, 10) }
      await act(async () =>
        root.render(
          <ChartContainer3D config={{}}>
            <Axes3D spec={spec} world={worldBox(spec)} />
          </ChartContainer3D>
        )
      )
      return [...host.querySelectorAll('[data-slot="chart-3d-axes"] line[stroke-width="1.5"]')].map(
        (l) => {
          const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((a) => Number(l.getAttribute(a)))
          return Math.hypot(x2 - x1, y2 - y1)
        }
      )
    }

    const outermost = await lengths()
    // A span that ends at the outermost tick draws the same line as no span.
    expect(await lengths([0, 4])).toEqual(outermost)
    // Halfway through a dropped tick, the four lines of x - one per edge -
    // end short of it; those of y and z stay.
    const glided = await lengths([0, 3.5])
    const shorter = glided.filter((length, i) => length < outermost[i] - 1)
    expect(shorter).toHaveLength(4)
    expect(glided.filter((length, i) => length === outermost[i])).toHaveLength(8)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a wall is a plain quad and its gridlines are lines keyed by tick, so a new one fades in", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (y: AxisSpec) => {
      const spec = { x: axis(0, 10), y, z: axis(0, 10) }
      return act(async () =>
        root.render(
          <ChartContainer3D config={{}}>
            <Axes3D spec={spec} world={worldBox(spec)} />
          </ChartContainer3D>
        )
      )
    }
    await render(axis(0, 100))

    // The walls carry no gridlines of their own: each is one closed quad, and
    // the gridlines are their own lines, in the border ink, which the
    // chart-3d-axes-in keyframe fades in when they mount.
    const walls = [...host.querySelectorAll<SVGPathElement>('[data-slot="chart-3d-axes"] path')]
    expect(walls.length).toBeGreaterThan(0)
    for (const wall of walls) expect(wall.getAttribute("d")).toMatch(/^M[^M]*Z$/)
    const gridlines = () => [
      ...host.querySelectorAll('[data-slot="chart-3d-axes"] line[stroke-width="0.75"]'),
    ]
    // Only the ticks between the ends draw gridlines - the border of the wall
    // is the line of an end tick. Three walls, two axes each, four ticks
    // between the ends per axis.
    const before = gridlines()
    expect(before).toHaveLength(24)

    // y goes from 0..100 (ticks 20, 40, 60, 80 between the ends) to 0..200
    // (50, 100, 150 between the ends). Keyed by value, the two walls that
    // grid y mount the three new ticks and drop the four gone ones, while the
    // x and z gridlines keep their nodes.
    await render(axis(0, 200))
    const after = gridlines()
    expect(after.filter((line) => !before.includes(line))).toHaveLength(6)
    expect(after.filter((line) => before.includes(line))).toHaveLength(before.length - 8)

    // While the end of the axis glides, a tick on or beyond it has no
    // gridline yet: it mounts - and fades in - once the end passes it.
    await render({ domain: [0, 130], ticks: axis(0, 200).ticks })
    expect(gridlines()).toHaveLength(20)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a leaving tick fades out in place: its label and its gridlines at opacity 0", async () => {
    const spec = {
      x: axis(0, 10),
      y: { domain: [0, 200], ticks: [0, 20, 50, 100, 150, 200], leaving: [20] },
      z: axis(0, 10),
    }
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Axes3D spec={spec} world={worldBox(spec)} />
      </ChartContainer3D>
    )
    // The labels of the leaving tick stay mounted, faded out by the transition.
    const labels = [...chart.svg.querySelectorAll("text")].filter((t) => t.textContent === "20")
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) expect(label.style.opacity).toBe("0")
    // Its gridlines fade with it: one per wall that grids y.
    const fading = [
      ...chart.svg.querySelectorAll<SVGLineElement>('line[stroke-width="0.75"]'),
    ].filter((line) => line.style.opacity === "0")
    expect(fading).toHaveLength(2)
    // A tick that stays keeps its label seen.
    const staying = [...chart.svg.querySelectorAll("text")].filter((t) => t.textContent === "50")
    expect(staying.some((t) => t.style.opacity === "1")).toBe(true)

    await chart.unmount()
  })

  test("the axis line never reaches past the gliding ends of its axis", async () => {
    // Mid-glide: the ends stand at 55 while the ticks already run to 70. The
    // line of the axis ends at the gliding end - the ticks beyond would drag
    // it out of the box, to appear at once instead of gliding in.
    const spec = {
      x: { domain: [0, 55], ticks: axis(0, 70).ticks },
      y: axis(0, 100),
      z: axis(0, 10),
    }
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Axes3D spec={spec} world={worldBox(spec)} />
      </ChartContainer3D>
    )
    const walls = [...chart.svg.querySelectorAll('[data-slot="chart-3d-axes"] path')]
    const cornerX = Math.max(
      ...walls.flatMap((wall) =>
        [...wall.getAttribute("d")!.matchAll(/([\d.-]+),[\d.-]+/g)].map(([, x]) => Number(x))
      )
    )
    const lineX = Math.max(
      ...[...chart.svg.querySelectorAll<SVGLineElement>('line[stroke-width="1.5"]')]
        .filter((line) => Number(line.style.opacity) > 0.5)
        .flatMap((line) => [Number(line.getAttribute("x1")), Number(line.getAttribute("x2"))])
    )
    expect(lineX).toBeLessThanOrEqual(cornerX + 0.5)

    await chart.unmount()
  })

  test("the enter fade covers the walls: the keyframe animates path with text and line", () => {
    const html = renderToString(
      <ChartContainer3D id="t" config={{}}>
        {null}
      </ChartContainer3D>
    )
    expect(html).toContain("path { animation: chart-3d-axes-in")
    expect(html.split("prefers-reduced-motion")[1]).toContain("path { animation: none")
  })

  test("thins an axis seen end on to its first label", async () => {
    const spec = { x: axis(0, 10), y: axis(0, 100, 2), z: axis(0, 10) }
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
      .filter((text) => Number(text.style.opacity) > 0)
      .map((text) => text.textContent!)

    expect(shown.filter((label) => label.startsWith("y"))).toEqual(["y0"])
    // The corner labels of two axes point out perpendicular sides, and with
    // room for the marks between them they cover each other no more.
    expect(shown.filter((label) => label.startsWith("x"))).toEqual([
      "x0",
      "x2",
      "x4",
      "x6",
      "x8",
      "x10",
    ])
    await chart.unmount()
  })

  test("a label that would cover the label of an axis with fewer ticks gives way to it", async () => {
    // Level with the box, the z axis points at the camera and its first label
    // sits where the x axis has its first tick, both pointing out below.
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10, 2) }
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Axes3D
          spec={spec}
          world={worldBox(spec)}
          format={{ x: (v) => `x${v}`, z: (v) => `z${v}` }}
        />
      </ChartContainer3D>
    )
    const shown = [...chart.host.querySelectorAll("text")]
      .filter((text) => Number(text.style.opacity) > 0.5)
      .map((text) => text.textContent!)

    expect(shown.filter((label) => label.startsWith("z"))).toEqual(["z0"])
    // x has six ticks to the three of z, so its first label gives way to z0.
    expect(shown.filter((label) => label.startsWith("x"))).toEqual(["x2", "x4", "x6", "x8", "x10"])
    // The mark of a label that gives way hides with it: of the five labels of
    // x that show, the six of y and the one of z, twelve marks are left.
    const marks = chart.host.querySelectorAll('[data-slot="chart-3d-axes"] line[stroke-width="1"]')
    expect(
      [...marks].filter((mark) => Number((mark as SVGLineElement).style.opacity) > 0.5)
    ).toHaveLength(12)
    await chart.unmount()
  })

  test("marks every tick of the chosen edge out of the box, and thins the marks with the labels", async () => {
    const spec = { x: axis(0, 10), y: axis(0, 100, 2), z: axis(0, 10) }
    // From above, the y axis thins to its first label; its marks thin with it.
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: Math.PI / 2 }}>
        <Axes3D spec={spec} world={worldBox(spec)} format={{ y: (v) => `y${v}` }} />
      </ChartContainer3D>
    )
    const marks = () => [
      ...chart.host.querySelectorAll<SVGLineElement>(
        '[data-slot="chart-3d-axes"] line[stroke-width="1"]'
      ),
    ]
    const shown = () => marks().filter((mark) => Number(mark.style.opacity) > 0.5)
    const of = (mark: SVGLineElement) => ({
      from: { x: Number(mark.getAttribute("x1")), y: Number(mark.getAttribute("y1")) },
      to: { x: Number(mark.getAttribute("x2")), y: Number(mark.getAttribute("y2")) },
    })
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y)

    // One mark per tick of every edge; the chosen edges show theirs, thinned like their labels.
    expect(marks()).toHaveLength(60)
    expect(shown()).toHaveLength(13)
    for (const mark of shown()) {
      expect(mark.getAttribute("class")).toContain("stroke-foreground/60")
      expect(dist(of(mark).from, of(mark).to)).toBeCloseTo(6, 5)
    }

    // The marks point out of the box, and every label stands clear of them,
    // as far out as the mark reaches and the space the label needs.
    const walls = [
      ...chart.host.querySelectorAll<SVGPathElement>('[data-slot="chart-3d-axes"] > path'),
    ]
    const xs = walls.flatMap((w) =>
      [...w.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
    )
    const ys = walls.flatMap((w) =>
      [...w.getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]))
    )
    const center = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    }
    for (const mark of shown()) {
      const { from, to } = of(mark)
      expect(dist(to, center)).toBeGreaterThan(dist(from, center))
    }
    const labels = [
      ...chart.host.querySelectorAll<SVGTextElement>('[data-slot="chart-3d-axes"] text'),
    ]
    for (const label of labels.filter((l) => Number(l.style.opacity) > 0.5)) {
      const at = { x: Number(label.getAttribute("x")), y: Number(label.getAttribute("y")) }
      for (const mark of shown()) expect(dist(at, of(mark).from)).toBeGreaterThan(10)
      expect(Math.min(...shown().map((mark) => dist(at, of(mark).from)))).toBeLessThan(20)
    }
    await chart.unmount()
  })

  test("titles the axes and labels them with numbers and elements", () => {
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10) }
    // Turned by π/4, one axis runs along the right side of the box.
    const html = renderToString(
      <ChartContainer3D config={{}} defaultView={{ yaw: Math.PI / 4, tilt: Math.PI / 6 }}>
        <Axes3D
          spec={spec}
          world={worldBox(spec)}
          titles={{ x: "Width", y: "Height", z: "Depth" }}
          format={{ x: (v) => v * 10, z: (v) => <tspan>z{v}</tspan> }}
        />
      </ChartContainer3D>
    )
    for (const title of ["Width", "Height", "Depth"]) expect(html).toContain(`>${title}</text>`)
    expect(html).toContain(">100</text>")
    expect(html).toContain("<tspan>z<!-- -->10</tspan>")
  })

  test("runs the title of an axis along its edge, never upside down", () => {
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10) }
    // The turn of the title that shows, with the camera at `yaw`.
    const turn = (yaw: number, title: string) => {
      const html = renderToString(
        <ChartContainer3D config={{}} defaultView={{ yaw, tilt: Math.PI / 6 }}>
          <Axes3D spec={spec} world={worldBox(spec)} titles={{ x: "Width", y: "Height" }} />
        </ChartContainer3D>
      )
      const shown = [...html.matchAll(new RegExp(`<text([^>]*)>${title}</text>`, "g"))]
        .map((m) => m[1])
        .filter((attrs) => attrs.includes("opacity:1;"))
      expect(shown).toHaveLength(1)
      return Number(/rotate\((-?[\d.]+)/.exec(shown[0])?.[1] ?? 0)
    }
    // The y axis stands vertical from every side and reads bottom-to-top.
    expect(turn(Math.PI / 4, "Height")).toBe(-90)
    expect(turn((5 * Math.PI) / 4, "Height")).toBe(-90)
    // Seen from behind, the x axis points left: its title turns round to read, leaning as from the front.
    const [front, behind] = [turn(Math.PI / 4, "Width"), turn((5 * Math.PI) / 4, "Width")]
    expect(Math.abs(front)).toBeGreaterThan(0)
    expect(Math.abs(front)).toBeLessThan(90)
    expect(behind).toBe(front)
  })

  test("draws the line of an axis on the edge it sits on, between its outermost ticks, and fades it from one to the next", async () => {
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10) }
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
        <Axes3D spec={spec} world={worldBox(spec)} />
      </ChartContainer3D>
    )
    const lines = () => [
      ...chart.host.querySelectorAll<SVGLineElement>(
        '[data-slot="chart-3d-axes"] line[stroke-width="1.5"]'
      ),
    ]
    const shown = () => lines().filter((line) => Number(line.style.opacity) > 0.5)
    // One line per edge of each axis, one edge of each axis chosen.
    expect(lines()).toHaveLength(12)
    expect(shown()).toHaveLength(3)
    for (const line of shown()) {
      expect(line.getAttribute("class")).toContain("stroke-foreground")
      expect(line.getAttribute("class")).toContain("transition-opacity")
    }

    const before = shown()[0]!
    for (let i = 0; i < 72 && Number(before.style.opacity) > 0.5; i += 1)
      await chart.send(key("ArrowRight"))
    // The line of the edge it left stays, unseen, so it fades out instead of vanishing.
    expect(Number(before.style.opacity)).toBe(0)
    expect(before.isConnected).toBe(true)
    expect(shown()).toHaveLength(3)
    await chart.unmount()
  })

  test("draws an axis on all four of its edges and fades it from one to the next as the camera turns", async () => {
    const spec = { x: axis(0, 10), y: axis(0, 100), z: axis(0, 10) }
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
        <Axes3D spec={spec} world={worldBox(spec)} format={{ x: (v) => `x${v}` }} />
      </ChartContainer3D>
    )
    const labels = () =>
      [...chart.host.querySelectorAll("text")].filter((t) => t.textContent === "x0")
    const shown = () => labels().find((t) => Number(t.style.opacity) > 0.5)
    expect(labels()).toHaveLength(4)

    const before = shown()!
    for (let i = 0; i < 72 && shown() === before; i += 1) await chart.send(key("ArrowRight"))
    // The label of the edge it left stays, unseen, so it fades out instead of vanishing.
    expect(shown()).not.toBe(before)
    expect(before.isConnected).toBe(true)
    expect(before.style.opacity).toBe("0")
    expect(before.getAttribute("class")).toContain("transition-[opacity,translate]")
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

  test("intoWorld hands a projection its accessors into the world box", () => {
    const spec = {
      x: { domain: [0, 10], ticks: [] },
      y: { domain: [0, 10], ticks: [] },
      z: { domain: [0, 10], ticks: [] },
    }
    // A projection without a camera turns by nothing, so the world shows in the round.
    const [point] = intoWorld(points3D(), worldBox(spec, 0.5)).data([{ x: 0, y: 10, z: 10 }])
    expect(point.rotated).toEqual({ x: -1, y: -1, z: 0.5 })
  })
})

describe("focus", () => {
  /** A square mark 50 wide at `x`, in `groups`. */
  const square = (key: string, x: number, groups?: string[]) => ({
    key,
    points: [
      { x, y: 100 },
      { x: x + 50, y: 100 },
      { x: x + 50, y: 150 },
      { x, y: 150 },
    ],
    fill: "red",
    tooltip: { items: [{ label: `tip-${key}`, value: 1 }] },
    groups,
  })
  const squares = [
    square("a", 0, ["a"]),
    square("b", 100, ["b"]),
    square("ab", 200, ["a", "b"]),
    square("none", 300),
  ]
  const labels = [
    { key: "la", at: { x: 0, y: 300 }, text: "A", anchor: "start" as const },
    { key: "lb", at: { x: 100, y: 300 }, text: "B", anchor: "start" as const },
  ]
  const lit = "var(--chart-3d-focus, color-mix(in oklch, red 60%, white))"
  const fills = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll("path")].map((path) => path.getAttribute("fill"))
  const strokes = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll("path")].map((path) => path.getAttribute("stroke"))
  const move = (clientX: number, clientY: number) =>
    new MouseEvent("pointermove", { bubbles: true, clientX, clientY })

  test("the pointer on a mark lights the fill of the marks that share its groups; off the mark it clears", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={squares} />
        <Labels3D labels={labels} />
      </ChartContainer3D>
    )
    expect(fills(chart.svg)).toEqual(["red", "red", "red", "red"])
    expect(strokes(chart.svg)).toEqual(["red", "red", "red", "red"])

    await chart.send(move(25, 125))
    expect(chart.host.textContent).toContain("tip-a")
    // a and ab share group "a" with the hovered mark and light up; b and the groupless one do
    // not. The seam of a lit mark follows its fill.
    expect(fills(chart.svg)).toEqual([lit, "red", lit, "red"])
    expect(strokes(chart.svg)).toEqual([lit, "red", lit, "red"])

    // Off the mark the tooltip and the focus go with it; leaving the chart does the same.
    await chart.send(move(25, 350))
    expect(chart.host.textContent).not.toContain("tip-a")
    expect(fills(chart.svg)).toEqual(["red", "red", "red", "red"])
    await chart.send(move(25, 125))
    expect(fills(chart.svg)).toEqual([lit, "red", lit, "red"])
    await chart.send(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }))
    expect(fills(chart.svg)).toEqual(["red", "red", "red", "red"])

    await chart.unmount()
  })

  test("the scene, which the canvas paints and the hover reads, has the lit marks too", async () => {
    let scene: { current: { fill: string; stroke?: string }[] } = { current: [] }
    function Scene() {
      scene = useChart3D().scene
      return null
    }
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={squares} />
        <Scene />
      </ChartContainer3D>
    )
    await chart.send(move(25, 125))
    expect(scene.current.map((mark) => mark.fill)).toEqual([lit, "red", lit, "red"])
    await chart.unmount()
  })

  test("a drag that turns the chart drops the tooltip and keeps the focus", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={squares} />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    const press = (type: string, clientX: number) =>
      new MouseEvent(type, { bubbles: true, clientX, clientY: 125, ctrlKey: true })

    await chart.send(move(25, 125))
    expect(chart.host.textContent).toContain("tip-a")
    await chart.send(press("pointerdown", 25))
    await chart.send(press("pointermove", 75))
    expect(chart.svg.setPointerCapture).toHaveBeenCalled()
    expect(chart.host.textContent).not.toContain("tip-a")
    expect(fills(chart.svg)).toContain(lit)

    await chart.unmount()
  })

  test("a focus on groups that no mark has any more highlights nothing", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (marks: typeof squares) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={{}}>
            <Marks3D marks={marks} />
          </ChartContainer3D>
        )
      )
    await render(squares)
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    await act(() => svg.dispatchEvent(move(25, 125)))
    expect(fills(svg)).toContain(lit)

    await render([square("b", 100, ["b"]), square("c", 200, ["c"])])
    expect(fills(svg)).toEqual(["red", "red"])

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("useTween", () => {
  // A browser that says the reader has not asked for reduced motion, so the chart may glide.
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("no-preference") }))
  )
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** Writes the numbers useTween returns as text, so every render shows them. */
  function Tween({ values, enter }: { values: Record<string, number>; enter?: number }) {
    return <text>{JSON.stringify(useTween(values, enter))}</text>
  }
  const shown = (host: HTMLElement) => JSON.parse(host.querySelector("text")!.textContent!)

  /** A chart of a `Tween`, which renders `values` and can render them again. */
  async function mountTween(duration: number) {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (values: Record<string, number>, enter?: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={{}} animationDuration={duration}>
            <Tween values={values} enter={enter} />
          </ChartContainer3D>
        )
      )
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { host, render, unmount }
  }

  test("glides from the numbers on screen into the new ones over the duration", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const chart = await mountTween(600)
    await chart.render({ a: 0 })
    await chart.render({ a: 600 })

    // The first render with new numbers still shows the old stand.
    expect(shown(chart.host)).toEqual({ a: 0 })
    await act(() => vi.advanceTimersByTime(300))
    const mid = shown(chart.host).a
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(600)
    await act(() => vi.advanceTimersByTime(400))
    expect(shown(chart.host)).toEqual({ a: 600 })

    await chart.unmount()
  })

  test("a new key starts at enter, and a gone one glides back to it before it leaves", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const chart = await mountTween(600)
    await chart.render({ a: 0 })
    await chart.render({ a: 600 })
    await act(() => vi.advanceTimersByTime(700))

    await chart.render({ a: 600, b: 300 }, 0)
    expect(shown(chart.host)).toEqual({ a: 600, b: 0 })
    await act(() => vi.advanceTimersByTime(700))
    expect(shown(chart.host)).toEqual({ a: 600, b: 300 })

    // Gone, b glides back to enter, the mirror of its entering, then leaves.
    await chart.render({ a: 600 }, 0)
    expect(shown(chart.host)).toEqual({ a: 600, b: 300 })
    await act(() => vi.advanceTimersByTime(300))
    const leaving = shown(chart.host).b
    expect(leaving).toBeGreaterThan(0)
    expect(leaving).toBeLessThan(300)
    await act(() => vi.advanceTimersByTime(400))
    expect(shown(chart.host)).toEqual({ a: 600 })

    // Without enter, a new key starts where it ends, and a gone one stands
    // where it is until the glide is done.
    await chart.render({ a: 500, c: 8 })
    expect(shown(chart.host)).toEqual({ a: 600, c: 8 })
    await act(() => vi.advanceTimersByTime(700))
    expect(shown(chart.host)).toEqual({ a: 500, c: 8 })
    await chart.render({ a: 400 })
    expect(shown(chart.host)).toEqual({ a: 500, c: 8 })
    await act(() => vi.advanceTimersByTime(300))
    expect(shown(chart.host).c).toBe(8)
    await act(() => vi.advanceTimersByTime(400))
    expect(shown(chart.host)).toEqual({ a: 400 })

    await chart.unmount()
  })

  test("without time, or with reduced motion, the numbers jump", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const jump = await mountTween(0)
    await jump.render({ a: 0 })
    await jump.render({ a: 600 })
    expect(shown(jump.host)).toEqual({ a: 600 })
    await jump.unmount()

    // The reader asks for reduced motion: no-preference does not match.
    vi.stubGlobal("matchMedia", () => ({ matches: false }))
    const reduce = await mountTween(600)
    await reduce.render({ a: 0 })
    await reduce.render({ a: 600 })
    expect(shown(reduce.host)).toEqual({ a: 600 })
    await reduce.unmount()
  })

  test("an update in the middle of a glide starts from the numbers on screen", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const chart = await mountTween(600)
    await chart.render({ a: 0 })
    await chart.render({ a: 600 })
    await act(() => vi.advanceTimersByTime(200))
    const mid = shown(chart.host).a

    await chart.render({ a: 0 })
    expect(shown(chart.host).a).toBe(mid)
    await act(() => vi.advanceTimersByTime(700))
    expect(shown(chart.host)).toEqual({ a: 0 })

    await chart.unmount()
  })

  test("hands back the target numbers themselves at the end, without float drift", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const chart = await mountTween(600)
    await chart.render({ a: 79.05191631611231 })
    await chart.render({ a: 11.752360577143339 })
    await act(() => vi.advanceTimersByTime(700))
    // 79.05191631611231 + (11.752360577143339 - 79.05191631611231) is not the target.
    expect(shown(chart.host)).toEqual({ a: 11.752360577143339 })

    await chart.unmount()
  })

  test("useTweenAxes glides the ends of the axes and keeps the ticks of the new spec", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    function Axes({ hi }: { hi: number }) {
      const spec = useTweenAxes({ x: axis(0, 1), y: axis(0, hi), z: axis(0, 1) })
      return <text>{JSON.stringify(spec.y)}</text>
    }
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (hi: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={{}}>
            <Axes hi={hi} />
          </ChartContainer3D>
        )
      )
    const y = () => JSON.parse(host.querySelector("text")!.textContent!)

    await render(100)
    await render(200)
    // Rounded, the end jumps from 100 to 200; the axis glides there with the new
    // ticks, and the dropped ones stay through the glide, fading out in place.
    await act(() => vi.advanceTimersByTime(300))
    const [lo, hi] = y().domain
    expect(lo).toBe(0)
    expect(hi).toBeGreaterThan(100)
    expect(hi).toBeLessThan(200)
    expect(y().ticks).toEqual([0, 20, 40, 50, 60, 80, 100, 150, 200])
    expect(y().leaving).toEqual([20, 40, 60, 80])
    // The span of the ticks, which the line of the axis runs, glides with the end.
    expect(y().span[1]).toBeGreaterThan(100)
    expect(y().span[1]).toBeLessThan(200)
    await act(() => vi.advanceTimersByTime(400))
    expect(y()).toEqual({ ...axis(0, 200), span: [0, 200] })

    await act(async () => root.unmount())
    host.remove()
  })

  test("useTweenAxes keeps a tick beyond the new ends until the glide is done, to fade it out", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    function Axes({ hi }: { hi: number }) {
      const spec = useTweenAxes({ x: axis(0, 1), y: axis(0, hi), z: axis(0, 1) })
      return <text>{JSON.stringify(spec.y)}</text>
    }
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = (hi: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={{}}>
            <Axes hi={hi} />
          </ChartContainer3D>
        )
      )
    const y = () => JSON.parse(host.querySelector("text")!.textContent!)

    await render(200)
    await render(100)
    // The axis shrinks: 150 and 200 lie beyond the new end, 50 within it. They
    // stay in the ticks while the end glides down - 50 fading out in place, the
    // others off the gliding ends - and leave once it arrives.
    await act(() => vi.advanceTimersByTime(300))
    expect(y().domain[1]).toBeGreaterThan(100)
    expect(y().ticks).toEqual([0, 20, 40, 50, 60, 80, 100, 150, 200])
    expect(y().leaving).toEqual([50])
    await act(() => vi.advanceTimersByTime(400))
    expect(y()).toEqual({ ...axis(0, 100), span: [0, 100] })

    // A shrink in the middle of a glide fades the ticks of the glide's target
    // out, not those of a spec long gone.
    await render(200)
    await act(() => vi.advanceTimersByTime(300))
    await render(100)
    await act(() => vi.advanceTimersByTime(100))
    expect(y().ticks).toEqual([0, 20, 40, 50, 60, 80, 100, 150, 200])
    await act(() => vi.advanceTimersByTime(700))
    expect(y()).toEqual({ ...axis(0, 100), span: [0, 100] })

    await act(async () => root.unmount())
    host.remove()
  })
})

describe("geo helpers", () => {
  test("orthographic copies the camera without its perspective", () => {
    const camera = camera3D()
      .origin({ x: 10, y: 20 })
      .scale(100)
      .rotateX(Math.PI / 2)
      .rotateY(Math.PI)
      .perspective(3)
    const eye = orthographic(camera)
    expect(eye.origin()).toEqual({ x: 10, y: 20 })
    expect(eye.scale()).toBe(100)
    expect(eye.rotateX()).toBe(Math.PI / 2)
    expect(eye.rotateY()).toBe(Math.PI)
    expect(eye.perspective()).not.toBe(3)
  })

  test("earth sets the projection to the camera in degrees at the radius of the globe, draws the sphere and then every region as rings, and drops a point", () => {
    const camera = camera3D()
      .origin({ x: 10, y: 20 })
      .scale(100)
      .rotateX(Math.PI / 2)
      .rotateY(Math.PI)
    const calls: unknown[] = []
    type P = {
      rotate(a: [number, number]): P
      scale(s: number): P
      translate(t: [number, number]): P
    }
    const projection: P = {
      rotate: (a) => (calls.push(["rotate", a]), projection),
      scale: (s) => (calls.push(["scale", s]), projection),
      translate: (t) => (calls.push(["translate", t]), projection),
    }
    const drawn: unknown[] = []
    // Stands in for d3-geo's geoPath: a square per object, and a point for the one named so.
    const geoPath =
      (
        p: P,
        sink: {
          beginPath(): void
          moveTo(x: number, y: number): void
          lineTo(x: number, y: number): void
          closePath(): void
          arc(): void
        }
      ) =>
      (object: { type: string }) => {
        expect(p).toBe(projection)
        drawn.push(object)
        sink.beginPath()
        sink.moveTo(0, 0)
        if (object.type === "Point") return sink.arc()
        sink.lineTo(1, 0)
        sink.lineTo(1, 1)
        sink.closePath()
      }
    const land = { features: [{ type: "Feature" }, { type: "Point" }, { type: "Feature" }] }
    const { marks, path, sink } = earth(land, camera, projection, geoPath)
    expect(calls).toEqual([
      ["rotate", [180, 90]],
      ["scale", 100 * GLOBE_RADIUS],
      ["translate", [10, 20]],
    ])
    expect(drawn[0]).toEqual({ type: "Sphere" })
    expect(marks.map((m) => m.key)).toEqual(["ocean-0", "land-0-0", "land-2-0"])
    expect(marks[0].fill).toBe("var(--chart-3d-ocean, var(--muted))")
    expect(marks[1]).toEqual({
      key: "land-0-0",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      fill: "var(--chart-3d-land, var(--border))",
    })
    // A chart of regions draws its own through the same path and sink.
    expect(sink.marks(() => path({ type: "Feature" }), "r", "red")).toEqual([
      { key: "r-0", points: marks[1].points, fill: "red" },
    ])
    // A hole is a ring wound the other way than the largest, the outer one: it is left out, not filled.
    const holed = () => {
      sink.moveTo(1, 1)
      sink.lineTo(1, 2)
      sink.lineTo(2, 2)
      sink.moveTo(0, 0)
      sink.lineTo(9, 0)
      sink.lineTo(9, 9)
      sink.moveTo(20, 0)
      sink.lineTo(21, 0)
      sink.lineTo(21, 1)
    }
    expect(sink.marks(holed, "h", "red").map((m) => m.points[0])).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ])
  })
})

describe("marks", () => {
  test("a circle is written rounded to two decimals, like a path, so the server HTML hydrates", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <Marks3D
          marks={[{ key: "c", points: [{ x: 100.123456, y: 50.987654 }], r: 4.56789, fill: "red" }]}
        />
      </ChartContainer3D>
    )
    expect(html).toContain('cx="100.12"')
    expect(html).toContain('cy="50.99"')
    expect(html).toContain('r="4.57"')
  })

  test("a tooltip given as a function is built when the pointer arrives on the mark, once", async () => {
    const lazy = vi.fn(() => ({ items: [{ label: "Lazy", value: 2 }] }))
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Marks3D marks={[{ ...marks[0], tooltip: lazy }]} />
      </ChartContainer3D>
    )
    expect(lazy).not.toHaveBeenCalled()
    await chart.send(pointer("pointermove", 150, 150))
    await chart.send(pointer("pointermove", 160, 150))
    expect(lazy).toHaveBeenCalledTimes(1)
    expect(chart.host.textContent).toContain("Lazy")
    await chart.unmount()
  })
})
