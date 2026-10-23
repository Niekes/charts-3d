// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { ChartContainer3D, type View3D } from "@/registry/new-york/ui/chart-3d"
import { SankeyChart3D, type SankeyChart3DProps } from "@/registry/new-york/ui/sankey-chart-3d"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const config = {
  a: { label: "A", color: "red" },
  b: { label: "B", color: "blue" },
  c: { label: "C", color: "green" },
  d: { label: "D", color: "orange" },
  e: { label: "E", color: "purple" },
  f: { label: "F", color: "teal" },
}

// One crossing: a → c and b → d swap their order, and b → d is the lighter of the two.
const knot = [
  { source: "a", target: "c", value: 3 },
  { source: "a", target: "d", value: 5 },
  { source: "b", target: "c", value: 5 },
  { source: "b", target: "d", value: 1 },
]

const chart = (data: SankeyChart3DProps["data"], defaultView?: View3D) => (
  <ChartContainer3D config={config} defaultView={defaultView}>
    <SankeyChart3D data={data} format={(value) => `${value} kWh`} />
  </ChartContainer3D>
)

/** The faces in paint order, each with its corners. */
const faces = (html: string) =>
  [...html.matchAll(/<path d="M([^"]*)Z" fill="(color-mix[^"]*)"/g)].map(([, d, fill]) => ({
    fill,
    corners: d.split("L").map((c) => c.split(",").map(Number)),
  }))

/**
 * The indices in paint order of the faces of the flow from `source` to
 * `target`, by slice: the share of its way that its color is mixed at.
 */
function slices(html: string, source: string, target: string) {
  const color = new RegExp(`var\\(--color-${target}\\) (\\d+)%, var\\(--color-${source}\\)`)
  const bySlice = new Map<number, number[]>()
  faces(html).forEach(({ fill }, i) => {
    const t = Number(fill.match(color)?.[1] ?? NaN)
    if (!Number.isNaN(t)) bySlice.set(t, [...(bySlice.get(t) ?? []), i])
  })
  return bySlice
}

/**
 * Renders `element` into the document and points at the middle of the last
 * painted face whose fill `pick` takes. Returns, before and after, the corners
 * of the faces in paint order, their fills, and the class of every label.
 */
async function pointAt(element: React.ReactElement, pick: (fill: string) => boolean) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  // The faces of the chart, not the icon of its shortcut button.
  const paths = () => [...svg.querySelectorAll("path")]
  const read = () => ({
    corners: paths().map((path) => path.getAttribute("d")),
    fills: paths().map((path) => path.getAttribute("fill")!),
    labels: Object.fromEntries(
      [...host.querySelectorAll("[data-slot=chart-3d-labels] text")].map((text) => [
        text.textContent,
        text.getAttribute("class"),
      ])
    ),
  })
  const before = read()
  const face = paths()
    .filter((path) => pick(path.getAttribute("fill")!))
    .at(-1)!
  const corners = face.getAttribute("d")!.slice(1, -1).split("L")
  const [x, y] = [0, 1].map(
    (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
  )
  await act(() =>
    svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
  )
  const after = read()
  await act(async () => root.unmount())
  host.remove()
  return { before, after }
}

const escape = (css: string) => css.replace(/[()]/g, "\\$&")

/** Whether a fill is a slice of the flow from the color `from` to the color `to`, faded or not. */
const flowFill = (from: string, to: string) => (fill: string) =>
  new RegExp(`${escape(to)} \\d+%, ${escape(from)}\\)`).test(fill)

/** Whether a fill is a face of a node of `color`, faded or not: shaded straight from the color. */
const nodeFill = (color: string) => (fill: string) =>
  new RegExp(`(^|, )color-mix\\(in oklch, ${escape(color)} \\d+%, black\\)`).test(fill)

const faded = (fill: string) => fill.endsWith(" 25%, var(--background))")

/** Whether, in every slice where both have faces, the flow `over` paints after the flow `under`. */
function paintsOver(over: Map<number, number[]>, under: Map<number, number[]>) {
  const shared = [...over.keys()].filter((t) => under.has(t))
  return (
    shared.length > 0 && shared.every((t) => Math.min(...over.get(t)!) > Math.max(...under.get(t)!))
  )
}

/**
 * Renders `element` into the document, moves the pointer onto a face in the
 * middle of the flow, away from the nodes, and returns the text the chart shows.
 */
