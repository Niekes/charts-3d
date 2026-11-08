"use client"

import * as React from "react"
import { range, ticks } from "d3-array"
import {
  polygons3D,
  sort,
  type AxesSpec,
  type Point3D,
  type Polygon,
  type Polygons3DInstance,
} from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  intoWorld,
  pad,
  useSeries,
  shade,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

export type AreaChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per point along x, with a value per series. */
  data: T[]
  /** The field that names each entry, such as "year"; a point follows its name through updates, so the names should be unique. */
  index: keyof T & string
  /**
   * The fields that hold the series, one ribbon each.
   * @defaultValue the keys of the chart config
   */
  keys?: string[]
  /** Formats the labels of the entries along x and the values along y. */
  format?: { x?: (label: string) => React.ReactNode; y?: (value: number) => React.ReactNode }
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * What a face of a ribbon says on hover: `tooltip` is what it would say,
   * its series and, on a segment of the top, the two entries it spans with
   * their values as the ticks name them; `data` the series key and those
   * entries, none on a side; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { key: string; entries: T[] }) => Tooltip3D | null
}

// The share of its row along z a ribbon covers.
const RIBBON = 2 / 3

/**
 * Areas pushed back into ribbons: the entries of `data` along x, one ribbon
 * per series along z, the area under its line reaching down to the floor of
 * the box. The series are the keys of the chart config unless `keys` names
 * them.
 */
export function AreaChart3D<T extends Record<string, unknown>>({
  data,
  index,
  keys,
  format = {},
  titles,
  tooltip,
}: AreaChart3DProps<T>) {
  const { config, camera } = useChart3D()
  // The rows glide to their new places, and an entry that comes or goes
  // unfolds from its neighbour as far as its presence.
  const { series, target, entries, values, rows, presence, labels } = useSeries({
    data,
    index,
    keys,
    format,
  })
  const spec = useTweenAxes(areaAxes(data.length, series.length, Object.values(target)))
  // The box deepens with the series, so a ribbon stays a ribbon, and glides
  // there with the axes.
  const depth = useTween({ depth: Math.min(1, Math.max(0.25, series.length / 6)) }).depth
  const world = worldBox(spec, depth)
  const polygons = intoWorld(polygons3D().camera(camera), world)
  // The x axis keeps half a row beyond the first and the last entry.
  const ends = [spec.x.domain[0] + 0.5, spec.x.domain[1] - 0.5]
  const toward = Math.sign(camera.viewDirection().x)
  const marks = series
    .flatMap((key, j) => {
      const line = linePoints(rows, values, presence, key, ends)
      if (!line.length) return []
      const z = [j - RIBBON / 2, j + RIBBON / 2]
      return [{ key, line, faces: ribbonFaces(polygons, line, spec.y.domain[0], z) }]
    })
    // The ribbons lie in slices of z of their own, and their floors span the
    // same x at the same height: ordered by the middle of the floor, they are
    // painted back to front exactly.
    .sort((a, b) => sort(a.faces[4], b.faces[4]))
    .flatMap(({ key, line, faces }) =>
      ribbonMarks(key, painted(faces, toward), line, (names) =>
        ribbonTooltip(key, names, { config, entries, target }, { format, tooltip })
      )
    )

  return (
    <>
      <Axes3D spec={spec} world={world} titles={titles} format={labels} />
      <Marks3D marks={marks} />
    </>
  )
}

/** One point of a line: the entry it stands for, its place along x and its value. */
type LinePoint = { name: string; x: number; value: number }

/** One face of a ribbon after the projection, with its name and, on the top, its segment. */
type RibbonFace = Polygon<
  Point3D,
  Point3D[] & { face: "front" | "back" | "left" | "right" | "bottom" | "top"; segment: number }
>

/**
 * The points of the line of the series `key`, in order along x: every entry,
 * the ones still gliding away among them, at its gliding row and value. An
 * entry that comes or goes unfolds from the point before it - the one after
 * it, at the start of the line - and folds back into it, as far as its
 * `presence`, so the ribbon opens and closes without a step. Its value comes
 * from nothing as its presence grows - the two glide in step - so the part of
 * its neighbour it has not yet left is added: the point heads straight from
 * the neighbour to its own, never down towards the floor. Every
 * point stays within the gliding `ends` of the x axis, so a line with no
 * neighbour to unfold from - one that was empty - grows inside the box
 * instead of standing beyond its walls. A point only one of the tweens still
 * knows is on its way out and stays unseen.
 */
function linePoints(
  rows: Record<string, number>,
  values: Record<string, number>,
  presence: Record<string, number>,
  key: string,
  [lo, hi]: number[]
): LinePoint[] {
  const own = Object.entries(rows)
    .sort(([, a], [, b]) => a - b)
    .flatMap(([name, x]) => {
      const value = values[`${name}-${key}`]
      return value === undefined ? [] : [{ name, x, value, seen: presence[name] }]
    })
  let anchor = own.find((p) => p.seen === 1)
  return own
    .map((p) => {
      if (p.seen === 1) anchor = p
      const { x } = anchor ?? p
      return {
        name: p.name,
        x: Math.min(hi, Math.max(lo, x + p.seen * (p.x - x))),
        value: p.value + (1 - p.seen) * (anchor?.value ?? 0),
      }
    })
    .sort((a, b) => a.x - b.x)
}

