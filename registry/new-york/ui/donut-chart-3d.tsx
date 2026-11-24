"use client"

import * as React from "react"
import { max, sum } from "d3-array"
import { cubes3D, sector, sort, type Camera3DInstance, type Point3D } from "d3-3d"

import {
  GLOBE_RADIUS,
  Marks3D,
  barMarks,
  colorOf,
  joined,
  keyOf,
  nonNegative,
  uniqueIds,
  useChart3D,
  useConfigKeys,
  useTooltips,
  useTween,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

/** The outer radius of the ring, as wide as the globe, and that of its hole, half of it. */
const RADIUS = GLOBE_RADIUS
const HOLE = RADIUS / 2
/** The height of the tallest slice: as tall as the ring is wide. */
const TALL = RADIUS - HOLE
/** The widest step a slice is cut into, 6°: so every footprint is about one size. */
const STEP = Math.PI / 30
/** The numbers a slice glides, by the first letter of their keys: its value, its fade and its place round the ring. */
const AMOUNT = "a"
const OPACITY = "o"
const PLACE = "p"

// An entry is any object: `object`, not `Record<string, unknown>`, lets one
// declared as an interface in, which has no index signature.
export type DonutChart3DProps<T extends object = Record<string, unknown>> = {
  /** One entry per slice, in the order the ring runs: clockwise seen from above, from the back. */
  data: T[]
  /**
   * The field of the value of an entry: the share of the whole its slice is
   * as wide as, and the height it rises to, relative to the largest. A value
   * below 0, or one that is not a finite number, stands as 0 and draws no
   * slice.
   */
  value: keyof T & string
  /**
   * The field that identifies an entry and titles its tooltip: through
   * updates a new slice widens out of its neighbours, a gone one narrows back
   * into them and one that changes glides. A name is its own within its
   * series, and one that repeats is a slice of its own.
   * @defaultValue the place of the entry in the data
   */
  id?: keyof T & string
  /**
   * The field whose value is the config key of the color of a slice.
   * @defaultValue `id`: every slice in the color its own name keys - without
   * `id`, the first key of the chart config for every slice
   */
  series?: keyof T & string
  /** Formats the value in the tooltip. */
  format?: { value?: (value: number) => React.ReactNode }
  /**
   * What a slice says on hover: `tooltip` is what it would say, its name or
   * its series, its value and its share of the whole, `data` the entry behind
   * it; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

/** The fields of an entry the chart reads. */
type Fields<T extends object> = Pick<DonutChart3DProps<T>, "value" | "id" | "series">

/** What a slice reads for its tooltip: the config, the fields, the whole the slices share, the format and what the reader makes of it. */
type Reading<T extends object> = {
  config: ChartConfig
  fields: Fields<T>
  total: number
} & Pick<DonutChart3DProps<T>, "format" | "tooltip">

/** A share as the tooltip names it, such as 37.5%. */
const PERCENT = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 })

/** A slice round the ring: where it starts and ends, as angles from the back, and how tall it is. */
type Slice = { name: string; start: number; end: number; height: number }

/**
 * A donut of slices, each as wide as its share of the whole and as tall as
 * its value, relative to the largest: a pie whose depth carries the value
 * (ADR-0015).
 */
export function DonutChart3D<T extends object>({
  data,
  value,
  id,
  series,
  format,
  tooltip,
}: DonutChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const fields = { value, id, series }
  const fallback = Object.keys(config)[0]
  const { entries, numbers, order, total } = useSlices(data, fields, fallback)
  // Every number of every slice in one glide, on one clock: its value - a new
  // slice widens and rises out of nothing, a gone one narrows and sinks back -
  // its fade, and its place round the ring, where a gone one stands.
  const glide = useTween(numbers, (key) => (key[0] === PLACE ? undefined : 0))
  const { amount, opacity, place } = split(glide)
  const keyFor = useConfigKeys(entries, series ?? id, fallback, amount)
  const tips = useTooltips([data, value, id, series, config, format, tooltip])
  const reading = { config, fields, total, format, tooltip }
  // A new slice and a gone one that stood in its place: the new one first.
  const rank = (name: string) => order[name] ?? Infinity
  const names = Object.keys(amount).sort((a, b) => place[a] - place[b] || rank(a) - rank(b))
  const marks = ringShapes(camera, ring(names, amount)).flatMap((step) =>
    stepMarks(
      step,
      colorOf(keyFor(step.name)),
      opacity[step.name],
      tips(step.name, () => sliceTooltip(keyFor(step.name), entries.get(step.name), reading))
    )
  )
  return <Marks3D marks={marks} />
}

/**
 * The slices of `data` by name - its id within its series - with the numbers
 * each glides, its place in the ring and the whole the slices share, built
 * once per change of the data, not at every frame the camera turns. A value
 * of 0 is no slice: it leaves the numbers as a gone entry does.
 */
function useSlices<T extends object>(data: T[], fields: Fields<T>, fallback?: string) {
  const { value, id, series } = fields
  return React.useMemo(() => {
    const color = series ?? id
    // Two entries of one name in one series are two slices; in two series, a
    // slice in each, which one leaving leaves the other as it is.
    const names = uniqueIds(
      data.map((d, i) => joined(keyOf(color && d[color], fallback), id ? String(d[id]) : String(i)))
    )
    const slices = names.flatMap((name, i) => {
      const amount = nonNegative(data[i][value])
      return amount > 0 ? [{ name, entry: data[i], amount }] : []
    })
    return {
      entries: new Map(slices.map((s) => [s.name, s.entry])),
      numbers: Object.fromEntries(
        slices.flatMap((s, i) => [
          [AMOUNT + s.name, s.amount],
          [OPACITY + s.name, 1],
          [PLACE + s.name, i],
        ])
      ),
      order: Object.fromEntries(slices.map((s, i) => [s.name, i])),
      total: sum(slices, (s) => s.amount),
    }
  }, [data, value, id, series, fallback])
}

