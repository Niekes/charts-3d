// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { box, cubes3D } from "d3-3d"

import {
  Axes3D,
  ChartContainer3D,
  ChartLegend3D,
  Labels3D,
  Marks3D,
  axis,
  center,
  cubeMarks,
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

const pointer = (type: string, clientX: number, clientY: number, relatedTarget?: EventTarget) =>
  new MouseEvent(type, { bubbles: true, clientX, clientY, relatedTarget: relatedTarget ?? null })

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

describe("shortcuts", () => {
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

  test("the panel lists an action by its label, its keys grouped by their modifiers", async () => {
    const chart = await mount(<ChartContainer3D config={{}}>{null}</ChartContainer3D>)
    expect(chart.svg.getAttribute("aria-label")).toBe(
      "3D chart. Drag to rotate it. Press ? for all shortcuts."
    )
    await chart.send(key("?"))

    expect(rows(chart.host)).toEqual([
      ["Rotate", "Drag", "←→↑↓"],
      ["Pan", "SpaceDrag", "Shift←→↑↓"],
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
    await chart.send(pointer("pointerdown", 150, 150))
    await chart.send(pointer("pointermove", 196, 150))
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
      "3D chart. Drag to rotate it. Press h for all shortcuts."
    )

    await chart.send(key("?"))
    expect(button.getAttribute("aria-expanded")).toBe("false")
    expect(button.hasAttribute("aria-controls")).toBe(false)
    await chart.send(key("h"))
    expect(button.getAttribute("aria-expanded")).toBe("true")
    const panel = chart.host.querySelector('[data-slot="chart-3d-shortcuts"]')!
    expect(button.getAttribute("aria-controls")).toBe(panel.id)

    expect(rows(chart.host).slice(0, 2)).toEqual([
      ["Rotate", "Drag", "→↑↓"],
      ["Links drehen", "←"],
    ])
    expect(rows(chart.host).at(-1)).toEqual(["Tastenkürzel", "h"])

    await chart.unmount()
  })
})

/** The rows of the open shortcut panel: the label, then the text of each group of keys. */
function rows(host: HTMLElement) {
  const panel = host.querySelector('[data-slot="chart-3d-shortcuts"]')!
  return [...panel.querySelectorAll("dt")].map((dt) => [
    dt.nextElementSibling!.textContent,
    ...[...dt.querySelectorAll('[data-slot="kbd-group"]')].map((group) => group.textContent),
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

    await chart.send(pointer("pointerdown", 150, 150))
    await chart.send(pointer("pointermove", 152, 151))
    expect(view(chart.host).yaw).toBe(0)
    expect(chart.svg.setPointerCapture).not.toHaveBeenCalled()

    await chart.send(pointer("pointermove", 196, 150))
    expect(chart.svg.setPointerCapture).toHaveBeenCalledTimes(1)
    expect(view(chart.host).yaw).toBeCloseTo((46 * Math.PI) / 230)
    // The drag takes the tooltip away and marks the chart as orbiting.
    expect(chart.host.textContent).not.toContain("Square")
    expect(chart.svg.dataset.orbiting).toBe("true")

    await chart.send(pointer("pointermove", 200, 150))
    expect(chart.svg.setPointerCapture).toHaveBeenCalledTimes(1)
    await chart.send(pointer("pointerup", 200, 150))
    expect(chart.svg.dataset.orbiting).toBe("false")

    await chart.unmount()
  })

  test("held Space turns a drag into a pan, until Space or the pointer is let go", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}} defaultView={{ yaw: 0, tilt: 0 }}>
        <Camera />
      </ChartContainer3D>
    )
    chart.svg.setPointerCapture = vi.fn()
    await chart.send(key(" "))
    await chart.send(pointer("pointerdown", 100, 100))
    await chart.send(pointer("pointermove", 130, 110))
    expect(view(chart.host)).toMatchObject({ origin: { x: 350, y: 210 }, yaw: 0 })
    expect(chart.svg.dataset.orbiting).toBe("false")

    await chart.send(pointer("pointercancel", 130, 110))
    await chart.send(new KeyboardEvent("keyup", { key: " ", bubbles: true }))
    await chart.send(pointer("pointerdown", 100, 100))
    await chart.send(pointer("pointermove", 130, 100))
    expect(view(chart.host).yaw).toBeCloseTo((30 * Math.PI) / 230)

    await chart.unmount()
  })

  test("a move within a mark keeps its tooltip, leaving the chart takes it away", async () => {
    const said = {
      ...marks[0],
      tooltip: { at: { x: 0, y: 0 }, items: [{ label: "Note", value: "n/a" }] },
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
    await chart.send(pointer("pointerdown", 100, 100))
    await chart.send(pointer("pointermove", 123, 100))
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
    await move(405, 100)
    expect(chart.host.textContent).toContain("Dot")
    await move(300, 300)
    expect(chart.host.textContent).not.toMatch(/Square|Dot/)

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

  test("cubeMarks shades the faces of a cube that look at the camera, each with the tooltip", () => {
    // Seen from the front, the left and above.
    const [cube] = cubes3D()
      .rotateY(Math.PI / 6)
      .rotateX(-Math.PI / 6)
      .data([box({ x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1 })])
    const tooltip = { at: { x: 0, y: 0 }, items: [] }
    const marks = cubeMarks("c", cube.faces, "red", tooltip)

    expect(marks.map((m) => m.key).sort()).toEqual(["c-front", "c-left", "c-top"])
    for (const mark of marks) {
      expect(mark.fill).toMatch(/^color-mix\(in oklch, red \d+%, black\)$/)
      expect(mark.points).toHaveLength(4)
      expect(mark.tooltip).toBe(tooltip)
    }
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
  test("thins an axis seen end on to its first label, and a label gives way to an axis with fewer ticks", async () => {
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
    // x0 would cover y0, and y has three ticks to the six of x.
    expect(shown.filter((label) => label.startsWith("x"))).toEqual(["x2", "x4", "x6", "x8", "x10"])
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
    tooltip: { at: { x: x + 25, y: 125 }, items: [{ label: `tip-${key}`, value: 1 }] },
    groups,
  })
  const squares = [
    square("a", 0, ["a"]),
    square("b", 100, ["b"]),
    square("ab", 200, ["a", "b"]),
    square("none", 300),
  ]
  const labels = [
    { key: "la", at: { x: 0, y: 300 }, text: "A", anchor: "start" as const, groups: ["a"] },
    { key: "lb", at: { x: 100, y: 300 }, text: "B", anchor: "start" as const, groups: ["b"] },
  ]
  const faded = "color-mix(in oklch, red 25%, var(--background))"
  const fills = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll("path")].map((path) => path.getAttribute("fill"))
  const fadedLabels = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll("[data-slot=chart-3d-labels] text")].map((text) =>
      text.classList.contains("opacity-25")
    )
  const move = (clientX: number, clientY: number) =>
    new MouseEvent("pointermove", { bubbles: true, clientX, clientY })

  test("the pointer on a mark fades the marks and labels that share none of its groups", async () => {
    const chart = await mount(
      <ChartContainer3D config={{}}>
        <Marks3D marks={squares} />
        <Labels3D labels={labels} />
      </ChartContainer3D>
    )
    expect(fills(chart.svg)).toEqual(["red", "red", "red", "red"])

    await chart.send(move(25, 125))
    expect(chart.host.textContent).toContain("tip-a")
    // b shares no group with a, ab shares one, and a mark without groups never fades.
    expect(fills(chart.svg)).toEqual(["red", faded, "red", "red"])
    expect(fadedLabels(chart.svg)).toEqual([false, true])

    // Off the marks the tooltip goes and the focus stays; leaving the chart drops it.
    await chart.send(move(25, 350))
    expect(chart.host.textContent).not.toContain("tip-a")
    expect(fills(chart.svg)).toEqual(["red", faded, "red", "red"])
    await chart.send(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }))
    expect(fills(chart.svg)).toEqual(["red", "red", "red", "red"])
    expect(fadedLabels(chart.svg)).toEqual([false, false])

    await chart.unmount()
  })

  test("a focus on groups that no mark has any more fades nothing", async () => {
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
    expect(fills(svg)).toContain(faded)

    await render([square("b", 100, ["b"]), square("c", 200, ["c"])])
    expect(fills(svg)).toEqual(["red", "red"])

    await act(async () => root.unmount())
    host.remove()
  })
})
