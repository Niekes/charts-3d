"use client"

import * as React from "react"
import { nice, ticks } from "d3-array"
import {
  axes3D,
  camera3D,
  normal,
  points3D,
  sort,
  type AxesSpec,
  type AxisEdge,
  type AxisSpec,
  type Camera3DInstance,
  type CubeFace,
  type Point2D,
  type TransformedPoint,
} from "d3-3d"
import { KeyboardIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// The same shape as the ChartConfig of shadcn's chart, so one config drives
// a 2D and a 3D chart side by side.
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

/** How the camera looks at the chart box, angles in radians. */
export type View3D = {
  yaw: number
  /** The angle above the floor the camera looks down from. */
  tilt: number
  zoom?: number
  /** How far the chart is moved, in the units of the view box. */
  pan?: Point2D
  /** The distance of the eye in box units; Infinity, the default, is orthographic. */
  perspective?: number
}

/** How the marks of a chart are drawn. The box, its labels, the tooltip and the legend are always SVG and HTML. */
export type Renderer3D = "svg" | "canvas"

/** Maps data values to the world box, which spans -1 to 1 on every axis, y up. */
export type World = Record<keyof AxesSpec, (value: number) => number>

export type Tooltip3D = {
  /** The anchor in the units of the view box. */
  at: Point2D
  title?: React.ReactNode
  items: { label: React.ReactNode; value: React.ReactNode; color?: string }[]
}

/** One shape of a chart, projected, in paint order: a polygon, or a circle of radius `r` around its one point. */
export type Mark3D = {
  /** Stable across renders, so React moves the shape instead of redrawing it. */
  key: string
  /** The corners of a polygon, or the center of a circle, in the units of the view box. */
  points: Point2D[]
  r?: number
  /** A CSS color, such as the result of `shade` or `var(--color-x)`. */
  fill: string
  /** The ring around a circle, a CSS color. */
  stroke?: string
  /** Shown while the pointer is over the mark. */
  tooltip?: Tooltip3D
}

type ChartContext3D = {
  config: ChartConfig
  camera: Camera3DInstance
  renderer: Renderer3D
  /** The marks of the chart, which the hover and the canvas read. */
  scene: React.RefObject<Mark3D[]>
  repaint: () => void
}

const Chart3DContext = React.createContext<ChartContext3D | null>(null)

export function useChart3D() {
  const context = React.useContext(Chart3DContext)
  if (!context) {
    throw new Error("useChart3D must be used within a <ChartContainer3D />")
  }
  return context
}

const DRAG = Math.PI / 230
const KEY_STEP = Math.PI / 36
const PAN_STEP = 20
const ZOOM_STEP = 1.2
const CLICK_DISTANCE = 4

/** A step of the camera: turned by `yaw` and `tilt`, moved by `pan`, zoomed by the factor `zoom`, or reset. */
type Move = { yaw?: number; tilt?: number; pan?: Point2D; zoom?: number; reset?: boolean }

/** The actions a key triggers: each steps the camera, `help` opens the shortcut panel. */
export type KeyAction3D =
  | "rotateLeft"
  | "rotateRight"
  | "rotateUp"
  | "rotateDown"
  | "panLeft"
  | "panRight"
  | "panUp"
  | "panDown"
  | "zoomIn"
  | "zoomOut"
  | "reset"
  | "help"

/** The gestures of the pointer: a drag turns the camera, with Space held it pans, Ctrl or ⌘ with the wheel zooms, a double click resets. */
export type Gesture3D = "dragRotate" | "dragPan" | "wheelZoom" | "doubleClickReset"

/**
 * The shortcuts of a chart over their defaults, per action: `false` turns an
 * action off, keys replace its keys and a label renames it in the shortcut
 * panel, where the actions of one label share a row. Keys are written the way
 * `aria-keyshortcuts` writes them, such as `"Shift+ArrowLeft"` or
 * `"Control+Plus"`, and the panel shows the first.
 */
export type Keymap3D = {
  [A in KeyAction3D]?: false | string[] | { keys?: string[]; label?: string }
} & { [G in Gesture3D]?: false | { label?: string } }

type Action3D = KeyAction3D | Gesture3D

// The shortcuts of a chart, in the order of the shortcut panel: the keys of
// an action move the camera, a gesture shows its hint, and the panel lists
// every action that is on, so the two never disagree. `keymap` overrides them.
const SHORTCUTS: Record<
  Action3D,
  { label: string; keys?: string[]; hint?: string[]; move?: Move }
> = {
  dragRotate: { label: "Rotate", hint: ["Drag"] },
  rotateLeft: { label: "Rotate", keys: ["ArrowLeft"], move: { yaw: -KEY_STEP } },
  rotateRight: { label: "Rotate", keys: ["ArrowRight"], move: { yaw: KEY_STEP } },
  rotateUp: { label: "Rotate", keys: ["ArrowUp"], move: { tilt: -KEY_STEP } },
  rotateDown: { label: "Rotate", keys: ["ArrowDown"], move: { tilt: KEY_STEP } },
  dragPan: { label: "Pan", hint: ["Space", "Drag"] },
  panLeft: { label: "Pan", keys: ["Shift+ArrowLeft"], move: { pan: { x: -PAN_STEP, y: 0 } } },
  panRight: { label: "Pan", keys: ["Shift+ArrowRight"], move: { pan: { x: PAN_STEP, y: 0 } } },
  panUp: { label: "Pan", keys: ["Shift+ArrowUp"], move: { pan: { x: 0, y: -PAN_STEP } } },
  panDown: { label: "Pan", keys: ["Shift+ArrowDown"], move: { pan: { x: 0, y: PAN_STEP } } },
  zoomIn: { label: "Zoom", keys: ["Plus", "="], move: { zoom: ZOOM_STEP } },
  zoomOut: { label: "Zoom", keys: ["-"], move: { zoom: 1 / ZOOM_STEP } },
  wheelZoom: { label: "Zoom", hint: ["Ctrl", "Scroll"] },
  reset: { label: "Reset", keys: ["0"], move: { reset: true } },
  doubleClickReset: { label: "Reset", hint: ["Double-click"] },
  help: { label: "Keyboard shortcuts", keys: ["?"] },
}

const MODIFIERS = ["Control", "Alt", "Meta", "Shift"]
// The keys that `aria-keyshortcuts` names, because `+` delimits and a space separates.
const NAMED: Record<string, string> = { Plus: "+", Space: " " }
const ARIA: Record<string, string> = { "+": "Plus", " ": "Space" }
const KBD: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  "-": "−",
  " ": "Space",
  Control: "Ctrl",
  Meta: "⌘",
}

