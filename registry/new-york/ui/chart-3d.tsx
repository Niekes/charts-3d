"use client"

import * as React from "react"
import { extent, max, min, nice, ticks } from "d3-array"
import {
  axes3D,
  box,
  camera3D,
  normal,
  points3D,
  sort,
  type Axes3DInstance,
  type AxesSpec,
  type AxisEdge,
  type AxisSpec,
  type AxisWall,
  type Camera3DInstance,
  type CubeFace,
  type Point2D,
  type Point3D,
  type ShapeInstance,
  type TransformedPoint,
} from "d3-3d"

import { cn } from "@/lib/utils"

// The same shape as the ChartConfig of shadcn's chart, so one config drives
// a 2D and a 3D chart side by side.
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
    /** The symbol a chart draws for the key, where it draws one: the tip of a route. */
    symbol?: Symbol3D
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

/**
 * How the marks of a chart are drawn. The box, its labels, the tooltip and the
 * legend are always SVG and HTML.
 */
export type Renderer3D = "svg" | "canvas"

/** Maps data values to the world box, which spans -1 to 1 on every axis, y up. */
export type World = Record<keyof AxesSpec, (value: number) => number>

/** What a mark says while the pointer is on it, beside the pointer. */
export type Tooltip3D = {
  title?: React.ReactNode
  items: { label: React.ReactNode; value: React.ReactNode; color?: string }[]
}

/**
 * A picture a mark is drawn as, such as a plane: the outline of an icon, as
 * its icon set writes it, in the one color of its mark.
 */
export type Symbol3D = {
  /** SVG path data in a box of 24: the `d` of an icon, the `d`s of its paths joined by a space. */
  path: string
  /**
   * Where it points as it is drawn, in degrees clockwise from up: 45 for the
   * plane of Lucide. A symbol that names it turns to the way it goes; one that
   * names none stays upright, as a car seen from the side.
   */
  points?: number
  /**
   * Whether it is filled, as the icons of a solid set are.
   * @defaultValue false: outlined, as Lucide draws its icons
   */
  fill?: boolean
}

/**
 * One shape of a chart, projected, in paint order: a polygon, unless its
 * `shape` says otherwise - a circle of radius `r` around its one point, or a
 * symbol on that disc.
 */
export type Mark3D = {
  /** Stable across renders, so React moves the shape instead of redrawing it. */
  key: string
  /** The corners of a polygon, or the center of a circle or a symbol, in the units of the view box. */
  points: Point2D[]
  /** A CSS color, such as the result of `shade` or `var(--color-x)`. */
  fill: string
  /** The ring around a circle or a symbol, a CSS color. */
  stroke?: string
  /**
   * Shown while the pointer is over the mark. A function is called when the
   * pointer lands on the mark, so a chart with thousands of marks pays for
   * one tooltip per hover, not one per mark per frame; `null` shows none.
   */
  tooltip?: Tooltip3D | (() => Tooltip3D | null)
  /**
   * The marks of the same element as this one, within its `Marks3D`: the
   * faces of a bar, the segments of a flow. Pointing at a mark fills them with the focus color -
   * `--chart-3d-focus`, or their own fill lightened - until the pointer
   * leaves the mark; a stroke of their own stays.
   */
  groups?: string[]
  /**
   * Drawn only while its groups are in focus, such as the dot on the point of
   * a line: unlit, it is out of the scene, so it neither paints nor hits.
   */
  whenLit?: true
} & (
  | { shape?: "polygon"; r?: never }
  | { shape: "circle"; r: number }
  | {
      shape: "symbol"
      /** The radius of the disc the symbol spans, and the pointer hits. */
      r: number
      symbol: Symbol3D
      /** The point it comes from: a symbol that names where it points turns to the way from there. */
      from?: Point2D
    }
)

/** The shapes a mark may have, and the mark of one of them. */
type Shape3D = NonNullable<Mark3D["shape"]>
type MarkOf<S extends Shape3D> = Extract<Mark3D, { shape?: S }>

/** The groups in focus, a store, so a change reaches the marks and labels without rendering the chart again. */
type Focus3D = {
  get: () => string[] | undefined
  set: (groups?: string[]) => void
  subscribe: (listener: () => void) => () => void
}

type ChartContext3D = {
  config: ChartConfig
  camera: Camera3DInstance
  renderer: Renderer3D
  /** The marks of the chart, which the hover and the canvas read. */
  scene: React.RefObject<Mark3D[]>
  /** Puts the marks of the `Marks3D` of `id`, drawn at `node` in the tree, into the scene, or takes them out. */
  place: (id: string, set?: { marks: Mark3D[]; node: Element }) => void
  repaint: () => void
  focus: Focus3D
  /** The time in ms a chart takes to glide into new data, 600 unless the container says. */
  animationDuration?: number
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
// How long the zoom cursor outlives the last wheel tick before the hand returns.
const ZOOM_CURSOR = 400

/**
 * A step of the camera: turned by `yaw` and `tilt`, moved by `pan`, zoomed by
 * the factor `zoom` to the point `at`, from the middle of the view, or reset.
 */
type Move = {
  yaw?: number
  tilt?: number
  pan?: Point2D
  zoom?: number
  at?: Point2D
  reset?: boolean
}

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

/** The gestures of the pointer, which `keymap` can turn off or rename but not rebind; the shortcut panel shows each with its modifier on the reader's platform. */
export type Gesture3D =
  | "dragRotate"
  | "touchOrbit"
  | "dragPan"
  | "wheelZoom"
  | "pinchZoom"
  | "doubleClickReset"

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
// an action move the camera, a gesture shows how it is made, and the panel lists
// every action that is on, so the two never disagree. `keymap` overrides them.
const SHORTCUTS: Record<
  Action3D,
  { label: string; keys?: string[]; gesture?: string[]; move?: Move }
> = {
  dragRotate: { label: "Rotate", gesture: ["Mod", "Drag"] },
  touchOrbit: { label: "Rotate", gesture: ["Two-finger drag"] },
  rotateLeft: { label: "Rotate", keys: ["ArrowLeft"], move: { yaw: -KEY_STEP } },
  rotateRight: { label: "Rotate", keys: ["ArrowRight"], move: { yaw: KEY_STEP } },
  rotateUp: { label: "Rotate", keys: ["ArrowUp"], move: { tilt: -KEY_STEP } },
  rotateDown: { label: "Rotate", keys: ["ArrowDown"], move: { tilt: KEY_STEP } },
  dragPan: { label: "Pan", gesture: ["Alt", "Drag"] },
  panLeft: { label: "Pan", keys: ["Shift+ArrowLeft"], move: { pan: { x: -PAN_STEP, y: 0 } } },
  panRight: { label: "Pan", keys: ["Shift+ArrowRight"], move: { pan: { x: PAN_STEP, y: 0 } } },
  panUp: { label: "Pan", keys: ["Shift+ArrowUp"], move: { pan: { x: 0, y: -PAN_STEP } } },
  panDown: { label: "Pan", keys: ["Shift+ArrowDown"], move: { pan: { x: 0, y: PAN_STEP } } },
  zoomIn: { label: "Zoom", keys: ["Plus", "="], move: { zoom: ZOOM_STEP } },
  zoomOut: { label: "Zoom", keys: ["-"], move: { zoom: 1 / ZOOM_STEP } },
  wheelZoom: { label: "Zoom", gesture: ["Mod", "Scroll"] },
  pinchZoom: { label: "Zoom", gesture: ["Pinch"] },
  reset: { label: "Reset", keys: ["0"], move: { reset: true } },
  doubleClickReset: { label: "Reset", gesture: ["Double-click"] },
  help: { label: "Keyboard shortcuts", keys: ["?"] },
}

const MODIFIERS = ["Control", "Alt", "Meta", "Shift"]

/** Whether the reader is on a Mac, where the platform modifier is ⌘; elsewhere it is Ctrl. */
const mac = () =>
  /mac/i.test(
    (globalThis.navigator as Navigator & { userAgentData?: { platform?: string } })?.userAgentData
      ?.platform ??
      globalThis.navigator?.platform ??
      ""
  )

/** The label of the platform modifier: ⌘ on a Mac, Ctrl elsewhere. */
const modLabel = () => (mac() ? "⌘" : "Ctrl")

/** The label of the Alt key: ⌥ on a Mac, Alt elsewhere. */
const altLabel = () => (mac() ? "⌥" : "Alt")

/** The platform never changes, so its store has nothing to tell. */
const never = () => () => {}

/** Whether the platform modifier - ⌘ on a Mac, Ctrl elsewhere - is held in `e`. */
const platformMod = (e: { metaKey: boolean; ctrlKey: boolean }) => (mac() ? e.metaKey : e.ctrlKey)

/** Whether `value` lies between the ends `lo` and `hi`. */
const within = (lo: number, hi: number, value: number) => value >= lo && value <= hi
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
  // Space is named, " " only in this form: Shift counts beside it.
  const typed = key.length === 1 && key !== " "
  const mods = MODIFIERS.filter((m) => parts.includes(m) && (m !== "Shift" || !typed))
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
    // A field left undefined, as from a condition, keeps its default.
    const set = Object.entries(Array.isArray(own) ? { keys: own } : own || {})
    const { keys = [], ...shortcut } = {
      ...SHORTCUTS[action],
      ...Object.fromEntries(set.filter(([, v]) => v !== undefined)),
    }
    const on = own !== false && (shortcut.gesture !== undefined || keys.length > 0)
    return { ...shortcut, action, on, keys: keys.map(combo) }
  })
}

type Shortcut = ReturnType<typeof shortcutsOf>[number]

/** The keys or the gesture of a shortcut as the panel writes them, with the modifiers of the reader's platform. */
const partsOf = ({ keys, gesture }: Pick<Shortcut, "keys" | "gesture">) =>
  (gesture ?? split(keys[0])).map((k) =>
    k === "Mod" ? modLabel() : k === "Alt" ? altLabel() : (KBD[k] ?? k)
  )

/**
 * The rows of the shortcut panel: the actions by label, the keys of a row in
 * groups of the same modifiers, left of its gestures, each a group of its own.
 */
function rowsOf(shortcuts: Shortcut[]) {
  const rows = new Map<string, { keys: Map<string, string[]>; gestures: string[][] }>()
  for (const { label, keys, gesture } of shortcuts) {
    const parts = partsOf({ keys, gesture })
    const row = rows.get(label) ?? { keys: new Map<string, string[]>(), gestures: [] }
    if (gesture) row.gestures.push(parts)
    else {
      const group = parts.slice(0, -1).join("+")
      const known = row.keys.get(group)
      row.keys.set(group, known ? [...known, parts.at(-1)!] : parts)
    }
    rows.set(label, row)
  }
  return [...rows].map(([label, row]) => ({
    label,
    keys: [...row.keys.values()],
    gestures: row.gestures,
  }))
}

/**
 * What a keymap does: the actions that are on, the step of each key, the help
 * keys, the rows of the panel and the hint of a gesture. Without the `panel`,
 * the help keys have nothing to open and are off.
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
    hint: (action: Gesture3D) => {
      const shortcut = on.find((s) => s.action === action)
      return shortcut && { label: shortcut.label, gesture: partsOf(shortcut) }
    },
  }
}

type Keymap = ReturnType<typeof keymapOf>

export type ChartContainer3DProps = {
  /** The series of the chart: a label and a color per key, as in the chart of shadcn/ui. */
  config: ChartConfig
  /**
   * The time in ms a chart takes to glide into new data; 0 makes it jump.
   * @defaultValue 600
   */
  animationDuration?: number
  /**
   * Where the camera starts, and where a reset returns it.
   * @defaultValue { yaw: π/6, tilt: π/6 }
   */
  defaultView?: View3D
  /**
   * The view the camera heads for: it starts there, and when the view
   * changes it glides there over the `animationDuration`, as the data does.
   * A view moves only what it names, so the zoom and the pan of the reader
   * stay, and the reader turns the camera on from it.
   * @defaultValue none: the camera starts at the default view
   */
  view?: View3D
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
   * How the marks of the chart are drawn: "canvas" suits many marks. The chart
   * draws as SVG until the browser shows it has a canvas, and where it has
   * none, as SVG.
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
  /**
   * The corner beside the pointer the tooltip sits at. Where the tooltip would
   * leave the chart, it flips to the other side, on each axis alone.
   * @defaultValue "top-right"
   */
  placement?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}

