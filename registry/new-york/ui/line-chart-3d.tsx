"use client"

import * as React from "react"
import { lineStrips3D, sort, type AxesSpec, type Point2D, type Point3D } from "d3-3d"

import {
  Axes3D,
  Marks3D,
  colorOf,
  faded,
  intoWorld,
  pointTooltip,
  useChart3D,
  usePoints,
  useTweenAxes,
  worldBox,
  type Mark3D,
  type Tooltip3D,
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
   * The field that names an entry, so a point follows its name through
   * updates: a new one unfolds from the point before it, a gone one folds
   * back into it, one that moves glides. The names should be unique.
   * @defaultValue the position of the entry
   */
  id?: keyof T & string
  /**
   * The field whose value is the config key of the line of a point: the
   * entries of one key are one line.
   * @defaultValue the first key of the chart config, one line of all the entries
   */
  series?: keyof T & string
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
  format,
  titles,
  tooltip,
}: LineChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const { fields, named, entries, axes, presence, read } = usePoints(data, x, y, z, id)
  const joints = useJoints(named, series, Object.keys(config)[0], presence)
  // The axes of the data the chart glides into; their ends glide along.
  const spec = useTweenAxes(axes)
  const world = worldBox(spec)
  const marks = intoWorld(lineStrips3D<Point3D>().camera(camera), world)
    .data(runs(joints, presence, read).flatMap(elbows))
    .sort(sort)
    .flatMap((elbow) =>
      elbowMarks(
        elbow,
        pointTooltip(
          entries.get(elbow.name),
          series ? (config[elbow.line]?.label ?? elbow.line) : undefined,
          fields,
          { format, titles, tooltip }
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

/** What the chart knows of a point: the config key of its line, and whether the line starts anew at it. */
type Joint = { line: string; starts: boolean }

/** A point of a line in the units of the data, with its name and how far it has come, from 0 to 1. */
type LinePoint = Point3D & { name: string; seen: number }

/** The part of a line that belongs to one point: from halfway to it, through it at `own`, halfway on. */
type Elbow = Point3D[] & { name: string; line: string; seen: number; own: number }

/**
 * The joint of every point by name, in the order the lines run, the points
 * still folding away among them: a gone point keeps its line and its place
 * after the point it followed, since its entry has already left the data,
 * and is forgotten when `alive`, the presence of the points, drops it. A
 * line starts anew after an entry of its series that has no place.
 */
function useJoints<T extends Record<string, unknown>>(
  named: { d: T; name: string; placed: boolean }[],
  series: (keyof T & string) | undefined,
  fallback: string,
  alive: Record<string, number>
) {
  const known = React.useRef(new Map<string, Joint>())
  const live = React.useMemo(() => {
    const live = new Map<string, Joint>()
    const broken = new Set<string>()
    for (const { d, name, placed } of named) {
      const line = series ? String(d[series]) : fallback
      if (placed) live.set(name, { line, starts: broken.delete(line) })
      else broken.add(line)
    }
    return live
  }, [named, series, fallback])
  known.current = withGone(live, known.current, alive)
  return known.current
}

/**
 * The `live` joints with the gone ones of `known` that are still `alive`
 * among them, each after the living one it followed - before the first, if
 * it followed none.
 */
function withGone(live: Map<string, Joint>, known: Map<string, Joint>, alive: object) {
  const gone = new Map<string | undefined, [string, Joint][]>([
    [undefined, []],
    ...[...live.keys()].map((name): [string, [string, Joint][]] => [name, []]),
  ])
  let last: string | undefined
  for (const [name, joint] of known) {
    if (live.has(name)) last = name
    else if (name in alive) gone.get(last)!.push([name, joint])
  }
  return new Map([
    ...gone.get(undefined)!,
    ...[...live].flatMap((joint) => [joint, ...gone.get(joint[0])!]),
  ])
}

/**
 * The runs of the lines: the points of each line in order, cut where it
 * starts anew. A point that comes or goes unfolds from the point before it
 * in its run - the one after it, at the start - and folds back into it, as
 * far as it is `seen`, so a line grows and shrinks at its end without a
 * step; a run that is all new stands in place and only fades in. Every joint
 * has a position: the positions glide at least as long as the presence does,
 * since names never change without them.
 */
function runs(
  joints: Map<string, Joint>,
  presence: Record<string, number>,
  read: (name: string, axis: keyof AxesSpec) => number
) {
  const open = new Map<string, LinePoint[]>()
  const all: { line: string; points: LinePoint[] }[] = []
  for (const [name, { line, starts }] of joints) {
    if (starts || !open.has(line)) {
      open.set(line, [])
      all.push({ line, points: open.get(line)! })
    }
    open.get(line)!.push({
      name,
      seen: presence[name],
      x: read(name, "x"),
      y: read(name, "y"),
      z: read(name, "z"),
    })
  }
  return all.map(({ line, points }) => {
    let anchor = points.find((p) => p.seen === 1)
    const toward = (p: LinePoint, a: keyof AxesSpec) => anchor![a] + p.seen * (p[a] - anchor![a])
    return {
      line,
      points: points.map((p) => {
        if (p.seen === 1) anchor = p
        return anchor ? { ...p, x: toward(p, "x"), y: toward(p, "y"), z: toward(p, "z") } : p
      }),
    }
  })
}

/**
 * The elbows of a run, one per point: the point and the middle of the
 * segment to each of its neighbours. Each sorts on its own depth, so a line
 * that passes in front of itself is painted in order, and the half of a
 * segment nearer a point speaks for that point on hover.
 */
function elbows({ line, points }: { line: string; points: LinePoint[] }): Elbow[] {
  const mid = (a: Point3D, b: Point3D) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  })
  return points.map((p, i) => {
    const before = i > 0 ? [mid(points[i - 1], p)] : []
    const after = i < points.length - 1 ? [mid(p, points[i + 1])] : []
    return Object.assign([...before, { x: p.x, y: p.y, z: p.z }, ...after], {
      name: p.name,
      line,
      seen: p.seen,
      own: before.length,
    })
  })
}

/**
 * The marks of an elbow, projected, in the color of its line: a quad as wide
 * as the line per half segment - a stroke of the same width on the screen
 * from every side - and a circle on the point that rounds the joint; alone,
 * it is all there is of a point without neighbours. They fade with the point as
 * it comes and goes. Their group is the line, so hovering highlights the
 * whole line, and the tooltip is that of the point.
 */
function elbowMarks(
  elbow: { projected: Point2D }[] & Pick<Elbow, "name" | "line" | "seen" | "own">,
  tooltip: Mark3D["tooltip"]
): Mark3D[] {
  const mark = { fill: faded(colorOf(elbow.line), elbow.seen), groups: [elbow.line], tooltip }
  const at = elbow.map((p) => p.projected)
  return [
    ...at.slice(1).map((b, i) => {
      const a = at[i]
      // A segment without a length, as of a point that has yet to unfold, has no side to turn to.
      const half = WIDTH / 2 / (Math.hypot(b.x - a.x, b.y - a.y) || 1)
      const n = { x: (a.y - b.y) * half, y: (b.x - a.x) * half }
      return {
        ...mark,
        key: `${elbow.name}-${i < elbow.own ? "before" : "after"}`,
        points: [
          { x: a.x + n.x, y: a.y + n.y },
          { x: b.x + n.x, y: b.y + n.y },
          { x: b.x - n.x, y: b.y - n.y },
          { x: a.x - n.x, y: a.y - n.y },
        ],
      }
    }),
    { ...mark, key: elbow.name, points: [at[elbow.own]], r: WIDTH / 2 },
  ]
}