/** Keys split at `+`, which is the key itself at the end: `"Control++"` is Control and `+`. */
const split = (keys: string) => keys.split(/\+(?!$)/)

/**
 * Keys in the one form a binding and a press compare in: the modifiers in a
 * fixed order, then the key, Plus as `+` and Space as " ". Shift counts only
 * beside a named key; a character such as "?" or "A" is typed with it already.
 */
function combo(keys: string) {
  const parts = split(keys)
  const key = NAMED[parts.at(-1)!] ?? parts.at(-1)!
  const mods = MODIFIERS.filter((m) => parts.includes(m) && (m !== "Shift" || key.length > 1))
  return [...mods, key].join("+")
}

/** The keys of a press, in the form of `combo`. */
function pressed(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey">) {
  const mods = [
    e.ctrlKey && "Control",
    e.altKey && "Alt",
    e.metaKey && "Meta",
    e.shiftKey && "Shift",
  ]
  return combo([...mods, e.key].filter(Boolean).join("+"))
}

/** Keys in the form of `combo`, the way `aria-keyshortcuts` writes them. */
function aria(keys: string) {
  const parts = split(keys)
  return [...parts.slice(0, -1), ARIA[parts.at(-1)!] ?? parts.at(-1)].join("+")
}

/** Every action, `keymap` over its defaults: on unless it is off or a key action without keys. */
function shortcutsOf(keymap: Keymap3D | false) {
  return (Object.keys(SHORTCUTS) as Action3D[]).map((action) => {
    const own: Keymap3D[KeyAction3D] = keymap && keymap[action]
    const { keys = [], ...shortcut } = {
      ...SHORTCUTS[action],
      ...(Array.isArray(own) ? { keys: own } : own || {}),
    }
    const on = own !== false && (shortcut.hint !== undefined || keys.length > 0)
    return { ...shortcut, action, on, keys: keys.map(combo) }
  })
}

type Shortcut = ReturnType<typeof shortcutsOf>[number]

/**
 * The rows of the shortcut panel: the actions by label, the keys of a row in
 * groups of the same modifiers, a gesture in a group of its own.
 */
function rowsOf(shortcuts: Shortcut[]) {
  const rows = new Map<string, Map<string, string[]>>()
  for (const { action, label, keys, hint } of shortcuts) {
    const parts = hint ?? split(keys[0]).map((k) => KBD[k] ?? k)
    const group = hint ? action : parts.slice(0, -1).join("+")
    const groups = rows.get(label) ?? new Map<string, string[]>()
    const known = groups.get(group)
    rows.set(label, groups.set(group, known ? [...known, parts.at(-1)!] : parts))
  }
  return [...rows].map(([label, groups]) => ({ label, groups: [...groups.values()] }))
}

/**
 * What a keymap does: the actions that are on, the step of each key, the help
 * keys and the rows of the panel. Without the `panel`, the help keys have
 * nothing to open and are off.
 */