function ChartContainer3D({
  id,
  config,
  defaultView = { yaw: Math.PI / 6, tilt: Math.PI / 6 },
  view: heading,
  width = 640,
  height = 400,
  animationDuration: ms,
  legend = false,
  renderer: requested = "svg",
  shortcuts = true,
  keymap = {},
  gizmo = "bottom-left",
  placement = "top-right",
  children,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"div"> & ChartContainer3DProps) {
  const chartId = chartIdOf(id, React.useId())
  // The colors of the config as a string: a new config object with the same colors is no change.
  const palette = JSON.stringify(Object.entries(config).map(([k, c]) => [k, c.color, c.theme]))
  const drawing = useScene(requested, width, height, placement, palette)
  const { scene, place, renderer, canvas, repaint, hover, hide, leave, tip, focus } = drawing
  const keys = keymapOf(keymap, shortcuts)
  const { view, handlers, hint } = useOrbit(defaultView, width, keys, hide, hover, { heading, ms })
  const camera = useCamera(view, width, height)
  const context = React.useMemo(
    () => ({ config, camera, renderer, scene, place, repaint, focus, animationDuration: ms }),
    [config, camera, renderer, place, repaint, focus, ms]
  )

  return (
    <div
      data-slot="chart-3d"
      data-chart={chartId}
      {...props}
      className={cn("relative w-full text-xs", props.className)}
    >
      <ChartStyle id={chartId} config={config} />
      <div className="relative rounded-lg has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
        <ChartSvg3D
          viewBox={`0 0 ${width} ${height}`}
          keys={keys}
          label={ariaLabel}
          onPointerLeave={leave}
          {...handlers}
        >
          <Chart3DContext.Provider value={context}>{children}</Chart3DContext.Provider>
        </ChartSvg3D>
        <ChartCanvas3D renderer={renderer} canvas={canvas} width={width} height={height} />
        <ChartGizmo3D camera={camera} corner={gizmo} />
        <ChartTooltip3D tip={tip} />
        <ChartHint3D {...hint} />
      </div>
      <ChartShortcuts3D {...keys} />
      {legend && <ChartLegendBody3D config={config} />}
    </div>
  )
}

/** The id the colors of a chart are scoped to: its own `id`, or the one React made up. */
function chartIdOf(id: string | undefined, uniqueId: string) {
  return `chart-${id || uniqueId.replace(/:/g, "")}`
}

/**
 * The svg of the chart, saying what `keys` do. The server knows no platform
 * and says Ctrl; the store renders once more after hydration, with the
 * modifier of the reader. The panel reads the platform directly: it opens on
 * the client only.
 */
function ChartSvg3D({
  keys,
  label,
  viewBox,
  ...props
}: React.ComponentProps<"svg"> & { keys: Keymap; label?: string }) {
  const mod = React.useSyncExternalStore(never, modLabel, () => "Ctrl")
  return <svg viewBox={viewBox} role="img" {...keymapProps(keys, mod, label)} {...props} />
}

/**
 * What the svg says about its keymap: a label that names the `mod` drag and the
 * help key if they are on, the keys, the focus only if a key does something
 * and, if a drag or two fingers do, `touch-pan-y`: a vertical swipe scrolls
 * the page and every other touch reaches the chart.
 */
function keymapProps(keys: Keymap, mod: string, label?: string): React.SVGProps<SVGSVGElement> {
  const drag = (["dragRotate", "dragPan", "touchOrbit", "pinchZoom"] as const).some(keys.on)
  const help = keys.help[0]
  const said = [
    "3D chart.",
    keys.on("dragRotate") && `${mod} and drag to rotate it.`,
    help && `Press ${aria(help)} for all shortcuts.`,
  ]
  return {
    "aria-label": label ?? said.filter(Boolean).join(" "),
    "aria-keyshortcuts": keys.aria || undefined,
    tabIndex: keys.aria ? 0 : undefined,
    className: cn(
      "block h-auto w-full outline-hidden select-none mask-x-from-96% mask-y-from-96%",
      // The default cursor stays, so a plain drag only inspects; the modifier and a drag rotate.
      // A touch has no modifier, so its vertical swipe scrolls the page (ADR-0001).
      drag && "touch-pan-y"
    ),
  }
}

// The bit of `a.compareDocumentPosition(b)` that says `b` comes before `a` in the document.
const PRECEDING = 2

/**
 * The marks of the chart and what reads them: the renderer that draws them,
 * the canvas it paints them on and the hover that shows their tooltips. The
 * scene holds the marks of every `Marks3D` in the container, each set placed
 * by `place`, in the order of the sets in the document - the order SVG paints
 * them in - so a set that mounts later but sits earlier lies under the others
 * on every renderer.
 */
function useScene(
  requested: Renderer3D,
  width: number,
  height: number,
  placement: Placement3D,
  palette: string
) {
  const scene = React.useRef<Mark3D[]>([])
  const sets = React.useRef(new Map<string, { marks: Mark3D[]; node: Element }>())
  const place = React.useCallback((id: string, set?: { marks: Mark3D[]; node: Element }) => {
    if (set) sets.current.set(id, set)
    else sets.current.delete(id)
    scene.current = [...sets.current.values()]
      .sort((a, b) => (a.node.compareDocumentPosition(b.node) & PRECEDING ? 1 : -1))
      .flatMap((s) => s.marks)
  }, [])
  const tip = useTip(placement)
  const focus = useFocus()
  const renderer = useRenderer(requested)
  const { canvas, repaint } = useCanvas(scene, width, palette)
  const { hover, hide, leave } = useHover(scene, width, height, tip, focus)
  return { scene, place, renderer, canvas, repaint, hover, hide, leave, tip, focus }
}

type Tip3D = ReturnType<typeof useTip>
type Placement3D = NonNullable<ChartContainer3DProps["placement"]>

// The room between the pointer and its tooltip, in pixels, and the shift of
// the tooltip on an axis: before the pointer by its own size and the room, or after it.
const TIP_GAP = 12
const shift = (isBefore: boolean) => (isBefore ? `calc(-100% - ${TIP_GAP}px)` : `${TIP_GAP}px`)

/**
 * Whether a tooltip of `size` goes before the pointer at `at`, on an axis of
 * `length`: as `preferred`, unless it would leave the chart there and the
 * other side has more room.
 */
function before(at: number, size: number, length: number, preferred: boolean) {
  const room = preferred ? at : length - at
  return room < size + TIP_GAP && length - room > room ? !preferred : preferred
}

/**
 * The tooltip of the hovered mark and where it sits: beside the pointer, in
 * the pixels of the chart, at `placement`. `follow` moves it with the pointer
 * straight in the DOM, so a move within a mark renders nothing; `place` puts
 * it there again once it shows, or its content changes its size.
 */
function useTip(placement: Placement3D) {
  const [tooltip, set] = React.useState<Tooltip3D | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  // The pointer in the chart, and the size of the chart.
  const pointer = React.useRef({ x: 0, y: 0, width: 0, height: 0 })
  const place = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    // A tooltip that shows jumps into its corner; only one on screen glides when it flips.
    const shows = !el.dataset.placement
    if (shows) el.style.transition = "none"
    const { x, y, width, height } = pointer.current
    const top = before(y, el.offsetHeight, height, placement.startsWith("top"))
    const left = before(x, el.offsetWidth, width, placement.endsWith("left"))
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.translate = `${shift(left)} ${shift(top)}`
    el.dataset.placement = `${top ? "top" : "bottom"}-${left ? "left" : "right"}`
    if (shows) {
      // Lays the corner out while the transition is off, then turns it on again.
      el.getBoundingClientRect()
      el.style.transition = ""
    }
  }, [placement])
  const follow = (at: typeof pointer.current) => {
    pointer.current = at
    place()
  }
  return { tooltip, set, ref, place, follow }
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

const clamp = (lo: number, hi: number, value: number) => Math.max(lo, Math.min(hi, value))
const ZERO = { x: 0, y: 0 }

/**
 * `view` moved by one step. The tilt stops at the zenith and the nadir, the
 * zoom at 1/4 and 8, and a turn is divided by the zoom: zoomed in, a drag
 * moves the picture under the pointer as far as zoomed out, and a key turns
 * it as far on screen. A zoom keeps the point `at` where it is, by the zoom
 * after its limits, so the chart stands still at them; without `at` that
 * point is the origin of the chart, and the pan stays.
 */
function moved(view: View3D, move: Move, initial: View3D): View3D {
  if (move.reset) return initial
  const step = { yaw: 0, tilt: 0, zoom: 1, pan: { x: 0, y: 0 }, ...move }
  const pan = view.pan ?? { x: 0, y: 0 }
  const from = view.zoom ?? 1
  const zoom = clamp(0.25, 8, from * step.zoom)
  const k = zoom / from
  const at = move.at ?? pan
  return {
    ...view,
    yaw: view.yaw + step.yaw / from,
    tilt: clamp(-Math.PI / 2, Math.PI / 2, view.tilt + step.tilt / from),
    zoom,
    pan: { x: at.x - (at.x - pan.x) * k + step.pan.x, y: at.y - (at.y - pan.y) * k + step.pan.y },
  }
}

/**
 * Whether the chart may move on its own: only where the browser says the
 * reader has not asked for reduced motion. Where it cannot say, as on the
 * server and in jsdom, the chart jumps.
 */
function animates() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: no-preference)").matches)
}

// The time in ms a chart takes to glide into new data, unless its container says otherwise.
const DURATION = 600

/** The share of the way a glide of the data has come at the share `t` of its time: it eases in and out. */
const smooth = (t: number) => t * t * (3 - 2 * t)

/** The same for a step of the camera, which answers a key at once: it eases out. */
const prompt = (t: number) => 1 - (1 - t) ** 3

/**
 * One glide of numbers: from `from` into `to`, come the share `t` of the
 * way, the keys the new numbers dropped gliding out to `out`.
 */
type Tween = {
  key: string
  from: Record<string, number>
  to: Record<string, number>
  out: Record<string, number>
  t: number
}

/**
 * Eases a chart into new data: the numbers of `values` glide from the ones
 * on screen to these over the animationDuration of the container. A key
 * that is new starts at `enter`, or where it ends; a key that is gone glides
 * back to `enter`, the mirror of its entering - without one it stands where
 * it is - and leaves when the glide is done. `enter` is one number for every
 * key, or a function that finds it `among` numbers - those on screen for a
 * key that comes, the new ones for a key that goes - such as the number of
 * its neighbour, and `undefined` for nowhere. `between` gives the numbers
 * the `share` of the way from their start to their ends, each on its own
 * unless it says otherwise - numbers that are a point together may take a
 * way of their own. A glide settles where its keys start and end when it
 * starts, so new data that comes on the way moves every number on from
 * where it is. Without time, or with reduced motion, the numbers jump. At
 * rest it hands back the record of its target, no copy, so no frame rebuilds
 * it: read it, never write to it.
 */
function useTween(
  values: Record<string, number>,
  enter?: number | ((key: string, among: Record<string, number>) => number | undefined),
  between: (
    from: Record<string, number>,
    ends: Record<string, number>,
    share: number
  ) => Record<string, number> = straight
): Record<string, number> {
  const { animationDuration: duration = DURATION } = useChart3D()
  // The content, not the record, keys the glide: a chart may build `values`
  // anew at any render. The same record as before is the same content, so a
  // chart that keeps its records while the camera turns compares nothing.
  const last = React.useRef<{ values: Record<string, number>; key: string }>(null)
  if (last.current?.values !== values) {
    last.current = { values, key: JSON.stringify(values) }
  }
  const key = last.current.key
  const [tween, setTween] = React.useState<Tween>({ key, from: values, to: values, out: {}, t: 1 })
  const shown = tweenNumbers(tween, between)

  // Numbers from the render before, the React pattern of state set while rendering.
  if (key !== tween.key) {
    setTween({ key, ...glideOf(shown, values, enter), t: duration > 0 && animates() ? 0 : 1 })
  }

  React.useEffect(() => {
    if (tween.t >= 1) return
    let start: number | null = null
    let frame = 0
    const step = (now: number) => {
      // A duration that changes during the glide goes on from the share covered.
      start ??= now - tween.t * duration
      // A duration that turned 0 during the glide: 0 / 0 is NaN, so it jumps to the end.
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1
      // A frame may run after new data has started the next glide and before
      // this one is cancelled: it moves its own glide only.
      setTween((tw) => (tw.key === tween.key ? { ...tw, t } : tw))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [tween.key, duration])

  return shown
}

/**
 * The glide from the numbers `shown` into `to`: a new key starts where it
 * enters from, or where it ends, and a gone one heads back there - or stands
 * where it is.
 */
function glideOf(
  shown: Record<string, number>,
  to: Record<string, number>,
  enter: Parameters<typeof useTween>[1]
) {
  const origin = (key: string, among: Record<string, number>) =>
    typeof enter === "function" ? enter(key, among) : enter
  const fresh = Object.keys(to).filter((k) => !(k in shown))
  const gone = Object.keys(shown).filter((k) => !(k in to))
  return {
    from: { ...shown, ...Object.fromEntries(fresh.map((k) => [k, origin(k, shown) ?? to[k]])) },
    to,
    out: Object.fromEntries(gone.map((k) => [k, origin(k, to) ?? shown[k]])),
  }
}

/**
 * The numbers of `tween` on screen: `from` eased into `to`, and into `out`
 * for the keys on their way out, until the glide is done, mixed as `between`
 * mixes them. At rest, as while the camera turns, they are the target
 * itself: nothing to build.
 */
function tweenNumbers({ from, to, out, t }: Tween, between: typeof straight) {
  if (t >= 1) return to
  const s = smooth(t)
  return { ...between(from, to, s), ...between(from, out, s) }
}

/** Every number the `share` of the way from its start to its end, each on its own. */
function straight(from: Record<string, number>, ends: Record<string, number>, share: number) {
  return Object.fromEntries(
    Object.entries(ends).map(([k, end]) => [k, from[k] + (end - from[k]) * share])
  )
}

/**
 * An axis gliding into new data: its spec, the ticks the data dropped, fading
 * out in place, and the gliding `span` of its ticks, which its line runs.
 */
type GlidingAxis = AxisSpec & { leaving?: number[]; span?: number[] }

/**
 * `spec` gliding into new data with the marks: the ends of every axis glide
 * as `useTween` glides the numbers, where ends rounded from the numbers on
 * screen would jump from one round number to the next, and the box with
 * them. The ticks stay those of `spec`; labels of ticks outside the gliding
 * ends fade out in `edgeLabels` instead of popping out of the range. The
 * outermost ticks glide too, so the line of the axis grows to a new tick and
 * shrinks from a dropped one instead of jumping when the glide is done.
 */
function useTweenAxes(spec: AxesSpec): AxesSpec {
  const axes = ["x", "y", "z"] as const
  const last = (domain: number[]) => domain[domain.length - 1]
  const target = Object.fromEntries(
    axes.flatMap((a) => {
      const { domain, ticks } = spec[a]
      return [
        [`${a}0`, domain[0]],
        [`${a}1`, last(domain)],
        [`${a}t0`, ticks.at(0) ?? domain[0]],
        [`${a}t1`, ticks.at(-1) ?? last(domain)],
      ]
    })
  )
  const ends = useTween(target)
  // At the end of a glide useTween hands back the targets themselves, so the
  // ends tell whether the axes still glide.
  const gliding = Object.keys(target).some((k) => ends[k] !== target[k])
  // The target the glide left, remembered the way useTween keys its numbers,
  // so a retarget in the middle of a glide fades the ticks of that target out.
  const key = JSON.stringify(spec)
  const memory = React.useRef({ key, target: spec, from: spec })
  if (memory.current.key !== key) {
    memory.current = { key, target: spec, from: memory.current.target }
  }
  const glided = (a: keyof AxesSpec): GlidingAxis => {
    const [lo, hi] = [ends[`${a}0`], ends[`${a}1`]]
    // The ticks stay those of the target, so a label whose tick lies outside the
    // gliding ends fades out instead of popping out of the range. Every tick the
    // new data drops stays until the glide is done: one beyond the new ends
    // fades out as the gliding end sweeps past it, one within them fades out in
    // place, named in `leaving`.
    const [d0, d1] = [spec[a].domain[0], last(spec[a].domain)]
    const gone = gliding
      ? memory.current.from[a].ticks.filter((t) => !spec[a].ticks.includes(t))
      : []
    const ticks = gone.length ? [...spec[a].ticks, ...gone].sort((t, u) => t - u) : spec[a].ticks
    const leaving = gone.filter((t) => within(Math.min(d0, d1), Math.max(d0, d1), t))
    const span = [ends[`${a}t0`], ends[`${a}t1`]]
    return { domain: [lo, hi], ticks, span, ...(leaving.length ? { leaving } : {}) }
  }
  return { x: glided("x"), y: glided("y"), z: glided("z") }
}

// How long the camera glides to the view a key asks for, in milliseconds.
const GLIDE = 200

/**
 * The view of the camera, `jump`, which moves it at once, and `glide`, which
 * moves it there in `ms` milliseconds, `GLIDE` unless told, easing out. A glide under way
 * heads for the next view from where it is, so a held key turns the camera
 * smoothly; a jump stops it. Where the reader asks for reduced motion, or
 * the browser cannot say, a glide jumps. The camera starts at `heading`,
 * over the default view, and glides to a new one in its `ms`.
 */
function useGlide(defaultView: View3D, { heading, ms = DURATION }: Heading) {
  const start = { ...defaultView, ...heading }
  const [view, setView] = React.useState(start)
  const now = React.useRef(start)
  const run = React.useRef<{ to: View3D; frame: number } | null>(null)
  const show = React.useCallback((v: View3D) => setView((now.current = v)), [])
  const stop = React.useCallback(() => {
    cancelAnimationFrame(run.current?.frame ?? 0)
    run.current = null
  }, [])
  const jump = React.useCallback(
    (to: (from: View3D) => View3D) => {
      stop()
      show(to(now.current))
    },
    [show, stop]
  )
  React.useEffect(() => stop, [stop])

  const glide = (to: (from: View3D) => View3D, ms = GLIDE, ease = prompt) => {
    if (!animates()) return jump(to)
    const end = to(run.current?.to ?? now.current)
    // The yaw turns the short way round, to an angle that looks the same.
    const from = { ...now.current, yaw: end.yaw + remainder(now.current.yaw - end.yaw) }
    const start = performance.now()
    stop()
    const frame = (time: number) => {
      const t = clamp(0, 1, (time - start) / ms)
      show(t < 1 ? between(from, end, ease(t)) : end)
      if (t < 1) run.current = { to: end, frame: requestAnimationFrame(frame) }
      else run.current = null
    }
    run.current = { to: end, frame: requestAnimationFrame(frame) }
  }
  // In step with the data: over the same time, eased the same way.
  useHeading(heading, (to) => glide((from) => ({ ...from, ...to }), ms, smooth))

  return { view, jump, glide }
}

/** The view the page heads the camera for, and the time in ms the camera takes there. */
type Heading = { heading?: View3D; ms?: number }

/**
 * Heads the camera for `view` when it changes: `head` takes it there. The
 * same view again, as a chart that renders anew hands in, moves nothing, so
 * the reader keeps the view they turned to.
 */
function useHeading(view: View3D | undefined, head: (to: View3D) => void) {
  const key = JSON.stringify(view)
  const last = React.useRef(key)
  React.useEffect(() => {
    if (key === last.current) return
    last.current = key
    if (view) head(view)
  })
}

/** The angle `a` in the turn from -π to π. */
function remainder(a: number) {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI))
}

