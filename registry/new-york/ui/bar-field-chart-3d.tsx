"use client"

import * as React from "react"
import { extent, max } from "d3-array"
import { cubes3D, sort, type AxesSpec, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  barCorners,
  barMarks,
  finite,
  floored,
  gridAxis,
  ramp,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  type Mark3D,
  type Tooltip3D,
  type World,
  useTooltips,
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
   * The data values the first and the last column (x) and row (z) stand for,
   * the others evenly between. The chart keeps half a cell between the bars
   * and the walls of its box, with `domain`, `x` and `z` too: a bar has a
   * width, and the room keeps the outer bars inside the box. The surface,
   * whose points have none, spans named places exactly.
   * @defaultValue the indices of the columns and rows
   */
  domain?: { x?: [number, number]; z?: [number, number] }
  /**
   * The value every column stands at along x, `x[column]`, in any order and
   * at any spacing, in place of `domain.x`. A column without a finite value
   * draws no bars.
   * @defaultValue evenly over `domain.x`
   */
  x?: number[]
  /**
   * The value every row stands at along z, `z[row]`, in any order and at any
   * spacing, in place of `domain.z`. A row without a finite value draws no
   * bars.
   * @defaultValue evenly over `domain.z`
   */
  z?: number[]
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
 * the data - its place from the value of its column and row, its footprint
 * from the smallest gap between two of them, its height from its value, its
 * color from the ramp between the two `colors` at the lowest and the highest
 * value.
 */
export function BarFieldChart3D({
  data,
  domain = {},
  x,
  z,
  tooltip,
  format,
  titles,
  colors,
}: BarFieldChart3DProps) {
  const { config, camera } = useChart3D()
  const [low, high = low] = colors ?? Object.keys(config)
  const field = useField(data, { domain, x, z })
  const tips = useTooltips([field, format, titles, tooltip])
  // A bar glides to its new value; a new one grows from 0 as it fades in, a
  // gone one shrinks back to 0 as it fades out and leaves when the glide is done.
  const values = useTween(field.target, 0)
  const presence = useTween(field.present, 0)
  // y runs from 0; x and z span the places with half a cell of room.
  const y = axis(Math.min(0, field.lo), Math.max(0, field.hi))
  const spec = useTweenAxes({ x: field.x.spec, y, z: field.z.spec })
  const world = worldBox(spec)
  // Every column and row glides to its place, and the footprint with the cell.
  const places = { x: useTween(field.x.places), z: useTween(field.z.places) }
  const cell = useTween({ x: field.x.cell, z: field.z.cell })
  const size = {
    width: Math.abs(world.x(cell.x) - world.x(0)) * BAR,
    depth: Math.abs(world.z(cell.z) - world.z(0)) * BAR,
  }
  // The ramp glides with the data, not with the bars on screen: one growing
  // from 0 or shrinking to it must not recolor the others.
  const span = useTween({ lo: field.lo, hi: field.hi })

  const cubes = cubes3D<Point3D>().camera(camera)
  const bars = floored(cubes.data(fieldCorners(values, world, places, size)), cubes).sort((a, b) =>
    sort(a.floor, b.floor)
  )
  const marks = bars.flatMap((bar) =>
    barMarks({
      id: bar.key,
      faces: bar.faces,
      color: ramp(bar.value, [span.lo, span.hi], [low, high]),
      tooltip: tips(bar.key, () => fieldTooltip(bar, field, { format, titles, tooltip })),
      opacity: presence[bar.key] ?? 0,
    })
  )

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** The value every column (x) and row (z) stands at, keyed by its index. */
type Place = Record<"x" | "z", Record<string, number>>

/**
 * The value of every bar, keyed by its row and column so it follows its cell
 * through updates, with its presence, the lowest and highest value and the
 * places of the columns and rows - built once per change of the data, not at
 * every frame the camera turns. A bar draws where its value and both its
 * places are finite numbers.
 */
function useField(
  data: number[][],
  {
    domain,
    x,
    z,
  }: Pick<BarFieldChart3DProps, "x" | "z"> & { domain: NonNullable<BarFieldChart3DProps["domain"]> }
) {
  return React.useMemo(() => {
    const columns = max(data, (row) => row.length) ?? 0
    const sides = {
      x: gridAxis(columns, { at: x, ends: domain.x }),
      z: gridAxis(data.length, { at: z, ends: domain.z }),
    }
    const target: Record<string, number> = Object.fromEntries(
      data.flatMap((row, r) =>
        row.flatMap((v, c) =>
          // A number given as text, as parsed CSV has it, is that number.
          finite(v) && c in sides.x.places && r in sides.z.places ? [[`${r}-${c}`, Number(v)]] : []
        )
      )
    )
    const [lo = 0, hi = 0] = extent(Object.values(target))
    return {
      ...sides,
      target,
      present: Object.fromEntries(Object.keys(target).map((key) => [key, 1])),
      lo,
      hi,
    }
  }, [data, x, z, domain.x, domain.z])
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
  return Object.entries(values).flatMap(([key, value]) => {
    const [row, column] = key.split("-").map(Number)
    // A bar whose column or row is gone has no place, and NaN corners would upset the sort.
    if (!(column in at.x && row in at.z)) return []
    const corners = barCorners(world, at.x[column], at.z[row], value, size)
    return [Object.assign(corners, { key, row, column, value })]
  })
}

/**
 * What a bar says on hover, made when the pointer lands on it: its x and z
 * as the ticks name them and its value as the ticks of y name it - or what
 * `tooltip` makes of that. A bar that has left the data, its value or its
 * place, says nothing.
 */
function fieldTooltip(
  { key, row, column }: { key: string; row: number; column: number },
  { target, x: xs, z: zs }: ReturnType<typeof useField>,
  {
    format = {},
    titles = {},
    tooltip = (tip) => tip,
  }: Pick<BarFieldChart3DProps, "format" | "titles" | "tooltip">
): Mark3D["tooltip"] {
  if (!(key in target)) return undefined
  const value = target[key]
  const named = (name: keyof AxesSpec, v: number) => ({
    label: titles[name] ?? (name === "y" ? "value" : name),
    value: format[name]?.(v) ?? v,
  })
  const [x, z] = [xs.places[column], zs.places[row]]
  return () =>
    tooltip(
      { items: [named("x", x), named("z", z), named("y", value)] },
      { row, column, x, z, value }
    )
}
