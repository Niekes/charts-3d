// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { BarChart3D } from "@/registry/new-york/ui/bar-chart-3d"
import { ChartContainer3D } from "@/registry/new-york/ui/chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = { a: { label: "A", color: "red" }, b: { label: "B", color: "blue" } }
const data = [
  { name: "x", a: 1, b: -2 },
  { name: "y", a: 3, b: 0.5 },
]
const faces = (html: string) => html.match(/<path d="[^"]*" fill="color-mix/g) ?? []

describe("BarChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the three faces of every bar that face the camera, a negative one too", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(12)
    expect(html).toContain("color-mix(in oklch, var(--color-b)")
    expect(html).not.toContain("NaN")
  })

  test("keys picks the series", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" keys={["a"]} />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(6)
    expect(html).not.toContain("var(--color-b)")
  })

  test("an empty chart draws the box and no bars", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={[]} index="name" />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(0)
    expect(html).not.toContain("NaN")
  })

  test("a bar under the pointer shows its entry and value in the tooltip", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <ChartContainer3D config={config}>
          <BarChart3D data={data} index="name" keys={["a"]} />
        </ChartContainer3D>
      )
    )
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    // The middle of the face painted last, which nothing covers.
    const face = [...host.querySelectorAll('path[fill^="color-mix"]')].at(-1)!
    const corners = face.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
    )
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
    )
    expect(host.textContent).toMatch(/A\s*[13]/)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a value that is not a number stands as no bar, and the labels fall back to the keys", () => {
    const html = renderToString(
      <ChartContainer3D config={{ a: { color: "red" } }}>
        <BarChart3D
          data={[
            { name: "x", a: "n/a", b: 2 },
            { a: 1, b: 3 },
          ]}
          index="name"
          keys={["a", "b"]}
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("NaN")
    // `b` has no label in the config, the entry without a name has an empty one.
    expect(html).toMatch(/>b<\/text>/)
    expect(html).toMatch(/><\/text>/)
  })
})

// The demo of the docs: six months, and two series that both have to show.
const months = ["January", "February", "March", "April", "May", "June"].map((month, i) => ({
  month,
  desktop: [186, 305, 237, 73, 209, 214][i],
  mobile: [80, 200, 120, 190, 130, 140][i],
}))
const demo = {
  desktop: { label: "Desktop", color: "red" },
  mobile: { label: "Mobile", color: "blue" },
}

/** Renders `element` into the document, with an svg of the size of its view box. */
async function mount(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  svg.setPointerCapture = () => {}
  const send = (type: string, init: object) =>
    act(() =>
      svg.dispatchEvent(
        new (type.startsWith("key") ? KeyboardEvent : MouseEvent)(type, { bubbles: true, ...init })
      )
    )
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }
  return { host, send, unmount }
}

/**
 * The labels of the box as the chart draws them: their text, how much of them
 * shows and the box they cover, guessed at 0.6em a character as the chart does.
 */
function drawn(host: HTMLElement) {
  return [...host.querySelectorAll<SVGTextElement>('[data-slot="chart-3d-axes"] text')].map(
    (el) => {
      const [dx = 0, dy = 0] = (el.style.translate || "0px").split(" ").map(parseFloat)
      const h = el.classList.contains("text-[10px]") ? 10 : 12
      const w = el.textContent!.length * h * 0.6
      const anchor = { start: 0.5, middle: 0, end: -0.5 }[
        el.getAttribute("text-anchor") ?? "start"
      ]!
      const x = Number(el.getAttribute("x")) + dx + anchor * w
      return {
        el,
        dx,
        dy,
        text: el.textContent!,
        x,
        y: Number(el.getAttribute("y")) + dy,
        w,
        h,
        opacity: Number(el.style.opacity || 1),
      }
    }
  )
}

const apart = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2)

const chart = (
  defaultView: { yaw: number; tilt: number },
  titles: Record<string, string> = { y: "Visitors" }
) => (
  <ChartContainer3D config={demo} defaultView={defaultView}>
    <BarChart3D data={months} index="month" format={{ x: (m) => m.slice(0, 3) }} titles={titles} />
  </ChartContainer3D>
)

