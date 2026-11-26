"use client"

import * as React from "react"
import { extent } from "d3-array"
import { cubes3D, sort, type AxesSpec, type Camera3DInstance } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  barCorners,
  barMarks,
  floored,
  pad,
  useSeries,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  colorOf,
  finite,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
  type World,
  joined,
  entryTicks,
  useTooltips,
} from "@/registry/new-york/ui/chart-3d"

// An entry is any object: `object`, not `Record<string, unknown>`, lets one
// declared as an interface in, which has no index signature.
export type BarChart3DProps<T extends object = Record<string, unknown>> = {
  /** One entry per row of bars, with a value per series. */
  data: T[]
  /** The field of the category of an entry along x, such as "month": it names the entry on the axis and in the tooltip, and a bar follows its name through updates. An entry of a name that repeats is, in the order of the data, a bar of its own. */
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
  /**
   * The name of the stack of a key: keys of the same name stand on one
   * another in one row along z, in the order of `keys` - those above 0
   * upward from the floor, those below 0 downward from it - and the axis
   * names the row by the stack. A key of no stack is a row of its own.
   * @defaultValue every key its own row
   */
  stack?: Record<string, string>
  /** Formats the labels of the entries along x and the values along y. */
  format?: { x?: (label: string) => React.ReactNode; y?: (value: number) => React.ReactNode }
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * What a bar says on hover: `tooltip` is what it would say, its entry and
   * value as the ticks name them, `data` the entry and the series key behind
   * it; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T; key: string }) => Tooltip3D | null
}

/**
 * Bars on a floor: one row per entry of `data` along x, one per series
 * along z, the value as the height. The series are the keys of the chart
 * config unless `keys` names them.
 */
export function BarChart3D<T extends object>({
  data,
  index,
  keys,
  barSize = 0.6,
  stack,
  format,
  titles,
  tooltip,
}: BarChart3DProps<T>) {
  const { config, camera } = useChart3D()
  // A value that is not a number is no bar, as in the bar field: one that goes
  // shrinks back into the floor and fades as it does, and fades in as it grows
  // back; a new one grows from the floor. The rows glide to their new cells when
  // the data reorders; a gone row stands in its cell while its bars shrink and
  // fade away, so a flat bar never pops.
  const {
    series,
    stacks,
    target,
    filled,
    entries,
    values,
    rows,
    presence,
    lanes,
    lanePresence,
    labels,
    nameOf,
  } = useSeries({
    data,
    index,
    keys,
    format,
    stack,
  })
  const fill = useTween(filled, 0)
  const base = useStackBases({ values, target, stacks, series, lanes })
  const cells = barCells(rows, lanes, values, base.drawn).filter((cell) =>
    Object.hasOwn(fill, joined(cell.name, cell.key))
  )
  const tips = useTooltips([data, index, keys, config, format, tooltip])

  // A stack reaches from the floor to the ends of its bars.
  const ends = [...entries.keys()].flatMap((name) =>
    series.map((key) => base.data(name, key) + target[joined(name, key)])
  )
  const box = barBox(data.length, stacks.length, ends)
  // Every axis glides with the bars: the value ends with the heights, the row
  // and series ends - and the depth of the box - as rows come and go. The
  // size of a bar comes from the gliding ends, so it eases with its cell.
  const spec = useTweenAxes(box.spec)
  const depth = useTween({ depth: box.depth }).depth
  const world = worldBox(spec, depth)
  const bars = barShapes(camera, cells, world, cellSize(spec, depth, barSize))

  return (
    <>
      <Axes3D spec={spec} world={world} titles={titles} format={labels} />
      <Marks3D
        marks={bars.flatMap((bar) =>
          barMarks({
            id: joined(bar.name, bar.key),
            faces: bar.faces,
            color: colorOf(bar.key),
            // A series turned off says nothing, as an entry that left.
            tooltip: tips(joined(bar.name, bar.key), () =>
              barTooltip(
                { id: bar.name, name: nameOf(bar.name), key: bar.key },
                series.includes(bar.key) ? entries.get(bar.name) : undefined,
                target,
                { config, format, tooltip }
              )
            ),
            opacity:
              (presence[bar.name] ?? 0) *
              (lanePresence[bar.key] ?? 0) *
              (fill[joined(bar.name, bar.key)] ?? 0),
          })
        )}
      />
    </>
  )
}

/** The cubes of the cells, projected by `camera` and painted back to front by their footprint, as the bars stand on one floor. */
function barShapes(
  camera: Camera3DInstance,
  cells: ReturnType<typeof barCells>,
  world: World,
  size: { width: number; depth: number }
) {
  const cubes = cubes3D().camera(camera)
  // How high the eye stands; where it is infinitely far, only the side it looks from counts.
  const eye = cubes.perspective() * cubes.viewDirection().y || 0
  const height = Math.max(-FAR, Math.min(FAR, eye))
  return floored(
    cubes.data(
      cells.map(({ name, x, j, key, value, base }) =>
        Object.assign(barCorners(world, x, j, value, size, base), {
          name,
          j,
          key,
          value,
          span: [world.y(base), world.y(base + value)],
        })
      )
    ),
    cubes
  ).sort((a, b) => sort(a.floor, b.floor) || stackOrder(a, b, height))
}

// Further than any bar stands from the box, which spans -1 to 1.
const FAR = 1e6

/**
 * The order of two bars of one stack, on one footprint: a flat one first, as
 * it lies on the face of another, then the one further from the height of the
 * eye, which sees the nearer one over it. Bars of two footprints that stand
 * equally near keep the order of the data.
 */
