"use client"

import * as React from "react"
import { geoDistance, geoInterpolate, geoOrthographic, geoPath } from "d3-geo"
import { lineStrips3D, sort, type Point2D, type Point3D } from "d3-3d"

import {
  GLOBE_RADIUS,
  Marks3D,
  colorOf,
  earth,
  faded,
  finite,
  globe,
  orthographic,
  placeOf,
  segment,
  useChart3D,
  usePoints,
  useRuns,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

export type RoutesChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * One entry per stop, in the order its route visits them. One whose
   * longitude or latitude is missing or not a number is no stop: its route
   * ends before it and starts again after it.
   */
  data: T[]
  /** The land under the routes: the regions of a GeoJSON `FeatureCollection`. */
  land: GeoJSON.FeatureCollection
  /** The field of the longitude of a stop, in degrees east. */
  lon: keyof T & string
  /** The field of the latitude of a stop, in degrees north. */
  lat: keyof T & string
  /**
   * The field that names a stop, in the tooltip and through updates: a new
   * stop at the end of its route grows its leg from the stop before it, a
   * gone one draws its leg back. A name that repeats, as of a route that
   * comes back to a stop, is, in the order of the data, a stop of its own.
   * @defaultValue the position of the entry
   */
  id?: keyof T & string
  /**
   * The field whose value is the config key of the route of a stop: the
   * entries of one key are one route.
   * @defaultValue the first key of the chart config, one route of all the entries
   */
  series?: keyof T & string
  /**
   * What a route says on hover: `tooltip` is what it would say, its series
   * over the stop under the pointer, or the two stops of the leg under it,
   * each with its latitude and longitude; `data` the entries of those stops;
   * `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entries: T[] }) => Tooltip3D | null
}

// The width of a leg and the radius of a stop, in the units of the view box.
const WIDTH = 2
const STOP = 3
// The length of a piece of a leg, in radians of the great circle: two degrees.
const PIECE = Math.PI / 90

/**
 * Routes over a globe: the entries of `data` are stops at their fields `lon`
 * and `lat`, joined in the order of the data along the great circle - the
 * shortest way over the surface. `series` names the field whose value is the
 * config key of a route; without it all the entries are one route.
 */
export function RoutesChart3D<T extends Record<string, unknown>>({
  data,
  land,
  lon,
  lat,
  id,
  series,
  tooltip,
}: RoutesChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const stops = useStops(data, { lon, lat, id, series })
  const { named, entries, presence, read } = usePoints(stops, "x", "y", "z", id && "name")
  // A stop that comes or goes travels the great circle from its neighbour.
  const runs = useRuns(
    named,
    series && "route",
    presence,
    (name) => placeOf({ x: read(name, "x"), y: read(name, "y"), z: read(name, "z") }),
    (from, to, k) => geoInterpolate(from, to)(k)
  )
  const reading = { config, entries, fields: { lon, lat, id, series }, tooltip }
  const routes = lineStrips3D<Point3D>()
    .camera(orthographic(camera))
    .data(runs.flatMap(pieces))
    // A piece on the far side is hidden by the globe.
    .filter((piece) => piece.every((p) => p.rotated.z > 0))
    // The stops lie over the legs, each among its own from back to front.
    .sort((a, b) => b.length - a.length || sort(a, b))
    .map((piece) => pieceMark(piece, routeTooltip(piece, reading)))

  const scenery = earth(land, camera, geoOrthographic(), geoPath).marks
  return <Marks3D marks={[...scenery, ...routes]} />
}

/** A place on the globe: its longitude and its latitude, in degrees. */
type Place = [number, number]

/** The fields of an entry the chart reads. */
type Fields<T> = Pick<
  RoutesChart3DProps<T & Record<string, unknown>>,
  "lon" | "lat" | "id" | "series"
>

/**
 * The entries as the core reads points: each with its name and its route,
 * and, where it has a place, the point of the globe it lies on. A stop that
 * moves glides as that point, through the globe, so it takes the shortest
 * way to its new place, over the date line too. Built once per change of the
 * data, not at every frame the camera turns.
 */
function useStops<T extends Record<string, unknown>>(data: T[], fields: Fields<T>) {
  const { lon, lat, id, series } = fields
  return React.useMemo(
    () =>
      data.map((entry) => ({
        entry,
        name: id && String(entry[id]),
        route: series && String(entry[series]),
        ...(finite(entry[lon]) && finite(entry[lat])
          ? globe(Number(entry[lon]), Number(entry[lat]))
          : undefined),
      })),
    [data, lon, lat, id, series]
  )
}

/** A stop of a route, where it is now, and how far it has come, from 0 to 1. */
type Stop = { name: string; seen: number; anchored: boolean; at: Place }

/** A part of a route on the globe: a stop, one point, or a piece of the leg between the stops `names`, two. */
type Piece = Point3D[] & { key: string; line: string; seen: number; names: string[] }

/** What a tooltip is read from. */
type Reading<T extends Record<string, unknown>> = Pick<RoutesChart3DProps<T>, "tooltip"> & {
  config: ChartConfig
  entries: Map<string, { entry: T }>
  fields: Fields<T>
}

/**
 * The pieces of a run on the globe: every stop, and every leg between two
 * stops next to each other, cut along its great circle into pieces short
 * enough to bend with the globe - each sorts on its own depth, and one
 * beyond the horizon is hidden alone. A leg with a stop on its way grows or
 * draws back with it, a line that draws itself, and is whole all the while;
 * one whose stops both stand in place is seen as far as the better seen of
 * them, so the legs of a route that is all new fade in with its stops.
 */
function pieces({ line, points }: { line: string; points: Stop[] }): Piece[] {
  const on = ([lon, lat]: Place) => globe(lon, lat, GLOBE_RADIUS)
  const piece = (points: Point3D[], key: string, seen: number, names: string[]) =>
    Object.assign(points, { key, line, seen, names })
  return [
    ...points.slice(1).flatMap((to, i) => {
      const from = points[i]
      const along = geoInterpolate(from.at, to.at)
      const count = Math.max(1, Math.ceil(geoDistance(from.at, to.at) / PIECE))
      return Array.from({ length: count }, (_, k) =>
        piece(
          [on(along(k / count)), on(along((k + 1) / count))],
          `${from.name}-${to.name}-${k}`,
          from.anchored || to.anchored ? 1 : Math.max(from.seen, to.seen),
          [from.name, to.name]
        )
      )
    }),
    ...points.map((stop) => piece([on(stop.at)], stop.name, stop.seen, [stop.name])),
  ]
}

/**
 * The mark of a piece, projected, in the color of its route, faded as far
 * as it is seen: a segment as wide as a leg, or the circle of a stop, ringed
 * by the background. Its group is the route, so hovering highlights the
 * whole route.
 */
function pieceMark(
  piece: { projected: Point2D }[] & Pick<Piece, "key" | "line" | "seen">,
  tooltip: Mark3D["tooltip"]
): Mark3D {
  const mark = {
    key: piece.key,
    fill: faded(colorOf(piece.line), piece.seen),
    groups: [piece.line],
    tooltip,
  }
  const at = piece.map((p) => p.projected)
  return at.length > 1
    ? { ...mark, points: segment(at[0], at[1], WIDTH) }
    : { ...mark, points: at, r: STOP, stroke: faded("var(--background)", piece.seen) }
}

/**
 * What a piece says on hover, made when the pointer lands on it: the series
 * of its route, where `series` names one, over its stops - the one stop, or
 * the two of a leg - each by its name, or by the fields of its place, with
 * its latitude and longitude - or what `tooltip` makes of that. A piece
 * with a stop whose entry has left the data says nothing.
 */
function routeTooltip<T extends Record<string, unknown>>(
  { line, names }: Pick<Piece, "line" | "names">,
  { config, entries, fields, tooltip = (tip) => tip }: Reading<T>
): Mark3D["tooltip"] {
  const stops = names.flatMap((name) => {
    const stop = entries.get(name)
    return stop ? [stop.entry] : []
  })
  if (stops.length < names.length) return undefined
  const { lon, lat, id, series } = fields
  return () =>
    tooltip(
      {
        title: series ? (config[line]?.label ?? line) : undefined,
        items: stops.map((d) => ({
          label: id ? String(d[id]) : `${lat}, ${lon}`,
          value: `${Number(d[lat])}, ${Number(d[lon])}`,
          color: colorOf(line),
        })),
      },
      { entries: stops }
    )
}