describe("BarChart3D labels", () => {
  test("show both series from every angle, and no two labels that show cover each other", async () => {
    // Every 5° round, every 15° from below to above the box.
    const bars = await mount(chart({ yaw: 0, tilt: -Math.PI / 2 }))
    const failures: string[] = []
    for (let tilt = -90; tilt <= 90; tilt += 15) {
      for (let yaw = 0; yaw < 360; yaw += 5) {
        const shown = drawn(bars.host).filter((label) => label.opacity > 0.5)
        const series = shown
          .filter((l) => l.text === "Desktop" || l.text === "Mobile")
          .map((l) => `${l.text} ${l.opacity}`)
          .join()
        if (series !== "Desktop 1,Mobile 1") failures.push(`${yaw}°/${tilt}°: ${series}`)
        for (const [i, a] of shown.entries())
          for (const b of shown.slice(i + 1))
            if (apart(a, b) < 0) failures.push(`${yaw}°/${tilt}°: ${a.text} covers ${b.text}`)
        await bars.send("keydown", { key: "ArrowRight" })
      }
      for (let i = 0; i < 3; i += 1) await bars.send("keydown", { key: "ArrowDown" })
    }
    expect(failures).toEqual([])
    await bars.unmount()
  }, 60_000)

  test("slide round their ticks as the camera turns, and never jump", async () => {
    let worst = 0
    for (const tilt of [-30, 15, 30, 60]) {
      const bars = await mount(chart({ yaw: 0, tilt: (tilt * Math.PI) / 180 }))
      let last = new Map(drawn(bars.host).map((label) => [label.el, label]))
      // A drag of 2px turns the camera by 1.6°, a whole turn in 230 steps.
      await bars.send("pointerdown", { clientX: 0, clientY: 0 })
      for (let x = 4; x <= 464; x += 2) {
        await bars.send("pointermove", { clientX: x, clientY: 0 })
        const now = drawn(bars.host)
        for (const label of now) {
          const before = last.get(label.el)
          if (!before || label.opacity < 0.5 || before.opacity < 0.5) continue
          // A change of row moves in a transition; the place follows the camera at once.
          const place = (l: typeof label) => ({ x: l.x - l.dx, y: l.y - l.dy })
          const [a, b] = [place(before), place(label)]
          worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y))
        }
        last = new Map(now.map((label) => [label.el, label]))
      }
      await bars.unmount()
    }
    // A tick moves by up to 6px a step; a label whose text anchor flips jumps by half its width more.
    expect(worst).toBeLessThan(8)
  }, 60_000)

  test("slide two series apart along their edge where they would just touch", async () => {
    const bars = await mount(chart({ yaw: (70 * Math.PI) / 180, tilt: Math.PI / 6 }))
    const shift = (text: string) => {
      const label = drawn(bars.host).find((l) => l.text === text && l.opacity === 1)!
      return { x: label.dx, y: label.dy }
    }
    const [desktop, mobile] = [shift("Desktop"), shift("Mobile")]
    // A pixel or two each, in opposite directions, and no further than a label may slide.
    expect(Math.hypot(desktop.x, desktop.y)).toBeGreaterThan(0.5)
    expect(Math.hypot(mobile.x, mobile.y)).toBeLessThan(12)
    expect(desktop.x * mobile.x + desktop.y * mobile.y).toBeLessThan(0)
    await bars.unmount()
  })

  test("stack two series in two rows where the camera looks along their axis, the title beyond", async () => {
    // Level with the box and turned by 10°, the two rows of bars stand almost behind one another.
    const bars = await mount(
      chart({ yaw: (10 * Math.PI) / 180, tilt: 0 }, { y: "Visitors", z: "Device" })
    )
    const row = (text: string) =>
      drawn(bars.host).find((l) => l.text === text && l.opacity > 0)!.el.style.translate
    expect(row("Desktop")).toBe("0px 0px")
    expect(row("Mobile")).not.toBe("0px 0px")
    expect(row("Device")).toBe(row("Mobile"))
    await bars.unmount()
  })
})

describe("BarChart3D transitions", () => {
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
    const render = async (values: { name: string; a: number; b: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={values} index="name" />
          </ChartContainer3D>
        )
      )

    await render(data)
    await render([
      { name: "x", a: 10, b: -20 },
      { name: "y", a: 8, b: -15 },
    ])
    // The y axis still shows the ticks of the old values.
    expect(host.textContent).not.toContain("-20")
    await act(() => vi.advanceTimersByTime(700))
    expect(host.textContent).toContain("-20")

    await act(async () => root.unmount())
    host.remove()
  })

  test("a bar that keeps its value keeps its height smooth, and a tick that stays glides as the same label", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (b: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={[{ name: "x", a: 100, b }]} index="name" />
          </ChartContainer3D>
        )
      )
    // The screen height of the bar of `a`, from the faces it shows.
    const height = () => {
      const faces = host.querySelectorAll('path[fill^="color-mix(in oklch, var(--color-a)"]')
      const ys = [...faces].flatMap((face) =>
        face
          .getAttribute("d")!
          .slice(1, -1)
          .split("L")
          .map((c) => Number(c.split(",")[1]))
      )
      return Math.max(...ys) - Math.min(...ys)
    }
    const tick = () =>
      [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')].find(
        (t) => t.textContent === "100" && (t as SVGTextElement).style.opacity === "1"
      )

    await render(305)
    const before = tick()
    // From 305 to 480, the y axis rounds its end from 350 to 500, over 400 and 450.
    await render(480)
    let last = height()
    let worst = 0
    for (let frame = 0; frame < 45; frame += 1) {
      await act(() => vi.advanceTimersByTime(16))
      worst = Math.max(worst, Math.abs(height() - last))
      last = height()
    }
    // The box shrinks under the bar by 30px in all; ends that jumped would take 10px at once.
    expect(worst).toBeLessThan(2)
    expect(tick()).toBe(before)

    await act(async () => root.unmount())
    host.remove()
  })
})
