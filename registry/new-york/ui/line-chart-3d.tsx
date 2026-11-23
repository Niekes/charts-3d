"use client"

import { extent } from "d3-array"
import { lineStrips3D, sort, type AxesSpec, type Point2D, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  colorOf,
  faded,
  intoWorld,
  pointTooltip,
  ramp,
  segment,
  useChart3D,
  usePoints,
  useRuns,
  useTweenAxes,
  worldBox,
  type Mark3D,
  type Tooltip3D,
  joined,
  useTooltips,
} from "@/registry/new-york/ui/chart-3d"

export type LineChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * One entry per point, in the order its line runs. One whose x, y or z is
   * missing or not a number has no point: its line stops before it and starts
   * again after it.
   */
  data: T[]
  /** The field of the position along x. */
  x: keyof T & string
  /** The field of the position along y, the height. */
  y: keyof T & string
  /** The field of the position along z. */
  z: keyof T & string
  /**
   * The field that identifies an entry, so a point follows its name through
   * updates: a new one unfolds from the point before it, a gone one folds
   * back into it, one that moves glides. A name that repeats is, in the
   * order of the data, a point of its own. A name is its own within its
   * series, and read as text: derive a field for a key of several fields.
   * @defaultValue the position of the entry
   */
  id?: keyof T & string
  /**
   * The field whose value is the config key of the line of a point: the
   * entries of one key are one line.
   * @defaultValue the first key of the chart config, one line of all the entries
   */
  series?: keyof T & string
  /**
   * The config keys of the colors at the lowest and at the highest height:
   * each point's part of a line takes the color of its height on the ramp
   * between them, in place of the color of its series.
   * @defaultValue none, every line in the color of its series
   */
  colors?: [string, string]
  /** Formats the tick labels of each axis. */
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * What a line says on hover, of the point nearest the pointer along it:
   * `tooltip` is what it would say, its series and the x, y and z of the
   * point as the ticks name them, `data` the entry behind the point; `null`
   * shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

// The width of a line in the units of the view box.
const WIDTH = 2

/**
 * Lines through the chart box: the entries of `data` at their fields `x`,
 * `y` and `z`, joined in the order of the data. `series` names the field
 * whose value is the config key of a line; without it all the entries are
 * one line. For entries along x with a value per series, see the area chart.
 */
export function LineChart3D<T extends Record<string, unknown>>({
  data,
  x,
  y,
  z,
  id,
  series,
  colors,
  format,
  titles,
  tooltip,
}: LineChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const { fields, named, entries, axes, presence, target } = usePoints(data, x, y, z, id, series)
  // A point that comes or goes unfolds from its neighbour straight through the box.
  const runs = useRuns(named, series, presence, target)
  const tips = useTooltips([data, x, y, z, id, series, config, format, titles, tooltip])
  // The axes of the data the chart glides into; their ends glide along.
  const spec = useTweenAxes(axes)
  const world = worldBox(spec)
  const [lo = 0, hi = 0] = colors
    ? extent(
        runs.flatMap((run) => run.points),
        (p) => p.at.y
      )
    : []
  const marks = intoWorld(lineStrips3D<Point3D>().camera(camera), world)
    .data(runs.flatMap(elbows))
    .sort(sort)
    .flatMap((elbow) =>
      elbowMarks(
        elbow,
        colors ? ramp(elbow[elbow.own].y, [lo, hi], colors) : colorOf(elbow.line),
        tips(joined(elbow.line, elbow.name), () =>
          pointTooltip(
            entries.get(elbow.name),
            series ? (config[elbow.line]?.label ?? elbow.line) : undefined,
            fields,
            { format, titles, tooltip }
          )
        )
      )
    )

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/** A point of a line in the units of the data. */
type LinePoint = { name: string; seen: number; at: Point3D }

/** The part of a line that belongs to one point: from halfway to it, through it at `own`, halfway on. */
type Elbow = Point3D[] & { name: string; line: string; seen: number; own: number }

/**
 * The elbows of a run, one per point: the point and the middle of the
 * segment to each of its neighbours. Each sorts on its own depth, so a line
 * that passes in front of itself is painted in order, and the half of a
 * segment nearer a point speaks for that point on hover.
 */
function elbows({ line, points }: { line: string; points: LinePoint[] }): Elbow[] {
  return points.map(({ name, seen, at }, i) => {
    const before = i > 0 ? [between(points[i - 1].at, at, 0.5)] : []
    const after = i < points.length - 1 ? [between(at, points[i + 1].at, 0.5)] : []
    return Object.assign([...before, at, ...after], {
      name,
      line,
      seen,
      own: before.length,
    })
  })
}

/** The point the share `k` of the way from `a` to `b`, straight through the box. */
function between(a: Point3D, b: Point3D, k: number): Point3D {
  return { x: a.x + k * (b.x - a.x), y: a.y + k * (b.y - a.y), z: a.z + k * (b.z - a.z) }
}

/**
 * The marks of an elbow, projected, in `color`: a quad as wide
 * as the line per half segment - a stroke of the same width on the screen
 * from every side - and a circle on the point that rounds the joint; alone,
 * it is all there is of a point without neighbours. They fade with the point as
 * it comes and goes. Their group is the point, so hovering lights it, with a
 * dot twice as wide as the line on it, and the tooltip is that of the point.
 */
function elbowMarks(
  elbow: { projected: Point2D }[] & Pick<Elbow, "name" | "seen" | "own">,
  color: string,
  tooltip: Mark3D["tooltip"]
): Mark3D[] {
  const mark = { fill: faded(color, elbow.seen), groups: [elbow.name], tooltip }
  const at = elbow.map((p) => p.projected)
  return [
    ...at.slice(1).map((b, i) => ({
      ...mark,
      key: joined(elbow.name, i < elbow.own ? "before" : "after"),
      points: segment(at[i], b, WIDTH),
    })),
    { ...mark, shape: "circle" as const, key: elbow.name, points: [at[elbow.own]], r: WIDTH / 2 },
    {
      ...mark,
      shape: "circle" as const,
      key: joined(elbow.name, "dot"),
      points: [at[elbow.own]],
      r: WIDTH,
      whenLit: true,
    },
  ]
}