/** The numbers of the slices apart by what they are - their values, fades and places - each by the name of its slice. */
function split(numbers: Record<string, number>) {
  const kinds: Record<string, Record<string, number>> = { [AMOUNT]: {}, [OPACITY]: {}, [PLACE]: {} }
  for (const key in numbers) kinds[key[0]][key.slice(1)] = numbers[key]
  return { amount: kinds[AMOUNT], opacity: kinds[OPACITY], place: kinds[PLACE] }
}

/** The slices of `names` round the ring, in their order, by their `amounts`; a slice of nothing has no room. */
function ring(names: string[], amounts: Record<string, number>): Slice[] {
  const total = sum(names, (name) => amounts[name])
  const peak = max(names, (name) => amounts[name]) ?? 0
  if (!(total > 0)) return []
  let start = 0
  return names.map((name) => {
    const end = start + (amounts[name] / total) * 2 * Math.PI
    const slice = { name, start, end, height: (amounts[name] / peak) * TALL }
    start = end
    return slice
  })
}

/**
 * The steps of every slice as cubes, projected by `camera` and painted back
 * to front by how near each stands to the side the eye looks from.
 */
function ringShapes(camera: Camera3DInstance, slices: Slice[]) {
  const cubes = cubes3D().camera(camera)
  const steps = slices.flatMap(({ name, start, end, height }) => {
    const spec = { x: 0, y: TALL / 2, z: 0, innerRadius: HOLE, outerRadius: RADIUS, height }
    const corners = sector(
      { ...spec, startAngle: start, endAngle: end },
      Math.ceil((end - start) / STEP)
    )
    return corners.map((step, index) =>
      Object.assign(step, { name, index, first: index === 0, last: index === corners.length - 1 })
    )
  })
  const toward = cubes.viewDirection()
  return cubes
    .data(steps)
    .map((step) => Object.assign(step, { near: nearness(step, toward) }))
    .sort((a, b) => sort(a.near, b.near))
}

/**
 * How near a step stands to the side the eye looks from, for d3-3d's `sort`.
 * The steps stand round one upright axis, so an upright plane through it
 * parts any two, and the eye sees the one on its side over the other: on
 * either side of the eye, the step nearer to it round the ring is nearer -
 * the cosine of the angle from the eye's side to the nearer edge of the
 * step. A step the eye's side runs through is the nearest, one the opposite
 * side runs through, behind all others on both sides, the furthest. The
 * footprints of `floored` order steps of one slice so turned round the ring
 * that their boxes overlap. Rounded as `floored` rounds, so the server and
 * the browser, which differ in the last bit of a sine, paint in one order.
 */
function nearness(step: Point3D[], toward: Point3D) {
  // Never 0: the camera never looks straight down the axis, as the cosine of
  // its tilt, even of a quarter turn, is never exactly 0 in floating point.
  const length = Math.hypot(toward.x, toward.z)
  const eye = { x: toward.x / length, z: toward.z / length }
  // cubes3D's corners 2 and 1: the foot of the outer wall where the step
  // starts and ends, as far from the axis as the ring is wide.
  const [from, to] = [step[2], step[1]].map((p) => ({ x: p.x / RADIUS, z: p.z / RADIUS }))
  const cross = (a: Flat, b: Flat) => a.x * b.z - a.z * b.x
  const spans = (side: Flat) => cross(from, side) >= 0 && cross(side, to) >= 0
  const near = spans(eye)
    ? 1
    : spans({ x: -eye.x, z: -eye.z })
      ? -1
      : Math.max(from.x * eye.x + from.z * eye.z, to.x * eye.x + to.z * eye.z)
  return { centroid: { z: Math.round(near * 1e9) / 1e9 } }
}

/** A direction on the floor. */
type Flat = { x: number; z: number }

/**
 * The marks of one step, as the bars draw theirs: its faces that look at the
 * camera, shaded in `color` and faded to `opacity`. The ends of a slice close
 * it, the walls between its steps are inside it, and its group is the slice,
 * so hovering lights the slice whole.
 */
function stepMarks(
  step: ReturnType<typeof ringShapes>[number],
  color: string,
  opacity: number,
  tooltip: Mark3D["tooltip"]
): Mark3D[] {
  // cubes3D's right face is where a step starts, its left one where it ends.
  const faces = step.faces.filter(
    (face) => (face.face !== "right" || step.first) && (face.face !== "left" || step.last)
  )
  const id = joined(step.name, String(step.index))
  return barMarks({ id, faces, color, tooltip, opacity }).map((mark) => ({
    ...mark,
    groups: [step.name],
  }))
}

/**
 * What a slice says on hover, made when the pointer lands on it: its name,
 * or its series, over its value and its share of the whole, labelled by the
 * field - or what `tooltip` makes of that. A slice on its way out - its
 * entry gone from the data, or its value 0 - says nothing.
 */
function sliceTooltip<T extends object>(
  key: string,
  entry: T | undefined,
  { config, fields, total, format, tooltip = (tip) => tip }: Reading<T>
): Mark3D["tooltip"] {
  if (!entry) return undefined
  const amount = nonNegative(entry[fields.value])
  return () =>
    tooltip(
      {
        // A slice without a name is titled by its series, never "null" or "undefined".
        title:
          fields.id && entry[fields.id] != null
            ? String(entry[fields.id])
            : (config[key]?.label ?? key),
        items: [
          {
            label: fields.value,
            value: format?.value?.(amount) ?? amount,
            color: colorOf(key),
          },
          { label: "share", value: PERCENT.format(amount / total) },
        ],
      },
      { entry }
    )
}
