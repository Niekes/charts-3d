"use client"

import * as React from "react"
import { points3D, sort, type AxesSpec, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  faded,
  pointTooltip,
  useChart3D,
  useConfigKeys,
  usePoints,
  useTween,
  useTweenAxes,
  worldBox,
  colorOf,
  type Tooltip3D,
  type World,
} from "@/registry/new-york/ui/chart-3d"

export type ScatterChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per point; one whose x, y or z is missing or not a number has none. */
  data: T[]
  /** The field of the position along x. */
  x: keyof T & string
  /** The field of the position along y, the height. */
  y: keyof T & string
  /** The field of the position along z. */
  z: keyof T & string
  /**
   * The field that names an entry, so a point follows its name through
   * updates: a new one grows, a gone one shrinks away, one that moves glides.
   * A name that repeats is, in the order of the data, a point of its own.
   * @defaultValue the position of the entry
   */
  id?: keyof T & string
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
  /**
   * What a point says on hover: `tooltip` is what it would say, its series
   * and its x, y and z as the ticks name them, `data` the entry behind it;
   * `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

/**
 * Points in the chart box, at the fields `x`, `y` and `z` of each entry.
 * `series` names the field whose value is the config key of the color.
 */
export function ScatterChart3D<T extends Record<string, unknown>>({
  data: all,
  x,
  y,
  z,
  id,
  series,
  radius = 4,
  format,
  titles,
  tooltip,
}: ScatterChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const { fields, names, entries, axes, presence: opacity, read } = usePoints(all, x, y, z, id)
  const radii = usePointRadii(names, radius)
  const key = useConfigKeys(entries, series, Object.keys(config)[0], radii)

  // The axes of the data the chart glides into; their ends glide along.
  const spec = useTweenAxes(axes)
  const world = worldBox(spec)
  const placed = usePointPlaces(names, radii, read, world)

  const points = points3D<{ name: string } & Point3D>()
    .camera(camera)
    .x((p) => p.x)
    .y((p) => p.y)
    .z((p) => p.z)

  const marks = points
    .data(placed)
    .sort(sort)
    .map((p) => ({
      key: p.name,
      points: [p.projected],
      r: radii[p.name],
      fill: faded(colorOf(key(p.name)), opacity[p.name]),
      // Its group is the point alone, so hovering highlights that point only.
      groups: [p.name],
      // Ringed by the background, so that points in front stand out.
      stroke: faded("var(--background)", opacity[p.name]),
      tooltip: pointTooltip(
        entries.get(p.name),
        series ? (config[key(p.name)]?.label ?? key(p.name)) : undefined,
        fields,
        { format, titles, tooltip }
      ),
    }))

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/**
 * The radius of every point, by name, entering from 0, so a new point grows
 * as it fades in and a gone one shrinks as it fades away.
 */
function usePointRadii(names: string[], radius: number) {
  const sizes = React.useMemo(
    () => Object.fromEntries(names.map((name) => [name, radius])),
    [names, radius]
  )
  return useTween(sizes, 0)
}

/**
 * The place of every point in the world box, by name. A living point follows
 * its gliding numbers through the gliding axes; a gone one stays frozen where
 * it was, so it shrinks away in place instead of riding the rescaling axes
 * out of the box. A point only one of the tweens still knows stays unseen.
 */
function usePointPlaces(
  names: string[],
  alive: Record<string, number>,
  read: (name: string, axis: keyof AxesSpec) => number,
  world: World
) {
  const places = React.useRef(new Map<string, Point3D>())
  const live = new Set(names)
  const placed = Object.keys(alive).flatMap((name) => {
    if (!live.has(name)) {
      const held = places.current.get(name)
      return held ? [{ name, ...held }] : []
    }
    const p = {
      x: world.x(read(name, "x")),
      y: world.y(read(name, "y")),
      z: world.z(read(name, "z")),
    }
    places.current.set(name, p)
    return [{ name, ...p }]
  })
  // Forgotten with the point, so the memory stays the size of the chart.
  for (const name of places.current.keys()) if (!(name in alive)) places.current.delete(name)
  return placed
}
