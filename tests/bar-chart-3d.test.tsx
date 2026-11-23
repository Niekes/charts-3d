// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { BarChart3D } from "@/registry/new-york/ui/bar-chart-3d"
import { ChartContainer3D, type Renderer3D, type Tooltip3D } from "@/registry/new-york/ui/chart-3d"

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
    expect(html).toContain("color-mix(in oklch, var(--color-b, currentColor)")
    expect(html).not.toContain("NaN")
  })

  test("a bar below the floor paints in the order of its footprint, as one above it: a bar behind never paints over the one before it", () => {
    // The series in paint order, far to near.
    const order = (row: Record<string, number>) => {
      const html = renderToString(
        <ChartContainer3D config={config}>
          <BarChart3D data={[{ name: "x", ...row }]} index="name" />
        </ChartContainer3D>
      )
      const painted = [
        ...html.matchAll(/<path d="[^"]*" fill="color-mix\(in oklch, var\(--color-(\w+)/g),
      ]
      expect(painted).toHaveLength(6)
      return [...new Set(painted.map((face) => face[1]))]
    }
    // The two bars stand in the same cells whatever their values: `a` behind `b`.
    expect(order({ a: 10, b: 1 })).toEqual(["a", "b"])
    // Both hang from the floor, the near one deeper, then the far one.
    expect(order({ a: -1, b: -10 })).toEqual(["a", "b"])
    expect(order({ a: -10, b: -1 })).toEqual(["a", "b"])
    // One above the floor and one below it, either way round.
    expect(order({ a: 10, b: -10 })).toEqual(["a", "b"])
    expect(order({ a: -10, b: 10 })).toEqual(["a", "b"])
  })

  test("in perspective the bars paint by their distance from the eye: looking along the rows, a bar hides the one further out on either side", () => {
    const five = Object.fromEntries("abcde".split("").map((key) => [key, { color: "red" }]))
    const html = renderToString(
      <ChartContainer3D config={five} defaultView={{ yaw: Math.PI / 2, tilt: 0.4, perspective: 3 }}>
        <BarChart3D data={[{ name: "x", a: 1, b: 1, c: 1, d: 1, e: 1 }]} index="name" />
      </ChartContainer3D>
    )
    // The series in paint order, far to near.
    const painted = [
      ...new Set(
        [...html.matchAll(/<path d="[^"]*" fill="color-mix\(in oklch, var\(--color-(\w+)/g)].map(
          (face) => face[1]
        )
      ),
    ]
    expect(painted).toHaveLength(5)
    const at = (key: string) => painted.indexOf(key)
    // The eye stands before the middle series, `c`: from there `b` hides part of `a` and `c`
    // part of `b`, and on the other side `d` hides part of `e` and `c` part of `d`.
    expect(at("a")).toBeLessThan(at("b"))
    expect(at("b")).toBeLessThan(at("c"))
    expect(at("e")).toBeLessThan(at("d"))
    expect(at("d")).toBeLessThan(at("c"))
  })

  test("in perspective a face that looks left and one that looks right are lit differently, as the light comes from the left", () => {
    // Seen nearly along z in perspective, the bars left of the eye show their right side
    // and the bars right of it their left side: with the top and the front, four shades.
    const shades = (perspective?: number) => {
      const html = renderToString(
        <ChartContainer3D config={config} defaultView={{ yaw: 0.1, tilt: 0.3, perspective }}>
          <BarChart3D
            data={"abcdefg".split("").map((name) => ({ name, a: 5 }))}
            index="name"
            keys={["a"]}
          />
        </ChartContainer3D>
      )
      return new Set(
        [...html.matchAll(/<path d="[^"]*" fill="color-mix\(in oklch, [^)]*\) (\d+)%, black/g)].map(
          (face) => face[1]
        )
      )
    }
    // Without perspective every bar shows the same three faces.
    expect(shades().size).toBe(3)
    expect(shades(4).size).toBe(4)
  })

  test("keys picks the series", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" keys={["a"]} />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(6)
    expect(html).not.toContain("var(--color-b, currentColor)")
  })

  test("a key listed twice in keys is one series: no empty lane, no second tick", () => {
    const html = (keys: string[]) =>
      renderToString(
        <ChartContainer3D id="c" config={config}>
          <BarChart3D data={data} index="name" keys={keys} />
        </ChartContainer3D>
      )
    expect(html(["a", "a"])).toBe(html(["a"]))
  })

  test("an empty chart draws the box and no bars", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={[]} index="name" />
      </ChartContainer3D>
    )
    expect(faces(html)).toHaveLength(0)
    expect(html).not.toContain("NaN")
    // Every series turned off as well: no entries and no series.
    const none = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={[]} index="name" keys={[]} />
      </ChartContainer3D>
    )
    expect(none).not.toContain("NaN")
  })

  test("the box keeps half a cell of room between the bars and its walls", async () => {
    // Level with the front, the screen follows the x of the box, so the room
    // between the bars and the walls is there to read off.
    const bars = await mount(
      <ChartContainer3D config={config} defaultView={{ yaw: 0, tilt: Math.PI / 6 }}>
        <BarChart3D data={data} index="name" />
      </ChartContainer3D>
    )
    const xs = (elements: Element[]) =>
      elements.flatMap((el) =>
        [...(el as SVGPathElement).getAttribute("d")!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) =>
          Number(m[1])
        )
      )
    const barFaces = xs([...bars.host.querySelectorAll('path[fill^="color-mix"]')])
    const walls = xs([
      ...bars.host.querySelectorAll('[data-slot="chart-3d-axes"] > path[stroke-width="0.75"]'),
    ])
    // Without the padding the bars stand a fifth of a cell from the walls, half
    // a cell with it.
    expect(Math.min(...barFaces) - Math.min(...walls)).toBeGreaterThan(40)
    await bars.unmount()
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

  test("tooltip makes what a bar says from the default and the entry and series behind it", async () => {
    const seen: { entry: { name: string }; key: string }[] = []
    const view = await mount(
      <ChartContainer3D config={config}>
        <BarChart3D
          data={data}
          index="name"
          keys={["a"]}
          tooltip={(tip, bar) => {
            seen.push(bar)
            return {
              ...tip,
              title: `${bar.entry.name}/${bar.key}`,
              items: tip.items.map((item) => ({ ...item, value: "n/a" })),
            }
          }}
        />
      </ChartContainer3D>
    )
    await view.send("pointermove", lastFace(view.host))
    expect(seen).toHaveLength(1)
    expect(seen[0].key).toBe("a")
    expect(data).toContain(seen[0].entry)
    expect(tip(view.host)).toBe(`${seen[0].entry.name}/aAn/a`)
    await view.unmount()
  })

  test("a bar under a resting pointer builds its tooltip once, not again at every frame", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    let built = 0
    const tooltip = (tip: Tooltip3D) => (built++, tip)
    // Props that keep their identity, as at a frame of the camera, which renders the chart alone.
    const keys = ["a"]
    const render = (rows: typeof data) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" keys={keys} tooltip={tooltip} />
          </ChartContainer3D>
        )
      )
    await render(data)
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, ...lastFace(host) }))
    )
    expect(built).toBe(1)
    // A frame of the camera renders the chart again with the same data.
    for (let i = 0; i < 3; i++) await render(data)
    expect(built).toBe(1)
    // New data under the pointer says the new value.
    await render(data.map((d) => ({ ...d, a: d.a * 10 })))
    expect(built).toBe(2)
    expect(tip(host)).toMatch(/A\s*(10|30)/)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a missing value draws no bar, as in the bar field: an empty cell of a sparse table stays empty", () => {
    const html = (rows: Record<string, unknown>[]) =>
      renderToString(
        <ChartContainer3D config={config}>
          <BarChart3D data={rows} index="name" />
        </ChartContainer3D>
      )
    for (const missing of [null, undefined, "", "n/a", Infinity]) {
      expect(faces(html([{ name: "x", a: 1, b: missing }]))).toHaveLength(3)
    }
    expect(faces(html([{ name: "x", a: null }]))).toHaveLength(0)
  })

  test("a tooltip of null shows none", async () => {
    const view = await mount(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" keys={["a"]} tooltip={() => null} />
      </ChartContainer3D>
    )
    await view.send("pointermove", lastFace(view.host))
    expect(view.host.querySelector('[data-slot="chart-3d-tooltip"]')).toBeNull()
    await view.unmount()
  })

  test("the tooltip names the entry and its value as the ticks do, through format; a series without a label by its key", async () => {
    const view = await mount(
      <ChartContainer3D config={{ a: { color: "red" } }}>
        <BarChart3D
          data={data}
          index="name"
          format={{ x: (label) => label.toUpperCase(), y: (value) => `${value} €` }}
        />
      </ChartContainer3D>
    )
    await view.send("pointermove", lastFace(view.host))
    expect(tip(view.host)).toMatch(/^[XY]a[13] €$/)
    await view.unmount()
  })

  test("a value that is not a finite number stands as no bar, and the labels fall back to the keys", () => {
    const html = renderToString(
      <ChartContainer3D config={{ a: { color: "red" } }}>
        <BarChart3D
          data={[
            { name: "x", a: "n/a", b: 2 },
            { a: 1, b: 3 },
            // A ratio divided by 0.
            { name: "y", a: Infinity, b: 1 },
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

/** The middle of the face painted last, which nothing covers. */
function lastFace(host: HTMLElement) {
  const face = [...host.querySelectorAll('path[fill^="color-mix"]')].at(-1)!
  const corners = face.getAttribute("d")!.slice(1, -1).split("L")
  const [clientX, clientY] = [0, 1].map(
    (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
  )
  return { clientX, clientY }
}

const tip = (host: HTMLElement) =>
  host.querySelector('[data-slot="chart-3d-tooltip"]')?.textContent ?? ""

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
      // The title of an axis lies along its edge, aslant.
      const turn =
        (Number(/rotate\((-?[\d.]+)/.exec(el.getAttribute("transform") ?? "")?.[1] ?? 0) *
          Math.PI) /
        180
      const x = Number(el.getAttribute("x")) + dx
      return {
        el,
        dx,
        dy,
        text: el.textContent!,
        x,
        y: Number(el.getAttribute("y")) + dy,
        w,
        h,
        turn,
        opacity: Number(el.style.opacity || 1),
      }
    }
  )
}

type Box = { x: number; y: number; w: number; h: number; turn: number }

/** The space between the boxes of two labels, negative where they overlap: the widest gap along a side of either, as a title lies aslant. */
const apart = (a: Box, b: Box) =>
  Math.max(
    ...[a.turn, a.turn + Math.PI / 2, b.turn, b.turn + Math.PI / 2].map((t) => {
      const e = { x: Math.cos(t), y: Math.sin(t) }
      const reach = (l: Box) =>
        (l.w / 2) * Math.abs(Math.cos(l.turn) * e.x + Math.sin(l.turn) * e.y) +
        (l.h / 2) * Math.abs(Math.cos(l.turn) * e.y - Math.sin(l.turn) * e.x)
      return Math.abs((a.x - b.x) * e.x + (a.y - b.y) * e.y) - reach(a) - reach(b)
    })
  )

const chart = (
  defaultView: { yaw: number; tilt: number; perspective?: number },
  titles: Record<string, string> = { y: "Visitors" }
) => (
  <ChartContainer3D config={demo} defaultView={defaultView}>
    <BarChart3D data={months} index="month" format={{ x: (m) => m.slice(0, 3) }} titles={titles} />
  </ChartContainer3D>
)

describe("BarChart3D labels", () => {
  test("show both series from every angle, and no two labels that show cover each other", async () => {
    const failures: string[] = []
    // Every 5° round, every 15° from below to above the box; once more in perspective, where the edges lean.
    for (const perspective of [undefined, 4]) {
      // shortcut: straight from below in perspective the y tick labels overlap, so that pass starts at -75°; fix `fit` for a leaning edge before a chart looks from there.
      const from = perspective ? -75 : -90
      const bars = await mount(
        chart(
          { yaw: 0, tilt: (from * Math.PI) / 180, perspective },
          { x: "Month", y: "Visitors", z: "Device" }
        )
      )
      const view = (yaw: number, tilt: number) => `${yaw}°/${tilt}°${perspective ? "/p" : ""}`
      for (let tilt = from; tilt <= 90; tilt += 15) {
        for (let yaw = 0; yaw < 360; yaw += 5) {
          const shown = drawn(bars.host).filter((label) => label.opacity > 0.5)
          const series = shown
            .filter((l) => l.text === "Desktop" || l.text === "Mobile")
            .map((l) => `${l.text} ${l.opacity}`)
            .join()
          if (series !== "Desktop 1,Mobile 1") failures.push(`${view(yaw, tilt)}: ${series}`)
          // A floor title shows unless its edge points at the camera, level with it or nearly: the
          // months run along x, which points at it from 90° and 270°, the two rows along z, from 0° and 180°.
          for (const [title, facing] of [
            ["Month", 90],
            ["Device", 0],
          ] as const) {
            const off = Math.abs(((((yaw - facing + 90) % 180) + 180) % 180) - 90)
            const edgeOn = Math.abs(tilt) <= 15 && off <= 20
            if (!edgeOn && !shown.some((l) => l.text === title))
              failures.push(`${view(yaw, tilt)}: no ${title}`)
          }
          for (const [i, a] of shown.entries())
            for (const b of shown.slice(i + 1))
              if (apart(a, b) < 0) failures.push(`${view(yaw, tilt)}: ${a.text} covers ${b.text}`)
          await bars.send("keydown", { key: "ArrowRight" })
        }
        for (let i = 0; i < 3; i += 1) await bars.send("keydown", { key: "ArrowDown" })
      }
      await bars.unmount()
    }
    expect(failures).toEqual([])
  }, 60_000)

  test("slide round their ticks as the camera turns, and never jump", async () => {
    let worst = 0
    // From below, level and from above; once in perspective, where the edges of the box lean.
    for (const [tilt, perspective] of [[-30], [15], [30, 4], [60]] as [number, number?][]) {
      const bars = await mount(chart({ yaw: 0, tilt: (tilt * Math.PI) / 180, perspective }))
      let last = new Map(drawn(bars.host).map((label) => [label.el, label]))
      // A drag of 2px with the platform modifier turns the camera by 1.6°, a whole turn in 230 steps.
      await bars.send("pointerdown", { clientX: 0, clientY: 0, ctrlKey: true })
      for (let x = 4; x <= 464; x += 2) {
        await bars.send("pointermove", { clientX: x, clientY: 0, ctrlKey: true })
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

  test("bend the mark of a slid label to it, and the marks never cross", async () => {
    const bars = await mount(chart({ yaw: (70 * Math.PI) / 180, tilt: Math.PI / 6 }))
    const marks = [
      ...bars.host.querySelectorAll('[data-slot="chart-3d-axes"] path[stroke-width="1"]'),
    ].map((el) => {
      const [x0, y0, ...rest] = el
        .getAttribute("d")!
        .match(/-?[\d.]+/g)!
        .map(Number)
      return { from: { x: x0, y: y0 }, to: { x: rest.at(-2)!, y: rest.at(-1)! } }
    })
    const ends = ["Desktop", "Mobile"].map((text) => {
      const label = drawn(bars.host).find((l) => l.text === text && l.opacity === 1)!
      const at = { x: label.x - label.dx, y: label.y - label.dy }
      // The mark of a label starts at its tick, straight in from the label before it slid.
      const near = (p: { x: number; y: number }) => Math.hypot(p.x - at.x, p.y - at.y)
      const mark = marks.reduce((a, b) => (near(b.from) < near(a.from) ? b : a))
      // Without the slide, the mark reaches straight out MARK, 6px.
      const straight = { x: mark.to.x - label.dx, y: mark.to.y - label.dy }
      expect(Math.hypot(straight.x - mark.from.x, straight.y - mark.from.y)).toBeCloseTo(6, 1)
      return mark
    })
    // The two labels slid apart, and their marks with them: their ends lie further apart than their ticks.
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y)
    expect(dist(ends[0].to, ends[1].to)).toBeGreaterThan(dist(ends[0].from, ends[1].from))
    await bars.unmount()
  })

  test("stack two series in two rows where the camera looks along their axis, the title beyond", async () => {
    // Level with the box and turned by 20°, the two rows of bars stand almost behind one another.
    const bars = await mount(
      chart({ yaw: (20 * Math.PI) / 180, tilt: 0 }, { y: "Visitors", z: "Device" })
    )
    const row = (text: string) =>
      drawn(bars.host).find((l) => l.text === text && l.opacity > 0.5)!.el.style.translate
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
    // The opacity of every axis label with `text`: out-of-range ticks stay mounted but faded out.
    const opacities = (text: string) =>
      [...host.querySelectorAll('[data-slot="chart-3d-axes"] text')]
        .filter((t) => t.textContent === text)
        .map((t) => (t as SVGTextElement).style.opacity)
    // Mid-glide, -20 is outside the gliding ends: present, but faded out.
    expect(opacities("-20").length).toBeGreaterThan(0)
    expect(opacities("-20").every((o) => o === "0")).toBe(true)
    await act(() => vi.advanceTimersByTime(700))
    expect(opacities("-20").some((o) => o === "1")).toBe(true)

    await act(async () => root.unmount())
    host.remove()
  })

  test("rows reordered while one leaves: the leaving bar fades out, never black", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: { year: string; a: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="year" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    const fills = () =>
      [...host.querySelectorAll('[data-slot="chart-3d-marks"] path')].map((p) =>
        p.getAttribute("fill")
      )
    const [a, b, c] = [2019, 2020, 2021].map((y, i) => ({ year: String(y), a: i + 1 }))

    await render([a, b, c])
    await render([b, c])
    await act(() => vi.advanceTimersByTime(300))
    // Integer-like names keep their order in the presence, so it does not restart with the rows.
    await render([c, b])
    await act(() => vi.advanceTimersByTime(400))
    expect(fills().join()).not.toContain("NaN")

    await act(async () => root.unmount())
    host.remove()
  })

  test("a gone row shrinks away while the rows around it glide to their new cells", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: { name: string; a: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    const faces = () => host.querySelectorAll('path[fill*="var(--color-a, currentColor)"]')
    const fading = () => host.querySelectorAll('path[fill^="color-mix(in oklab"]')
    const rightEdge = () =>
      Math.max(
        ...[...faces()].flatMap((f) =>
          f
            .getAttribute("d")!
            .slice(1, -1)
            .split("L")
            .map((c) => Number(c.split(",")[0]))
        )
      )

    await render([
      { name: "x", a: 100 },
      { name: "y", a: 50 },
      { name: "z", a: 80 },
    ])
    const bars0 = faces().length
    const edge0 = rightEdge()

    // y leaves: its bar stays through the glide, shrinking, while z glides inward.
    await render([
      { name: "x", a: 100 },
      { name: "z", a: 80 },
    ])
    expect(faces().length).toBe(bars0)
    await act(() => vi.advanceTimersByTime(300))
    expect(faces().length).toBe(bars0)
    // It fades as it shrinks, so a flat bar never pops out; the others stay opaque.
    expect(fading().length).toBe(bars0 / 3)
    const edgeMid = rightEdge()
    await act(() => vi.advanceTimersByTime(150))
    const edgeLate = rightEdge()
    await act(() => vi.advanceTimersByTime(250))
    expect(faces().length).toBe((bars0 / 3) * 2)
    const edge1 = rightEdge()
    // z travels: away from its start mid-glide, and closing on its end late.
    expect(edgeMid).not.toBe(edge0)
    expect(Math.abs(edgeLate - edge1)).toBeLessThan(Math.abs(edgeMid - edge1))

    await act(async () => root.unmount())
    host.remove()
  })

  test("mid-glide, a bar tells the value of the data, not the gliding number", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (a: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={[{ name: "x", a }]} index="name" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    await render(100)
    await act(() => vi.advanceTimersByTime(700))
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect

    await render(40)
    await act(() => vi.advanceTimersByTime(300))
    await act(() =>
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, ...lastFace(host) }))
    )
    expect(tip(host)).toBe("xA40")

    await act(async () => root.unmount())
    host.remove()
  })

  test("a bar whose entry has left the data says nothing on hover; the others still do", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: { name: string; a: number }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    await render([
      { name: "x", a: 100 },
      { name: "y", a: 50 },
      { name: "z", a: 80 },
    ])
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const hover = (face: Element) => {
      const corners = face.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
      )
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }

    // y leaves: mid-glide its bar still stands, fading, and says nothing.
    await render([
      { name: "x", a: 100 },
      { name: "z", a: 80 },
    ])
    await act(() => vi.advanceTimersByTime(300))
    const fading = [...host.querySelectorAll('path[fill^="color-mix(in oklab"]')]
    expect(fading.length).toBeGreaterThan(0)
    await hover(fading.at(-1)!)
    expect(tip(host)).toBe("")
    await hover([...host.querySelectorAll('path[fill^="color-mix(in oklch"]')].at(-1)!)
    expect(tip(host)).toMatch(/^[xz]A(100|80)$/)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a bar whose value has gone missing says nothing on hover while it fades out, as one whose entry left", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: { name: string; a: number | null }[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    await render([
      { name: "x", a: 100 },
      { name: "y", a: 50 },
      { name: "z", a: 80 },
    ])
    const svg = host.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
    const hover = (face: Element) => {
      const corners = face.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
      )
      return act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }))
      )
    }

    // The value of y goes missing: mid-glide its bar still stands, fading, and says nothing.
    await render([
      { name: "x", a: 100 },
      { name: "y", a: null },
      { name: "z", a: 80 },
    ])
    await act(() => vi.advanceTimersByTime(150))
    const fading = [...host.querySelectorAll('path[fill^="color-mix(in oklab"]')]
    expect(fading.length).toBeGreaterThan(0)
    await hover(fading.at(-1)!)
    expect(tip(host)).toBe("")
    await hover([...host.querySelectorAll('path[fill^="color-mix(in oklch"]')].at(-1)!)
    expect(tip(host)).toMatch(/^[xz]A(100|80)$/)

    await act(async () => root.unmount())
    host.remove()
  })

  test("the size of a bar eases with its cell: new rows shrink it gradually, never at once", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: Record<string, unknown>[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" />
          </ChartContainer3D>
        )
      )
    // x stays the tallest bar, so the highest face of color a is its top; its
    // span along the screen is the width of the bar.
    const extent = () => {
      const faces = [
        ...host.querySelectorAll('path[fill^="color-mix(in oklch, var(--color-a, currentColor)"]'),
      ].map((f) =>
        f
          .getAttribute("d")!
          .slice(1, -1)
          .split("L")
          .map((c) => c.split(",").map(Number))
      )
      const top = faces.reduce((a, b) =>
        Math.min(...a.map(([, y]) => y)) < Math.min(...b.map(([, y]) => y)) ? a : b
      )
      const xs = top.map(([x]) => x)
      return Math.max(...xs) - Math.min(...xs)
    }
    await render([{ name: "x", a: 100 }])
    const wide = extent()

    // Two new rows third the cells; the bar keeps its size until the glide moves it.
    await render([
      { name: "x", a: 100 },
      { name: "y", a: 50 },
      { name: "z", a: 80 },
    ])
    expect(Math.abs(extent() - wide)).toBeLessThan(0.5)
    await act(() => vi.advanceTimersByTime(300))
    const mid = extent()
    await act(() => vi.advanceTimersByTime(150))
    const late = extent()
    await act(() => vi.advanceTimersByTime(250))
    const slim = extent()
    expect(slim).toBeLessThan(wide)
    // On its way it narrows through the middle, closing on its end.
    expect(mid).toBeLessThan(wide)
    expect(Math.abs(late - slim)).toBeLessThan(Math.abs(mid - slim))

    await act(async () => root.unmount())
    host.remove()
  })

  test("a glide reaches the canvas renderer: every frame repaints, the scene moving through", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never)
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (a: number) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} renderer="canvas">
            <BarChart3D data={[{ name: "x", a }]} index="name" keys={["a"]} />
          </ChartContainer3D>
        )
      )
    // The highest painted corner: on the canvas, a taller bar reaches a smaller y.
    const top = () => Math.min(...ctx.lineTo.mock.calls.map(([, y]) => y as number))

    // From 305 to 480 the end of the y axis rounds from 350 to 500, so the
    // share of the box the bar fills grows, and its top truly rises.
    await render(305)
    await act(() => vi.advanceTimersByTime(700))
    const settled = ctx.fill.mock.calls.length

    await render(480)
    ctx.lineTo.mockClear()
    await act(() => vi.advanceTimersByTime(100))
    const painted1 = ctx.fill.mock.calls.length
    const top1 = top()
    ctx.lineTo.mockClear()
    await act(() => vi.advanceTimersByTime(100))
    const painted2 = ctx.fill.mock.calls.length
    const top2 = top()
    // The glide repaints frame by frame, and the bar rises between the frames.
    expect(painted1).toBeGreaterThan(settled)
    expect(painted2).toBeGreaterThan(painted1)
    expect(top2).toBeLessThan(top1)
    ctx.lineTo.mockClear()
    await act(() => vi.advanceTimersByTime(500))
    expect(top()).toBeLessThan(top2)

    // Unmounted while the canvas is still stubbed: the marks leaving repaint it.
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    host.remove()
    vi.restoreAllMocks()
  })

  test("rows and series swapped together: a cell only one tween knows stays unseen, no number breaks", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (rows: Record<string, unknown>[], keys: string[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={rows} index="name" keys={keys} />
          </ChartContainer3D>
        )
      )
    await render(
      [
        { name: "x", a: 100, b: 50 },
        { name: "y", a: 60, b: 30 },
      ],
      ["a"]
    )
    await act(() => vi.advanceTimersByTime(700))

    // y leaves while the series swaps from a to b: the leaving row y has no
    // value of b to show, so its cell of b stays unseen instead of breaking.
    await render([{ name: "x", a: 100, b: 50 }], ["b"])
    await act(() => vi.advanceTimersByTime(300))
    const ds = [...host.querySelectorAll('path[fill^="color-mix"]')].map((p) =>
      p.getAttribute("d")!
    )
    expect(ds.length).toBeGreaterThan(0)
    expect(ds.some((d) => d.includes("NaN"))).toBe(false)
    await act(() => vi.advanceTimersByTime(400))
    expect(
      host.querySelectorAll('path[fill^="color-mix(in oklch, var(--color-a, currentColor)"]')
    ).toHaveLength(0)
    expect(
      host.querySelectorAll('path[fill^="color-mix(in oklch, var(--color-b, currentColor)"]').length
    ).toBeGreaterThan(0)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a series that leaves shrinks and fades away, and the ones that stay glide to their new rows", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    // Seen from the side, z runs along the screen: a row of series is a place on x.
    const render = async (keys: string[]) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config} defaultView={{ yaw: Math.PI / 2, tilt: 0.3 }}>
            <BarChart3D data={[{ name: "x", a: 4, b: 3 }]} index="name" keys={keys} />
          </ChartContainer3D>
        )
      )
    const faces = (key: string) => [
      ...host.querySelectorAll(`path[fill*="var(--color-${key}, currentColor)"]`),
    ]
    const left = (key: string) =>
      Math.min(
        ...faces(key).flatMap((f) =>
          [...f.getAttribute("d")!.matchAll(/(-?[\d.]+),/g)].map((m) => Number(m[1]))
        )
      )

    await render(["a", "b"])
    await act(() => vi.advanceTimersByTime(700))
    const from = left("b")
    await render(["b"])
    await act(() => vi.advanceTimersByTime(100))
    // Mid-glide the bar of a is still there, faded, and b is on its way, not past its end.
    expect(faces("a").length).toBeGreaterThan(0)
    expect(faces("a").every((f) => f.getAttribute("fill")!.includes("transparent"))).toBe(true)
    const mid = left("b")
    await act(() => vi.advanceTimersByTime(700))
    const to = left("b")
    expect(faces("a")).toHaveLength(0)
    // On its way, strictly: a jump to its new row would stand at the end already.
    expect(Math.min(from, to) + 1 < mid && mid < Math.max(from, to) - 1).toBe(true)

    // A series that comes fades in as it grows.
    await render(["b", "a"])
    await act(() => vi.advanceTimersByTime(16))
    expect(faces("a").length).toBeGreaterThan(0)
    expect(faces("a").every((f) => f.getAttribute("fill")!.includes("transparent"))).toBe(true)

    await act(async () => root.unmount())
    host.remove()
  })

  test("a value that goes missing fades out as its bar shrinks, and one that comes back fades in as it grows, as in the bar field", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (a: number | null) =>
      act(async () =>
        root.render(
          <ChartContainer3D config={config}>
            <BarChart3D data={[{ name: "x", a, b: 3 }]} index="name" />
          </ChartContainer3D>
        )
      )
    const faces = (key: string) => [
      ...host.querySelectorAll(`path[fill*="var(--color-${key}, currentColor)"]`),
    ]
    /** How much of the bar of `key` shows: the share its fill keeps, 1 where it is not faded. */
    const seen = (key: string) =>
      Math.max(
        ...faces(key).map((face) => {
          const share = face.getAttribute("fill")!.match(/ ([\d.]+)%, transparent\)$/)
          return share ? Number(share[1]) / 100 : 1
        })
      )

    await render(6)
    await act(() => vi.advanceTimersByTime(700))
    expect(seen("a")).toBe(1)
    // The value goes missing: near the end of the glide its bar, all but flat, is all but gone.
    await render(null)
    await act(() => vi.advanceTimersByTime(560))
    expect(faces("a").length).toBeGreaterThan(0)
    expect(seen("a")).toBeLessThan(0.1)
    await act(() => vi.advanceTimersByTime(200))
    expect(faces("a")).toHaveLength(0)
    // It comes back: it grows from the floor, unseen at first, never a flat tile at full color.
    await render(6)
    await act(() => vi.advanceTimersByTime(16))
    expect(faces("a").length).toBeGreaterThan(0)
    expect(seen("a")).toBeLessThan(0.1)
    await act(() => vi.advanceTimersByTime(700))
    expect(seen("a")).toBe(1)
    // The bar beside it never fades.
    expect(seen("b")).toBe(1)

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
      const faces = host.querySelectorAll(
        'path[fill^="color-mix(in oklch, var(--color-a, currentColor)"]'
      )
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

