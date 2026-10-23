"use client"

import * as React from "react"
import { nice, ticks } from "d3-array"
import {
  axes3D,
  camera3D,
  normal,
  type AxesSpec,
  type AxisEdge,
  type AxisSpec,
  type Camera3DInstance,
  type Point2D,
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
  /** The distance of the eye in box units; Infinity, the default, is orthographic. */
  perspective?: number
}

/** Maps data values to the world box, which spans -1 to 1 on every axis, y up. */
export type World = Record<keyof AxesSpec, (value: number) => number>

export type Tooltip3D = {
  /** The anchor in the units of the view box. */
  at: Point2D
  title?: React.ReactNode
  items: { label: React.ReactNode; value: React.ReactNode; color?: string }[]
}

type ChartContext3D = {
  config: ChartConfig
  camera: Camera3DInstance
  setTooltip: (tooltip: Tooltip3D | null) => void
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
const CLICK_DISTANCE = 4

export type ChartContainer3DProps = {
  /** The series of the chart: a label and a color per key, as in the chart of shadcn/ui. */
  config: ChartConfig
  /**
   * Where the camera starts.
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
}

function ChartContainer3D({
  id,
  config,
  defaultView = { yaw: Math.PI / 6, tilt: Math.PI / 6 },
  width = 640,
  height = 400,
  legend = false,
  className,
  children,
  "aria-label": ariaLabel = "3D chart. Drag or use the arrow keys to rotate it.",
  ...props
}: React.ComponentProps<"div"> & ChartContainer3DProps) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  const [tooltip, setTooltip] = React.useState<Tooltip3D | null>(null)
  const { view, handlers } = useOrbit(defaultView, () => setTooltip(null))

  // The shapes of the chart hang on this camera, so a new view re-projects them all.
  const camera = React.useMemo(
    () =>
      camera3D()
        .origin({ x: width / 2, y: height / 2 })
        .scale(Math.min(width, height) * 0.3 * (view.zoom ?? 1))
        .perspective(view.perspective ?? Infinity)
        .rotateY(view.yaw)
        .rotateX(-view.tilt),
    [view, width, height]
  )
  const context = React.useMemo(() => ({ config, camera, setTooltip }), [config, camera])

  return (
    <div
      data-slot="chart-3d"
      data-chart={chartId}
      className={cn("relative w-full text-xs", className)}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="block h-auto w-full cursor-grab touch-none rounded-lg outline-hidden select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
        {...handlers}
      >
        <Chart3DContext.Provider value={context}>{children}</Chart3DContext.Provider>
      </svg>
      {tooltip && <ChartTooltip3D tooltip={tooltip} width={width} height={height} />}
      {legend && <ChartLegend3D config={config} />}
    </div>
  )
}

/**
 * The view of the camera, and the handlers that turn it: a drag turns it by
 * the distance of the pointer, the arrow keys by a step. The tilt stops at the
 * zenith and the nadir. `onDragStart` runs when a press becomes a drag.
 */
function useOrbit(defaultView: View3D, onDragStart: () => void) {
  const [view, setView] = React.useState(defaultView)
  const drag = React.useRef<Point2D & { moved: boolean }>(null)

  const turn = (yaw: number, tilt: number) =>
    setView((v) => ({
      ...v,
      yaw: v.yaw + yaw,
      tilt: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v.tilt + tilt)),
    }))
  const release = () => {
    drag.current = null
  }

  const handlers: React.SVGProps<SVGSVGElement> = {
    onPointerDown: (e) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: false }
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      // A press that wanders a few pixels is still a click on a bar.
      if (!d.moved && Math.hypot(dx, dy) < CLICK_DISTANCE) return
      if (!d.moved) {
        e.currentTarget.setPointerCapture(e.pointerId)
        onDragStart()
      }
      drag.current = { x: e.clientX, y: e.clientY, moved: true }
      turn(dx * DRAG, dy * DRAG)
    },
    onPointerUp: release,
    onPointerCancel: release,
    onKeyDown: (e) => {
      const step = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowUp: [0, -KEY_STEP],
        ArrowDown: [0, KEY_STEP],
      }[e.key]
      if (!step) return
      e.preventDefault()
      turn(step[0], step[1])
    },
  }

  return { view, handlers }
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
  tooltip: Tooltip3D
  width: number
  height: number
}) {
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
      {box.axes(spec).map((edge) => (
        <AxisEdge3D
          key={edge.axis}
          edge={edge}
          format={format[edge.axis] ?? String}
          title={titles[edge.axis]}
        />
      ))}
    </g>
  )
}

/**
 * The tick labels of one axis on the outline of the box, pushed away from the
 * box along the normal of the edge, and the title of the axis further out.
 */
function AxisEdge3D({
  edge,
  format,
  title,
}: {
  edge: AxisEdge
  format: (value: number) => React.ReactNode
  title?: React.ReactNode
}) {
  // An axis without ticks, such as the rows of an empty chart, has nothing to label.
  if (!edge.length) return null
  const { normal: n } = edge
  const start = edge[0].projected
  const end = edge[edge.length - 1].projected
  const anchor = n.x > 0.3 ? "start" : n.x < -0.3 ? "end" : "middle"

  return (
    <g>
      {edge.map((tick, i) => (
        <text
          key={i}
          x={tick.projected.x + n.x * 10}
          y={tick.projected.y + n.y * 10}
          textAnchor={anchor}
          dominantBaseline="central"
          className="fill-muted-foreground text-[10px]"
        >
          {format(tick[edge.axis])}
        </text>
      ))}
      {title && (
        <text
          x={(start.x + end.x) / 2 + n.x * 44}
          y={(start.y + end.y) / 2 + n.y * 44}
          textAnchor={anchor}
          dominantBaseline="central"
          className="fill-foreground font-medium"
        >
          {title}
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

export { ChartContainer3D, ChartLegend3D, Axes3D, axis, linear, worldBox, shade, center }
