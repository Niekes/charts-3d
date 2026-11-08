"use client"

import * as React from "react"
import { box, cubes3D, sort, type AxesSpec, type Camera3DInstance, type CubeFace } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  cubeMarks,
  faded,
  pad,
  useSeries,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
  type World,
} from "@/registry/new-york/ui/chart-3d"

export type BarChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per row of bars, with a value per series. */
  data: T[]
  /** The field that names each entry, such as "month"; a bar follows its name through updates, so the names should be unique. */
  index: keyof T & string
  /**
   * The fields that hold the series, one row of bars each.
   * @defaultValue the keys of the chart config
   */
  keys?: string[]
  /**
   * The share of its cell a bar covers.
   * @defaultValue 0.6
   */
  barSize?: number
  /** Formats the labels of the entries along x and the values along y. */
  format?: { x?: (label: string) => React.ReactNode; y?: (value: number) => React.ReactNode }
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * What a bar says on hover: `tooltip` is what it would say, its entry and
   * value as the ticks name them, `data` the entry and the series key behind
   * it; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T; key: string }) => Tooltip3D | null
}

/**
 * Bars on a floor: one row per entry of `data` along x, one per series
 * along z, the value as the height. The series are the keys of the chart
 * config unless `keys` names them.
 */
export function BarChart3D<T extends Record<string, unknown>>({
  data,
  index,
  keys,
  barSize = 0.6,
  format,
  titles,
  tooltip,
}: BarChart3DProps<T>) {
  const { config, camera } = useChart3D()
  // A value that is not a number stands as no bar, one of height 0; a new one
  // grows from the floor, and a gone one shrinks back into it. The rows glide
  // to their new cells when the data reorders; a gone row stands in its cell
  // while its bars shrink and fade away, so a flat bar never pops.
  const { series, target, entries, values, rows, presence, labels } = useSeries({
    data,
    index,
    keys,
    format,
  })
  const cells = barCells(rows, series, values)

  const box = barBox(data.length, series.length, Object.values(target))
  // Every axis glides with the bars: the value ends with the heights, the row
  // and series ends - and the depth of the box - as rows come and go. The
  // size of a bar comes from the gliding ends, so it eases with its cell.
  const spec = useTweenAxes(box.spec)
  const depth = useTween({ depth: box.depth }).depth
  const world = worldBox(spec, depth)
  const bars = barShapes(camera, cells, world, cellSize(spec, depth, barSize))

  return (
    <>
      <Axes3D spec={spec} world={world} titles={titles} format={labels} />
      <Marks3D
        marks={bars.flatMap((bar) =>
          barMarks({
            id: `${bar.name}-${bar.key}`,
            faces: bar.faces,
            color: `var(--color-${bar.key})`,
            tooltip: barTooltip(bar, entries.get(bar.name), target, { config, format, tooltip }),
            opacity: presence[bar.name],
          })
        )}
      />
    </>
  )
}

/** The cubes of the cells, projected by `camera` and painted back to front by their footprint, as the bars stand on one floor. */
function barShapes(
  camera: Camera3DInstance,
  cells: ReturnType<typeof barCells>,
  world: World,
  size: { width: number; depth: number }
) {
  return cubes3D()
    .camera(camera)
    .data(
      cells.map(({ name, x, j, key, value }) =>
        Object.assign(barCorners(world, x, j, value, size), { name, key, value })
      )
    )
    .map((bar) => Object.assign(bar, { bottom: bar.faces.find((f) => f.face === "bottom")! }))
    .sort((a, b) => sort(a.bottom, b.bottom))
}

/**
 * The cell of every bar, the rows still gliding away among them: the row
 * position along x, the series `key` along z, with the tweened value. A cell
 * only one of the tweens still knows is on its way out and stays unseen.
 */
function barCells(rows: Record<string, number>, series: string[], values: Record<string, number>) {
  return Object.entries(rows).flatMap(([name, x]) =>
    series.flatMap((key, j) => {
      const value = values[`${name}-${key}`]
      return value === undefined ? [] : [{ name, x, j, key, value }]
    })
  )
}

/**
 * The box of a bar chart: a row per entry along x, a row per series along z,
 * with half a cell of room between the outer rows and the walls.
 */
function barBox(entries: number, series: number, values: number[]) {
  const index = (length: number) => Array.from({ length }, (_, i) => i)
  const spec: AxesSpec = {
    x: pad({ domain: [-0.5, entries - 0.5], ticks: index(entries) }, 1),
    y: axis(Math.min(0, ...values), Math.max(0, ...values)),
    z: pad({ domain: [-0.5, series - 0.5], ticks: index(series) }, 1),
  }
  // A shallow box for few series, so the bars stay square.
  const depth = Math.min(1, Math.max(0.25, series / entries))
  return { spec, depth }
}

/**
 * The size of a bar, the share `barSize` of its cell - of the gliding ends of
 * `spec`, so a bar eases into a new cell size as rows come and go.
 */
function cellSize(spec: AxesSpec, depth: number, barSize: number) {
  return {
    width: (2 / (spec.x.domain[1] - spec.x.domain[0])) * barSize,
    depth: ((2 * depth) / (spec.z.domain[1] - spec.z.domain[0])) * barSize,
  }
}

/**
 * The corners of one bar, from the floor to its value, at row `x` and series
 * `z`. box() rises towards -y, so a negative bar starts at its value.
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

/**
 * What the bar of `entry` says on hover, made when the pointer lands on it:
 * the entry as the ticks of x name it and its value as the ticks of y name
 * it - or what `tooltip` makes of that. A bar whose entry has left the data
 * says nothing.
 */
function barTooltip<T extends Record<string, unknown>>(
  { name, key }: { name: string; key: string },
  entry: T | undefined,
  target: Record<string, number>,
  {
    config,
    format = {},
    tooltip = (tip) => tip,
  }: Pick<BarChart3DProps<T>, "format" | "tooltip"> & { config: ChartConfig }
): Mark3D["tooltip"] {
  if (!entry) return undefined
  const value = target[`${name}-${key}`]
  return () =>
    tooltip(
      {
        title: (format.x ?? String)(name),
        items: [
          {
            label: config[key]?.label ?? key,
            value: format.y?.(value) ?? value,
            color: `var(--color-${key})`,
          },
        ],
      },
      { entry, key }
    )
}

/** The marks of one bar: the faces that look at the camera, shaded and faded to `opacity`, each with `tooltip` on hover. Its group is the bar alone, so hovering highlights one bar, not its series. */
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
