"use client"

import * as React from "react"
import { extent, max } from "d3-array"
import {
  gridPlanes3D,
  sort,
  type AxesSpec,
  type GridPlane,
  type GridPlanes3DInstance,
  type Point3D,
} from "d3-3d"

import {
  Axes3D,
  Marks3D,
  axis,
  gridAxis,
  intoWorld,
  faded,
  shade,
  useChart3D,
  useTween,
  useTweenAxes,
  worldBox,
  finite,
  ramp,
  type Mark3D,
  type Tooltip3D,
  useTooltips,
  joined,
} from "@/registry/new-york/ui/chart-3d"

export type SurfaceChart3DProps = {
  /** The heights on the grid, `data[row][column]`; one that is not a finite number stands at the lowest of the others. */
  data: number[][]
  /**
   * The data values the first and the last column (x) and row (z) stand for,
   * the others evenly between. The chart keeps half a cell between the grid
   * and the walls of its box; a domain given here names the box exactly,
   * without that room.
   * @defaultValue the indices of the columns and rows
   */
  domain?: { x?: [number, number]; z?: [number, number] }
  /**
   * The value every column stands at along x, `x[column]`, at any spacing,
   * in place of `domain.x`; the box spans them exactly. The surface joins
   * the columns in the order of the data: give them ascending, or it folds
   * back over itself. A column without a finite value drops out, its
   * neighbours joined.
   * @defaultValue evenly over `domain.x`
   */
  x?: number[]
  /**
   * The value every row stands at along z, `z[row]`, as `x` does for the
   * columns.
   * @defaultValue evenly over `domain.z`
   */
  z?: number[]
  /**
   * The config keys of the colors at the lowest and at the highest height.
   * @defaultValue the first two keys of the chart config
   */
  colors?: [string, string]
  /** Formats the tick labels of each axis. */
  format?: Partial<Record<keyof AxesSpec, (value: number) => React.ReactNode>>
  /** The titles of the axes. */
  titles?: Partial<Record<keyof AxesSpec, React.ReactNode>>
  /**
   * What a cell says on hover: `tooltip` is what it would say, its height as
   * the ticks of y name it, `data` the row and column the cell starts at and
   * its height, the mean of its four corners; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (
    tooltip: Tooltip3D,
    data: { row: number; column: number; value: number }
  ) => Tooltip3D | null
}

/**
 * A surface over a grid: `data[row][column]` is the height, the columns run
 * along x and the rows along z. The fill ramps from the first color of
 * `colors` at the lowest height to the second at the highest; both are keys
 * of the chart config, by default its first two.
 */
export function SurfaceChart3D({
  data: raw,
  domain = {},
  x,
  z,
  colors,
  format,
  titles,
  tooltip,
}: SurfaceChart3DProps) {
  const { config, camera } = useChart3D()
  const [low, high = low] = colors ?? Object.keys(config)
  const { floor, peak, target, present, ...sides } = useGrid(raw, { domain, x, z })
  // The heights glide cell by cell, so the surface, its color ramp and the y
  // axis follow. Coming and going is a fade in place - a new border cell
  // fades in where it belongs, a gone one fades out where it stands and
  // leaves when the glide is done - so the surface never moves where data
  // merely appears or disappears.
  const heights = useTween(target)
  const fade = useTween(present, 0)
  // Every column and row glides to its place.
  const placesX = useTween(sides.x.places)
  const placesZ = useTween(sides.z.places)
  const tips = useTooltips([raw, present, format, titles, tooltip])
  // Everything of a cell but its shade waits for the data to move, not the camera.
  const { lattice, points } = React.useMemo(() => {
    const lattice = gridLattice(heights, { x: placesX, z: placesZ }, floor)
    const cells = {
      raw,
      present,
      keys: [low, high] as [string, string],
      tips,
      format,
      titles,
      tooltip,
    }
    return { lattice, points: gridPoints(lattice, { x: placesX, z: placesZ }, cells) }
  }, [heights, placesX, placesZ, floor, raw, present, low, high, tips, format, titles, tooltip])
  const spec = useTweenAxes({ x: sides.x.spec, y: axis(floor, peak), z: sides.z.spec })
  const world = worldBox(spec)

  const grid = intoWorld<GridPoint, GridPlanes3DInstance<GridPoint>>(
    gridPlanes3D<GridPoint>().camera(camera),
    world
  )
    // d3-3d reads rows(0) as the getter; a grid without columns has no points anyway.
    .rows(Math.max(1, lattice[0]?.length ?? 0))
  const marks = grid
    .data(points)
    .sort(sort)
    .map((quad) => quadMark(quad, fade))

  return (
    <>
      <Axes3D spec={spec} world={world} format={format} titles={titles} />
      <Marks3D marks={marks} />
    </>
  )
}

/**
 * A point of the lattice, carrying the row and column it stands for, its key
 * and, where a cell starts at it, the key, color and tooltip of that cell.
 */
type GridPoint = Point3D & {
  r: number
  c: number
  key: string
  cell?: { key: string; color: string; tooltip: Mark3D["tooltip"] }
}

/** What the cells of the lattice are colored and named by. */
type Cells = Pick<SurfaceChart3DProps, "format" | "titles" | "tooltip"> & {
  raw: number[][]
  present: Record<string, number>
  keys: [string, string]
  tips: ReturnType<typeof useTooltips>
}

/**
 * The points of the lattice at their places, each cell on the point it
 * starts at - its lowest row and column - with its color on the ramp at its
 * height, the mean of its corners, and its tooltip.
 */
function gridPoints(
  lattice: { r: number; c: number; y: number }[][],
  places: Record<"x" | "z", Record<string, number>>,
  { raw, present, keys, tips, ...say }: Cells
): GridPoint[] {
  const [lo = 0, hi = 0] = extent(lattice.flat(), (p) => p.y)
  return lattice.flatMap((row, i) =>
    row.map(({ r, c, y }, j) => {
      const point: GridPoint = { x: places.x[c], y, z: places.z[r], r, c, key: `${r}-${c}` }
      const corners = [row[j + 1], lattice[i + 1]?.[j], lattice[i + 1]?.[j + 1]]
      if (corners.every(Boolean)) {
        const quad = [{ r, c, y }, ...corners] as { r: number; c: number; y: number }[]
        const height = quad.reduce((sum, p) => sum + p.y, 0) / quad.length
        point.cell = {
          key: point.key,
          color: ramp(height, [lo, hi], keys),
          // What a cell says reads the data at its corners, not the heights on their way; a
          // column that leaves gives the cell beside it new corners when the glide is done.
          tooltip: tips(joined(...quad.map((p) => `${p.r}-${p.c}`)), () =>
            cellTooltip(quad, raw, present, say)
          ),
        }
      }
      return point
    })
  )
}

/**
 * What a cell says on hover, made when the pointer lands on it: its height,
 * the mean of its four corners in the data, as the ticks of y name it - or
 * what `tooltip` makes of that. A cell on its way out of the data - its
 * height or its place - says nothing, and so does one with a height that is no number, where the
 * stand-in at the floor would make a value up.
 */
function cellTooltip(
  quad: { r: number; c: number }[],
  data: number[][],
  present: Record<string, number>,
  {
    format = {},
    titles = {},
    tooltip = (tip) => tip,
  }: Pick<SurfaceChart3DProps, "format" | "titles" | "tooltip">
): Mark3D["tooltip"] {
  if (quad.some((p) => !(`${p.r}-${p.c}` in present) || !finite(data[p.r][p.c]))) return undefined
  return () => {
    const value = quad.reduce((sum, p) => sum + data[p.r][p.c], 0) / quad.length
    const row = Math.min(...quad.map((p) => p.r))
    const column = Math.min(...quad.map((p) => p.c))
    return tooltip(
      { items: [{ label: titles.y ?? "value", value: format.y?.(value) ?? value }] },
      { row, column, value }
    )
  }
}

/**
 * The mark of one cell: its quad, shaded in the color of its cell and faded
 * in place by `fade` while the cell enters or leaves. It is named by the row
 * and column it starts at, as d3-3d numbers its quads anew as the grid grows.
 */
function quadMark(quad: GridPlane<GridPoint>, fade: Record<string, number>): Mark3D {
  let start = quad[0]
  let seen = 1
  for (const p of quad) {
    if (p.r <= start.r && p.c <= start.c) start = p
    // A corner only one of the tweens still knows is on its way out and stays unseen.
    seen = Math.min(seen, fade[p.key] ?? 0)
  }
  // The point a cell starts at carries it: every quad of the lattice has one.
  const { key, color, tooltip } = start.cell!
  const shaded = shade(quad, color)
  return {
    key,
    points: quad.map((p) => p.projected),
    fill: faded(shaded, seen),
    // Its group is the cell, so hovering it lights the cell alone.
    groups: [key],
    tooltip,
  }
}

/**
 * The grid with every height a number, its lowest and highest height, the
 * height of every cell and its presence, and the places of its columns and
 * rows - built once per change of the data, not at every frame the camera
 * turns. A column or row without a place drops out of all of them.
 */
function useGrid(
  raw: number[][],
  {
    domain,
    x,
    z,
  }: Pick<SurfaceChart3DProps, "x" | "z"> & {
    domain: NonNullable<SurfaceChart3DProps["domain"]>
  }
) {
  return React.useMemo(() => {
    // Named places span the box exactly; the indices keep half a cell of room.
    const columns = max(raw, (row) => row.length) ?? 0
    const sides = {
      x: gridAxis(columns, {
        at: x,
        ends: domain.x,
        padded: !(x || domain.x),
      }),
      z: gridAxis(raw.length, { at: z, ends: domain.z, padded: !(z || domain.z) }),
    }
    // A short row is as long as the longest: its missing corners are NaN, at the floor.
    const placed = raw.map((row, r) =>
      r in sides.z.places
        ? Array.from({ length: columns }, (_, c) => (c in sides.x.places ? (row[c] ?? NaN) : NaN))
        : []
    )
    const grid = cleanGrid(placed)
    const target = gridValues(grid.data, sides)
    return {
      ...grid,
      ...sides,
      target,
      present: Object.fromEntries(Object.keys(target).map((k) => [k, 1])),
    }
  }, [raw, x, z, domain.x, domain.z])
}

/**
 * The grid with every height a number: one that is not - NaN, Infinity -
 * stands at the lowest of the others, so one cell cannot blank the surface.
 * With the lowest and the highest height, 0 for a grid without one.
 */
function cleanGrid(raw: number[][]) {
  const [floor = 0, peak = 0] = extent(raw.flat().filter(finite))
  const data = raw.map((row) => row.map((y) => (finite(y) ? y : floor)))
  return { data, floor, peak }
}

/** The height of every cell with a place, keyed by its row and column, gliding into new data. */
function gridValues(
  data: number[][],
  sides: Record<"x" | "z", { places: Record<number, number> }>
) {
  return Object.fromEntries(
    data.flatMap((row, r) =>
      row.flatMap((y, c) => (c in sides.x.places && r in sides.z.places ? [[`${r}-${c}`, y]] : []))
    )
  )
}

/**
 * The gliding heights as a lattice over the rows and columns they name. It
 * spans the cells still leaving too, so a shrunken grid sinks away instead
 * of popping; a corner only one dimension kept stands at the floor until it
 * goes. A column or row without a place is no line of it: new heights
 * glide a leaving one on while its place, and its fade, are gone.
 */
function gridLattice(
  tweened: Record<string, number>,
  places: Record<"x" | "z", Record<string, number>>,
  floor: number
) {
  const rows = new Set<number>()
  const columns = new Set<number>()
  for (const key of Object.keys(tweened)) {
    const [r, c] = key.split("-").map(Number)
    if (r in places.z) rows.add(r)
    if (c in places.x) columns.add(c)
  }
  const ascending = (set: Set<number>) => [...set].sort((a, b) => a - b)
  return ascending(rows).map((r) =>
    ascending(columns).map((c) => ({ r, c, y: tweened[`${r}-${c}`] ?? floor }))
  )
}
