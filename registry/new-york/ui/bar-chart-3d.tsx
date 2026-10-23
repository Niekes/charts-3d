"use client"

import * as React from "react"
import { box, cubes3D, sort, type AxesSpec, type CubeFace } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  center,
  cubeMarks,
  useChart3D,
  worldBox,
  type World,
} from "@/registry/new-york/ui/chart-3d"

export type BarChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per row of bars, with a value per series. */
  data: T[]
  /** The field that names each entry, such as "month". */
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
  format = {},
  titles,
}: BarChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const series = keys ?? Object.keys(config)
  // A value that is not a number stands as no bar, one of height 0.
  const cells = data.flatMap((d, i) =>
    series.map((key, j) => ({ i, j, key, value: Number(d[key]) || 0 }))
  )

  const { spec, world, size } = barBox(
    data.length,
    series.length,
    cells.map((cell) => cell.value),
    barSize
  )
  const bars = cubes3D()
    .camera(camera)
    .data(
      cells.map(({ i, j, key, value }) =>
        Object.assign(barCorners(world, i, j, value, size), { i, key, value })
      )
    )
    .map((bar) => Object.assign(bar, { bottom: bar.faces.find((f) => f.face === "bottom")! }))
    // The bars stand on one floor, so they paint back to front by their footprint.
    .sort((a, b) => sort(a.bottom, b.bottom))

  return (
    <>
      <Axes3D
        spec={spec}
        world={world}
        titles={titles}
        format={{
          // The ticks along x are the indices of the entries.
          x: (i) => (format.x ?? String)(String(data[i][index] ?? "")),
          y: format.y,
          z: (j) => config[series[j]]?.label ?? series[j],
        }}
      />
      <Marks3D
        marks={bars.flatMap((bar) =>
          barMarks({
            id: `${bar.i}-${bar.key}`,
            faces: bar.faces,
            color: `var(--color-${bar.key})`,
            title: String(data[bar.i][index]),
            label: config[bar.key]?.label ?? bar.key,
            value: bar.value,
          })
        )}
      />
    </>
  )
}

/**
 * The box of a bar chart: a row per entry along x, a row per series along z,
 * and the size of a bar, the share `barSize` of its cell.
 */
function barBox(entries: number, series: number, values: number[], barSize: number) {
  const index = (length: number) => Array.from({ length }, (_, i) => i)
  const spec: AxesSpec = {
    x: { domain: [-0.5, entries - 0.5], ticks: index(entries) },
    y: axis(Math.min(0, ...values), Math.max(0, ...values)),
    z: { domain: [-0.5, series - 0.5], ticks: index(series) },
  }
  // A shallow box for few series, so the bars stay square.
  const depth = Math.min(1, Math.max(0.25, series / entries))
  const size = { width: (2 / entries) * barSize, depth: ((2 * depth) / series) * barSize }
  return { spec, world: worldBox(spec, depth), size }
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

/** The marks of one bar: the faces that look at the camera, shaded, each with its entry and value on hover. */
function barMarks({
  id,
  faces,
  color,
  title,
  label,
  value,
}: {
  id: string
  faces: CubeFace[]
  color: string
  title: string
  label: React.ReactNode
  value: number
}) {
  const tooltip = {
    at: center(faces.find((face) => face.face === "top")!),
    title,
    items: [{ label, value, color }],
  }
  return cubeMarks(id, faces, color, tooltip)
}