/** The view the share `k` of the way from `from` to `to`. */
function between(from: View3D, to: View3D, k: number): View3D {
  const mix = (a: number, b: number) => a + (b - a) * k
  const pan = from.pan ?? ZERO
  const goal = to.pan ?? ZERO
  return {
    ...to,
    yaw: mix(from.yaw, to.yaw),
    tilt: mix(from.tilt, to.tilt),
    zoom: mix(from.zoom ?? 1, to.zoom ?? 1),
    pan: { x: mix(pan.x, goal.x), y: mix(pan.y, goal.y) },
  }
}

/**
 * The view of the camera, and the handlers that move it, as far as `keys`
 * has them on: a drag turns it, or pans it while Alt is held, the keys step
 * it, Ctrl or ⌘ with the wheel zooms it and a double click resets it - a
 * drag following the pointer at once, a key and a double click gliding.
 * `data-orbiting` among them is true while the camera turns. `onDragStart`
 * runs when a press becomes a drag, `onHover` on a move without one - but
 * under two fingers, where the tooltip would jump from one to the other, it
 * goes, as in a drag. `heading` is the view the page heads the camera for.
 */
function useOrbit(
  defaultView: View3D,
  width: number,
  keys: Keymap,
  onDragStart: () => void,
  onHover: (e: React.PointerEvent<SVGSVGElement>) => void,
  heading: Heading
) {
  const { view, jump, glide } = useGlide(defaultView, heading)
  const [orbiting, setOrbiting] = React.useState(false)
  const held = useModsHeld()
  const drag = React.useRef<(Point2D & { moved: boolean; rotate: boolean }) | null>(null)
  const { ref, touching, hint } = useGestures(jump, keys, setOrbiting)
  const move = (step: Move) => jump((v) => moved(v, step, defaultView))
  const step = (step: Move) => glide((v) => moved(v, step, defaultView))
  const keyHandlers = useKeys(keys, step, setOrbiting)
  const release = () => {
    drag.current = null
    setOrbiting(false)
  }

  const handlers: OrbitHandlers = {
    ref,
    onPointerDown: (e) => {
      // A finger inspects where it lands, a tap having no move; Alt held, the drag pans, Mod turns.
      if (e.pointerType === "touch") return onHover(e)
      const pans = keys.on("dragPan") && e.altKey
      if (pans || (keys.on("dragRotate") && platformMod(e))) {
        drag.current = { x: e.clientX, y: e.clientY, moved: false, rotate: !pans }
      }
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d) return touching.current ? onDragStart() : onHover(e)
      // A drag moves only while its modifier is held: the platform one turning, Alt panning.
      if (d.rotate ? !platformMod(e) : !e.altKey) return release()
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      // A press that wanders a few pixels is still a click on a bar.
      if (!d.moved && Math.hypot(dx, dy) < CLICK_DISTANCE) return
      if (!d.moved) {
        e.currentTarget.setPointerCapture(e.pointerId)
        onDragStart()
      }
      drag.current = { x: e.clientX, y: e.clientY, moved: true, rotate: d.rotate }
      const k = unitsPerPixel(e.currentTarget)
      setOrbiting(d.rotate)
      move(d.rotate ? { yaw: dx * DRAG, tilt: dy * DRAG } : { pan: { x: dx * k, y: dy * k } })
    },
    onPointerUp: release,
    onPointerCancel: release,
    onDoubleClick: keys.on("doubleClickReset") ? () => step({ reset: true }) : undefined,
    ...keyHandlers,
    "data-orbiting": orbiting,
    "data-mod": keys.on("dragRotate") && held.mod ? true : undefined,
    "data-alt": keys.on("dragPan") && held.alt ? true : undefined,
  }

  return { view, handlers, hint }
}

type OrbitHandlers = React.SVGProps<SVGSVGElement> & {
  "data-orbiting": boolean
  "data-mod"?: boolean
  "data-alt"?: boolean
}

/**
 * Whether the platform modifier or Alt is held, so the cursor shows a hand
 * before the drag rotates and the four arrows before it pans. A missed keyup
 * (window blur while held) must not stick either cursor.
 */
function useModsHeld() {
  const [mod, setMod] = React.useState(false)
  const [alt, setAlt] = React.useState(false)
  React.useEffect(() => {
    const modKey = mac() ? "Meta" : "Control"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === modKey) setMod(e.type === "keydown")
      if (e.key === "Alt") setAlt(e.type === "keydown")
    }
    const onBlur = () => {
      setMod(false)
      setAlt(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
      window.removeEventListener("blur", onBlur)
    }
  }, [])
  return { mod, alt }
}

/**
 * The handlers that step the camera with the keys of `keys`. A key that
 * turns the camera marks it as orbiting until it is let go.
 */
function useKeys(
  keys: Keymap,
  move: (step: Move) => void,
  setOrbiting: (orbiting: boolean) => void
) {
  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = keys.moves[pressed(e)]
    if (!step) return
    e.preventDefault()
    setOrbiting(Boolean(step.yaw || step.tilt))
    move(step)
  }
  const onKeyUp = () => setOrbiting(false)
  return { onKeyDown, onKeyUp }
}

/** A ref for the svg that hands it to the listeners of the wheel, of two fingers and of a missed drag. */
function useGestures(
  jump: (to: (from: View3D) => View3D) => void,
  keys: Keymap,
  setOrbiting: (orbiting: boolean) => void
) {
  const wheel = useWheelZoom(jump, keys.on("wheelZoom"))
  const touch = useTouch(jump, keys, setOrbiting)
  const missed = useMissedDrag(keys)
  const ref = React.useCallback(
    (svg: SVGSVGElement | null) => {
      const off = [wheel(svg), touch.ref(svg), missed.ref(svg)]
      return () => off.forEach((f) => f?.())
    },
    [wheel, touch.ref, missed.ref]
  )
  return { ref, touching: touch.touching, hint: missed.hint }
}

// How far a press goes before it is a drag that missed, how long its hint
// stays after the lift and how long it fades, in pixels and ms.
const MISS_DISTANCE = 8
const HINT = 1500
const HINT_FADE = 200

/**
 * A ref for the svg that watches for a drag that turns nothing - the mouse
 * without a modifier, or one finger sideways, `MISS_DISTANCE` or further -
 * and the hint that names what would have turned the chart: the gesture of
 * `dragRotate` or `touchOrbit`, none where `keys` has it off. The hint stays
 * `HINT` after the lift, fades for `HINT_FADE` and then says nothing.
 */
function useMissedDrag(keys: Keymap) {
  const [missed, setMissed] = React.useState<"dragRotate" | "touchOrbit">()
  const [open, setOpen] = React.useState(false)
  const [mouse, finger, pan] = [keys.on("dragRotate"), keys.on("touchOrbit"), keys.on("dragPan")]
  const ref = React.useCallback(
    (svg: SVGSVGElement | null) => {
      if (!svg) return
      let press: (Point2D & { touch: boolean }) | null = null
      let timer: ReturnType<typeof setTimeout> | undefined
      const down = (e: PointerEvent) => {
        const touch = e.pointerType === "touch"
        // A second finger makes a pinch, a modifier a turn or a pan: neither misses.
        const plain = touch ? finger && e.isPrimary : mouse && !platformMod(e) && !(pan && e.altKey)
        press = plain && e.button === 0 ? { x: e.clientX, y: e.clientY, touch } : null
      }
      const move = (e: PointerEvent) => {
        const [dx, dy] = press ? [e.clientX - press.x, e.clientY - press.y] : [0, 0]
        if (!press || Math.hypot(dx, dy) < MISS_DISTANCE) return
        // Up or down, a finger scrolls the page.
        if (!press.touch || Math.abs(dx) > Math.abs(dy)) {
          clearTimeout(timer)
          setMissed(press.touch ? "touchOrbit" : "dragRotate")
          setOpen(true)
        }
        press = null
      }
      const up = () => {
        press = null
        clearTimeout(timer)
        timer = setTimeout(() => {
          setOpen(false)
          timer = setTimeout(() => setMissed(undefined), HINT_FADE)
        }, HINT)
      }
      // A plain drag holds no capture: released beyond the chart, it only leaves it.
      const listeners = {
        pointerdown: down,
        pointermove: move,
        pointerup: up,
        pointercancel: up,
        pointerleave: up,
      }
      for (const [type, f] of Object.entries(listeners))
        svg.addEventListener(type, f as EventListener)
      return () => {
        clearTimeout(timer)
        // The timer that would close an open hint goes with these listeners.
        setOpen(false)
        setMissed(undefined)
        for (const [type, f] of Object.entries(listeners))
          svg.removeEventListener(type, f as EventListener)
      }
    },
    [mouse, finger, pan]
  )
  return { ref, hint: { shown: missed && keys.hint(missed), open } }
}

/** The units of the view box of `svg` in a pixel of the client. */
function unitsPerPixel(svg: SVGSVGElement) {
  const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number)
  const box = svg.getBoundingClientRect()
  // The browser fits the view box into the svg, centred, at the smaller of its two scales.
  return Math.max(width / box.width, height / box.height)
}

/** The point (`x`, `y`) of the client in the units of the view box of `svg`, from its middle. */
function inViewBox(svg: SVGSVGElement, x: number, y: number) {
  const box = svg.getBoundingClientRect()
  const k = unitsPerPixel(svg)
  return { x: (x - box.left - box.width / 2) * k, y: (y - box.top - box.height / 2) * k }
}

/** Two fingers as one: the point between them and their distance, in the pixels of the client. */
type Pinch = { x: number; y: number; d: number }

const pinchOf = (a: Touch, b: Touch): Pinch => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
  d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
})

/**
 * The step of the camera from the fingers `last` to `now`: the move of the
 * point between them turns it, if `orbit`, as far as a drag of the mouse, and
 * the change of their distance zooms it, if `zoom`. Two fingers on one pixel
 * have no distance to zoom from.
 */
function pinchStep(last: Pinch, now: Pinch, orbit: boolean, zoom: boolean): Move {
  const [dx, dy] = orbit ? [now.x - last.x, now.y - last.y] : [0, 0]
  return { yaw: dx * DRAG, tilt: dy * DRAG, zoom: zoom ? now.d / Math.max(last.d, 1) : 1 }
}

/**
 * A ref for the svg that turns the camera with two fingers on it and zooms it
 * with their pinch, as far as `keys` has them on: the move of the point
 * between them turns, the change of their distance zooms to that point, both
 * at once. One finger is left to the browser, which scrolls the page with it
 * (ADR-0001), and so is a touch it has begun to scroll. The listeners are the
 * core's own: only one that is not passive keeps the browser from scrolling
 * under two fingers. `touching` is true while two fingers hold the chart.
 */
function useTouch(
  jump: (to: (from: View3D) => View3D) => void,
  keys: Keymap,
  setOrbiting: (orbiting: boolean) => void
) {
  const orbit = keys.on("touchOrbit")
  const zoom = keys.on("pinchZoom")
  const touching = React.useRef(false)
  const ref = React.useCallback(
    (svg: SVGSVGElement | null) => {
      if (!svg || !(orbit || zoom)) return
      let last: Pinch | null = null
      const onTouch = (e: TouchEvent) => {
        // Only fingers that landed on the chart count, and a touch the browser
        // scrolls with can no longer be cancelled: it stays the browser's.
        if (e.targetTouches.length !== 2 || !e.cancelable) {
          if (last) setOrbiting(false)
          touching.current = false
          last = null
          return
        }
        e.preventDefault()
        touching.current = true
        const now = pinchOf(e.targetTouches[0], e.targetTouches[1])
        if (last) {
          const step = {
            ...pinchStep(last, now, orbit, zoom),
            at: inViewBox(svg, now.x, now.y),
          }
          jump((v) => moved(v, step, v))
          setOrbiting(Boolean(step.yaw || step.tilt))
        }
        last = now
      }
      const events = ["touchstart", "touchmove", "touchend", "touchcancel"]
      for (const type of events)
        svg.addEventListener(type, onTouch as EventListener, { passive: false })
      return () => events.forEach((type) => svg.removeEventListener(type, onTouch as EventListener))
    },
    [jump, orbit, zoom, setOrbiting]
  )
  return { ref, touching }
}

/**
 * A ref for the svg that zooms the view to the cursor with the platform
 * modifier and the wheel, if `on`. Ctrl and the wheel zooms on a Mac too, because a trackpad
 * pinch arrives that way, indistinguishable from the keys. The wheel alone
 * still scrolls the page. While the wheel zooms, the svg says so in
 * `data-zoom` - `"in"` or `"out"`, the direction of its cursor - until
 * `ZOOM_CURSOR` after the last tick.
 */