function keymapOf(keymap: Keymap3D | false, panel: boolean) {
  const all = shortcutsOf(keymap)
  const on = all.filter((s) => s.on && (panel || s.action !== "help"))
  return {
    on: (action: Action3D) => on.some((s) => s.action === action),
    moves: Object.fromEntries(on.flatMap((s) => s.keys.map((k) => [k, s.move]))) as Record<
      string,
      Move | undefined
    >,
    help: on.find((s) => s.action === "help")?.keys ?? [],
    label: all.find((s) => s.action === "help")!.label,
    aria: on.flatMap((s) => s.keys.map(aria)).join(" "),
    rows: panel ? rowsOf(on) : [],
  }
}

type Keymap = ReturnType<typeof keymapOf>

export type ChartContainer3DProps = {
  /** The series of the chart: a label and a color per key, as in the chart of shadcn/ui. */
  config: ChartConfig
  /**
   * Where the camera starts, and where a reset returns it.
   * @defaultValue { yaw: π/6, tilt: π/6 }
   */
  defaultView?: View3D
  /**
   * The width of the view box the chart is drawn in.
   * @defaultValue 640
   */
  width?: number
  /**
   * The height of the view box the chart is drawn in.
   * @defaultValue 400
   */
  height?: number
  /**
   * Shows the label and the color of every config key below the chart.
   * @defaultValue false
   */
  legend?: boolean
  /**
   * How the marks of the chart are drawn: "canvas" suits many marks. The
   * chart draws as SVG until the browser shows it has a canvas, and where it
   * has none.
   * @defaultValue "svg"
   */
  renderer?: Renderer3D
  /**
   * Shows a button that lists the keyboard shortcuts of the chart; `?` lists them too.
   * @defaultValue true
   */
  shortcuts?: boolean
  /**
   * Rebinds, renames or turns off the keys and the gestures of the chart, per
   * action; `false` turns them all off and the chart stands still.
   * @defaultValue {}
   */
  keymap?: Keymap3D | false
  /**
   * The corner that shows the axes of the chart, turned with the camera; `false` hides them.
   * @defaultValue "bottom-left"
   */
  gizmo?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | false
}

function ChartContainer3D({
  id,
  config,
  defaultView = { yaw: Math.PI / 6, tilt: Math.PI / 6 },
  width = 640,
  height = 400,
  legend = false,
  renderer: requested = "svg",
  shortcuts = true,
  keymap = {},
  gizmo = "bottom-left",
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"div"> & ChartContainer3DProps) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  const { scene, renderer, canvas, repaint, hover, leave, tooltip } = useScene(
    requested,
    width,
    height
  )
  const keys = keymapOf(keymap, shortcuts)
  const { view, orbiting, handlers } = useOrbit(defaultView, width, keys, leave, hover)
  const camera = useCamera(view, width, height)
  const context = React.useMemo(
    () => ({ config, camera, renderer, scene, repaint }),
    [config, camera, renderer, repaint]
  )

  return (
    <div
      data-slot="chart-3d"
      data-chart={chartId}
      className={cn("relative w-full text-xs", className)}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      <div className="relative rounded-lg has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          {...keymapProps(keys, ariaLabel)}
          data-orbiting={orbiting}
          onPointerLeave={leave}
          {...handlers}
        >
          <Chart3DContext.Provider value={context}>{children}</Chart3DContext.Provider>
        </svg>
        <ChartCanvas3D renderer={renderer} canvas={canvas} width={width} height={height} />
        <ChartGizmo3D camera={camera} corner={gizmo} />
        <ChartTooltip3D tooltip={tooltip} width={width} height={height} />
      </div>
      {keys.rows.length > 0 && <ChartShortcuts3D {...keys} />}
      {legend && <ChartLegend3D config={config} />}
    </div>
  )
}

/**
 * What the svg says about its keymap: a label that names the drag and the
 * help key if they are on, the keys, the focus only if a key does something
 * and the grab cursor only if a drag does; without one, a touch scrolls the page.
 */
function keymapProps(keys: Keymap, label?: string): React.SVGProps<SVGSVGElement> {
  const drag = keys.on("dragRotate") || keys.on("dragPan")
  const help = keys.help[0]
  const said = [
    "3D chart.",
    keys.on("dragRotate") && "Drag to rotate it.",
    help && `Press ${aria(help)} for all shortcuts.`,
  ]
  return {
    "aria-label": label ?? said.filter(Boolean).join(" "),
    "aria-keyshortcuts": keys.aria || undefined,
    tabIndex: keys.aria ? 0 : undefined,
    className: cn(
      "block h-auto w-full outline-hidden select-none mask-y-from-96%",
      drag && "cursor-grab touch-none active:cursor-grabbing"
    ),
  }
}

/**
 * The marks of the chart and what reads them: the renderer that draws them,
 * the canvas it paints them on and the hover that shows their tooltips.
 */