async function hoverFlow(element: React.ReactElement) {
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(element))
  const svg = host.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
  const slices = [...host.querySelectorAll('path[fill^="color-mix(in oklch, color-mix"]')]
  const corners = slices[slices.length >> 1].getAttribute("d")!.slice(1, -1).split("L")
  const [x, y] = [0, 1].map(
    (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
  )
  await act(() =>
    svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
  )
  const text = host.textContent
  await act(async () => root.unmount())
  host.remove()
  return text
}

describe("SankeyChart3D", () => {
  // The charts are plain SVG, so they render on the server without a DOM.
  test("draws the nodes, labelled, and the flows between them in the colors of their ends", () => {
    const html = renderToString(
      chart([
        { source: "a", target: "b", value: 2 },
        { source: "a", target: "c", value: 1 },
      ])
    )
    expect(faces(html).length).toBeGreaterThan(0)
    expect(html).toMatch(/color-mix\(in oklch, var\(--color-b\) \d+%, var\(--color-a\)\)/)
    expect(html).toMatch(/color-mix\(in oklch, var\(--color-c\) \d+%, var\(--color-a\)\)/)
    for (const label of ["A", "B", "C"]) expect(html).toContain(`>${label}</text>`)
    expect(html).not.toContain("NaN")
  })

  test("an empty chart, or one whose flows have no value, draws nothing", () => {
    for (const data of [[], [{ source: "a", target: "b", value: 0 }]]) {
      const html = renderToString(chart(data))
      expect(faces(html)).toHaveLength(0)
      expect(html).not.toContain("NaN")
    }
  })

  test("flows that form a cycle throw", () => {
    const cycle = [
      { source: "a", target: "b", value: 1 },
      { source: "b", target: "a", value: 1 },
    ]
    expect(() => renderToString(chart(cycle))).toThrow("cycle")
  })

  test("the node farther from the eye paints first, also in perspective", () => {
    const data = [{ source: "a", target: "b", value: 1 }]
    const first = (view: View3D) => {
      const html = renderToString(chart(data, view))
      return html.indexOf("var(--color-a)") < html.indexOf("var(--color-b)") ? "a" : "b"
    }
    for (const perspective of [Infinity, 3]) {
      // A positive yaw turns the eye to the left of the chart, a negative one to the right.
      expect(first({ yaw: Math.PI / 3, tilt: Math.PI / 6, perspective })).toBe("b")
      expect(first({ yaw: -Math.PI / 3, tilt: Math.PI / 6, perspective })).toBe("a")
    }
  })

  test("a thin flow off the top of a tall node paints behind it, seen from the side of the node", () => {
    // From the left and above, the default view. By its center alone, the slice
    // next to the top of a would be nearer than a, and paint over it.
    const html = renderToString(
      chart([
        { source: "a", target: "b", value: 1 },
        { source: "a", target: "c", value: 9 },
      ])
    )
    const fills = faces(html).map((face) => face.fill)
    const lastSlice = fills
      .map((fill) => fill.startsWith("color-mix(in oklch, color-mix"))
      .lastIndexOf(true)
    const firstOfA = fills.findIndex((fill) =>
      fill.startsWith("color-mix(in oklch, var(--color-a) ")
    )
    expect(lastSlice).toBeGreaterThan(-1)
    expect(firstOfA).toBeGreaterThan(lastSlice)
  })

  test("a flow that skips a column passes it beside the nodes there, not through them", () => {
    const html = renderToString(
      chart(
        [
          { source: "a", target: "b", value: 1 },
          { source: "b", target: "c", value: 1 },
          { source: "a", target: "c", value: 3 },
        ],
        // From the front, every piece shows only its front face.
        { yaw: 0, tilt: 0 }
      )
    )
    const span = (match: (fill: string) => boolean) => {
      const ys = faces(html)
        .filter((face) => match(face.fill))
        .flatMap((face) => face.corners.map(([, y]) => y))
      return [Math.min(...ys), Math.max(...ys)]
    }
    const [b0, b1] = span((fill) => fill.startsWith("color-mix(in oklch, var(--color-b) "))
    // The waypoint of a → c in the middle column, halfway between the colors of its ends.
    const [w0, w1] = span((fill) => fill.includes("var(--color-c) 50%, var(--color-a)"))
    expect(b0).toBeLessThan(b1)
    expect(w0).toBeLessThan(w1)
    expect(b1 <= w0 || w1 <= b0).toBe(true)
  })

  test("a flow under the pointer shows its ends and its value in the tooltip", async () => {
    const text = await hoverFlow(chart([{ source: "a", target: "b", value: 2 }]))
    expect(text).toContain("A → B")
    expect(text).toContain("2 kWh")
  })

  test("a node without a config entry shows its id in the muted color, and values show as they are", async () => {
    const element = (
      <ChartContainer3D config={{ a: { label: "A", color: "red" } }}>
        <SankeyChart3D data={[{ source: "a", target: "x", value: 3 }]} />
      </ChartContainer3D>
    )
    const html = renderToString(element)
    expect(html).toContain(">x</text>")
    expect(html).toContain("var(--muted-foreground)")

    expect(await hoverFlow(element)).toContain("A → x3")
  })

  test("a node without width lifts its label over it, where its sides tell no way out", () => {
    // The left and the right face of such a node fall on one line.
    const html = renderToString(
      <ChartContainer3D config={config}>
        <SankeyChart3D data={[{ source: "a", target: "b", value: 1 }]} nodeWidth={0} />
      </ChartContainer3D>
    )
    const label = (text: string) => {
      const [, x, y, anchor] = html.match(
        new RegExp(`<text x="([^"]*)" y="([^"]*)" text-anchor="(\\w+)"[^>]*>${text}</text>`)
      )!
      return { x: Number(x), y: Number(y), anchor }
    }
    expect([label("A").anchor, label("B").anchor]).toEqual(["middle", "middle"])
    expect(label("A").x).toBeLessThan(label("B").x)
  })

  test("a label swings over its node as the camera turns the node edge on, instead of jumping across", () => {
    const at = (yaw: number) => {
      const html = renderToString(
        chart([{ source: "a", target: "b", value: 1 }], { yaw, tilt: Math.PI / 6 })
      )
      const [, x, y] = html.match(/<text x="([^"]*)" y="([^"]*)"[^>]*>A<\/text>/)!
      return { x: Number(x), y: Number(y) }
    }
    let worst = 0
    for (let degree = 0; degree < 180; degree += 2) {
      const [a, b] = [at((degree * Math.PI) / 180), at(((degree + 2) * Math.PI) / 180)]
      worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y))
    }
    // The node moves by 5px a step. Round 90°, the label leaves the left of its node for the
    // right: in a step, an anchor that flips would carry it across, a width and two gaps away.
    expect(worst).toBeLessThan(12)
  })

  test("of two flows that cross, the lighter passes in front over the whole crossing", () => {
    // Straight ahead and straight behind, the eye sees only the depth of the lanes.
    const view = (yaw: number) => {
      const html = renderToString(chart(knot, { yaw, tilt: 0 }))
      return { ac: slices(html, "a", "c"), bd: slices(html, "b", "d") }
    }
    const ahead = view(0)
    expect(paintsOver(ahead.bd, ahead.ac)).toBe(true)
    const behind = view(Math.PI)
    expect(paintsOver(behind.ac, behind.bd)).toBe(true)
  })

  test("flows that cross part in depth by a lane where they pass, and meet the nodes level", () => {
    // From straight above, the screen shows the depth: y = 200 + 120·z.
    const html = renderToString(chart(knot, { yaw: 0, tilt: Math.PI / 2 }))
    const all = faces(html)
    const depths = (source: string, target: string) =>
      [...slices(html, source, target).entries()]
        .sort(([a], [b]) => a - b)
        .map(([, ids]) => {
          const ys = ids.flatMap((i) => all[i].corners.map(([, y]) => y))
          return ((Math.min(...ys) + Math.max(...ys)) / 2 - 200) / 120
        })
    const [ac, bd, ad] = [depths("a", "c"), depths("b", "d"), depths("a", "d")]
    // The lighter b → d in front (+z), a → c behind, a lane apart where they cross.
    expect(Math.max(...bd)).toBeCloseTo(0.18, 2)
    expect(Math.min(...ac)).toBeCloseTo(-0.18, 2)
    // a → d crosses nothing and stays where it was.
    expect(ad.every((z) => Math.abs(z) < 0.01)).toBe(true)
    // At the nodes both start and end level: the outer corners of their first and last slices sit at z = ±0.14.
    for (const flow of [slices(html, "a", "c"), slices(html, "b", "d")]) {
      const ends = [...flow.entries()].sort(([a], [b]) => a - b)
      for (const [ids, side] of [
        [ends[0][1], Math.min],
        [ends.at(-1)![1], Math.max],
      ] as const) {
        const corners = ids.flatMap((i) => all[i].corners)
        const edge = side(...corners.map(([x]) => x))
        const ys = corners.filter(([x]) => x === edge).map(([, y]) => y)
        expect([Math.min(...ys), Math.max(...ys)]).toEqual([183.2, 216.8])
      }
    }
  })

  test("pointing at a flow fades the flows and nodes it does not connect, in place", async () => {
    const [a, b, c] = ["var(--color-a)", "var(--color-b)", "var(--color-c)"]
    const { before, after } = await pointAt(
      chart(
        [
          { source: "a", target: "b", value: 2 },
          { source: "a", target: "c", value: 1 },
        ],
        { yaw: 0, tilt: 0 }
      ),
      flowFill(a, b)
    )
    expect(before.fills.some(faded)).toBe(false)
    const fades = (is: (fill: string) => boolean) => after.fills.filter(is).map(faded)
    expect(new Set(fades(flowFill(a, c)))).toEqual(new Set([true]))
    expect(new Set(fades(nodeFill(c)))).toEqual(new Set([true]))
    for (const lit of [flowFill(a, b), nodeFill(a), nodeFill(b)]) {
      expect(new Set(fades(lit))).toEqual(new Set([false]))
    }
    expect(after.labels.C).toContain("opacity-25")
    expect([after.labels.A, after.labels.B].join(" ")).not.toContain("opacity-25")
    // Faded in place: the depth order stays as it was.
    expect(after.corners).toEqual(before.corners)
  })

  test("pointing at a node keeps its flows and the nodes at their other ends", async () => {
    const [a, b, c, x] = [
      "var(--color-a)",
      "var(--color-b)",
      "var(--color-c)",
      "var(--muted-foreground)",
    ]
    const { after } = await pointAt(
      chart(
        [
          { source: "a", target: "b", value: 2 },
          { source: "b", target: "c", value: 2 },
          { source: "x", target: "c", value: 1 },
        ],
        { yaw: 0, tilt: 0 }
      ),
      nodeFill(b)
    )
    const fades = (is: (fill: string) => boolean) => new Set(after.fills.filter(is).map(faded))
    for (const lit of [flowFill(a, b), flowFill(b, c), nodeFill(a), nodeFill(b), nodeFill(c)]) {
      expect(fades(lit)).toEqual(new Set([false]))
    }
    // x → c, its waypoint included, and x fade.
    expect(fades(flowFill(x, c))).toEqual(new Set([true]))
    expect(fades(nodeFill(x))).toEqual(new Set([true]))
    expect(after.labels.x).toContain("opacity-25")
  })

  test("a flow that crosses nothing, above flows that cross, paints over them from above", () => {
    // Seen from above and ahead, the lanes face the eye too, but the height decides between knots.
    const html = renderToString(
      chart([{ source: "e", target: "f", value: 2 }, ...knot], { yaw: 0, tilt: Math.PI / 3 })
    )
    expect(paintsOver(slices(html, "e", "f"), slices(html, "b", "d"))).toBe(true)
    expect(paintsOver(slices(html, "e", "f"), slices(html, "a", "c"))).toBe(true)
  })
})

describe("SankeyChart3D transitions", () => {
  afterEach(() => vi.useRealTimers())

  test("new values glide in over the animationDuration of the container", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = async (data: SankeyChart3DProps["data"]) =>
      act(async () => root.render(chart(data)))
    const hover = async () => {
      const svg = host.querySelector("svg")!
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect
      // Off the chart first, so the hover reads the tooltip of the slice as it is now.
      await act(() =>
        svg.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: host }))
      )
      const slices = [...host.querySelectorAll('path[fill^="color-mix(in oklch, color-mix"]')]
      const corners = slices[slices.length >> 1].getAttribute("d")!.slice(1, -1).split("L")
      const [x, y] = [0, 1].map(
        (i) => corners.reduce((sum, c) => sum + Number(c.split(",")[i]), 0) / corners.length
      )
      await act(() =>
        svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }))
      )
      return host.textContent
    }

    await render([{ source: "a", target: "b", value: 2 }])
    await render([{ source: "a", target: "b", value: 7 }])
    expect(await hover()).toContain("2 kWh")
    await act(() => vi.advanceTimersByTime(700))
    expect(await hover()).toContain("7 kWh")

    await act(async () => root.unmount())
    host.remove()
  })
})