describe("BarChart3D focus", () => {
  const lit = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`
  const isLit = (fill: string) => fill.startsWith("var(--chart-3d-focus")
  // The faces of the bars: shaded, or lit.
  const barFaces = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll("path")].flatMap((p) => {
      const f = p.getAttribute("fill")
      return f?.startsWith("color-mix") || (f && isLit(f)) ? [p] : []
    })
  const fills = (svg: SVGSVGElement) => barFaces(svg).map((p) => p.getAttribute("fill")!)

  test("hovering a bar lights the fill of that bar alone; leaving clears it", async () => {
    const chart = await mount(
      <ChartContainer3D config={config}>
        <BarChart3D data={data} index="name" />
      </ChartContainer3D>
    )
    const svg = chart.host.querySelector("svg")!
    const move = (clientX: number, clientY: number) =>
      chart.send("pointermove", { clientX, clientY })
    const before = fills(svg)
    // The centroid of a face of a bar of series a.
    const face = barFaces(svg).find((p) =>
      p.getAttribute("fill")!.includes("var(--color-a, currentColor)")
    )!
    const corners = face.getAttribute("d")!.slice(1, -1).split("L")
    const [x, y] = [0, 1].map(
      (i) => corners.reduce((s, c) => s + Number(c.split(",")[i]), 0) / corners.length
    )

    await move(x, y)
    // The faces of one bar alone light up, each its own fill lightened; every other fill stays.
    const after = fills(svg)
    expect(after.filter(isLit).length).toBeGreaterThan(0)
    expect(after.filter(isLit).length).toBeLessThanOrEqual(3)
    expect(after).toEqual(before.map((f, i) => (isLit(after[i]) ? lit(f) : f)))

    // Off the bar, still inside the chart: nothing lit.
    await move(5, 5)
    expect(fills(svg)).toEqual(before)

    // Hover again, then leave the chart.
    await move(x, y)
    expect(fills(svg).filter(isLit).length).toBeGreaterThan(0)
    await chart.send("pointerout", { relatedTarget: document.body })
    expect(fills(svg)).toEqual(before)

    await chart.unmount()
  })
})

describe("BarChart3D renderer switch", () => {
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
            <BarChart3D data={data} index="name" />
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

    await render("svg")
    expect(host.querySelector("canvas")).toBeNull()
    expect(host.querySelector('svg path[fill^="color-mix"]')).not.toBeNull()

    await act(async () => root.unmount())
    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

describe("BarChart3D names that are no CSS identifiers", () => {
  const chart = (
    <ChartContainer3D id="q1.sales" config={{ "Net sales": { color: "red" } }} legend>
      <BarChart3D data={[{ month: "Jan", "Net sales": 1 }]} index="month" />
    </ChartContainer3D>
  )

  test("a chart id with a dot still scopes its colors: the rule that declares them selects the chart", async () => {
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    await act(async () => root.render(chart))
    const style = host.querySelector("style")!.textContent!
    const selector = style.match(/ (\[data-chart=[^\n]*\]) \{\n {2}--color/)![1]
    expect(host.querySelector(selector)).toBe(host.querySelector("[data-slot=chart-3d]"))
    await act(async () => root.unmount())
    host.remove()
  })

  test("a series with a space keeps its color: the variable is declared, and read by the bars and the legend, under the escaped name", () => {
    const html = renderToString(chart)
    // A space in a CSS identifier is written `\20 `.
    expect(html).toContain("--color-Net\\20 sales: red;")
    expect(html).toContain('fill="color-mix(in oklch, var(--color-Net\\20 sales, currentColor)')
    expect(html).toContain("background:var(--color-Net\\20 sales, currentColor)")
    expect(html).not.toContain("--color-Net sales")
  })
})

describe("BarChart3D values that are no numbers", () => {
  test("an infinite value stands as no bar, as one that is not a number, and the chart keeps its box", () => {
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D
          data={[
            { month: "Jan", a: Infinity, b: -Infinity },
            { month: "Feb", a: 2, b: 1 },
          ]}
          index="month"
        />
      </ChartContainer3D>
    )
    expect(html).not.toContain("NaN")
    expect(html).not.toContain("Infinity")
    expect(html).toContain(">2<")
  })

  test("no data and no series draws an empty box, with no number left undefined", () => {
    const html = renderToString(
      <ChartContainer3D config={{}}>
        <BarChart3D data={[]} index="month" />
      </ChartContainer3D>
    )
    expect(html).toContain('data-slot="chart-3d-axes"')
    expect(html).not.toContain("NaN")
  })
})

describe("BarChart3D entries of the same name", () => {
  const twice = [
    { month: "Jan", a: 1 },
    { month: "Jan", a: 5 },
    { month: "Feb", a: 2 },
  ]

  test("each is a bar of its own: as many faces as with three names", () => {
    const render = (data: typeof twice) =>
      renderToString(
        <ChartContainer3D config={config}>
          <BarChart3D data={data} index="month" keys={["a"]} />
        </ChartContainer3D>
      )
    const three = render(twice.map((d, i) => ({ ...d, month: `${d.month}${i}` })))
    expect(faces(render(twice))).toHaveLength(faces(three).length)
  })

  test("a year of daily bars ticks about ten of its days, not every one", () => {
    const year = Array.from({ length: 365 }, (_, i) => ({ name: `day${i}`, a: i % 7 }))
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={year} index="name" keys={["a"]} />
      </ChartContainer3D>
    )
    // A tick is laid out on each of the four edges of its axis.
    const labels = new Set(html.match(/>day\d+</g))
    expect(labels.size).toBeGreaterThan(4)
    expect(labels.size).toBeLessThanOrEqual(12)
    expect(labels).toContain(">day0<")
  })

  test("a dozen bars keep a tick each", () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ name: `m${i}`, a: i }))
    const html = renderToString(
      <ChartContainer3D config={config}>
        <BarChart3D data={months} index="name" keys={["a"]} />
      </ChartContainer3D>
    )
    expect(new Set(html.match(/>m\d+</g)).size).toBe(12)
  })

  test("names and series with a hyphen draw the bars of their own values", () => {
    const render = (names: [string, string]) =>
      renderToString(
        <ChartContainer3D config={{ "b-c": { color: "red" }, c: { color: "blue" } }}>
          <BarChart3D
            data={[
              { name: names[0], "b-c": 1, c: 0 },
              { name: names[1], "b-c": 0, c: 5 },
            ]}
            index="name"
          />
        </ChartContainer3D>
      )
    // "a" with "b-c" and "a-b" with "c" both read "a-b-c" when joined with a hyphen.
    expect(faces(render(["a", "a-b"]))).toEqual(faces(render(["p", "q"])))
  })

  test("a bar of a repeated name says that name, and the entry behind it", async () => {
    const seen: (typeof twice)[number][] = []
    const view = await mount(
      <ChartContainer3D config={config}>
        <BarChart3D
          data={twice}
          index="month"
          keys={["a"]}
          tooltip={(t, bar) => (seen.push(bar.entry), t)}
        />
      </ChartContainer3D>
    )
    // Every face under the pointer in turn: each bar answers, the second "Jan" too.
    const said = new Set<string>()
    for (const face of view.host.querySelectorAll('path[fill^="color-mix"]')) {
      const corners = face.getAttribute("d")!.slice(1, -1).split("L")
      const [clientX, clientY] = [0, 1].map(
        (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
      )
      await view.send("pointermove", { clientX, clientY })
      said.add(tip(view.host))
    }
    expect([...said].sort()).toEqual(["FebA2", "JanA1", "JanA5"])
    expect(new Set(seen)).toEqual(new Set(twice))
    await view.unmount()
  })
})