function useScene(requested: Renderer3D, width: number, height: number) {
  const scene = React.useRef<Mark3D[]>([])
  const [tooltip, setTooltip] = React.useState<Tooltip3D | null>(null)
  const renderer = useRenderer(requested)
  const { canvas, repaint } = useCanvas(scene, width)
  const { hover, leave } = useHover(scene, width, height, setTooltip)
  return { scene, renderer, canvas, repaint, hover, leave, tooltip }
}

/** The camera of a view. The shapes of the chart hang on it, so a new view re-projects them all. */
function useCamera(view: View3D, width: number, height: number) {
  return React.useMemo(
    () =>
      camera3D()
        .origin({ x: width / 2 + (view.pan?.x ?? 0), y: height / 2 + (view.pan?.y ?? 0) })
        .scale(Math.min(width, height) * 0.3 * (view.zoom ?? 1))
        .perspective(view.perspective ?? Infinity)
        .rotateY(view.yaw)
        .rotateX(-view.tilt),
    [view, width, height]
  )
}

/** `view` moved by one step. The tilt stops at the zenith and the nadir, the zoom at 1/4 and 8. */
function moved(view: View3D, move: Move, initial: View3D): View3D {
  if (move.reset) return initial
  const step = { yaw: 0, tilt: 0, zoom: 1, pan: { x: 0, y: 0 }, ...move }
  const pan = view.pan ?? { x: 0, y: 0 }
  const clamp = (lo: number, hi: number, value: number) => Math.max(lo, Math.min(hi, value))
  return {
    ...view,
    yaw: view.yaw + step.yaw,
    tilt: clamp(-Math.PI / 2, Math.PI / 2, view.tilt + step.tilt),
    zoom: clamp(0.25, 8, (view.zoom ?? 1) * step.zoom),
    pan: { x: pan.x + step.pan.x, y: pan.y + step.pan.y },
  }
}

/**
 * The view of the camera, and the handlers that move it, as far as `keys`
 * has them on: a drag turns it, or pans it while Space is held, the keys
 * step it, Ctrl or ⌘ with the wheel zooms it and a double click resets it.
 * `orbiting` is true while the camera turns. `onDragStart` runs when a press
 * becomes a drag, `onHover` on a move without one.
 */
function useOrbit(
  defaultView: View3D,
  width: number,
  keys: Keymap,
  onDragStart: () => void,
  onHover: (e: React.PointerEvent<SVGSVGElement>) => void
) {
  const [view, setView] = React.useState(defaultView)
  const [orbiting, setOrbiting] = React.useState(false)
  const drag = React.useRef<Point2D & { moved: boolean }>(null)
  const ref = useWheelZoom(setView, keys.on("wheelZoom"))
  const move = (step: Move) => setView((v) => moved(v, step, defaultView))
  const { space, ...keyHandlers } = useKeys(keys, move, setOrbiting)
  const release = () => {
    drag.current = null
    setOrbiting(false)
  }

  const handlers: React.SVGProps<SVGSVGElement> = {
    ref,
    onPointerDown: (e) => {
      // Space is held only while the drag pans; without it, the drag turns.
      if (space.current || keys.on("dragRotate")) {
        drag.current = { x: e.clientX, y: e.clientY, moved: false }
      }
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d) return onHover(e)
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      // A press that wanders a few pixels is still a click on a bar.
      if (!d.moved && Math.hypot(dx, dy) < CLICK_DISTANCE) return
      if (!d.moved) {
        e.currentTarget.setPointerCapture(e.pointerId)
        onDragStart()
      }
      drag.current = { x: e.clientX, y: e.clientY, moved: true }
      const k = width / e.currentTarget.getBoundingClientRect().width
      setOrbiting(!space.current)
      move(space.current ? { pan: { x: dx * k, y: dy * k } } : { yaw: dx * DRAG, tilt: dy * DRAG })
    },
    onPointerUp: release,
    onPointerCancel: release,
    onDoubleClick: keys.on("doubleClickReset") ? () => move({ reset: true }) : undefined,
    ...keyHandlers,
  }

  return { view, orbiting, handlers }
}

/**
 * The handlers that step the camera with the keys of `keys`, and `space`,
 * which is true while Space is held for a drag to pan. A key that turns the
 * camera marks it as orbiting until it is let go.
 */
function useKeys(
  keys: Keymap,
  move: (step: Move) => void,
  setOrbiting: (orbiting: boolean) => void
) {
  const space = React.useRef(false)
  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    // Held on the chart, Space pans a drag instead of scrolling the page.
    const pan = e.key === " " && keys.on("dragPan")
    if (pan) space.current = true
    const step = keys.moves[pressed(e)]
    if (!step && !pan) return
    e.preventDefault()
    if (!step) return
    setOrbiting(Boolean(step.yaw || step.tilt))
    move(step)
  }
  const onKeyUp = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === " ") space.current = false
    setOrbiting(false)
  }
  return { space, onKeyDown, onKeyUp }
}

