"use client"

import * as React from "react"
import { geoDistance, geoInterpolate, geoOrthographic, geoPath } from "d3-geo"
import { lineStrips3D, sort, type Point2D, type Point3D } from "d3-3d"

import {
  GLOBE_RADIUS,
  Marks3D,
  azimuth,
  azimuthAt,
  colorOf,
  earth,
  faded,
  finite,
  globe,
  orthographic,
  placeAt,
  placeOf,
  segment,
  useChart3D,
  useConfigKeys,
  usePoints,
  useRuns,
  useTween,
  type ChartConfig,
  type Mark3D,
  type Symbol3D,
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
   * The field that identifies a stop through updates, and names it in the
   * tooltip: a new
   * stop at the end of its route grows its leg from the stop before it, a
   * gone one draws its leg back. A name that repeats, as of a route that
   * comes back to a stop, is, in the order of the data, a stop of its own.
   * @defaultValue the position of the entry
   */
  id?: keyof T & string
  /**
   * The field that tells the routes apart: the entries of one value are one
   * route. The value is the config key of the route, which gives it its
   * color and its label wherever no `leg` names another.
   * @defaultValue the first key of the chart config, one route of all the entries
   */
  series?: keyof T & string
  /**
   * The field whose value is the config key of the leg that leads to a
   * stop, such as how it was travelled: the leg and the stop it arrives at
   * take that color, and the first stop of a route that of the leg that
   * leaves it. Any value names a leg but a missing or a blank one: a stop
   * that names none, and one no leg touches, keeps the color of its route.
   * @defaultValue none: every leg has the color of its route
   */
  leg?: keyof T & string
  /**
   * What a route says on hover, where the leg or the stop under the pointer
   * alone is highlighted: `tooltip` is what it would say, what its color
   * stands for - its leg, or else its series - over that stop, or the two
   * stops of that leg,
   * each with its latitude and longitude; `data` the entries of those stops;
   * `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entries: T[] }) => Tooltip3D | null
}

// The width of a leg, the radius of a stop and that of the disc of a tip, in the units of the view box.
const WIDTH = 2
const STOP = 3
const TIP = 8
// How far behind a tip the point lies that it comes from, as a share of its leg.
const BACK = 0.01
// The share of its leg a tip has flown when it has turned into its bearing.
const TURNED = 0.25
// How far behind a tip the place lies that a symbol on its way round points from, in radians.
const NEAR = 0.01
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
  leg,
  tooltip,
}: RoutesChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const fields = { lon, lat, id, series, leg }
  const stops = useStops(data, fields)
  const { named, entries, presence, target } = usePoints(stops, "x", "y", "z", id && "name")
  // The leg a stop names, none as "": a stop on its way out keeps it, and its color with it.
  const legOf = useConfigKeys(entries, "leg", "", presence)
  // A stop that comes, goes or moves travels the great circle, at an even pace.
  const runs = useRuns(named, series && "route", presence, target, overGlobe)
  const reading = { config, entries, fields, tooltip }
  const came = useCame(presence)
  const lists = runs.map((run) => pieces(run, legOf))
  // A route ends with its last run: one after a gap goes on from there.
  const last = new Map(runs.map((run, i) => [run.line, i]))
  const tips = runs.flatMap((run, i) =>
    last.get(run.line) === i ? tipIn(lists[i], run, reading, came) : []
  )
  const behindOf = useTurns(tips)
  for (const tip of tips) fly(tip, behindOf(tip))
  const routes = lineStrips3D<Point3D>()
    .camera(orthographic(camera))
    .data(lists.flat())
    // A piece on the far side is hidden by the globe; a tip is where its stop is, wherever it comes from.
    .filter((piece) => piece.slice(0, piece.symbol ? 1 : 2).every((p) => p.rotated.z > 0))
    // The stops lie over the legs and the tips over the stops, each among its own from back to front.
    .sort((a, b) => layer(a) - layer(b) || sort(a, b))
    .map((piece) => pieceMark(piece, routeTooltip(piece, reading)))

  const scenery = earth(land, camera, geoOrthographic(), geoPath).marks
  return <Marks3D marks={[...scenery, ...routes]} />
}

/** A place on the globe: its longitude and its latitude, in degrees. */
type Place = [number, number]

/** The point of the globe the marks lie on, over a place. */
const onGlobe = ([lon, lat]: Place) => globe(lon, lat, GLOBE_RADIUS)

/**
 * The point of the globe the `share` of the way from one to another along
 * the great circle between them, the shortest way over the surface, over the
 * date line too - where the straight way through the globe would rush past
 * its middle.
 */
function overGlobe(from: Point3D, to: Point3D, share: number) {
  const [lon, lat] = geoInterpolate(placeOf(from), placeOf(to))(share)
  return globe(lon, lat)
}

/** The fields of an entry the chart reads. */
type Fields<T> = Pick<
  RoutesChart3DProps<T & Record<string, unknown>>,
  "lon" | "lat" | "id" | "series" | "leg"
>

/**
 * The entries as the core reads points: each with its name, its route and
 * the leg it names, and, where it has a place, the point of the globe it
 * lies on, which the core glides. Built once per change of the data, not at
 * every frame the camera turns.
 */
function useStops<T extends Record<string, unknown>>(data: T[], fields: Fields<T>) {
  const { lon, lat, id, series, leg } = fields
  return React.useMemo(
    () =>
      data.map((entry) => ({
        entry,
        name: id && String(entry[id]),
        route: series && String(entry[series]),
        leg: legKey(leg && entry[leg]),
        ...(finite(entry[lon]) && finite(entry[lat])
          ? globe(Number(entry[lon]), Number(entry[lat]))
          : undefined),
      })),
    [data, lon, lat, id, series, leg]
  )
}

/** The config key a value of the `leg` field names: any value read as text, and none, "", for a missing or a blank one. */
const legKey = (value: unknown) => (value == null ? "" : String(value).trim())

/** A stop of a route: the point it glides as, which lies over its place, how far it has come, from 0 to 1, and whether it is on its way. */
type Stop = { name: string; seen: number; moves: boolean; at: Point3D }

/**
 * A part of a route on the globe: a stop, one point, or a piece of the leg
 * between the stops `names`, two. A tip with a symbol is a stop that has it,
 * and, where a leg arrives, the point behind it that it comes from.
 */
type Piece = Point3D[] & {
  key: string
  symbol?: Symbol3D
  /** The config key of its color, and whether a stop names it as the key of a leg. */
  colorKey: string
  named: boolean
  seen: number
  names: string[]
  group: string
}

/** What a tooltip and a tip are read from. */
type Reading<T extends Record<string, unknown>> = Pick<RoutesChart3DProps<T>, "tooltip"> & {
  config: ChartConfig
  entries: Map<string, { entry: T }>
  fields: Fields<T>
}

/** How a tip comes: where it is, the place behind it, if it comes from one, and how it comes by it. */
type Coming = { at: Place; back?: Place; how: "leg" | "kept" | "trail" | "pending" | "drawn" }

/** How every tip came when the chart last drew it, by the name of its stop. */
type Came = Map<string, Coming>

/**
 * How every tip came, kept as long as its stop is on screen, so a tip
 * without a leg has a bearing too: one whose leg has drawn back into it, as
 * on a tour that drops the stop it left, keeps the one it came with, and
 * one that moves points the way it goes.
 */
function useCame(presence: Record<string, number>) {
  const came: Came = React.useRef(new Map()).current
  for (const name of came.keys()) if (!(name in presence)) came.delete(name)
  return came
}

/**
 * The pieces of a run on the globe: every stop, and every leg between two
 * stops next to each other, cut along its great circle into pieces short
 * enough to bend with the globe - each sorts on its own depth, and one
 * beyond the horizon is hidden alone. A leg with a stop on its way grows or
 * draws back with it, a line that draws itself, and is whole all the while;
 * one whose stops both stand in place is seen as far as the better seen of
 * them, so the legs of a route that is all new fade in with its stops. A
 * leg has the color of the leg the stop it arrives at names, `legOf` it,
 * and so has that stop; the first stop has that of the leg that leaves it.
 * Where no leg is named, or none touches a stop, the color is that of the
 * route, `line`.
 */
function pieces(
  { line, points }: { line: string; points: Stop[] },
  legOf: (name: string) => string
): Piece[] {
  const places = points.map((stop) => placeOf(stop.at))
  // A piece is in focus with the stops it lies between: a leg whole, a stop alone.
  // The stop `by` names the leg that colors it; with no such leg, it has the color of its route.
  const piece = (points: Point3D[], key: string, seen: number, names: string[], by?: string) => {
    const leg = by === undefined ? "" : legOf(by)
    const [colorKey, named, group] = [leg || line, leg !== "", names.join("\u2192")]
    return Object.assign(points, { key, seen, names, group, colorKey, named })
  }
  return [
    ...points.slice(1).flatMap((to, i) => {
      const from = points[i]
      const along = geoInterpolate(places[i], places[i + 1])
      const count = Math.max(1, Math.ceil(geoDistance(places[i], places[i + 1]) / PIECE))
      return Array.from({ length: count }, (_, k) =>
        piece(
          [onGlobe(along(k / count)), onGlobe(along((k + 1) / count))],
          `${from.name}-${to.name}-${k}`,
          from.moves || to.moves ? 1 : Math.max(from.seen, to.seen),
          [from.name, to.name],
          to.name
        )
      )
    }),
    // A stop is the end of the leg that leads to it; the first one, of the leg that leaves it.
    ...points.map((stop, i) =>
      piece(
        [onGlobe(places[i])],
        stop.name,
        stop.seen,
        [stop.name],
        i ? stop.name : points[1]?.name
      )
    ),
  ]
}

/** The layer a piece is painted in: the legs, over them the stops, and over all the tips with a symbol. */
const layer = (piece: unknown[] & Pick<Piece, "symbol">) => (piece.symbol ? 2 : 2 - piece.length)

// Two places nearer than this, in radians of the great circle, are one place - millimetres
// on the earth: a place read back from its point on the globe is off by a last digit.
const SAME = 1e-9

/** The place the `share` of the way `from` one place `to` another, on their great circle; none where they are one place. */
const along = (from: Place, to: Place, share: number): Place | undefined =>
  geoDistance(from, to) > SAME ? geoInterpolate(from, to)(share) : undefined

/**
 * How a tip without a leg comes `at` a place, after how it came before. One
 * whose leg has only now drawn back into it has `kept` the bearing of that
 * leg, wherever it has got to since. Else it comes a little behind on its
 * `trail` from where it last was, and where it stands it comes as it did.
 */
function legless(was: Coming, at: Place): Coming {
  if (was.how === "leg" && was.back) {
    const far = geoDistance(was.at, was.back)
    return { at, how: "kept", back: placeAt(at, azimuth(was.at, was.back), far) }
  }
  const trail = along(was.at, at, 1 - BACK)
  return trail ? { at, how: "trail", back: trail } : { ...was, at }
}

/**
 * How the tip of a run comes, noted in `came` for the next time the chart
 * draws: along its `leg`, a little behind it on the leg that arrives, as
 * that leg is drawn, whichever of its stops is on its way; and without a
 * leg, as it came before. A tip that is new and whose leg has no length
 * yet, since it has only set out, is `pending`: its way shows with its next
 * step. One without a stop before it, which never came from anywhere, is as
 * it is `drawn`.
 */
function coming(stops: Stop[], came: Came): Coming {
  const [before, tip] = [stops[stops.length - 2], stops[stops.length - 1]]
  const [at, was] = [placeOf(tip.at), came.get(tip.name)]
  const leg = before && along(placeOf(before.at), at, 1 - BACK)
  const fresh: Coming = { at, how: before ? "pending" : "drawn" }
  const comes: Coming = leg ? { at, how: "leg", back: leg } : was ? legless(was, at) : fresh
  came.set(tip.name, comes)
  return comes
}

/**
 * The tip among the stops of a run, by its position: the last one that is
 * in the data or still seen. One that has left the data and has faded out
 * is gone, though it may still be on its way.
 */
function tipOf(stops: Stop[], entries: Map<string, unknown>) {
  let last = stops.length - 1
  while (last > 0 && !entries.has(stops[last].name) && stops[last].seen === 0) last -= 1
  return last
}

/**
 * The tip of a route with a symbol: its piece, its stop by name, how it
 * comes, and whether it is `whole` on its way, as its leg is: a tip that
 * grows its leg out of a stop that stands is the symbol that left that
 * stop, and does not fade in. One whose entry has left the data draws back
 * as it fades.
 */
type Tip = Coming & {
  piece: Piece
  line: string
  name: string
  symbol: Symbol3D
  whole: boolean
}

/**
 * The tip in the pieces of the last run of a route: its last stop, where
 * the config key that colors it - its leg, or else its route - has a symbol,
 * and none where it has not, so the stop stays the circle it is. The stops
 * are the last pieces of a run, in their order.
 */
function tipIn<T extends Record<string, unknown>>(
  list: Piece[],
  { line, points: stops }: { line: string; points: Stop[] },
  reading: Reading<T>,
  came: Came
): Tip[] {
  const last = tipOf(stops, reading.entries)
  const piece = list[list.length - stops.length + last]
  const symbol = reading.config[piece.colorKey]?.symbol
  if (!symbol) return []
  const tip = stops[last]
  const whole = reading.entries.has(tip.name) && tip.moves
  return [{ piece, line, name: tip.name, symbol, whole, ...coming(stops.slice(0, last + 1), came) }]
}

/** Makes the piece of a tip its symbol, with the point behind it that it comes from, where it has one. */
function fly({ piece, symbol, whole }: Tip, back?: Place) {
  if (back) piece.push(onGlobe(back))
  Object.assign(piece, { symbol, seen: whole ? 1 : piece.seen })
}

/**
 * What a route showed of its tip when the chart last drew it: which tip
 * and how it came, the glide of its turn by its key and where that glide
 * starts, and the way the place behind the tip lay from it - its `tail`, in
 * degrees clockwise from north - with how far off that the symbol still
 * was. A tip that is `held` shows what the tip before it did, until its own
 * way shows.
 */
type Shown = { tip: string; key: string; kick: number; tail: number; off: number; held: boolean }

/**
 * A turn in degrees as the shorter way round, from -180 to 180. Half a turn
 * goes clockwise, and so does one within a degree of it: a tip that flies
 * back the way it came reads its new bearing a little way along its leg,
 * so the two are not opposite to the last digit.
 */
function shorter(degrees: number) {
  const turn = (((degrees % 360) + 540) % 360) - 180
  return turn > 179 ? turn - 360 : turn
}

/**
 * The numbers of a turn the `share` of the way a tip has flown: all of the
 * way when the tip has flown the share of its leg that turns it, and slower
 * towards the end, so the symbol settles into its bearing.
 */
function turnedBy(from: Record<string, number>, ends: Record<string, number>, share: number) {
  const turned = 1 - (1 - Math.min(1, share / TURNED)) ** 2
  return Object.fromEntries(
    Object.entries(ends).map(([key, end]) => [key, from[key] + (end - from[key]) * turned])
  )
}

/** A tip whose symbol names the way it points, in degrees clockwise from up, and so turns. */
type Turning = Tip & { points: number }

/**
 * What a route shows of `tip` now, after what it showed before, in `memory`.
 * The tail of a tip is the way to the place behind it, and of one that
 * comes from nowhere the way its symbol, as it is drawn, seems to come
 * from: `drawn`. A tip whose way is pending holds what the route showed. A
 * tip that is new to its route, or comes another way than before, starts a
 * turn of its own, off by as far as the route pointed elsewhere, the
 * shorter way round; a route that is new shows its tip as it is.
 */
function shownOf(
  tip: Turning,
  memory: { shown: Map<string, Shown>; turns: number },
  drawn: (tip: Turning) => number
): Shown {
  const was = memory.shown.get(tip.line)
  if (tip.how === "pending" && was) return { ...was, held: true }
  const [id, tail] = tip.back
    ? [`${tip.name}\n${tip.how}`, azimuth(tip.at, tip.back)]
    : [`${tip.name}\ndrawn`, drawn(tip)]
  if (was?.tip === id) return { ...was, tail, held: false }
  const kick = was ? shorter(was.tail + was.off - tail) : 0
  memory.turns += 1
  return { tip: id, key: `${tip.line}\n${memory.turns}`, kick, tail, off: kick, held: false }
}

/**
 * The place behind a tip as its symbol shows it: the one it comes from, or,
 * while the symbol still turns or holds what the tip before it showed, one
 * that way round the tip - for a tip that comes from nowhere too, which
 * else shows as drawn.
 */
function swung(tip: Tip, turn?: Shown) {
  if (!turn?.off && !turn?.held) return tip.back
  return placeAt(tip.at, turn.tail + turn.off, NEAR)
}

/**
 * The turns of the tips: a bearing never jumps. Where the tip of a route
 * passes from one stop to another, takes its first leg or comes another way
 * than before, its symbol turns from the way the route pointed into its
 * bearing, the shorter way round, while it sets out - a glide of its own,
 * of how far off it still is, so new data on the way turns it on from where
 * it points. Gives the place behind a tip as its symbol shows it now.
 */
function useTurns(tips: Tip[]) {
  const { camera } = useChart3D()
  const memory = React.useRef({ shown: new Map<string, Shown>(), turns: 0 }).current
  const turning = tips.flatMap((tip) =>
    tip.symbol.points === undefined ? [] : [{ ...tip, points: tip.symbol.points }]
  )
  const drawn = (tip: Turning) => azimuthAt(camera, tip.at, tip.points) + 180
  memory.shown = new Map(turning.map((tip) => [tip.line, shownOf(tip, memory, drawn)]))
  const turns = [...memory.shown.values()]
  const off = useTween(
    Object.fromEntries(turns.map((turn) => [turn.key, 0])),
    (key) => turns.find((turn) => turn.key === key)?.kick,
    turnedBy
  )
  for (const turn of turns) turn.off = off[turn.key] ?? 0
  return (tip: Tip) => swung(tip, memory.shown.get(tip.line))
}

/**
 * The mark of a piece, projected, in its color, faded as far
 * as it is seen: a segment as wide as a leg, the circle of a stop, or the
 * symbol of a tip, turned to the way it comes, each of the two ringed
 * by the background. Its group is its leg, or its stop, so hovering
 * highlights the leg under the pointer alone, or the stop.
 */
function pieceMark(
  piece: { projected: Point2D }[] & Pick<Piece, "key" | "colorKey" | "seen" | "group" | "symbol">,
  tooltip: Mark3D["tooltip"]
): Mark3D {
  const mark = {
    key: piece.key,
    fill: faded(colorOf(piece.colorKey), piece.seen),
    groups: [piece.group],
    tooltip,
  }
  // The other point of a piece is the end of a leg, or the point a tip comes from.
  const [at, other] = piece.map((p) => p.projected)
  const stroke = faded("var(--background)", piece.seen)
  if (piece.symbol)
    return {
      ...mark,
      shape: "symbol",
      points: [at],
      r: TIP,
      stroke,
      symbol: piece.symbol,
      from: other,
    }
  return other
    ? { ...mark, points: segment(at, other, WIDTH) }
    : { ...mark, shape: "circle", points: [at], r: STOP, stroke }
}

/**
 * What a piece says on hover, made when the pointer lands on it: what its
 * color stands for - the leg a stop names, or else its route, where `series`
 * names one - over its stops - the one stop, or
 * the two of a leg - each by its name, or by the fields of its place, with
 * its latitude and longitude - or what `tooltip` makes of that. A piece
 * with a stop whose entry has left the data says nothing.
 */
function routeTooltip<T extends Record<string, unknown>>(
  { colorKey, named, names }: Pick<Piece, "colorKey" | "named" | "names">,
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
        title: named || series ? (config[colorKey]?.label ?? colorKey) : undefined,
        items: stops.map((d) => ({
          label: id ? String(d[id]) : `${lat}, ${lon}`,
          value: `${Number(d[lat])}, ${Number(d[lon])}`,
          color: colorOf(colorKey),
        })),
      },
      { entries: stops }
    )
}