function useWheelZoom(jump: (to: (from: View3D) => View3D) => void, on: boolean) {
  // React listens to the wheel passively, and only a listener that is not
  // passive can keep the browser from zooming the page.
  return React.useCallback(
    (svg: SVGSVGElement | null) => {
      if (!on || !svg) return
      let timer: ReturnType<typeof setTimeout>
      const onWheel = (e: WheelEvent) => {
        if (!platformMod(e) && !e.ctrlKey) return
        e.preventDefault()
        const at = inViewBox(svg, e.clientX, e.clientY)
        jump((v) => moved(v, { zoom: 2 ** (-e.deltaY / 200), at }, v))
        svg.dataset.zoom = e.deltaY < 0 ? "in" : "out"
        clearTimeout(timer)
        timer = setTimeout(() => delete svg.dataset.zoom, ZOOM_CURSOR)
      }
      svg.addEventListener("wheel", onWheel, { passive: false })
      return () => {
        clearTimeout(timer)
        svg.removeEventListener("wheel", onWheel)
      }
    },
    [jump, on]
  )
}

/**
 * The tooltip of the mark under the pointer, the one painted last, and the
 * focus on its groups. The highlight follows the mark: `hover` sets the
 * tooltip only when the pointer moves onto another mark, or onto new data
 * under the same one, and the focus only when the groups change, so a move
 * within a mark of a chart at rest does not render it again; off the mark and
 * when the pointer leaves the chart, `leave` drops both. A finger lifting
 * leaves the chart too: what it tapped stays until a tap elsewhere, on the
 * chart or off it. While a drag turns the chart under the captured pointer,
 * `hide` drops the tooltip and keeps the focus, so a flow does not flash away
 * and can be followed from every side.
 */
function useHover(
  scene: React.RefObject<Mark3D[]>,
  width: number,
  height: number,
  tip: Tip3D,
  focus: Focus3D
) {
  const hovered = React.useRef<Mark3D>(undefined)
  const svg = React.useRef<SVGSVGElement>(null)
  const { set } = tip
  const clear = React.useCallback(() => {
    hovered.current = undefined
    focus.set(undefined)
    set(null)
  }, [focus, set])
  useTapElsewhere(svg, clear)
  const show = (mark?: Mark3D) => {
    // Also within one mark, whose groups new data can change; the store ignores the groups it holds.
    focus.set(mark?.groups)
    // The tooltip decides what shows: the same one says the same, new data under the same mark another.
    if (mark?.tooltip === hovered.current?.tooltip) return
    hovered.current = mark
    const tooltip = mark?.tooltip
    tip.set((typeof tooltip === "function" ? tooltip() : tooltip) ?? null)
  }

  return {
    hover: (e: React.PointerEvent<SVGSVGElement>) => {
      svg.current = e.currentTarget
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      tip.follow({ x, y, width: rect.width, height: rect.height })
      // The pointer in the view box the way the wheel and the pinch read it.
      const at = inViewBox(e.currentTarget, e.clientX, e.clientY)
      show(hit(scene.current, { x: at.x + width / 2, y: at.y + height / 2 }))
    },
    hide: () => {
      hovered.current = undefined
      tip.set(null)
    },
    leave: (e: React.PointerEvent) => {
      // A pinch dropped the tooltip already: lifting its fingers drops the focus too.
      if (e.pointerType !== "touch" || !hovered.current) show(undefined)
    },
  }
}

/** Calls `clear` when a finger taps anywhere but `svg`: on the page, or on another chart. */
function useTapElsewhere(svg: React.RefObject<SVGSVGElement | null>, clear: () => void) {
  React.useEffect(() => {
    const tap = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !svg.current?.contains(e.target as Node)) clear()
    }
    document.addEventListener("pointerdown", tap)
    return () => document.removeEventListener("pointerdown", tap)
  }, [svg, clear])
}