/**
 * A ref for the svg that zooms the view with Ctrl or ⌘ and the wheel, which
 * is also how a trackpad pinches, if `on`. The wheel alone still scrolls the page.
 */
function useWheelZoom(setView: React.Dispatch<React.SetStateAction<View3D>>, on: boolean) {
  // React listens to the wheel passively, and only a listener that is not
  // passive can keep the browser from zooming the page.
  return React.useCallback(
    (svg: SVGSVGElement | null) => {
      if (!on) return
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        setView((v) => moved(v, { zoom: 2 ** (-e.deltaY / 200) }, v))
      }
      svg?.addEventListener("wheel", onWheel, { passive: false })
      return () => svg?.removeEventListener("wheel", onWheel)
    },
    [setView, on]
  )
}

/**
 * The tooltip of the mark under the pointer, the one painted last. `hover`
 * sets it only when the pointer moves onto another mark, so a move within
 * one does not render the chart again.
 */
function useHover(
  scene: React.RefObject<Mark3D[]>,
  width: number,
  height: number,
  setTooltip: (tooltip: Tooltip3D | null) => void
) {
  const hovered = React.useRef<Mark3D>(undefined)
  const show = (mark?: Mark3D) => {
    if (mark?.key === hovered.current?.key) return
    hovered.current = mark
    setTooltip(mark?.tooltip ?? null)
  }

  return {
    hover: (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const at = {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      }
      show(hit(scene.current, at))
    },
    leave: () => show(undefined),
  }
}

/** The topmost mark under `at`: the last one painted that holds it. */
function hit(marks: Mark3D[], at: Point2D) {
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const { points, r } = marks[i]
    const holds =
      r === undefined ? inside(points, at) : Math.hypot(points[0].x - at.x, points[0].y - at.y) <= r
    if (holds) return marks[i]
  }
}

/** Whether `at` lies inside `polygon`: a ray from it crosses an odd number of its edges. */
function inside(polygon: Point2D[], at: Point2D) {
  let odd = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > at.y !== b.y > at.y && at.x < ((b.x - a.x) * (at.y - a.y)) / (b.y - a.y) + a.x) {
      odd = !odd
    }
  }
  return odd
}

/**
 * The renderer the chart draws with: SVG on the server and in the first
 * render on the client, then the requested one if the browser has it.
 */
function useRenderer(requested: Renderer3D) {
  const [renderer, setRenderer] = React.useState<Renderer3D>("svg")
  React.useEffect(() => {
    // A canvas of its own, as one that gave out a context cannot give another.
    const canvas = requested === "canvas" && document.createElement("canvas").getContext("2d")
    setRenderer(canvas ? "canvas" : "svg")
  }, [requested])
  return renderer
}

/**
 * A ref for the canvas of the marks, and the repaint that paints them: on new
 * marks, when the canvas changes its size and when the theme changes. A color
 * resolves on the canvas itself, inside the chart, so the `--color-*` apply.
 */
function useCanvas(scene: React.RefObject<Mark3D[]>, width: number) {
  const element = React.useRef<HTMLCanvasElement>(null)
  const colors = React.useRef(new Map<string, string>())

  const repaint = React.useCallback(() => {
    const canvas = element.current
    if (!canvas) return
    paint(canvas, scene.current, width, (css) => {
      let color = colors.current.get(css)
      if (color === undefined) {
        canvas.style.color = css
        color = getComputedStyle(canvas).color
        colors.current.set(css, color)
      }
      return color
    })
  }, [scene, width])

  const canvas = React.useCallback(
    // A ref that returns its cleanup is never called with null.
    (node: HTMLCanvasElement) => {
      element.current = node
      repaint()
      const resize = new ResizeObserver(repaint)
      resize.observe(node)
      // ponytail: watches the theme on <html> only, as the class `.dark` of THEMES does.
      const theme = new MutationObserver(() => {
        colors.current.clear()
        repaint()
      })
      theme.observe(document.documentElement, { attributeFilter: ["class", "style"] })
      return () => {
        element.current = null
        resize.disconnect()
        theme.disconnect()
      }
    },
    [repaint]
  )

  return { canvas, repaint }
}

/** Paints `marks` on `canvas`, from the view box of `width` to the pixels of the canvas. */
function paint(
  canvas: HTMLCanvasElement,
  marks: Mark3D[],
  width: number,
  color: (css: string) => string
) {
  canvas.width = Math.round(canvas.clientWidth * devicePixelRatio)
  canvas.height = Math.round(canvas.clientHeight * devicePixelRatio)
  // useRenderer draws on a canvas only where the browser gives one a 2D context.
  const ctx = canvas.getContext("2d")!
  const scale = canvas.width / width
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.lineJoin = "round"

  for (const { points, r, fill, stroke } of marks) {
    ctx.beginPath()
    if (r === undefined) {
      for (const p of points) ctx.lineTo(p.x, p.y)
      ctx.closePath()
    } else {
      ctx.arc(points[0].x, points[0].y, r, 0, 2 * Math.PI)
    }
    ctx.fillStyle = color(fill)
    ctx.fill()
    // A polygon is outlined in its own color, which closes the seams to its neighbours.
    const outline = r === undefined ? fill : stroke
    if (!outline) continue
    ctx.strokeStyle = color(outline)
    ctx.lineWidth = r === undefined ? 0.5 : 1
    ctx.stroke()
  }
}

