"use client"
/* eslint-disable -- shortcut: the hooks here keep values in refs while rendering, which the rules of React's compiler forbid; move them into state after 1.0. */

import * as React from "react"
import { points3D, sort, type AxesSpec, type Point2D, type Point3D } from "d3-3d"

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
  type Mark3D,
  type Tooltip3D,
  type World,
  useTooltips,
} from "@/registry/new-york/ui/chart-3d"

export type ScatterChart3DProps<T extends object = Record<string, unknown>> = {
  /** One entry per point; one whose x, y or z is missing or not a number has none. */
  data: T[]
  /** The field of the position along x. */
  x: keyof T & string
  /** The field of the position along y, the height. */
  y: keyof T & string
  /** The field of the position along z. */
  z: keyof T & string
  /**
   * The field that identifies an entry, so a point follows its name through
   * updates: a new one grows, a gone one shrinks away, one that moves glides.
   * A name that repeats is, in the order of the data, a point of its own.
   * A name is its own within its series, and read as text: derive a field
   * for a key of several fields.
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
export function ScatterChart3D<T extends object>({
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
  const entryPoints = usePoints(all, x, y, z, id, series)
  const { fields, names, entries, axes, target, presence, key: at } = entryPoints
  // The positions glide entry by entry; a gone point stands in place.
  const values = useTween(target)
  const read = (name: string, axis: keyof AxesSpec) => values[at(axis, name)]
  const radii = usePointRadii(names, radius)
  const key = useConfigKeys(entries, series, Object.keys(config)[0], radii)
  const tips = useTooltips([all, x, y, z, id, series, config, format, titles, tooltip])

  // The axes of the data the chart glides into; their ends glide along.
  const spec = useTweenAxes(axes)
  const world = worldBox(spec)
  const placed = usePointPlaces(names, radii, read, world)

  const says = (name: string) =>
    tips(name, () =>
      pointTooltip(
        entries.get(name),
        series ? (config[key(name)]?.label ?? key(name)) : undefined,
        fields,
        { format, titles, tooltip }
      )
    )
  const points = points3D<{ name: string } & Point3D>()
    .camera(camera)
    .x((p) => p.x)
    .y((p) => p.y)
    .z((p) => p.z)
  const marks = points
    .data(placed)
    .sort(sort)
    .map((p) => {
      // Its own keys only: a point named "constructor" is no key every object has.
      const seen = Object.hasOwn(presence, p.name) ? presence[p.name] : 0
      return pointMark(p, radii[p.name], colorOf(key(p.name)), seen, says(p.name))
    })

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/**
 * The mark of a point: a circle of radius `r` in `color`, faded to its
 * presence and ringed by the background, so that points in front stand out.
 * Its group is the point alone, so hovering highlights that point only.
 */
function pointMark(
  p: { name: string; projected: Point2D },
  r: number,
  color: string,
  presence: number,
  tooltip: Mark3D["tooltip"]
): Mark3D {
  const [fill, stroke] = [faded(color, presence), faded("var(--background)", presence)]
  return {
    key: p.name,
    shape: "circle",
    points: [p.projected],
    r,
    fill,
    groups: [p.name],
    stroke,
    tooltip,
  }
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
