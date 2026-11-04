"use client"

import * as React from "react"
import { extent } from "d3-array"
import {
  gridPlanes3D,
  sort,
  type AxesSpec,
  type GridPlane,
  type GridPlanes3DInstance,
  type Point3D,
} from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  center,
  intoWorld,
  linear,
  pad,
  shade,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
} from "@/registry/new-york/ui/chart-3d"

export type SurfaceChart3DProps = {
  /** The heights on the grid, `data[row][column]`. */
  data: number[][]
  /**
   * The data values the first and the last column (x) and row (z) stand for.
   * The chart keeps half a cell between the grid and the walls of its box; a
   * domain given here names the box exactly, without that room.
   * @defaultValue the indices of the columns and rows
   */
  domain?: { x?: [number, number]; z?: [number, number] }
  /**
   * The config keys of the colors at the lowest and at the highest height.
   * @defaultValue the first two keys of the chart config
   */
  colors?: [string, string]
  /** Formats the tick labels of each axis. */
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
}

/**
 * A surface over a grid: `data[row][column]` is the height, the columns run
 * along x and the rows along z. The fill ramps from the first color of
 * `colors` at the lowest height to the second at the highest; both are keys
 * of the chart config, by default its first two.
 */
export function SurfaceChart3D({ data, domain = {}, colors, format, titles }: SurfaceChart3DProps) {
  const { config, camera } = useChart3D()
  const [low, high = low] = colors ?? Object.keys(config)
  const [floor = 0, peak = 0] = extent(data.flat())
  const target = gridValues(data)
  // The heights glide cell by cell, so the surface, its color ramp and the y
  // axis follow. Coming and going is a fade in place - a new border cell
  // fades in where it belongs, a gone one fades out where it stands and
  // leaves when the glide is done - so the surface never moves where data
  // merely appears or disappears.
  const heights = gridHeights(useTween(target), floor)
  const fade = useTween(Object.fromEntries(Object.keys(target).map((k) => [k, 1])), 0)
  const rows = data.length
  const columns = data[0]?.length ?? 0
  const [x0, x1] = domain.x ?? [0, columns - 1]
  const [z0, z1] = domain.z ?? [0, rows - 1]
  // A cell of the grid, along x and along z, in the values the data stands for.
  const cell = {
    x: (x1 - x0) / Math.max(1, columns - 1),
    z: (z1 - z0) / Math.max(1, rows - 1),
  }
  // The color ramp follows the heights on screen, the axes glide to those of the data.
  const [lo = 0, hi = 0] = extent(heights.flat())

  // The box keeps half a cell beyond the grid; a domain the reader hands the
  // chart names the box exactly.
  const spec = useTweenAxes({
    x: domain.x ? axis(x0, x1) : pad(axis(x0, x1), cell.x),
    y: axis(floor, peak),
    z: domain.z ? axis(z0, z1) : pad(axis(z0, z1), cell.z),
  })
  const world = worldBox(spec)
  const toX = linear([0, columns - 1], [x0, x1])
  const toZ = linear([0, rows - 1], [z0, z1])

  const grid = intoWorld<GridPoint, GridPlanes3DInstance<GridPoint>>(
    gridPlanes3D<GridPoint>().camera(camera),
    world
  )
    // d3-3d reads rows(0) as the getter; a grid without columns has no points anyway.
    .rows(Math.max(1, heights[0]?.length ?? 0))
  const points = heights.flatMap((row, r) => row.map((y, c) => ({ x: toX(c), y, z: toZ(r), r, c })))

  const marks = grid
    .data(points)
    .sort(sort)
    .map((quad) => quadMark(quad, fade, { lo, hi, low, high }, titles?.y))

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** A point of the lattice, carrying the row and column it stands for. */
type GridPoint = Point3D & { r: number; c: number }

/**
 * The mark of one cell: its quad, shaded by the color ramp at its height and
 * faded in place by `fade` while the cell enters or leaves.
 */
function quadMark(
  quad: GridPlane<GridPoint>,
  fade: Record<string, number>,
  ramp: { lo: number; hi: number; low: string; high: string },
  title: React.ReactNode
) {
  const height = quad.reduce((sum, p) => sum + p.y, 0) / quad.length
  const t = Math.round(((height - ramp.lo) / (ramp.hi - ramp.lo || 1)) * 100)
  const shaded = shade(
    quad,
    `color-mix(in oklch, var(--color-${ramp.high}) ${t}%, var(--color-${ramp.low}))`
  )
  // A corner only one of the tweens still knows is on its way out and stays unseen.
  const seen = Math.min(...quad.map((p) => fade[`${p.r}-${p.c}`] ?? 0))
  return {
    key: quad.plane,
    points: quad.map((p) => p.projected),
    fill:
      seen < 1 ? `color-mix(in srgb, ${shaded} ${Math.round(seen * 100)}%, transparent)` : shaded,
    // Its group is the cell, so hovering it lights the cell alone.
    groups: [quad.plane],
    tooltip: { at: center(quad), items: [{ label: title ?? "value", value: height }] },
  }
}

/** The height of every cell, keyed by its row and column, gliding into new data. */
function gridValues(data: number[][]) {
  return Object.fromEntries(data.flatMap((row, r) => row.map((y, c) => [`${r}-${c}`, y])))
}

/**
 * The gliding heights as a lattice. It spans the cells still leaving too, so
 * a shrunken grid sinks away instead of popping; a corner only one dimension
 * kept stands at the floor until it goes.
 */
function gridHeights(tweened: Record<string, number>, floor: number) {
  let rows = 0
  let columns = 0
  for (const key of Object.keys(tweened)) {
    const [r, c] = key.split("-").map(Number)
    rows = Math.max(rows, r + 1)
    columns = Math.max(columns, c + 1)
  }
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => tweened[`${r}-${c}`] ?? floor)
  )
}