/** The canvas over the chart box that the marks are painted on, if the chart draws on one. */
function ChartCanvas3D({
  renderer,
  canvas,
  width,
  height,
}: {
  renderer: Renderer3D
  canvas: React.Ref<HTMLCanvasElement>
  width: number
  height: number
}) {
  if (renderer !== "canvas") return null

  return (
    <canvas
      ref={canvas}
      className="pointer-events-none absolute top-0 left-0 w-full mask-y-from-96%"
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  )
}

// The ends of the axes of the gizmo, in the space of d3-3d, where y points down: up in the chart.
const GIZMO = [
  { axis: "x", x: 1, y: 0, z: 0 },
  { axis: "y", x: 0, y: -1, z: 0 },
  { axis: "z", x: 0, y: 0, z: 1 },
]

const CORNERS = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
}

/**
 * The axes of the world in a corner of the chart: turned with the camera,
 * neither panned nor zoomed, the axis nearest the camera on top. An axis
 * draws in `currentColor`, so a text color on its `data-axis` recolors it.
 */
function ChartGizmo3D({
  camera,
  corner,
}: {
  camera: Camera3DInstance
  corner: ChartContainer3DProps["gizmo"]
}) {
  if (!corner) return null
  // The letters at the ends, in a box of 48 around its middle.
  const eye = camera3D()
    .origin({ x: 24, y: 24 })
    .scale(18)
    .rotateY(camera.rotateY())
    .rotateX(camera.rotateX())
  const ends = points3D<(typeof GIZMO)[number]>().camera(eye).data(GIZMO).sort(sort)

  return (
    <svg
      data-slot="chart-3d-gizmo"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("pointer-events-none absolute size-12 text-muted-foreground", CORNERS[corner])}
    >
      {ends.map(({ axis, projected: p }) => (
        <g key={axis} data-axis={axis}>
          <line
            x1={24}
            y1={24}
            x2={24 + (p.x - 24) * 0.6}
            y2={24 + (p.y - 24) * 0.6}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <text
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            className="text-[10px] font-medium"
          >
            {axis.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  )
}

/**
 * The marks of a chart, drawn by the renderer of the container: as SVG
 * elements, or on the canvas over the chart box. The hover reads them too.
 */
function Marks3D({ marks }: { marks: Mark3D[] }) {
  const { renderer, scene, repaint } = useChart3D()
  React.useLayoutEffect(() => {
    scene.current = marks
    repaint()
  })

  if (renderer === "canvas") return null
  return marks.map(({ key, points, r, fill, stroke }) =>
    r === undefined ? (
      <path
        key={key}
        d={`M${points.map((p) => `${+p.x.toFixed(2)},${+p.y.toFixed(2)}`).join("L")}Z`}
        fill={fill}
        stroke={fill}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
    ) : (
      <circle
        key={key}
        cx={points[0].x}
        cy={points[0].y}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 1 : undefined}
      />
    )
  )
}

/** A label beside a mark: `at` in the units of the view box, `anchor` the end of the text that sits there. */
export type Label3D = {
  key: string
  at: Point2D
  text: React.ReactNode
  anchor: "start" | "middle" | "end"
}

/**
 * The labels of the marks of a chart, ringed by the background so that they
 * read on the marks. Like the labels of the box, they are SVG with every renderer.
 */
function Labels3D({ labels }: { labels: Label3D[] }) {
  // ponytail: under the canvas of the canvas renderer, as the labels of the box; an SVG layer over the canvas would lift them.
  return (
    <g data-slot="chart-3d-labels">
      {labels.map(({ key, at, text, anchor }) => (
        <text
          key={key}
          x={at.x}
          y={at.y}
          textAnchor={anchor}
          dominantBaseline="central"
          paintOrder="stroke"
          strokeWidth={3}
          strokeLinejoin="round"
          className="fill-foreground stroke-background text-[10px] font-medium"
        >
          {text}
        </text>
      ))}
    </g>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] || item.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

function ChartTooltip3D({
  tooltip,
  width,
  height,
}: {
  tooltip: Tooltip3D | null
  width: number
  height: number
}) {
  if (!tooltip) return null

  return (
    <div
      className="pointer-events-none absolute z-10 grid min-w-32 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
      style={{ left: `${(tooltip.at.x / width) * 100}%`, top: `${(tooltip.at.y / height) * 100}%` }}
    >
      {tooltip.title && <div className="font-medium">{tooltip.title}</div>}
      {tooltip.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {item.color && (
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} />
          )}
          <span className="text-muted-foreground">{item.label}</span>
          <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
            {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * A button in the corner of the chart, named `label`, that lists the rows of
 * its keymap. The `help` keys on the chart open and close the list, Escape
 * closes it.
 */
function ChartShortcuts3D({ rows, help, label }: Pick<Keymap, "rows" | "help" | "label">) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  // A dependency that stays the same while the keys do; no key is a line break.
  const keys = help.join("\n")

  React.useEffect(() => {
    const chart = ref.current?.parentElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (keys.split("\n").includes(pressed(e))) setOpen((o) => !o)
      if (e.key === "Escape") setOpen(false)
    }
    chart?.addEventListener("keydown", onKeyDown)
    return () => chart?.removeEventListener("keydown", onKeyDown)
  }, [keys])

  return (
    <div ref={ref} className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        data-slot="chart-3d-shortcuts-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4"
      >
        <KeyboardIcon />
      </button>
      {open && <ChartShortcutList3D id={id} rows={rows} />}
    </div>
  )
}

/** The list of the shortcut panel: per row, its groups of keys and its label. */
function ChartShortcutList3D({ id, rows }: { id: string; rows: Keymap["rows"] }) {
  return (
    <dl
      id={id}
      data-slot="chart-3d-shortcuts"
      className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 shadow-xl"
    >
      {rows.map(({ label, groups }) => (
        <React.Fragment key={label}>
          <dt className="flex flex-wrap gap-x-2 gap-y-1">
            {groups.map((group, i) => (
              <span key={i} data-slot="kbd-group" className="flex gap-1">
                {group.map((key, j) => (
                  <kbd
                    key={j}
                    data-slot="kbd"
                    className="pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            ))}
          </dt>
          <dd className="text-muted-foreground">{label}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function ChartLegend3D({ config }: { config: ChartConfig }) {
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {Object.entries(config).map(([key, item]) => (
        <div key={key} className="flex items-center gap-1.5">
          {item.icon ? (
            <item.icon />
          ) : (
            <span className="size-2 rounded-[2px]" style={{ background: `var(--color-${key})` }} />
          )}
          {item.label ?? key}
        </div>
      ))}
    </div>
  )
}

/**
 * The walls of the chart box that face away from the camera, with their
 * gridlines, and an axis with ticks on the outline of the box.
 */
function Axes3D({
  spec,
  world,
  format = {},
  titles = {},
}: {
  spec: AxesSpec
  world: World
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
}) {
  const { camera } = useChart3D()
  const box = axes3D()
    .camera(camera)
    .x((p) => world.x(p.x))
    .y((p) => world.y(p.y))
    .z((p) => world.z(p.z))

  return (
    <g data-slot="chart-3d-axes">
      {box
        .data(spec)
        .filter((wall) => !wall.ccw)
        .map((wall) => (
          <path
            key={`${wall.axis}${wall.side}`}
            d={box.draw(wall)}
            className="fill-muted/40 stroke-border"
            strokeWidth={0.75}
          />
        ))}
      {labelAxes(box.axes(spec), format, titles).map((axis) => (
        <AxisEdge3D key={axis.key} ticks={axis.ticks} title={axis.title} />
      ))}
    </g>
  )
}

/** A label of the chart box in the units of the view box: a tick label or the title of an axis. */
type AxisLabel = {
  x: number
  y: number
  anchor: "start" | "middle" | "end"
  text: React.ReactNode
  /** The font size, which the overlap check reads. */
  size: number
  hidden?: boolean
}

/**
 * The labels of one axis on the outline of the box: a label per tick, pushed
 * away from the box along the normal of the edge, and the title of the axis
 * further out. `key` names the edge, one of the four the axis moves between
 * as the camera turns.
 */
function axisLabels(
  edge: AxisEdge,
  format: (value: number) => React.ReactNode,
  title?: React.ReactNode
) {
  const { normal: n } = edge
  const start = edge[0].projected
  const end = edge[edge.length - 1].projected
  const anchor = n.x > 0.3 ? "start" : n.x < -0.3 ? "end" : "middle"
  const label = (at: Point2D, out: number, text: React.ReactNode, size: number): AxisLabel => ({
    x: at.x + n.x * out,
    y: at.y + n.y * out,
    anchor,
    text,
    size,
  })
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }

  return {
    key: `${edge.axis}:${edge[0].x},${edge[0].y},${edge[0].z}`,
    ticks: edge.map((tick) => label(tick.projected, 10, format(tick[edge.axis]), 10)),
    title: title ? label(middle, 44, title, 12) : undefined,
  }
}

/**
 * The labels of the axes, with every tick label hidden that would cover a
 * title or a tick label before it, so an axis seen end on keeps its first
 * label and a short one every other.
 */
function labelAxes(
  edges: AxisEdge[],
  format: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>,
  titles: Partial<Record<keyof AxesSpec, React.ReactNode>>
) {
  // An axis without ticks, such as the rows of an empty chart, has nothing to label.
  const axes = edges
    .filter((edge) => edge.length)
    .map((edge) => axisLabels(edge, format[edge.axis] ?? String, titles[edge.axis]))
  const placed = axes.flatMap((axis) => (axis.title ? [bounds(axis.title)] : []))
  for (const label of axes.flatMap((axis) => axis.ticks)) {
    const b = bounds(label)
    label.hidden = placed.some(
      (p) => b.left < p.right && p.left < b.right && b.top < p.bottom && p.top < b.bottom
    )
    if (!label.hidden) placed.push(b)
  }
  return axes
}

/** The box a label covers, guessed from its text, as the browser lays it out only after the render. */
function bounds({ x, y, anchor, text, size }: AxisLabel) {
  // ponytail: 0.6em a character; measure with getBBox if wide fonts or rich labels still overlap.
  const chars = typeof text === "string" || typeof text === "number" ? String(text).length : 4
  const width = chars * size * 0.6
  const left = x - width * { start: 0, middle: 0.5, end: 1 }[anchor]
  return { left, right: left + width, top: y - size / 2, bottom: y + size / 2 }
}

/**
 * The labels of one axis, dimmed while the camera turns. When the axis jumps
 * to another edge of the box, its key changes, so they mount anew and fade in
 * there.
 */
function AxisEdge3D({ ticks, title }: { ticks: AxisLabel[]; title?: AxisLabel }) {
  return (
    <g className="transition-opacity duration-300 starting:opacity-0 in-data-[orbiting=true]:opacity-50">
      {ticks.map(({ x, y, anchor, text, hidden }, i) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor={anchor}
          dominantBaseline="central"
          className={cn(
            "fill-muted-foreground text-[10px] transition-opacity",
            hidden && "opacity-0"
          )}
        >
          {text}
        </text>
      ))}
      {title && (
        <text
          x={title.x}
          y={title.y}
          textAnchor={title.anchor}
          dominantBaseline="central"
          className="fill-foreground font-medium"
        >
          {title.text}
        </text>
      )}
    </g>
  )
}

/** A nice axis from `lo` to `hi` with about `count` ticks. */
function axis(lo: number, hi: number, count = 5): AxisSpec {
  const [start, stop] = nice(lo, lo === hi ? hi + 1 : hi, count)
  return { domain: [start, stop], ticks: ticks(start, stop, count) }
}

/** The linear map from `domain` to `range`. */
function linear([d0, d1]: number[], [r0, r1]: number[]) {
  return (value: number) => r0 + ((value - d0) / (d1 - d0 || 1)) * (r1 - r0)
}

/** The world box of `spec`: x from -1 to 1, y up from 1 to -1, z from -`depth` to `depth`. */
function worldBox(spec: AxesSpec, depth = 1): World {
  return {
    x: linear(spec.x.domain, [-1, 1]),
    y: linear(spec.y.domain, [1, -1]),
    z: linear(spec.z.domain, [-depth, depth]),
  }
}

// From the upper left, towards the viewer, in view space where y points down.
const LIGHT = { x: -0.4, y: -0.8, z: 0.44 }

/**
 * `color` lit by the light from the upper left: the face that looks at it
 * keeps the color, one that turns away gets darker. A CSS color-mix, so the
 * shade follows the theme variables.
 */
function shade(face: TransformedPoint<unknown>[], color: string) {
  const n = normal(face.map((p) => p.rotated))
  // The normal of the side the camera sees, whichever way the face winds.
  const side = n.z < 0 ? -1 : 1
  const light = Math.max(0, side * (n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z))
  return `color-mix(in oklch, ${color} ${Math.round(65 + 35 * light)}%, black)`
}

/** The mean of the projected points, where a tooltip points at. */
function center(points: TransformedPoint<unknown>[]): Point2D {
  const sum = points.reduce((s, p) => ({ x: s.x + p.projected.x, y: s.y + p.projected.y }), {
    x: 0,
    y: 0,
  })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/** The marks of a cube: its faces that look at the camera, shaded in `color`, each with `tooltip` on hover. */
function cubeMarks(id: string, faces: CubeFace[], color: string, tooltip: Tooltip3D): Mark3D[] {
  // The faces point outwards: a convex shape shows the ones facing the camera.
  return faces
    .filter((face) => face.ccw)
    .map((face) => ({
      key: `${id}-${face.face}`,
      points: face.map((p) => p.projected),
      fill: shade(face, color),
      tooltip,
    }))
}

export {
  ChartContainer3D,
  ChartLegend3D,
  Axes3D,
  Marks3D,
  Labels3D,
  axis,
  linear,
  worldBox,
  shade,
  center,
  cubeMarks,
}