function stackOrder(
  a: { name: string; j: number; value: number; span: number[] },
  b: typeof a,
  eye: number
) {
  if (a.name !== b.name || a.j !== b.j) return 0
  if ((a.value === 0) !== (b.value === 0)) return a.value === 0 ? -1 : 1
  const away = ({ span }: typeof a) => Math.max(Math.min(...span) - eye, eye - Math.max(...span), 0)
  return away(b) - away(a)
}

/**
 * The cell of every bar, the rows and the series still gliding away among
 * them: the row position along x, the place `j` of the series `key` along z,
 * with the tweened value and where it starts in its stack. A cell only one of
 * the tweens still knows is on its
 * way out and stays unseen.
 */
function barCells(
  rows: Record<string, number>,
  lanes: Record<string, number>,
  values: Record<string, number>,
  baseOf: (name: string, key: string) => number
) {
  return Object.entries(rows).flatMap(([name, x]) =>
    Object.entries(lanes).flatMap(([key, j]) => {
      const value = values[joined(name, key)]
      return value === undefined ? [] : [{ name, x, j, key, value, base: baseOf(name, key) }]
    })
  )
}

/**
 * Where every bar starts: `drawn` from the values on screen, so a stack never
 * parts while its values glide, and `data` from the values of the data, which
 * the box spans. Which bar stands on which glides too, from 0 to 1: a key that
 * moves into or out of a stack rises or sinks there, where one that comes or
 * goes keeps its place, and the bars over it ride on it as it grows or shrinks.
 */
function useStackBases({
  values,
  target,
  stacks,
  series,
  lanes,
}: {
  values: Record<string, number>
  target: Record<string, number>
  stacks: string[][]
  series: string[]
  lanes: Record<string, number>
}) {
  const pairs = React.useMemo(
    () =>
      Object.fromEntries(
        stacks.flatMap((keys) =>
          keys.flatMap((above, i) => keys.slice(0, i).map((below) => [joined(below, above), 1]))
        )
      ),
    [stacks]
  )
  // `lanes` are still those on screen when new keys arrive: a key in them and in `series` stays.
  const stays = (key: string) => series.includes(key) && Object.hasOwn(lanes, key)
  const shares = useTween(pairs, (pair) => (parts(pair).every(stays) ? 0 : undefined))
  return { drawn: basesFrom(values, shares), data: basesFrom(target, pairs) }
}

/**
 * Where every bar of `values` starts: on the bars under it in its stack with a
 * value of its sign, each as far as its share in `shares` - those above 0
 * upward from the floor, those below 0 downward from it.
 */
function basesFrom(values: Record<string, number>, shares: Record<string, number>) {
  const under = new Map<string, [string, number][]>()
  for (const [pair, share] of Object.entries(shares)) {
    const [below, above] = parts(pair)
    under.set(above, [...(under.get(above) ?? []), [below, share]])
  }
  return (name: string, key: string) => {
    const own = values[joined(name, key)]
    return (under.get(key) ?? []).reduce((base, [below, share]) => {
      // An entry that comes while a key leaves has no value of it: it lifts nothing.
      const value = values[joined(name, below)] ?? 0
      return value < 0 === own < 0 ? base + share * value : base
    }, 0)
  }
}

/** The parts of a key that `joined` made. */
const parts = (key: string) => key.split("\u0001")

/**
 * The box of a bar chart: a row per entry along x, a row per series along z,
 * with half a cell of room between the outer rows and the walls.
 */
function barBox(entries: number, series: number, values: number[]) {
  const index = (length: number) => Array.from({ length }, (_, i) => i)
  // extent, not a spread: thousands of arguments overflow the stack.
  const [lo = 0, hi = 0] = extent(values)
  const spec: AxesSpec = {
    // About ten ticks, not one per bar: a year of days lays out ten labels, not 365.
    x: pad({ domain: [-0.5, entries - 0.5], ticks: entryTicks(entries) }, 1),
    y: axis(Math.min(0, lo), Math.max(0, hi)),
    z: pad({ domain: [-0.5, series - 0.5], ticks: index(series) }, 1),
  }
  // A shallow box for few series, so the bars stay square.
  // An empty chart has no entries to divide by.
  const depth = Math.min(1, Math.max(0.25, series / (entries || 1)))
  return { spec, depth }
}

/**
 * The size of a bar, the share `barSize` of its cell - of the gliding ends of
 * `spec`, so a bar eases into a new cell size as rows come and go.
 */
function cellSize(spec: AxesSpec, depth: number, barSize: number) {
  return {
    width: (2 / (spec.x.domain[1] - spec.x.domain[0])) * barSize,
    depth: ((2 * depth) / (spec.z.domain[1] - spec.z.domain[0])) * barSize,
  }
}

/**
 * What the bar of `entry` says on hover, made when the pointer lands on it:
 * the entry as the ticks of x name it and its value as the ticks of y name
 * it - or what `tooltip` makes of that. A bar whose entry has left the data
 * says nothing, and so does one whose value has: either is on its way out.
 */
function barTooltip<T extends object>(
  { id, name, key }: { id: string; name: string; key: string },
  entry: T | undefined,
  target: Record<string, number>,
  {
    config,
    format = {},
    tooltip = (tip) => tip,
  }: Pick<BarChart3DProps<T>, "format" | "tooltip"> & { config: ChartConfig }
): Mark3D["tooltip"] {
  if (!entry || !finite((entry as Record<string, unknown>)[key])) return undefined
  const value = target[joined(id, key)]
  return () =>
    tooltip(
      {
        title: (format.x ?? String)(name),
        items: [
          {
            label: config[key]?.label ?? key,
            value: format.y?.(value) ?? value,
            color: colorOf(key),
          },
        ],
      },
      { entry, key }
    )
}
