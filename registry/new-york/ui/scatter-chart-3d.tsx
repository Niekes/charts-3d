"use client"

import * as React from "react"
import { extent } from "d3-array"
import { points3D, sort, type AxesSpec } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  useChart3D,
  useTween,
  worldBox,
} from "@/registry/new-york/ui/chart-3d"

export type ScatterChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per point. */
  data: T[]
  /** The field of the position along x. */
  x: keyof T & string
  /** The field of the position along y, the height. */
  y: keyof T & string
  /** The field of the position along z. */
  z: keyof T & string
  /**
   * The field whose value is the config key of the color of a point.
   * @defaultValue the first key of the chart config for every point
   */
  series?: keyof T & string
  /**
   * The radius of a point in the units of the view box.
   * @defaultValue 4
   */
  radius?: number
  /** Formats the tick labels of each axis. */
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
}

/**
 * Points in the chart box, at the fields `x`, `y` and `z` of each entry.
 * `series` names the field whose value is the config key of the color.
 */
export function ScatterChart3D<T extends Record<string, unknown>>({
  data,
  x,
  y,
  z,
  series,
  radius = 4,
  format,
  titles,
}: ScatterChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const fields = { x, y, z }
  // The positions glide entry by entry, so the points, the axes and the tooltips follow.
  const values = useTween(pointValues(data, fields))
  const read = (i: number, axis: keyof AxesSpec) => values[`${axis}${i}`]

  const range = (a: keyof AxesSpec) => {
    const [lo = 0, hi = 0] = extent(data, (_, i) => read(i, a))
    return axis(lo, hi)
  }
  const spec: AxesSpec = { x: range("x"), y: range("y"), z: range("z") }
  const world = worldBox(spec)

  const points = points3D<{ d: T; i: number }>()
    .camera(camera)
    .x(({ i }) => world.x(read(i, "x")))
    .y(({ i }) => world.y(read(i, "y")))
    .z(({ i }) => world.z(read(i, "z")))
  const fallback = Object.keys(config)[0]

  const marks = points
    .data(data.map((d, i) => ({ d, i })))
    .sort(sort)
    .map((p) => {
      const key = series ? String(p.d[series]) : fallback
      return {
        key: String(p.i),
        points: [p.projected],
        r: radius,
        fill: `var(--color-${key})`,
        // Ringed by the background, so that points in front stand out.
        stroke: "var(--background)",
        tooltip: {
          at: p.projected,
          title: series ? (config[key]?.label ?? key) : undefined,
          items: (["x", "y", "z"] as const).map((a) => ({
            label: titles?.[a] ?? fields[a],
            value: read(p.i, a),
          })),
        },
      }
    })

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** The position of every entry, keyed by its axis and index, gliding into new data. */
function pointValues<T extends Record<string, unknown>>(
  data: T[],
  fields: Record<keyof AxesSpec, keyof T & string>
) {
  return Object.fromEntries(
    data.flatMap((d, i) =>
      (["x", "y", "z"] as const).map((a) => [`${a}${i}`, Number(d[fields[a]])])
    )
  )
}