/** A store for the groups in focus, which tells its listeners only when the groups change. */
function useFocus(): Focus3D {
  const [focus] = React.useState(() => {
    let groups: string[] | undefined
    const listeners = new Set<() => void>()
    return {
      get: () => groups,
      set: (next?: string[]) => {
        if (JSON.stringify(next) === JSON.stringify(groups)) return
        groups = next
        listeners.forEach((listener) => listener())
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
  })
  return focus
}

/** Whether an item shares a group, as `own` names it, with the focus: the hover lights those items. */
function useLit(own: (group: string) => string) {
  const { focus } = useChart3D()
  const groups = React.useSyncExternalStore(focus.subscribe, focus.get, focus.get)
  return (item: { groups?: string[] }) =>
    item.groups?.some((group) => groups?.includes(own(group))) ?? false
}

/** The topmost mark under `at`: the last one painted that holds it. */
function hit(marks: Mark3D[], at: Point2D) {
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    if (holds(marks[i], at)) return marks[i]
  }
}

/** Whether `mark` holds `at`: inside its polygon, or on the disc of its circle or its symbol. */
function holds(mark: Mark3D, at: Point2D): boolean {
  switch (mark.shape) {
    case "circle":
    case "symbol":
      return Math.hypot(mark.points[0].x - at.x, mark.points[0].y - at.y) <= mark.r
    case "polygon":
    case undefined:
      return inside(mark.points, at)
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
 * render on the client, then a canvas if the browser has one.
 */
function useRenderer(requested: Renderer3D) {
  const [renderer, setRenderer] = React.useState<Renderer3D>("svg")
  React.useEffect(() => {
    const canvas = requested !== "svg" && document.createElement("canvas").getContext("2d")
    setRenderer(canvas ? "canvas" : "svg")
  }, [requested])
  return renderer
}

/**
 * A ref for the canvas of the marks, and the repaint that paints them: on new
 * marks, when the canvas changes its size and when the theme or the colors of
 * the config change. A color
 * resolves on the canvas itself, inside the chart, so the `--color-*` apply.
 */
function useCanvas(scene: React.RefObject<Mark3D[]>, width: number, palette: string) {
  const element = React.useRef<HTMLCanvasElement>(null)
  const colors = React.useRef(new Map<string, string>())

  const repaint = React.useCallback(() => {
    const canvas = element.current
    if (!canvas) return
    paint(canvas, scene.current, width, (css) => resolved(canvas, css, colors.current))
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

  // New colors in the config write new `--color-*`: the same CSS of a mark resolves anew.
  React.useLayoutEffect(() => {
    colors.current.clear()
    repaint()
  }, [palette, repaint])

  return { canvas, repaint }
}

/**
 * The color that `css` resolves to on `canvas`, inside the chart, as the sRGB
 * the canvas paints it in, cached per color: the canvas parses `fillStyle`
 * at every mark, and an `rgb()` four times faster than the `oklch()` the
 * theme resolves to.
 */
function resolved(canvas: HTMLCanvasElement, css: string, cache: Map<string, string>) {
  let color = cache.get(css)
  if (color === undefined) {
    canvas.style.color = css
    color = srgb(getComputedStyle(canvas).color)
    cache.set(css, color)
  }
  return color
}

// One pixel to read back the sRGB of a color; made the first time a canvas paints.
let pixel: CanvasRenderingContext2D | null = null

/** `color` as the `rgb()` a canvas paints it in, read back from a pixel. */
function srgb(color: string) {
  // useRenderer paints on a canvas only where the browser gives one a 2D context.
  pixel ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
  pixel.clearRect(0, 0, 1, 1)
  pixel.fillStyle = color
  pixel.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data
  return `rgb(${r} ${g} ${b} / ${+(a / 255).toFixed(3)})`
}

/**
 * Sizes `canvas` to its pixels on screen, or, where it has that size, clears
 * it: setting the size throws its buffer away and makes a new one, every frame.
 */
function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const width = Math.round(canvas.clientWidth * devicePixelRatio)
  const height = Math.round(canvas.clientHeight * devicePixelRatio)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    return
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
}

/** Paints `marks` on `canvas`, from the view box of `width` to the pixels of the canvas. */
function paint(
  canvas: HTMLCanvasElement,
  marks: Mark3D[],
  width: number,
  color: (css: string) => string
) {
  // useRenderer draws on a canvas only where the browser gives one a 2D context.
  const ctx = canvas.getContext("2d")!
  fitCanvas(canvas, ctx)
  const scale = canvas.width / width
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.lineJoin = "round"

  // The shape of a mark names its painter; a polygon names none.
  for (const mark of marks) PAINT[mark.shape ?? "polygon"](ctx, mark as never, color)
}

/** Paints a mark of one shape on `ctx`, its colors resolved by `color`. */
type Painter<S extends Shape3D> = (
  ctx: CanvasRenderingContext2D,
  mark: MarkOf<S>,
  color: (css: string) => string
) => void

/** Fills the path of `ctx` with `fill` and, if it has one, outlines it `width` wide. */
function ink(
  ctx: CanvasRenderingContext2D,
  color: (css: string) => string,
  fill: string,
  outline: string | undefined,
  width: number
) {
  const filled = color(fill)
  ctx.fillStyle = filled
  ctx.fill()
  if (!outline) return
  // Its own color is resolved already: a lookup per mark, not two.
  ctx.strokeStyle = outline === fill ? filled : color(outline)
  ctx.lineWidth = width
  ctx.stroke()
}

// The box an icon set draws a symbol in, the width of its outline in that
// box, as Lucide draws it, and the width of the ring around it in the units
// of the view box, as around a circle.
const SYMBOL_BOX = 24
const SYMBOL_LINE = 2
const SYMBOL_RING = 1

/** The way from `from` to `to` on the screen, in degrees clockwise from up; none where they are one point. */
function wayOf(from: Point2D, to: Point2D) {
  const [dx, dy] = [to.x - from.x, to.y - from.y]
  return dx || dy ? (Math.atan2(dx, -dy) * 180) / Math.PI : undefined
}

/**
 * `n` to two decimals, for every number written into the HTML: the server
 * and the browser, whose last bits of a sine differ, then write the same.
 */
const fixed = (n: number) => +n.toFixed(2)

/**
 * How a symbol lies on its disc: how far it is scaled from its box, how far
 * it is turned, in degrees clockwise - to the way it comes, where it names
 * the way it points and comes from another point, and else not at all - and
 * how wide the ring is drawn, in the units of its box: around a filled one,
 * and around the line of an outlined one. Rounded, so the server and the
 * browser, whose last bits of a sine differ, write the same HTML.
 */
function lieOf({ points: [at], r, symbol, from }: MarkOf<"symbol">) {
  const scale = (2 * r) / SYMBOL_BOX
  const [way, points] = [from && wayOf(from, at), symbol.points]
  return {
    scale: +scale.toFixed(4),
    turn: points === undefined || way === undefined ? 0 : fixed(way - points),
    ring: fixed((symbol.fill ? 0 : SYMBOL_LINE) + (2 * SYMBOL_RING) / scale),
  }
}

/** Paints a symbol: its ring, and over it its outline, filled or drawn as a line. */
const paintSymbol: Painter<"symbol"> = (ctx, mark, color) => {
  const { scale, turn, ring } = lieOf(mark)
  // ponytail: parses the path at every paint, which a tip or two can afford; keep the outlines by their path data when a chart draws symbols by the thousand.
  const outline = new Path2D(mark.symbol.path)
  ctx.save()
  ctx.translate(mark.points[0].x, mark.points[0].y)
  ctx.rotate((turn * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.translate(-SYMBOL_BOX / 2, -SYMBOL_BOX / 2)
  ctx.lineCap = "round"
  if (mark.stroke) {
    ctx.strokeStyle = color(mark.stroke)
    ctx.lineWidth = ring
    ctx.stroke(outline)
  }
  ctx.fillStyle = ctx.strokeStyle = color(mark.fill)
  ctx.lineWidth = SYMBOL_LINE
  if (mark.symbol.fill) ctx.fill(outline)
  else ctx.stroke(outline)
  ctx.restore()
}

// The painter of every shape: a shape without one fails to compile.
const PAINT: { [S in Shape3D]: Painter<S> } = {
  polygon: (ctx, { points, fill, stroke }, color) => {
    ctx.beginPath()
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    // A polygon is outlined in its own color, which closes the seams to its neighbours.
    ink(ctx, color, fill, stroke ?? fill, 0.5)
  },
  circle: (ctx, { points, r, fill, stroke }, color) => {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, r, 0, 2 * Math.PI)
    ink(ctx, color, fill, stroke, 1)
  },
  symbol: paintSymbol,
}

/** Twice the signed area of the triangle `a`, `b`, `c`: its sign tells which way it turns, 0 on a line. */
const turn = (a: Point2D, b: Point2D, c: Point2D) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

/** Twice the signed area of a ring: its sign tells which way it winds. */
const areaOf = (ring: Point2D[]) =>
  ring.reduce((sum, p, i) => sum + turn(ring[0], p, ring[i + 1] ?? p), 0)

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
  if (renderer === "svg") return null

  return (
    <canvas
      data-slot="chart-3d-canvas"
      ref={canvas}
      className="pointer-events-none absolute top-0 left-0 w-full mask-x-from-96% mask-y-from-96%"
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
            x2={fixed(24 + (p.x - 24) * 0.6)}
            y2={fixed(24 + (p.y - 24) * 0.6)}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <text
            x={fixed(p.x)}
            y={fixed(p.y)}
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
 * `text` as part of a CSS identifier: every character but an ASCII letter, a
 * digit, `-` and `_` written as its escape, such as the space of "Net sales"
 * or the dot of "q1.sales". Unescaped, it would end the name, and the browser
 * would drop the rule that declares the color.
 */
const cssName = (text: string) =>
  text.replace(/[^\w-]/gu, (c) => `\\${c.codePointAt(0)!.toString(16)} `)

/**
 * The color of the config key `key`: the CSS variable the container declares
 * for it. A chart without a config has no first key to fall back on, and
 * draws in a variable nobody declares: colorless, as before.
 */
const colorOf = (key: string | undefined) => `var(--color-${cssName(String(key))})`

/**
 * The focus color of a fill, which a lit mark takes: `--chart-3d-focus`, or the
 * fill itself lightened, so the highlight carries the color of what it highlights.
 */
const focusOf = (fill: string) => `var(--chart-3d-focus, color-mix(in oklch, ${fill} 60%, white))`

/**
 * The marks of a chart, drawn by the renderer of the container: as SVG
 * elements, or on the canvas over the chart box. The hover reads them too.
 */
function Marks3D({ marks }: { marks: Mark3D[] }) {
  const { renderer, place, repaint } = useChart3D()
  const id = React.useId()
  // Drawn on every renderer, empty off SVG, so the scene orders the sets as SVG does.
  const node = React.useRef<SVGGElement>(null)
  // The groups of a set are its own, so two charts in one container never light each other.
  const own = (group: string) => `${id} ${group}`
  const lit = useLit(own)
  // The lit marks take the focus color as their fill - `--chart-3d-focus`, their own fill
  // lightened unless set - and keep a stroke of their own: a scatter point its ring, a flow's
  // inner faces their seams. The order, and with it the depth, stays as painted. A mark
  // whenLit is left out unlit (ADR-0002).
  const drawn = marks.flatMap((mark) => {
    const placed = { ...mark, groups: mark.groups?.map(own) }
    return lit(mark) ? [{ ...placed, fill: focusOf(mark.fill) }] : mark.whenLit ? [] : [placed]
  })
  React.useLayoutEffect(() => {
    // The group is in the tree once the layout effects run.
    place(id, { marks: drawn, node: node.current! })
    repaint()
  })
  // A chart taken out of its container takes its marks along: the hover finds
  // none, and the canvas paints none.
  React.useLayoutEffect(
    () => () => {
      place(id)
      repaint()
    },
    [id, place, repaint]
  )

  return (
    <g ref={node} data-slot="chart-3d-marks">
      {renderer === "svg" && drawn.map(markElement)}
    </g>
  )
}

/** `mark` as its SVG element: a shape without one fails to compile. */
function markElement(mark: Mark3D): React.ReactElement {
  const { key, points, fill, stroke } = mark
  switch (mark.shape) {
    case "symbol":
      return <SymbolMark3D key={key} mark={mark} />
    case "circle":
      return (
        // Rounded like a path, so the server and the browser, whose last
        // bits of a sine differ, write the same HTML.
        <circle
          key={key}
          cx={fixed(points[0].x)}
          cy={fixed(points[0].y)}
          r={fixed(mark.r)}
          fill={fill}
          stroke={stroke}
          strokeWidth={stroke ? 1 : undefined}
        />
      )
    case "polygon":
    case undefined:
      return (
        <path
          key={key}
          d={`M${points.map((p) => `${fixed(p.x)},${fixed(p.y)}`).join("L")}Z`}
          fill={fill}
          stroke={stroke ?? fill}
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      )
  }
}

/**
 * A symbol as SVG: its box laid on its disc, and in it its ring and, over
 * that, its outline, filled or drawn as a line, in the color of the mark.
 */
function SymbolMark3D({ mark }: { mark: MarkOf<"symbol"> }) {
  const { points, symbol, fill, stroke } = mark
  const { scale, turn, ring } = lieOf(mark)
  const at = `${fixed(points[0].x)} ${fixed(points[0].y)}`
  const line = { d: symbol.path, strokeLinecap: "round", strokeLinejoin: "round" } as const
  const look = symbol.fill ? { fill } : { fill: "none", stroke: fill, strokeWidth: SYMBOL_LINE }
  return (
    <g
      transform={`translate(${at}) rotate(${turn}) scale(${scale}) translate(${-SYMBOL_BOX / 2} ${-SYMBOL_BOX / 2})`}
    >
      {stroke && <path {...line} fill="none" stroke={stroke} strokeWidth={ring} />}
      <path {...line} {...look} />
    </g>
  )
}

/**
 * A label beside a mark, at `at` in the units of the view box. `toward`, a
 * unit vector, lays the label on that side of `at`, touching it, and slides
 * it round `at` as the vector turns; without it, `anchor` is the end of the
 * text that sits at `at`.
 */
export type Label3D = {
  key: string
  at: Point2D
  text: React.ReactNode
  anchor?: "start" | "middle" | "end"
  toward?: Point2D
}

/**
 * The labels of the marks of a chart, ringed by the background so that they
 * read on the marks. Like the labels of the box, they are SVG with every renderer.
 */
function Labels3D({ labels }: { labels: Label3D[] }) {
  // ponytail: under the canvas of the canvas renderer, as the labels of the box; an SVG layer over the canvas would lift them.
  return (
    <g data-slot="chart-3d-labels">
      {labels.map((label) => {
        const { x, y } = label.toward
          ? beside(label.at, label.toward, textWidth(label.text, 10), 10, 0)
          : label.at
        return (
          <text
            key={label.key}
            x={fixed(x)}
            y={fixed(y)}
            textAnchor={label.toward ? "middle" : label.anchor}
            dominantBaseline="central"
            paintOrder="stroke"
            strokeWidth={3}
            strokeLinejoin="round"
            className="fill-foreground stroke-background text-[10px] font-medium"
          >
            {label.text}
          </text>
        )
      })}
    </g>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  // The id escaped whole, as a CSS identifier, so a dot or a space keeps it one selector.
  const scope = `[data-chart=${cssName(id)}]`
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color)
  // Every part of the axes that enters fades in: a label, a tick mark, a gridline, a wall.
  // The cursor names the gesture of the held modifier: the platform modifier
  // a hand (Alt, held with it, wins, as it does on pointer down), Alt the four
  // arrows of the pan, the wheel zoom its direction, and a turning drag grabbing.
  const entering = ["text", "line", "path"]
    .map((el) => `${scope} [data-slot="chart-3d-axes"] ${el}`)
    .join(", ")
  const base = `@keyframes chart-3d-axes-in { from { opacity: 0; } }
${entering} { animation: chart-3d-axes-in 300ms ease-out; }
@media (prefers-reduced-motion: reduce) { ${entering} { animation: none; } }
${scope} svg[data-mod="true"] { cursor: grab; }
${scope} svg[data-alt="true"] { cursor: move; }
${scope} svg[data-zoom="in"] { cursor: zoom-in; }
${scope} svg[data-zoom="out"] { cursor: zoom-out; }
${scope} svg[data-orbiting="true"] { cursor: grabbing; }`

  // No colors, no rule per theme.
  const themes = colorConfig.length ? Object.entries(THEMES) : []

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: [
          base,
          ...themes.map(
            ([theme, prefix]) => `
${prefix} ${scope} {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] || item.color
    return color ? `  --color-${cssName(key)}: ${color};` : null
  })
  .join("\n")}
}
`
          ),
        ]
          .join("\n")
          // `cssName` has escaped the id and the keys; a color is the caller's text
          // still, and with its `<` escaped it cannot close the style element of a
          // server-rendered page. Whether it is CSS stays with the caller.
          .replaceAll("<", "\\3c "),
      }}
    />
  )
}

function ChartTooltip3D({ tip }: { tip: Tip3D }) {
  const { tooltip, ref, place } = tip
  // Before the browser paints it, so a new tooltip never shows where the last one was.
  React.useLayoutEffect(place, [tooltip, place])
  if (!tooltip) return null

  return (
    <div
      ref={ref}
      data-slot="chart-3d-tooltip"
      // As wide as its content wherever it sits, so a tooltip near the right edge is measured whole.
      className="pointer-events-none absolute z-10 grid w-max min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl motion-safe:transition-[translate]"
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
 * The hint of a drag that missed, a box in the middle of the chart over a
 * light veil, above the tooltip: always there, empty while it has nothing to
 * say, so a screen reader hears its first word. The veil has no blur, which
 * would cost every frame of the drag it shows during.
 */
function ChartHint3D({
  shown,
  open,
}: {
  shown?: { label: string; gesture: string[] }
  open: boolean
}) {
  return (
    <div
      role="status"
      data-slot="chart-3d-hint"
      data-state={open ? "open" : "closed"}
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-background/40 motion-safe:transition-opacity data-[state=closed]:opacity-0"
    >
      {shown && (
        <div
          data-slot="chart-3d-hint-box"
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 shadow-xl"
        >
          <KbdGroup3D group={shown.gesture} />
          <span className="text-muted-foreground">{shown.label}</span>
        </div>
      )}
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

  // A pointer down outside the corner closes the list; the press still lands.
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Without a key or a panel, there is nothing to list.
  if (!rows.length) return null
  return (
    <div
      ref={ref}
      data-slot="chart-3d-shortcuts"
      className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1"
    >
      <button
        type="button"
        data-slot="chart-3d-shortcuts-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md bg-background/60 text-muted-foreground outline-none transition-colors hover:bg-background hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4"
      >
        <KeyboardIcon3D />
      </button>
      {open && <ChartShortcutList3D id={id} rows={rows} />}
    </div>
  )
}

/**
 * The keyboard of the shortcut button: the keyboard icon of Lucide,
 * Copyright (c) Lucide Icons and Contributors, ISC License, https://lucide.dev.
 */
function KeyboardIcon3D() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </svg>
  )
}

/** One group of keys as chips. */
function KbdGroup3D({ group }: { group: string[] }) {
  return (
    <span data-slot="kbd-group" className="flex gap-1">
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
  )
}

/** The list of the shortcut panel: per row its label, then its keys, a rule, and its gestures. */
function ChartShortcutList3D({ id, rows }: { id: string; rows: Keymap["rows"] }) {
  return (
    <dl
      id={id}
      data-slot="chart-3d-shortcuts-panel"
      className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 shadow-xl"
    >
      {rows.map(({ label, keys, gestures }) => (
        <React.Fragment key={label}>
          <dt data-slot="chart-3d-shortcuts-label" className="text-muted-foreground">
            {label}
          </dt>
          <dd className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {keys.map((group, i) => (
              <KbdGroup3D key={i} group={group} />
            ))}
            {keys.length > 0 && gestures.length > 0 && (
              <span data-slot="chart-3d-shortcuts-rule" className="h-4 w-px bg-border" />
            )}
            {gestures.map((group, i) => (
              <KbdGroup3D key={i} group={group} />
            ))}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

/**
 * The legend on its own, beside a chart or anywhere on the page: outside a
 * container no `--color-*` reaches it, so it scopes the colors of its config itself.
 */
function ChartLegend3D({ config }: { config: ChartConfig }) {
  return <ChartLegendBody3D config={config} chartId={chartIdOf(undefined, React.useId())} />
}

/**
 * The label and the swatch or icon of every config key. The container draws
 * it in its own scope, so a color set on the chart in CSS reaches the legend too.
 */
function ChartLegendBody3D({ config, chartId }: { config: ChartConfig; chartId?: string }) {
  return (
    <div
      data-slot="chart-3d-legend"
      data-chart={chartId}
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3"
    >
      {chartId && <ChartStyle id={chartId} config={config} />}
      {Object.entries(config).map(([key, item]) => (
        <div key={key} className="flex items-center gap-1.5">
          {item.icon ? (
            <item.icon />
          ) : (
            <span className="size-2 rounded-[2px]" style={{ background: colorOf(key) }} />
          )}
          {item.label ?? key}
        </div>
      ))}
    </div>
  )
}

/**
 * The walls of the chart box that face away from the camera, with their
 * gridlines, the line of every axis along its edge with the mark of each of
 * its ticks, and the labels of every axis on each of its four edges. Only the
 * edge the axis sits on shows them, so when the axis moves to another edge,
 * its line, its marks and its labels fade from one to the other.
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
  const box = intoWorld(axes3D().camera(camera), world)
  const { labels, lines, marks } = labelAxes(box, spec, format, titles)
  // The gridline of a tick the new data dropped fades out with its label.
  const leaving = new Set(
    (["x", "y", "z"] as const).flatMap((a) =>
      ((spec[a] as GlidingAxis).leaving ?? []).map((value) => `${a}-${value}`)
    )
  )

  return (
    <g data-slot="chart-3d-axes">
      {box
        .data(spec)
        .filter((wall) => !wall.ccw)
        .map((wall) => (
          <React.Fragment key={`${wall.axis}${wall.side}`}>
            <path d={quad(wall)} className="fill-muted/40 stroke-border" strokeWidth={0.75} />
            {wall.grid.map((segment) => {
              const [from, to] = [segment[0], segment[segment.length - 1]]
              const key = gridKey(wall, from, to)
              return (
                <line
                  key={key}
                  x1={fixed(from.projected.x)}
                  y1={fixed(from.projected.y)}
                  x2={fixed(to.projected.x)}
                  y2={fixed(to.projected.y)}
                  style={{ opacity: leaving.has(key) ? 0 : 1 }}
                  className="stroke-border transition-opacity duration-300 ease-out motion-reduce:transition-none"
                  strokeWidth={0.75}
                />
              )
            })}
          </React.Fragment>
        ))}
      {lines.map((line) => (
        <AxisLine3D key={line.key} line={line} ink="stroke-foreground" width={1.5} />
      ))}
      {marks.map((mark) => (
        <AxisLine3D key={mark.key} line={mark} ink="stroke-foreground/60" width={1} />
      ))}
      {labels.map((label) => (
        <AxisLabel3D key={label.key} label={label} />
      ))}
    </g>
  )
}

// The space between a tick and its label, the least space between two
// labels, and the space over which a label fades as it nears another.
const GAP = 10
const PAD = 2
const FADE = 4
// How far a label may slide along its edge to make room, before the labels take two rows.
const DODGE = 12
// How far the mark of a tick reaches out from its edge.
const MARK = 6

/** The closed quad of a wall; its gridlines are their own lines, so a new one fades in. */
function quad(wall: AxisWall) {
  return `M${wall.map(({ projected }) => `${fixed(projected.x)},${fixed(projected.y)}`).join("L")}Z`
}

/**
 * The key of a gridline: the axis and value of the tick it marks - the one
 * coordinate its ends share beside the wall's own axis - so the gridline of
 * a tick that stays glides on, and one of a new tick mounts and fades in.
 * Exactly one coordinate differs along the line, because a domain always has
 * width: `axis` widens an empty extent.
 */
function gridKey(wall: AxisWall, from: Point3D, to: Point3D) {
  const axis = (["x", "y", "z"] as const).find((a) => a !== wall.axis && from[a] === to[a])!
  return `${axis}-${from[axis]}`
}

/**
 * A line of an axis: the line that carries its scale along the edge it sits
 * on, or the mark of one of its ticks. Its place follows the camera at once;
 * a change of edge fades it in a transition.
 */
type AxisLine = {
  key: string
  from: Point2D
  to: Point2D
  opacity: number
}

/**
 * A label of the chart box, a tick label or the title of an axis: its box
 * `w`×`h` in the units of the view box, centred at `at` and moved by `shift`
 * along its edge or into a second row.
 */
type AxisLabel = {
  key: string
  axis: keyof AxesSpec
  /** The tick value; the axis title has none. */
  value?: number
  at: Point2D
  w: number
  h: number
  shift: Point2D
  text: React.ReactNode
  opacity: number
  title?: boolean
  /** The turn of the text in degrees: the title of an axis runs along its edge. */
  angle?: number
}

/**
 * The labels of the axes on all their edges, the line of every axis along its
 * edge and the mark of each of its ticks, shown on the edges the axes sit on.
 * Every edge fits its own tick labels; then the labels of an axis give way to
 * those of an axis with fewer ticks, which say more each, and the titles give
 * way to the ticks.
 */
function labelAxes(
  box: Axes3DInstance,
  spec: AxesSpec,
  format: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>,
  titles: Partial<Record<keyof AxesSpec, React.ReactNode>>
) {
  // The edges again with a tick at each end of the domain: their corners on the box, which a title spans.
  const ends = (a: AxisSpec) => ({ ...a, ticks: [Math.min(...a.domain), Math.max(...a.domain)] })
  const frame = box.edges({ x: ends(spec.x), y: ends(spec.y), z: ends(spec.z) })
  // An axis without ticks, such as the rows of an empty chart, has nothing to label.
  const axes = box
    .edges(spec)
    .filter((edge) => edge.length)
    .map((edge) =>
      edgeLabels(
        edge,
        frame.find((f) => f.axis === edge.axis && f.sides.join() === edge.sides.join())!,
        spec[edge.axis],
        format[edge.axis] ?? String,
        titles[edge.axis]
      )
    )
  const shown = axes.filter((axis) => axis.chosen).sort((a, b) => a.ticks.length - b.ticks.length)
  const placed: AxisLabel[] = []
  for (const label of [...shown.flatMap((a) => a.ticks), ...shown.flatMap((a) => a.title ?? [])]) {
    // A tick outside the gliding ends stays faded out and does not take room from the others.
    if (label.opacity === 0) continue
    label.opacity = shows(label, placed)
    placed.push(label)
  }
  // The marks fade with their labels, also where a label of another axis takes its place.
  for (const axis of axes) axis.marks.forEach((mark, i) => (mark.opacity = axis.ticks[i].opacity))
  return {
    labels: axes.flatMap((axis) => [...axis.ticks, ...(axis.title ? [axis.title] : [])]),
    lines: axes.map((axis) => axis.line),
    marks: axes.flatMap((axis) => axis.marks),
  }
}

/**
 * The labels of one edge: a label per tick beside it, away from the box, in
 * the rows that `fit` finds, and the title of the axis beyond them. The
 * labels of an edge the axis does not sit on are there, but do not show.
 */
/**
 * The point of `value` along `edge`, between the ticks that bracket it: the
 * projection keeps the edge straight, so the point lies on their line. An
 * axis of one tick is a point.
 */
function along(edge: AxisEdge, value: number): Point2D {
  if (edge.length === 1) return edge[0].projected
  let i = 0
  while (i < edge.length - 2 && edge[i + 1][edge.axis] < value) i += 1
  const [a, b] = [edge[i][edge.axis], edge[i + 1][edge.axis]]
  // Neighbouring ticks are distinct values, so their span has width.
  const t = clamp(0, 1, (value - a) / (b - a))
  const [p, q] = [edge[i].projected, edge[i + 1].projected]
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
}

/** The ticks whose value lies in `domain`, with the ends of `domain`. */
function inRange(ticks: AxisLabel[], domain: number[]) {
  const range = { lo: Math.min(...domain), hi: Math.max(...domain) }
  return {
    ranged: ticks.filter((t) => t.value !== undefined && within(range.lo, range.hi, t.value)),
    range,
  }
}

/** An edge the axis does not sit on hides its labels; on a chosen one, the ticks outside the gliding ends fade out. */
function hideOffRange(labels: AxisLabel[], range: { lo: number; hi: number }, chosen: boolean) {
  if (!chosen) for (const l of labels) l.opacity = 0
  else
    for (const l of labels)
      if (l.value !== undefined && !within(range.lo, range.hi, l.value)) l.opacity = 0
}

function edgeLabels(
  edge: AxisEdge,
  frame: AxisEdge,
  { domain, leaving = [], span }: GlidingAxis,
  format: (value: number) => React.ReactNode,
  title?: React.ReactNode
) {
  const { axis, normal: n, chosen } = edge
  const label = (
    key: string,
    at: Point2D,
    text: React.ReactNode,
    h: number,
    gap: number,
    value?: number
  ) => {
    const w = textWidth(text, h)
    return { key, axis, value, at: beside(at, n, w, h, gap), w, h, shift: ZERO, text, opacity: 1 }
  }
  const id = `${axis}${edge.sides.join("")}`
  // Keyed by value, so a tick that new data keeps glides on as the same label.
  const ticks = edge.map((tick) =>
    label(`${id}-${tick[axis]}`, tick.projected, format(tick[axis]), 10, GAP, tick[axis])
  )
  // A tick the new data dropped fades out in place and takes no room from the others.
  for (const t of ticks) if (t.value !== undefined && leaving.includes(t.value)) t.opacity = 0
  // Ticks outside the gliding ends fade out; only the ones inside take room.
  const { ranged, range } = inRange(
    ticks.filter((t) => t.opacity > 0),
    domain
  )
  // How far a row of labels reaches out from the edge; max, as a spread of thousands overflows the stack.
  const depth = max(ranged, (t) => Math.abs(n.x) * t.w + Math.abs(n.y) * t.h) ?? 0
  const row = { x: n.x * (depth + PAD), y: n.y * (depth + PAD) }
  const rows = fit(ranged, n, row)
  // The line of the axis runs the gliding span of its ticks, within the
  // gliding ends: a tick beyond them would drag it out of the box, and one
  // the data adds or drops would make it jump instead of glide.
  const [s0, s1] = span ?? [edge[0][axis], edge[edge.length - 1][axis]]
  const start = along(edge, clamp(range.lo, range.hi, s0))
  const end = along(edge, clamp(range.lo, range.hi, s1))
  const [from, to] = [frame[0].projected, frame[frame.length - 1].projected]
  const head = title ? titleLabel(`${id}-title`, axis, title, from, to, n, ranged) : undefined
  // A second row of tick labels pushes the title out with it.
  if (head && rows === 2) head.shift = row
  // The edges the axis does not sit on keep their labels in place, unseen, to fade them in.
  hideOffRange([...ticks, ...(head ? [head] : [])], range, chosen)
  // The axis line runs its edge between its outermost ticks; a mark points out from every
  // tick, as far out as its label is clear of it, and hides where the label does.
  const line: AxisLine = { key: id, from: start, to: end, opacity: chosen ? 1 : 0 }
  const marks = edge.map((tick, i) => ({
    key: ticks[i].key,
    from: tick.projected,
    to: { x: tick.projected.x + n.x * MARK, y: tick.projected.y + n.y * MARK },
    opacity: ticks[i].opacity,
  }))
  return { chosen, ticks, title: head, line, marks }
}

/**
 * The title of an axis, along its edge as the screen shows it, never upside
 * down, beyond its `ticks` on the side of the `normal`, at the middle of the
 * edge (ADR-0013). It fades out where the edge points at the camera and shrinks
 * to less than a line. Its box is the upright extent of the turned text,
 * which the labels of the other axes keep clear of.
 */
function titleLabel(
  key: string,
  axis: keyof AxesSpec,
  text: React.ReactNode,
  start: Point2D,
  end: Point2D,
  normal: Point2D,
  ticks: AxisLabel[]
): AxisLabel {
  const h = 12
  const w = textWidth(text, h)
  const angle = upright(start, end)
  const [c, s] = [Math.cos, Math.sin].map((f) => Math.abs(f((angle * Math.PI) / 180)))
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const { out, reach } = clearOf(ticks, start, end, normal)
  return {
    key,
    axis,
    text,
    title: true,
    angle,
    shift: ZERO,
    // Fades out as the edge, pointing at the camera, shrinks from a line to half of one.
    opacity: clamp(0, 1, (2 * length) / h - 1),
    // Along the edge, the text reaches out half its height, whatever its length.
    at: beside(middle, out, 0, 0, reach + GAP + h / 2),
    w: c * w + s * h,
    h: s * w + c * h,
  }
}

/**
 * The turn in degrees of text along the line from `start` to `end`, in whole
 * tenths folded into [-90°, 90°): never upside down, and float noise on a
 * vertical line does not flip it from frame to frame.
 */
function upright(start: Point2D, end: Point2D) {
  const tenths = Math.round((Math.atan2(end.y - start.y, end.x - start.x) * 1800) / Math.PI)
  return ((((tenths + 900) % 1800) + 1800) % 1800) / 10 - 90
}

/**
 * The way `out` square to the line from `start` to `end`, on the side of the
 * `normal`, which perspective leans off the line, and how far the `ticks`
 * reach that way from it.
 */
function clearOf(ticks: AxisLabel[], start: Point2D, end: Point2D, normal: Point2D) {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const square = { x: (start.y - end.y) / length, y: (end.x - start.x) / length }
  const side = Math.sign(square.x * normal.x + square.y * normal.y) || 1
  const out = length ? { x: side * square.x, y: side * square.y } : normal
  const reach = Math.max(
    0,
    ...ticks.map(
      (t) =>
        (t.at.x - start.x) * out.x +
        (t.at.y - start.y) * out.y +
        (Math.abs(out.x) * t.w + Math.abs(out.y) * t.h) / 2
    )
  )
  return { out, reach }
}

/**
 * Fits the tick labels of an edge into the space between its ticks: in one
 * row if they keep `PAD` apart, or slid along the edge if no label has to
 * slide further than `DODGE`, else every other label a `row` further out if
 * that is enough, else every `stride`-th label of one row, 2, 4, 8… The
 * labels of a stride are among those of the one before, so as the edge
 * shortens, a label only ever leaves and none comes in for it. Returns the rows.
 */
function fit(ticks: AxisLabel[], normal: Point2D, row: Point2D) {
  if (clear(ticks, 1) || slide(ticks, normal)) return 1
  ticks.forEach((t, i) => (t.shift = i % 2 ? row : ZERO))
  if (clear(ticks, 2)) return 2
  ticks.forEach((t) => (t.shift = ZERO))
  let stride = 2
  while (stride < ticks.length && !clear(ticks, stride, stride)) stride *= 2
  ticks.forEach((t, i) => (t.opacity = i % stride ? 0 : 1))
  return 1
}

/** Whether every label from every `every`-th keeps `PAD` apart from the one `step` after it. */
function clear(ticks: AxisLabel[], step: number, every = 1) {
  // A hair under PAD, as labels that `slide` sets exactly PAD apart may round to less.
  return ticks.every(
    (t, i) => i % every > 0 || i + step >= ticks.length || apart(t, ticks[i + step]) > PAD - 1e-6
  )
}

/**
 * Slides the labels of an edge along it, square to its `normal`, as little
 * as they can until each has the room it needs. True if that is enough and
 * no label slides further than `DODGE`; the slide grows from nothing as the
 * labels near, so it follows the camera without a jump.
 */
function slide(ticks: AxisLabel[], normal: Point2D) {
  const t = { x: -normal.y, y: normal.x }
  const along = ({ at }: AxisLabel) => at.x * t.x + at.y * t.y
  // The labels in their order along the edge, whichever way its ticks run.
  const line = [...ticks].sort((a, b) => along(a) - along(b))
  const gaps = line.slice(1).map((b, i) => room(line[i], b, normal, t))
  const placed = dodge(line.map(along), gaps)
  line.forEach((label, i) => {
    const d = placed[i] - along(label)
    label.shift = { x: t.x * d, y: t.y * d }
  })
  return line.every((label, i) => Math.abs(placed[i] - along(label)) <= DODGE) && clear(ticks, 1)
}

/**
 * How far along `t` the label `b` has to stand from `a`, which comes before
 * it there, for their boxes to keep `PAD` apart, as far as they stand apart
 * along `normal`, square to `t`.
 */
function room(a: AxisLabel, b: AxisLabel, normal: Point2D, t: Point2D) {
  const off = (b.at.x - a.at.x) * normal.x + (b.at.y - a.at.y) * normal.y
  const x = ((a.w + b.w) / 2 + PAD - off * normal.x * Math.sign(t.x)) / Math.abs(t.x)
  const y = ((a.h + b.h) / 2 + PAD - off * normal.y * Math.sign(t.y)) / Math.abs(t.y)
  return Math.min(x, y)
}

/**
 * Places points on a line in their order, `gaps[i]` at least between the
 * i-th and the next, and moves them as little as it can: points that would
 * come too close move as one block, centred on the places they want.
 */
function dodge(want: number[], gaps: number[]) {
  const blocks: { start: number; offsets: number[]; at: number }[] = []
  want.forEach((at, start) => {
    let block = { start, offsets: [0], at }
    let last = blocks.at(-1)
    while (last && last.at + last.offsets.at(-1)! + gaps[block.start - 1] > block.at) {
      blocks.pop()
      const base = last.offsets.at(-1)! + gaps[block.start - 1]
      const offsets = [...last.offsets, ...block.offsets.map((o) => o + base)]
      const first = last.start
      // Where the block moves its points the least: the mean of the places they want.
      const mean = offsets.reduce((sum, o, k) => sum + want[first + k] - o, 0) / offsets.length
      block = { start: first, offsets, at: mean }
      last = blocks.at(-1)
    }
    blocks.push(block)
  })
  return blocks.flatMap((block) => block.offsets.map((o) => block.at + o))
}

/**
 * How much of a label shows beside the labels placed before it: it fades as
 * it nears a label of another axis, by as much as that one shows. As this
 * follows the geometry, the label fades as smoothly as the camera turns.
 */
function shows(label: AxisLabel, placed: AxisLabel[]) {
  return placed.reduce(
    (opacity, p) =>
      // A title lies beyond the labels of its own axis by construction.
      p.axis === label.axis
        ? opacity
        : Math.min(opacity, 1 - (1 - clamp(0, 1, apart(label, p) / FADE)) * p.opacity),
    label.opacity
  )
}

/** The space between the boxes of two labels, negative where they overlap. */
function apart(a: AxisLabel, b: AxisLabel) {
  const dx = Math.abs(a.at.x + a.shift.x - b.at.x - b.shift.x) - (a.w + b.w) / 2
  const dy = Math.abs(a.at.y + a.shift.y - b.at.y - b.shift.y) - (a.h + b.h) / 2
  return Math.max(dx, dy)
}

/**
 * The centre of a box `w`×`h` that lies `gap` from `at` towards `toward`, a
 * unit vector. As the vector turns, the box slides round `at` and keeps the
 * gap, where an anchor that switches from start to end would jump.
 */
function beside(at: Point2D, toward: Point2D, w: number, h: number, gap: number): Point2D {
  const out = gap + (Math.abs(toward.x) * w + Math.abs(toward.y) * h) / 2
  return { x: at.x + toward.x * out, y: at.y + toward.y * out }
}

/** The width of a label at the font size `size`, guessed from its text, as the browser lays it out only after the render. */
function textWidth(text: React.ReactNode, size: number) {
  // ponytail: 0.6em a character; measure with getBBox if wide fonts or rich labels still overlap.
  const chars = typeof text === "string" || typeof text === "number" ? String(text).length : 4
  return chars * size * 0.6
}

/**
 * A line of the axes, in the ink of the kind it is: the line of an axis along
 * its edge, or the mark of one of its ticks. Its place follows the camera at
 * once; a change of edge fades it in a transition.
 */
function AxisLine3D({
  line: { from, to, opacity },
  ink,
  width,
}: {
  line: AxisLine
  ink: string
  width: number
}) {
  return (
    <line
      x1={fixed(from.x)}
      y1={fixed(from.y)}
      x2={fixed(to.x)}
      y2={fixed(to.y)}
      strokeWidth={width}
      style={{ opacity: Math.round(opacity * 100) / 100 }}
      className={cn("transition-opacity duration-300 ease-out motion-reduce:transition-none", ink)}
    />
  )
}

/**
 * A label of the chart box. Its place follows the camera at once; a change
 * of edge, of row or of the labels that fit fades and moves it in a transition.
 */
function AxisLabel3D({ label: { at, shift, opacity, text, title, angle } }: { label: AxisLabel }) {
  return (
    <text
      x={fixed(at.x)}
      y={fixed(at.y)}
      transform={angle ? `rotate(${fixed(angle)} ${fixed(at.x)} ${fixed(at.y)})` : undefined}
      textAnchor="middle"
      dominantBaseline="central"
      style={{
        opacity: Math.round(opacity * 100) / 100,
        translate: `${fixed(shift.x)}px ${fixed(shift.y)}px`,
      }}
      className={cn(
        "transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none",
        title ? "fill-foreground font-medium" : "fill-muted-foreground text-[10px]"
      )}
    >
      {text}
    </text>
  )
}

/** A nice axis from `lo` to `hi` with about `count` ticks. */
function axis(lo: number, hi: number, count = 5): AxisSpec {
  const [start, stop] = nice(lo, lo === hi ? hi + 1 : hi, count)
  return { domain: [start, stop], ticks: ticks(start, stop, count) }
}

/**
 * The axis `spec` with its domain widened by half a `cell` on each side, so
 * the box keeps room between the outermost data and its walls. The ticks stay
 * where they were, on the data.
 */
function pad(spec: AxisSpec, cell: number): AxisSpec {
  return { domain: [spec.domain[0] - cell / 2, spec.domain[1] + cell / 2], ticks: spec.ticks }
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

/**
 * The point at `lon` and `lat`, in degrees, on the sphere of `radius` around
 * the center of the world box: the prime meridian faces the viewer at yaw 0,
 * east lies to the right and the north pole is up - towards -y, as the box
 * counts y. The globe chart builds its tiles from it, since a chart may not
 * do trigonometry of its own.
 */
function globe(lon: number, lat: number, radius = 1): Point3D {
  const [theta, phi] = [lon, lat].map((degrees) => (degrees * Math.PI) / 180)
  const flat = radius * Math.cos(phi)
  return { x: flat * Math.sin(theta), y: -radius * Math.sin(phi), z: flat * Math.cos(theta) }
}

/**
 * The longitude and latitude, in degrees, of the place a point lies over, as
 * seen from the middle of the globe: `globe` read back, at any radius. A
 * geo chart glides a place as a point through the globe - the chord between
 * two places lies under their great circle, so the place takes the shortest
 * way, over the date line too - and reads the place on the way back with it.
 */
function placeOf({ x, y, z }: Point3D): [number, number] {
  const degrees = (radians: number) => (radians * 180) / Math.PI
  return [degrees(Math.atan2(x, z)), degrees(Math.atan2(-y, Math.hypot(x, z)))]
}

/**
 * The view that looks at the place at `lon` and `lat`, in degrees: the
 * place lies in the middle of the globe. A page hands it to the `view` of
 * the container, so the camera turns to a place, since a chart may not do
 * trigonometry of its own, and neither should a page have to.
 */
function facing(lon: number, lat: number): View3D {
  return { yaw: (-lon * Math.PI) / 180, tilt: (lat * Math.PI) / 180 }
}

/**
 * The way one place sets out for another along their great circle, in
 * degrees clockwise from north; `placeAt` reads it back. A geo chart turns
 * one place round another with the two, since a chart may not do
 * trigonometry of its own.
 */
function azimuth([lon0, lat0]: [number, number], [lon1, lat1]: [number, number]) {
  const [from, to, east] = [lat0, lat1, lon1 - lon0].map((degrees) => (degrees * Math.PI) / 180)
  const north = Math.cos(from) * Math.sin(to) - Math.sin(from) * Math.cos(to) * Math.cos(east)
  return (Math.atan2(Math.sin(east) * Math.cos(to), north) * 180) / Math.PI
}

/**
 * The place `far` radians of the great circle from the place at `lon` and
 * `lat` that sets out the way `setOut`, in degrees clockwise from north:
 * its longitude, from -180 to 180, and its latitude.
 */
function placeAt([lon, lat]: [number, number], setOut: number, far: number): [number, number] {
  const [from, way] = [lat, setOut].map((degrees) => (degrees * Math.PI) / 180)
  const up = Math.sin(from) * Math.cos(far) + Math.cos(from) * Math.sin(far) * Math.cos(way)
  const east = Math.atan2(
    Math.sin(way) * Math.sin(far) * Math.cos(from),
    Math.cos(far) - Math.sin(from) * up
  )
  const degrees = (radians: number) => (radians * 180) / Math.PI
  return [((lon + degrees(east) + 540) % 360) - 180, degrees(Math.asin(up))]
}

/** The radius of the globe in the world box: `geoView` projects the land at it, and a geo chart places its marks on it. */
const GLOBE_RADIUS = 1.15

/**
 * The camera without its perspective, a copy, since d3-3d shares the view of
 * a camera it is handed: d3-geo has no perspective, so a geo chart projects
 * its marks without one too, and they stay on the land.
 */
function orthographic(camera: Camera3DInstance) {
  return camera3D()
    .origin(camera.origin())
    .scale(camera.scale())
    .rotateX(camera.rotateX())
    .rotateY(camera.rotateY())
}

/**
 * The azimuth over the globe, in degrees clockwise from north, of the way
 * that points `way` degrees clockwise from up on the screen at a place, as
 * `camera` shows it: `way` itself where the camera faces the place with
 * north up. With it a geo chart says which way over the globe a symbol
 * points that is drawn as it is.
 */
function azimuthAt(camera: Camera3DInstance, place: [number, number], way: number) {
  // A step north and one east, short enough for the bend of the globe: the screen shows a way
  // over the globe as so much of the one and so much of the other.
  const [here, north, east] = points3D<Point3D>()
    .camera(orthographic(camera))
    .data([place, placeAt(place, 0, 1e-4), placeAt(place, 90, 1e-4)].map((p) => globe(...p)))
    .map((p) => p.projected)
  const [n, e] = [north, east].map((p) => ({ x: p.x - here.x, y: p.y - here.y }))
  const [x, y] = [Math.sin((way * Math.PI) / 180), -Math.cos((way * Math.PI) / 180)]
  // Seen from behind the globe the two steps change sides, and `side` its sign.
  const side = n.x * e.y - e.x * n.y
  return (Math.atan2((n.x * y - n.y * x) * side, (e.y * x - e.x * y) * side) * 180) / Math.PI
}

/** What `earth` sets on a projection of d3-geo: the three setters it needs, each returning the projection. */
export type GeoProjectionLike<P> = {
  rotate(angles: [number, number]): P
  scale(scale: number): P
  translate(point: [number, number]): P
}

/**
 * Sets a projection of d3-geo to the camera: its rotation in degrees, its
 * scale at the radius of the globe and its origin, so the land turns, pans
 * and zooms with the marks.
 */
function geoView<P extends GeoProjectionLike<P>>(camera: Camera3DInstance, projection: P) {
  const degrees = (radians: number) => (radians * 180) / Math.PI
  const { x, y } = camera.origin()
  return projection
    .rotate([degrees(camera.rotateY()), degrees(camera.rotateX())])
    .scale(camera.scale() * GLOBE_RADIUS)
    .translate([x, y])
}

/**
 * Stands in for a canvas under d3-geo's `geoPath`: `marks(draw, key, fill)`
 * runs `draw` and returns every ring it drew, cut at the horizon as d3-geo
 * cuts it, as a polygon mark keyed `key-i`. A point is not a region: the ring
 * its `moveTo` began goes with its `arc`. A hole is not one either: a ring
 * wound the other way than the largest ring is left out, so the region
 * around a hole fills it once, not twice.
 */
function ringSink() {
  const rings: Point2D[][] = []
  return {
    beginPath: () => {
      rings.length = 0
    },
    moveTo: (x: number, y: number) => {
      rings.push([{ x, y }])
    },
    lineTo: (x: number, y: number) => {
      rings.at(-1)!.push({ x, y })
    },
    closePath: () => {},
    arc: () => {
      rings.pop()
    },
    marks: (draw: () => void, key: string, fill: string): Mark3D[] => {
      rings.length = 0
      draw()
      const areas = rings.map(areaOf)
      const largest = areas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0)
      return rings.flatMap((points, i) =>
        areas[i] * largest < 0 ? [] : [{ key: `${key}-${i}`, points, fill }]
      )
    },
  }
}

/**
 * The earth under the marks of a geo chart: the ocean and the land as marks,
 * flat in `--chart-3d-ocean` and `--chart-3d-land`, falling back to the
 * colors of the walls - scenery, grouped by nothing, with no tooltip, that
 * neither enters nor glides. The chart hands in d3-geo's `geoOrthographic()`
 * and `geoPath`, so the core carries no d3-geo; `earth` sets the projection
 * to the camera and draws through a sink that collects every ring, cut at
 * the horizon, as a polygon. `path` and `sink` come along for a chart that
 * draws regions of its own: `sink.marks(() => path(feature), key, fill)`,
 * and `ground(feature, key)` draws one feature as land, for a chart that
 * paints the land of a region in an order of its own.
 */
function earth<
  Feature,
  P extends GeoProjectionLike<P>,
  Path extends (object: Feature | { type: "Sphere" }) => unknown,
>(
  land: { features: Feature[] },
  camera: Camera3DInstance,
  projection: P,
  geoPath: (projection: P, sink: ReturnType<typeof ringSink>) => Path
) {
  const sink = ringSink()
  const path = geoPath(geoView(camera, projection), sink)
  const ground = (feature: Feature, key: string) =>
    sink.marks(() => path(feature), key, "var(--chart-3d-land, var(--border))")
  const marks = [
    ...sink.marks(() => path({ type: "Sphere" }), "ocean", "var(--chart-3d-ocean, var(--muted))"),
    ...land.features.flatMap((feature, i) => ground(feature, `land-${i}`)),
  ]
  return { marks, path, sink, ground }
}

/**
 * Hands the projection its accessors into the world box, so every chart maps
 * its shapes onto the screen the same way.
 */
function intoWorld<Datum extends Point3D, T extends ShapeInstance<Datum>>(
  projection: T,
  world: World
): T {
  return projection
    .x((p) => world.x(p.x))
    .y((p) => world.y(p.y))
    .z((p) => world.z(p.z))
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

/**
 * `color` at `opacity`, from 0 to 1: a CSS color-mix with transparent, so a
 * mark fades on every renderer while its color stays in CSS. Rounded to a
 * percent, so the renderers that resolve colors cache a bounded few. Fade
 * after `shade`, which would mix a translucent color back towards opaque.
 */
function faded(color: string, opacity: number) {
  const percent = Math.round(opacity * 100)
  return percent >= 100 ? color : `color-mix(in oklab, ${color} ${percent}%, transparent)`
}

/**
 * Whether `value` is a number a chart can place: whatever `Number` reads as a
 * finite number - a number, a string of one, a date, a bigint - but not what
 * it reads as 0 for want of a value: null, a blank string and a boolean would
 * draw an entry without a place at the origin.
 */
function finite(value: unknown) {
  const isBlank = typeof value === "string" && value.trim() === ""
  const isValue = value != null && typeof value !== "boolean" && !isBlank
  return isValue && Number.isFinite(Number(value))
}

/**
 * The config key a field of the data names, as `series` reads it: the value
 * as a string, or `fallback` where it is missing or blank, never
 * "undefined" or "null".
 */
function keyOf(value: unknown, fallback: string) {
  return value == null || String(value).trim() === "" ? fallback : String(value)
}

/**
 * `value` as an amount a mark is sized by, such as the area of a dot or the
 * height of a tile: one below 0, or one that is not a finite number, stands
 * as 0.
 */
function nonNegative(value: unknown) {
  return finite(value) ? Math.max(0, Number(value)) : 0
}

/**
 * The entries of `data` as points in the chart box, for a chart that places
 * every entry at its fields `x`, `y` and `z`, as the scatter and the line
 * chart do. Every entry is `named` by its `id` field, or by its position in
 * the data, so a point keeps its name when an entry before it gains or loses
 * its place; one whose x, y or z is not a finite number is not `placed` and
 * is not among the `names` and the `entries` behind them. The `axes` hold
 * every placed entry, a nice one per field. `target` holds the position of
 * every point, under the `key` of its axis and its name, for the chart to glide into,
 * and `presence` runs by name from 0 to 1 as a point comes and back as it
 * goes, the gone ones still among them. Built once per change of the data,
 * not at every frame the camera turns.
 */
function usePoints<T extends Record<string, unknown>>(
  data: T[],
  x: keyof T & string,
  y: keyof T & string,
  z: keyof T & string,
  id?: keyof T & string
) {
  const points = React.useMemo(() => {
    const fields = { x, y, z }
    const names = id ? uniqueIds(data.map((d) => String(d[id]))) : data.map((_, i) => String(i))
    const named = data.map((d, i) => ({
      d,
      name: names[i],
      placed: [x, y, z].every((f) => finite(d[f])),
    }))
    const placed = named.filter((p) => p.placed)
    const range = (a: keyof AxesSpec) => {
      const [lo = 0, hi = 0] = extent(placed, (p) => Number(p.d[fields[a]]))
      return axis(lo, hi)
    }
    return {
      fields,
      named,
      names: placed.map((p) => p.name),
      entries: new Map(placed.map((p) => [p.name, p.d])),
      target: Object.fromEntries(
        placed.flatMap((p) => AXES.map((a) => [positionKey(a, p.name), Number(p.d[fields[a]])]))
      ),
      present: Object.fromEntries(placed.map((p) => [p.name, 1])),
      axes: { x: range("x"), y: range("y"), z: range("z") },
    }
  }, [data, x, y, z, id])
  return { ...points, presence: useTween(points.present, 0), key: positionKey }
}

/** What a chart of lines knows of an entry: the config key of its line, and whether it is a gap, an entry without a place, where the line breaks. */
type Joint = { line: string; gap: boolean }

/**
 * The runs of the lines of a chart that joins its entries in the order of
 * the data, as the line and the routes chart do: per line - the entries of
 * one value of `series`, all of them without it - its points in order, cut
 * where an entry has no place, so a line stops before it and starts again
 * after it. `named` is every entry with its name and whether it is placed,
 * `presence` how far each point has come, from 0 to 1, the gone ones still
 * among them: a gone point keeps its line and its place after the entry it
 * followed - a gap too, so it stays in its run - since its own entry has
 * already left the data, and is forgotten when it has arrived: when neither
 * the presence nor the glide of the positions holds it any more.
 * `target` is the position of every point, by its axis and its name, as
 * `usePoints` gives it, and the points glide into it: a point that comes
 * starts on the nearest point of its run that is on screen - the one before
 * it, or after it at the start - where that one is now, and a point that
 * goes heads for the nearest one that stays, from where it is. So new data
 * that comes while points are on their way moves every one on from where it
 * is. A point goes the straight way, or the way `toward` gives: the place
 * the `share` of the way from one point to another. A point `moves` while it is off its place, or goes to one that stays;
 * in a run that is all new, or all gone, the points stand.
 */
function useRuns<T extends Record<string, unknown>>(
  named: { d: T; name: string; placed: boolean }[],
  series: (keyof T & string) | undefined,
  presence: Record<string, number>,
  target: Record<string, number>,
  toward?: (from: Point3D, to: Point3D, share: number) => Point3D
) {
  const { config } = useChart3D()
  const fallback = Object.keys(config)[0]
  const known = React.useRef(new Map<string, Joint>())
  // The positions of the render before: a point is there as long as it has one.
  const shown = React.useRef<Record<string, number>>({})
  const live = React.useMemo(() => liveJoints(named, series, fallback), [named, series, fallback])
  const alive = (name: string) => name in presence || positionKey("x", name) in shown.current
  const runs = runsOf((known.current = withGone(live, known.current, alive)))
  const places = useTween(target, neighbour(runs), toward && pointwise(toward))
  shown.current = places
  // A point the glide does not know yet is on its way in with the next render,
  // and one it knows no more is gone with it: a run of such has nothing to show.
  const drawn = runs
    .map(({ line, names }) => ({
      line,
      names: names.filter((name) => positionKey("x", name) in places),
    }))
    .filter(({ names }) => names.length)
  return drawn.map(({ line, names }) => {
    const stays = names.some((name) => live.has(name))
    return {
      line,
      points: names.map((name) => {
        const at = pointOf(places, name)
        const own = pointOf(target, name)
        return {
          name,
          // A point still on its way when its presence has run out is seen no more.
          seen: presence[name] ?? 0,
          moves: live.has(name) ? AXES.some((a) => at[a] !== own[a]) : stays,
          at,
        }
      }),
    }
  })
}

// The axes a position has a number along.
const AXES = ["x", "y", "z"] as const

/** The key of the position of the point `name` along `axis`, among the numbers of a chart. */
const positionKey = (axis: keyof AxesSpec, name: string) => `${axis}${name}`

/** The position of the point `name` among `numbers`. */
function pointOf(numbers: Record<string, number>, name: string): Point3D {
  const along = (axis: keyof AxesSpec) => numbers[positionKey(axis, name)]
  return { x: along("x"), y: along("y"), z: along("z") }
}

/**
 * Mixes the positions of a glide point by point, for `useTween`: every point
 * the share of the way `toward` its end that a chart says - over a globe,
 * say, where the straight way would cut through it. A point that stands
 * keeps its numbers to the last digit.
 */
function pointwise(toward: (from: Point3D, to: Point3D, share: number) => Point3D) {
  return (from: Record<string, number>, ends: Record<string, number>, share: number) =>
    Object.fromEntries(
      Object.keys(ends)
        .filter((key) => key.startsWith("x"))
        .flatMap((key) => {
          const [start, end] = [pointOf(from, key.slice(1)), pointOf(ends, key.slice(1))]
          const stands = AXES.every((a) => start[a] === end[a])
          const at = stands ? end : toward(start, end, share)
          return AXES.map((a) => [positionKey(a, key.slice(1)), at[a]])
        })
    )
}

/**
 * Where a point of `runs` enters from, for `useTween`: the number of the
 * nearest point of its run that is `among` the numbers - the one before it,
 * or after it at the start - along the axis of the key, and nowhere where
 * its run has none.
 */
function neighbour(runs: { names: string[] }[]) {
  // One sweep per record of numbers, not a search per key: thousands of new points stay linear.
  const sweeps = new Map<Record<string, number>, Map<string, string>>()
  return (key: string, among: Record<string, number>) => {
    let near = sweeps.get(among)
    if (!near) sweeps.set(among, (near = nearest(runs, among)))
    // A point the runs have dropped already has no run to find a neighbour in.
    const at = near.get(key)
    return at === undefined ? undefined : among[at]
  }
}

/**
 * The key of the nearest point `among` the numbers for the key of every
 * point of `runs`, on each axis: the one before it, or the first of its run.
 * A key is never among the numbers it enters from or heads for, so the first
 * of its run, where none comes before it, lies after it.
 */
function nearest(runs: { names: string[] }[], among: Record<string, number>) {
  const near = new Map<string, string>()
  for (const { names } of runs)
    for (const axis of AXES) {
      const keys = names.map((name) => positionKey(axis, name))
      let before = keys.find((k) => k in among)
      for (const k of keys) {
        if (before !== undefined) near.set(k, before)
        if (k in among) before = k
      }
    }
  return near
}

/** The joint of every entry, by name, in the order of the data: a point of its line, or a gap in it. */
function liveJoints<T extends Record<string, unknown>>(
  named: { d: T; name: string; placed: boolean }[],
  series: (keyof T & string) | undefined,
  fallback: string
) {
  return new Map(
    named.map(({ d, name, placed }): [string, Joint] => [
      name,
      { line: keyOf(series && d[series], fallback), gap: !placed },
    ])
  )
}

/**
 * The `live` joints with the gone ones of `known` that are still `alive`
 * among them, each after the living one it followed - before the first, if
 * it followed none.
 */
function withGone(
  live: Map<string, Joint>,
  known: Map<string, Joint>,
  alive: (name: string) => boolean
) {
  const gone = new Map<string | undefined, [string, Joint][]>([
    [undefined, []],
    ...[...live.keys()].map((name): [string, [string, Joint][]] => [name, []]),
  ])
  let last: string | undefined
  for (const [name, joint] of known) {
    if (live.has(name)) last = name
    else if (alive(name)) gone.get(last)!.push([name, joint])
  }
  return new Map([
    ...gone.get(undefined)!,
    ...[...live].flatMap((joint) => [joint, ...gone.get(joint[0])!]),
  ])
}

/** The names of the points of every run, in order: a run per line, and a new one after a gap in it. */
function runsOf(joints: Map<string, Joint>) {
  const open = new Map<string, string[]>()
  const runs: { line: string; names: string[] }[] = []
  for (const [name, { line, gap }] of joints) {
    if (gap) open.delete(line)
    else {
      if (!open.has(line)) runs.push({ line, names: open.set(line, []).get(line)! })
      open.get(line)!.push(name)
    }
  }
  return runs
}

/**
 * The corners of the segment from `a` to `b`, `width` wide, in the units of
 * the view box: a line of the same width on the screen from every side, as a
 * polygon every renderer draws. A segment without a length, as of a point
 * that has yet to unfold, has no side to turn to and stays a point.
 */
function segment(a: Point2D, b: Point2D, width: number): Point2D[] {
  const half = width / 2 / (Math.hypot(b.x - a.x, b.y - a.y) || 1)
  const n = { x: (a.y - b.y) * half, y: (b.x - a.x) * half }
  return [
    { x: a.x + n.x, y: a.y + n.y },
    { x: b.x + n.x, y: b.y + n.y },
    { x: b.x - n.x, y: b.y - n.y },
    { x: a.x - n.x, y: a.y - n.y },
  ]
}

/**
 * The config key of every point, by name, read from `field` of its entry,
 * `fallback` without one - remembered while a gone point is on its way out,
 * since its entry has already left the data, so it keeps its color to the
 * end - and forgotten with the point, so the memory stays the size of the
 * chart. `alive` holds the points still on their way.
 */
function useConfigKeys<T extends Record<string, unknown>>(
  entries: Map<string, T>,
  field: (keyof T & string) | undefined,
  fallback: string,
  alive: Record<string, number>
) {
  const known = React.useRef(new Map<string, string>())
  entries.forEach((d, name) => known.current.set(name, keyOf(field && d[field], fallback)))
  for (const name of known.current.keys()) {
    if (!(name in alive) && !entries.has(name)) known.current.delete(name)
  }
  return (name: string) => known.current.get(name) ?? fallback
}

/**
 * What the point of `entry` says on hover, made when the pointer lands on
 * it: its series, where `title` names one, and its x, y and z as the ticks of
 * each axis name them - or what `tooltip` makes of that. A point whose entry
 * has left the data says nothing.
 */
function pointTooltip<T extends Record<string, unknown>>(
  entry: T | undefined,
  title: React.ReactNode,
  fields: Record<keyof AxesSpec, keyof T & string>,
  {
    format = {},
    titles = {},
    tooltip = (tip) => tip,
  }: {
    format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
    titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
    tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
  }
): Mark3D["tooltip"] {
  if (!entry) return undefined
  return () =>
    tooltip(
      {
        title,
        items: (["x", "y", "z"] as const).map((a) => {
          const value = Number(entry[fields[a]])
          return { label: titles[a] ?? fields[a], value: format[a]?.(value) ?? value }
        }),
      },
      { entry }
    )
}

/**
 * The entries of `data` and their series, for a chart that lays the entries
 * out along x and the series along z, as the bar and the area chart do. The
 * name of every entry comes from its `index` field, the series are `keys` or
 * the keys of the config, and the `target` of every cell is keyed by the name
 * of its entry and its series, so it follows its entry when the data
 * reorders; a value that is not a finite number stands as 0. Each glides by name:
 * `values` from 0, `rows` - the place of every entry - to where it stands, and
 * `presence` from 0 to 1 as an entry comes and back as it goes, the gone ones
 * still among them. `labels` name the ticks: the entry at a tick of x, through
 * `format.x` - a tick of a gone entry fades out unnamed - and the series at a
 * tick of z. Every entry is keyed by its id - its name, made unique where a
 * name repeats - and `nameOf` reads the name back; `entries` holds the entry
 * behind every id still in the data.
 */
function useSeries<T extends Record<string, unknown>>({
  data,
  index,
  keys,
  format = {},
}: {
  data: T[]
  index: keyof T & string
  keys?: string[]
  format?: { x?: (label: string) => React.ReactNode; y?: (value: number) => React.ReactNode }
}) {
  const { config } = useChart3D()
  const series = React.useMemo(() => keys ?? Object.keys(config), [keys, config])
  // Built once per change of the data, not at every frame the camera turns.
  const { names, ids, target, order, present } = React.useMemo(() => {
    const names = data.map((d) => String(d[index] ?? ""))
    const ids = uniqueIds(names)
    return {
      names,
      ids,
      target: Object.fromEntries(
        data.flatMap((d, i) =>
          series.map((key) => [`${ids[i]}-${key}`, finite(d[key]) ? Number(d[key]) : 0])
        )
      ),
      order: Object.fromEntries(ids.map((id, i) => [id, i])),
      present: Object.fromEntries(ids.map((id) => [id, 1])),
    }
  }, [data, index, series])
  const labels = {
    x: (i: number) => (format.x ?? String)(names[i] ?? ""),
    y: format.y,
    z: (j: number) => config[series[j]]?.label ?? series[j],
  }
  return {
    series,
    target,
    entries: new Map(data.map((d, i) => [ids[i], d])),
    values: useTween(target, 0),
    rows: useTween(order),
    presence: useTween(present, 0),
    labels,
    nameOf,
  }
}

// Between a name and the count of its repeat, in the id of an entry: a
// character no name of the data is expected to hold.
const REPEAT = "\u0000"

/**
 * An id per name, unique: a name the first time, the name and its count when
 * it comes again, so entries of the same name are entries of their own.
 * Nothing else tells them apart, so the order of the data does: the first
 * "Jan" stays the first through an update, whichever entry that is.
 */
function uniqueIds(names: string[]) {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name}${REPEAT}${count}`
  })
}

/** The name of the entry of `id`, as its data names it. */
const nameOf = (id: string) => id.split(REPEAT)[0]

/** The marks of a cube: its faces that look at the camera, shaded in `color`, each with `tooltip` on hover. */
function cubeMarks(
  id: string,
  faces: CubeFace[],
  color: string,
  tooltip: Mark3D["tooltip"]
): Mark3D[] {
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

/**
 * The corners of a bar on the floor of `world`, at `x` and `z` in the values
 * of the data, from 0 to `value`, `size` wide and deep in the world box.
 * box() rises towards -y, so a negative bar starts at its value.
 */
function barCorners(
  world: World,
  x: number,
  z: number,
  value: number,
  size: { width: number; depth: number }
) {
  const floor = world.y(0)
  const top = world.y(value)
  return box({
    x: world.x(x),
    y: Math.max(floor, top),
    z: world.z(z),
    ...size,
    height: Math.abs(floor - top),
  })
}

/** The marks of one bar: the faces that look at the camera, shaded and faded to `opacity`, each with `tooltip` on hover. Its group is the bar alone, so hovering highlights one bar. */
function barMarks({
  id,
  faces,
  color,
  tooltip,
  opacity,
}: {
  id: string
  faces: CubeFace[]
  color: string
  tooltip: Mark3D["tooltip"]
  opacity: number
}) {
  return cubeMarks(id, faces, color, tooltip).map((mark) => ({
    ...mark,
    fill: faded(mark.fill, opacity),
    groups: [id],
  }))
}

/**
 * The color at `value` on a ramp from the config color `low` at `lo` to
 * `high` at `hi` - a value beyond them takes the color of the nearer end: a
 * CSS color-mix, so it follows the theme.
 */
function ramp(value: number, [lo, hi]: [number, number], [low, high]: [string, string]) {
  const t = Math.min(100, Math.max(0, Math.round(((value - lo) / (hi - lo || 1)) * 100)))
  return `color-mix(in oklch, ${colorOf(high)} ${t}%, ${colorOf(low)})`
}

/**
 * Where the `count` columns or rows of a grid stand along one axis of
 * arrangement: at their value of `at`, in any order, or evenly over `ends`,
 * by default their indices; one without a finite value has no place. With
 * the cell, the smallest gap between two places - 1 where there is none -
 * and the axis over the places, its ticks within: its walls half a cell
 * beyond them - the padding - or at them where not `padded`, never at a
 * rounder tick, which would leave the box empty beyond the data.
 */
function gridAxis(
  count: number,
  {
    at,
    ends = [0, count - 1],
    padded = true,
  }: { at?: number[]; ends?: [number, number]; padded?: boolean } = {}
) {
  const even = linear([0, count - 1], ends)
  const values = Array.from({ length: count }, (_, i) => (at ? at[i] : even(i)))
  const places: Record<number, number> = Object.fromEntries(
    values.flatMap((v, i) => (finite(v) ? [[i, v]] : []))
  )
  const sorted = [...new Set(Object.values(places))].sort((a, b) => a - b)
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i])
  const cell = min(gaps) ?? 1
  const [lo = 0, hi = lo] = [sorted[0], sorted.at(-1)]
  // A single place has no span of its own: it keeps its padding either way.
  const spec = pad({ domain: [lo, hi], ticks: ticks(lo, hi, 5) }, padded || lo === hi ? cell : 0)
  return { places, cell, spec }
}

/** `cubes`, each with its bottom face as `floor`, found once: bars on one floor paint back to front by it. */
function floored<C extends { faces: CubeFace[] }>(cubes: C[]) {
  return cubes.map((cube) =>
    Object.assign(cube, { floor: cube.faces.find((f) => f.face === "bottom")! })
  )
}

export {
  ChartContainer3D,
  ChartLegend3D,
  Axes3D,
  Marks3D,
  Labels3D,
  axis,
  pad,
  linear,
  worldBox,
  globe,
  placeOf,
  azimuth,
  azimuthAt,
  placeAt,
  facing,
  GLOBE_RADIUS,
  orthographic,
  earth,
  intoWorld,
  shade,
  colorOf,
  faded,
  finite,
  keyOf,
  nonNegative,
  useSeries,
  usePoints,
  useConfigKeys,
  useRuns,
  segment,
  pointTooltip,
  cubeMarks,
  barCorners,
  barMarks,
  floored,
  gridAxis,
  ramp,
  uniqueIds,
  useTween,
  useTweenAxes,
}
