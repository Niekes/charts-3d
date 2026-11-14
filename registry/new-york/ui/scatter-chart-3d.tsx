"use client"

import * as React from "react"
import { extent } from "d3-array"
import { points3D, sort, type AxesSpec, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  faded,
  finite,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  colorOf,
  type ChartConfig,
  type Mark3D,
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
   * The names should be unique.
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
  const { fields, data, names, entries, values, axes } = usePoints(all, x, y, z, id)
  const { radii, opacity, read, key } = usePointTweens(names, data, values, series, config, radius)

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
 * What a point says on hover, made when the pointer lands on it: its series,
 * where `title` names one, and its x, y and z as the ticks of each axis name
 * them - or what `tooltip` makes of that. A point whose entry has left the
 * data says nothing.
 */
function pointTooltip<T extends Record<string, unknown>>(
  entry: T | undefined,
  title: React.ReactNode,
  fields: Record<keyof AxesSpec, keyof T & string>,
  {
    format = {},
    titles = {},
    tooltip = (tip) => tip,
  }: Pick<ScatterChart3DProps<T>, "format" | "titles" | "tooltip">
): Mark3D["tooltip"] {
  if (!entry) return undefined
  return () =>
    tooltip(
      {
        title,
        items: (["x", "y", "z"] as const).map((a) => {
          const value = Number(entry[fields[a]])
          return { label: titles[a] ?? fields[a], value: format[a]?.(value) ?? value }
        }),
      },
      { entry }
    )
}

/**
 * The entries with a place in the box, their names, the entry behind each
 * name, their positions and the axes that hold them - built once per change
 * of the data, not at every frame the camera turns.
 */
function usePoints<T extends Record<string, unknown>>(
  all: T[],
  x: keyof T & string,
  y: keyof T & string,
  z: keyof T & string,
  id: (keyof T & string) | undefined
) {
  return React.useMemo(() => {
    const fields = { x, y, z }
    // An entry without a place in the box has no point.
    const data = all.filter((d) => [x, y, z].every((f) => finite(d[f])))
    const names = data.map((d, i) => (id ? String(d[id]) : String(i)))
    return {
      fields,
      data,
      names,
      entries: new Map(names.map((name, i) => [name, data[i]])),
      values: pointValues(names, data, fields),
      axes: pointAxes(data, fields),
    }
  }, [all, x, y, z, id])
}

/** The axes that hold every entry of `data`, a nice one per field. */
function pointAxes<T extends Record<string, unknown>>(
  data: T[],
  fields: Record<keyof AxesSpec, keyof T & string>
): AxesSpec {
  const range = (a: keyof AxesSpec) => {
    const [lo = 0, hi = 0] = extent(data, (d) => Number(d[fields[a]]))
    return axis(lo, hi)
  }
  return { x: range("x"), y: range("y"), z: range("z") }
}

/**
 * The tweened numbers of the chart, by the name of each entry: the positions
 * glide entry by entry - a gone point stands in place - and the radius and
 * the opacity enter from 0, so a new point grows as it fades in and a gone
 * one shrinks as it fades away. `read` and `key` look them up, also for a
 * point still leaving.
 */
function usePointTweens<T extends Record<string, unknown>>(
  names: string[],
  data: T[],
  target: Record<string, number>,
  series: (keyof T & string) | undefined,
  config: ChartConfig,
  radius: number
) {
  const values = useTween(target)
  const sizes = React.useMemo(
    () => Object.fromEntries(names.map((name) => [name, radius])),
    [names, radius]
  )
  const radii = useTween(sizes, 0)
  const present = React.useMemo(() => Object.fromEntries(names.map((name) => [name, 1])), [names])
  const opacity = useTween(present, 0)
  const fallback = Object.keys(config)[0]
  return {
    radii,
    opacity,
    read: (name: string, axis: keyof AxesSpec) => values[`${axis}${name}`],
    key: usePointKeys(names, data, series, fallback, radii),
  }
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

/** The position of every entry, keyed by its axis and name, gliding into new data. */
function pointValues<T extends Record<string, unknown>>(
  names: string[],
  data: T[],
  fields: Record<keyof AxesSpec, keyof T & string>
) {
  return Object.fromEntries(
    data.flatMap((d, i) =>
      (["x", "y", "z"] as const).map((a) => [`${a}${names[i]}`, Number(d[fields[a]])])
    )
  )
}

/**
 * The config key of every point's color, by name - remembered while a gone
 * point shrinks away, since its entry has already left the data - and
 * forgotten with the point, so the memory stays the size of the chart.
 */
function usePointKeys<T extends Record<string, unknown>>(
  names: string[],
  data: T[],
  series: (keyof T & string) | undefined,
  fallback: string,
  alive: Record<string, number>
) {
  const known = React.useRef(new Map<string, string>())
  data.forEach((d, i) => known.current.set(names[i], series ? String(d[series]) : fallback))
  for (const name of known.current.keys()) {
    if (!(name in alive) && !names.includes(name)) known.current.delete(name)
  }
  return (name: string) => known.current.get(name) ?? fallback
}
