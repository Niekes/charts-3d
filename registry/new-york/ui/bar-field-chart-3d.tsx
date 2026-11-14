"use client"

import * as React from "react"
import { extent } from "d3-array"
import { cubes3D, sort, type AxesSpec, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  barCorners,
  barMarks,
  finite,
  floored,
  gridBox,
  pad,
  ramp,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  type Mark3D,
  type Tooltip3D,
  type World,
} from "@/registry/new-york/ui/chart-3d"

// The share of its cell a bar covers; the rest is the gap that tells two bars apart.
const BAR = 0.8

export type BarFieldChart3DProps = {
  /**
   * The value of every bar, `data[row][column]`: the columns run along x, the
   * rows along z, and a bar rises from 0 to its value. One that is not a
   * finite number draws no bar.
   */
  data: number[][]
  /**
   * The data values the first and the last column (x) and row (z) stand for.
   * The chart keeps half a cell between the bars and the walls of its box.
   * @defaultValue the indices of the columns and rows
   */
  domain?: { x?: [number, number]; z?: [number, number] }
  /**
   * What a bar says on hover: `tooltip` is what it would say, its x, z and
   * value as the ticks name them, `data` the row and column of the bar, the
   * x and z they stand for and its value; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (
    tooltip: Tooltip3D,
    data: { row: number; column: number; x: number; z: number; value: number }
  ) => Tooltip3D | null
  /** Formats the tick labels of each axis. */
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * The config keys of the colors at the lowest and at the highest value.
   * @defaultValue the first two keys of the chart config
   */
  colors?: [string, string]
}

/**
 * A field of bars over a grid: `data[row][column]` is the value of a bar, the
 * columns run along x and the rows along z. Everything about a bar comes from
 * the data - its place from its row and column, its footprint from the cell
 * of the grid, its height from its value, its color from the ramp between
 * the two `colors` at the lowest and the highest value.
 */
export function BarFieldChart3D({
  data,
  domain = {},
  tooltip,
  format,
  titles,
  colors,
}: BarFieldChart3DProps) {
  const { config, camera } = useChart3D()
  const [low, high = low] = colors ?? Object.keys(config)
  const field = useField(data)
  // A bar glides to its new value; a new one grows from 0 as it fades in, a
  // gone one shrinks back to 0 as it fades out and leaves when the glide is done.
  const values = useTween(field.target, 0)
  const presence = useTween(field.present, 0)
  // y runs from 0. A bar is wider than its point: the box keeps half a cell
  // of room beyond the outer bars even where `domain` names the ends.
  const y = axis(Math.min(0, field.lo), Math.max(0, field.hi))
  const box = gridBox(field, domain, y)
  const spec = useTweenAxes({
    ...box.spec,
    x: domain.x ? pad(box.spec.x, box.cell.x) : box.spec.x,
    z: domain.z ? pad(box.spec.z, box.cell.z) : box.spec.z,
  })
  const world = worldBox(spec)
  // The bars stand on the gliding grid, so under a domain a grown grid slides
  // its bars to their new places and their footprint eases, never jumps.
  const shown = useTween({ rows: field.rows, columns: field.columns })
  const grid = gridBox({ rows: shown.rows, columns: shown.columns }, domain, y)
  const size = {
    width: Math.abs(world.x(grid.cell.x) - world.x(0)) * BAR,
    depth: Math.abs(world.z(grid.cell.z) - world.z(0)) * BAR,
  }
  // The ramp glides with the data, not with the bars on screen: one growing
  // from 0 or shrinking to it must not recolor the others.
  const span = useTween({ lo: field.lo, hi: field.hi })

  const bars = floored(
    cubes3D<Point3D>()
      .camera(camera)
      .data(fieldCorners(values, world, grid.at, size))
  ).sort((a, b) => sort(a.floor, b.floor))
  const marks = bars.flatMap((bar) =>
    barMarks({
      id: bar.key,
      faces: bar.faces,
      color: ramp(bar.value, [span.lo, span.hi], [low, high]),
      tooltip: fieldTooltip(bar, data, box.at, { format, titles, tooltip }),
      opacity: presence[bar.key],
    })
  )

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** Where a column and a row stand, in the values of the data. */
type Place = ReturnType<typeof gridBox>["at"]

/**
 * The value of every bar, keyed by its row and column so it follows its cell
 * through updates, with its presence, the size of the grid and the lowest
 * and highest value - built once per change of the data, not at every frame
 * the camera turns.
 */
function useField(data: number[][]) {
  return React.useMemo(() => {
    const target: Record<string, number> = Object.fromEntries(
      data.flatMap((row, r) => row.flatMap((v, c) => (finite(v) ? [[`${r}-${c}`, v]] : [])))
    )
    const [lo = 0, hi = 0] = extent(Object.values(target))
    return {
      target,
      present: Object.fromEntries(Object.keys(target).map((key) => [key, 1])),
      rows: data.length,
      columns: Math.max(0, ...data.map((row) => row.length)),
      lo,
      hi,
    }
  }, [data])
}

/**
 * The corners of every bar still on screen, from 0 to its gliding value, at
 * its row and column, `size` wide and deep.
 */
function fieldCorners(
  values: Record<string, number>,
  world: World,
  at: Place,
  size: { width: number; depth: number }
) {
  return Object.entries(values).map(([key, value]) => {
    const [row, column] = key.split("-").map(Number)
    const corners = barCorners(world, at.x(column), at.z(row), value, size)
    return Object.assign(corners, { key, row, column, value })
  })
}

/**
 * What a bar says on hover, made when the pointer lands on it: its x and z
 * as the ticks name them and its value as the ticks of y name it - or what
 * `tooltip` makes of that. A bar whose value has left the data says nothing.
 */
function fieldTooltip(
  { row, column }: { row: number; column: number },
  data: number[][],
  at: Place,
  {
    format = {},
    titles = {},
    tooltip = (tip) => tip,
  }: Pick<BarFieldChart3DProps, "format" | "titles" | "tooltip">
): Mark3D["tooltip"] {
  const value = data[row]?.[column]
  if (!finite(value)) return undefined
  const named = (key: keyof AxesSpec, v: number) => ({
    label: titles[key] ?? (key === "y" ? "value" : key),
    value: format[key]?.(v) ?? v,
  })
  const [x, z] = [at.x(column), at.z(row)]
  return () =>
    tooltip(
      { items: [named("x", x), named("z", z), named("y", value)] },
      { row, column, x, z, value }
    )
}