/**
 * The faces of the ribbon of `line`, projected: the area under the line,
 * down to `floor`, pushed back from `z[0]` to `z[1]`. Each is wound
 * counter-clockwise as seen from outside, so `ccw` tells whether it faces the
 * camera. The first five lie on its bounding box - the front and the back,
 * one polygon each however many points the line has, the two ends and the
 * bottom - the rest are its top, one quad per segment of the line.
 */
function ribbonFaces(
  polygons: Polygons3DInstance<Point3D>,
  line: LinePoint[],
  floor: number,
  [back, front]: number[]
): RibbonFace[] {
  const on = (p: LinePoint, z: number) => ({ x: p.x, y: p.value, z })
  const under = (p: LinePoint, z: number) => ({ x: p.x, y: floor, z })
  const face = (name: RibbonFace["face"], points: Point3D[], segment = -1) =>
    Object.assign(points, { face: name, segment })
  const [a, o] = [line[0], line[line.length - 1]]
  return polygons.data([
    face("front", [
      on(a, front),
      under(a, front),
      under(o, front),
      ...line
        .slice(1)
        .reverse()
        .map((p) => on(p, front)),
    ]),
    face("back", [...line.map((p) => on(p, back)), under(o, back), under(a, back)]),
    face("left", [on(a, back), under(a, back), under(a, front), on(a, front)]),
    face("right", [on(o, front), under(o, front), under(o, back), on(o, back)]),
    face("bottom", [under(a, front), under(a, back), under(o, back), under(o, front)]),
    ...line
      .slice(1)
      .map((p, i) =>
        face("top", [on(line[i], front), on(p, front), on(p, back), on(line[i], back)], i)
      ),
  ])
}

/**
 * The faces of a ribbon that face the camera, in paint order. Every segment
 * of the top is a slab, and the planes x = const separate them: the top is
 * painted from the end of the ribbon away from the camera, which `toward`,
 * the sign of x in the view direction, names. The faces of the bounding box
 * come last: the ribbon lies wholly behind each of them.
 */
function painted(faces: RibbonFace[], toward: number) {
  const shown = faces.filter((f) => f.ccw)
  return [
    ...shown.filter((f) => f.face === "top").sort((a, b) => toward * (a.segment - b.segment)),
    ...shown.filter((f) => f.face !== "top"),
  ]
}

/**
 * The marks of one ribbon, shaded in the color of its series. Each face is a
 * group of its own, so hovering highlights the face under the pointer alone.
 * A segment of the top is keyed by the entry it starts at, so it keeps its
 * mark when entries come or go before it. Every face says what `tooltip`
 * makes of the entries it spans: the two ends of a segment of the top, none
 * on a side.
 */
function ribbonMarks(
  key: string,
  faces: RibbonFace[],
  line: LinePoint[],
  tooltip: (names: string[]) => Mark3D["tooltip"]
): Mark3D[] {
  const color = `var(--color-${key})`
  const spans = (f: RibbonFace) =>
    f.face === "top" ? [line[f.segment].name, line[f.segment + 1].name] : []
  return faces.map((f) => {
    const id = f.face === "top" ? `${key}-top-${line[f.segment].name}` : `${key}-${f.face}`
    return {
      key: id,
      points: f.map((p) => p.projected),
      fill: shade(f, color),
      groups: [id],
      tooltip: tooltip(spans(f)),
    }
  })
}

/**
 * What a face of the ribbon of `key` says on hover, made when the pointer
 * lands on it: the series and, on a segment of the top, the entries it
 * spans as the ticks of x name them, with their values as the ticks of y
 * name them - or what `tooltip` makes of that. A segment whose entry has
 * left the data says nothing.
 */
function ribbonTooltip<T extends Record<string, unknown>>(
  key: string,
  names: string[],
  {
    config,
    entries,
    target,
  }: { config: ChartConfig; entries: Map<string, T>; target: Record<string, number> },
  { format = {}, tooltip = (tip) => tip }: Pick<AreaChart3DProps<T>, "format" | "tooltip">
): Mark3D["tooltip"] {
  const spanned = names.flatMap((name) => {
    const entry = entries.get(name)
    return entry ? [entry] : []
  })
  if (spanned.length < names.length) return undefined
  const color = `var(--color-${key})`
  return () =>
    tooltip(
      {
        title: config[key]?.label ?? key,
        items: names.map((name) => {
          const value = target[`${name}-${key}`]
          return { label: (format.x ?? String)(name), value: format.y?.(value) ?? value, color }
        }),
      },
      { key, entries: spanned }
    )
}

/**
 * The axes of an area chart: the entries along x, with half a row of room
 * between the first and the last and the walls, a row per series along z.
 * A line has many entries, so x ticks about ten of them, not every one.
 */
function areaAxes(entries: number, series: number, values: number[]): AxesSpec {
  const every = entries ? ticks(0, entries - 1, 10).filter(Number.isInteger) : []
  return {
    x: pad({ domain: [0, Math.max(0, entries - 1)], ticks: every }, 1),
    y: axis(Math.min(0, ...values), Math.max(0, ...values)),
    z: pad({ domain: [0, Math.max(0, series - 1)], ticks: range(series) }, 1),
  }
}
