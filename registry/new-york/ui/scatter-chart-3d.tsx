"use client"

import * as React from "react"
import { extent } from "d3-array"
import { points3D, sort, type AxesSpec, type Point2D } from "d3-3d"

import { Axes3D, axis, useChart3D, worldBox, type Tooltip3D } from "@/registry/new-york/ui/chart-3d"

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
  const read = (d: T, axis: keyof AxesSpec) => Number(d[fields[axis]])

  const range = (a: keyof AxesSpec) => {
    const [lo = 0, hi = 0] = extent(data, (d) => read(d, a))
    return axis(lo, hi)
  }
  const spec: AxesSpec = { x: range("x"), y: range("y"), z: range("z") }
  const world = worldBox(spec)

  const points = points3D<{ d: T; i: number }>()
    .camera(camera)
    .x(({ d }) => world.x(read(d, "x")))
    .y(({ d }) => world.y(read(d, "y")))
    .z(({ d }) => world.z(read(d, "z")))
  const fallback = Object.keys(config)[0]

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      {points
        .data(data.map((d, i) => ({ d, i })))
        .sort(sort)
        .map((p) => {
          const key = series ? String(p.d[series]) : fallback
          return (
            <ScatterPoint
              key={p.i}
              at={p.projected}
              radius={radius}
              color={`var(--color-${key})`}
              tooltip={{
                at: p.projected,
                title: series ? (config[key]?.label ?? key) : undefined,
                items: (["x", "y", "z"] as const).map((a) => ({
                  label: titles?.[a] ?? fields[a],
                  value: read(p.d, a),
                })),
              }}
            />
          )
        })}
    </>
  )
}

/** One point, ringed by the background so that points in front stand out, and its tooltip. */
function ScatterPoint({
  at,
  radius,
  color,
  tooltip,
}: {
  at: Point2D
  radius: number
  color: string
  tooltip: Tooltip3D
}) {
  const { setTooltip } = useChart3D()

  return (
    <circle
      cx={at.x}
      cy={at.y}
      r={radius}
      fill={color}
      className="stroke-background"
      strokeWidth={1}
      onPointerEnter={() => setTooltip(tooltip)}
      onPointerLeave={() => setTooltip(null)}
    />
  )
}
