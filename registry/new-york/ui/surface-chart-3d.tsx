"use client"

import * as React from "react"
import { extent } from "d3-array"
import { gridPlanes3D, sort, type AxesSpec, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  center,
  linear,
  shade,
  useChart3D,
  useTween,
  worldBox,
} from "@/registry/new-york/ui/chart-3d"

export type SurfaceChart3DProps = {
  /** The heights on the grid, `data[row][column]`. */
  data: number[][]
  /**
   * The data values the first and the last column (x) and row (z) stand for.
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
  // The heights glide cell by cell, so the surface, its color ramp and the y axis follow.
  const tweened = useTween(gridValues(data))
  const heights = data.map((row, r) => row.map((_, c) => tweened[`${r}-${c}`]))
  const rows = data.length
  const columns = data[0]?.length ?? 0
  const [x0, x1] = domain.x ?? [0, columns - 1]
  const [z0, z1] = domain.z ?? [0, rows - 1]
  const [lo = 0, hi = 0] = extent(heights.flat())

  const spec: AxesSpec = { x: axis(x0, x1), y: axis(lo, hi), z: axis(z0, z1) }
  const world = worldBox(spec)
  const toX = linear([0, columns - 1], [x0, x1])
  const toZ = linear([0, rows - 1], [z0, z1])

  const grid = gridPlanes3D<Point3D>()
    .camera(camera)
    // d3-3d reads rows(0) as the getter; a grid without columns has no points anyway.
    .rows(Math.max(1, columns))
    .x((p) => world.x(p.x))
    .y((p) => world.y(p.y))
    .z((p) => world.z(p.z))
  const points = heights.flatMap((row, r) => row.map((y, c) => ({ x: toX(c), y, z: toZ(r) })))

  const marks = grid
    .data(points)
    .sort(sort)
    .map((quad) => {
      const height = quad.reduce((sum, p) => sum + p.y, 0) / quad.length
      const t = Math.round(((height - lo) / (hi - lo || 1)) * 100)
      return {
        key: quad.plane,
        points: quad.map((p) => p.projected),
        fill: shade(quad, `color-mix(in oklch, var(--color-${high}) ${t}%, var(--color-${low}))`),
        tooltip: { at: center(quad), items: [{ label: titles?.y ?? "value", value: height }] },
      }
    })

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** The height of every cell, keyed by its row and column, gliding into new data. */
function gridValues(data: number[][]) {
  return Object.fromEntries(data.flatMap((row, r) => row.map((y, c) => [`${r}-${c}`, y])))
}
