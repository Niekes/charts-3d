"use client"

import * as React from "react"
import {
  points3D,
  polygons3D,
  sort,
  type Camera3DInstance,
  type Point3D,
  type Polygon,
} from "d3-3d"
import { geoOrthographic, geoPath } from "d3-geo"

import {
  GLOBE_RADIUS,
  Marks3D,
  axis,
  earth,
  faded,
  finite,
  nonNegative,
  globe,
  orthographic,
  shade,
  useChart3D,
  useTween,
  colorOf,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

export type GlobeChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per tile: the tile that holds an entry rises to its value, and the last entry on a tile wins. */
  data: T[]
  /**
   * The regions of the earth under the tiles, a GeoJSON feature collection,
   * cut at the horizon. d3-geo reads a region wound clockwise, the opposite
   * of RFC 7946: topojson-client's `feature` winds it so, and a region
   * wound the other way fills the globe around it.
   */
  land: GeoJSON.FeatureCollection
  /** The field of the longitude of an entry, in degrees east. */
  lon: keyof T & string
  /** The field of the latitude of an entry, in degrees north. */
  lat: keyof T & string
  /** The field of the value of an entry, the height of its tile; a value below 0, or one that is not a finite number, stands as 0. */
  value: keyof T & string
  /**
   * The field whose value is the config key of the color of a tile.
   * @defaultValue the first key of the chart config for every tile
   */
  series?: keyof T & string
  /**
   * The field that names an entry: the name of the last entry on a tile is
   * the title of its tooltip.
   * @defaultValue the label of the series
   */
  label?: keyof T & string
  /**
   * The width of a tile in degrees, a divisor of 180; one that is not
   * above 0 and up to 180 draws the default.
   * @defaultValue 5
   */
  step?: number
  /** Formats the value in the tooltip. */
  format?: (value: number) => React.ReactNode
  /**
   * What a tile says on hover: `tooltip` is what it would say, its name or
   * its series, its value and its center, `data` the entries on the tile;
   * `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entries: T[] }) => Tooltip3D | null
}

/** The width of a tile in degrees, unless the chart says. */
const STEP = 5

/** The height of a tile at the ceiling, in the world box. */
const HEIGHT = 0.4

/** One face of a tile that rises: its corners, lifted, with the id of the tile it belongs to. */
type Face = Point3D[] & { id: string; part: "top" | `side${number}` }

/** The fields of an entry: its place, its value and, if the chart has them, its series and its name. */
type Fields<T> = {
  lon: keyof T & string
  lat: keyof T & string
  value: keyof T & string
  series?: keyof T & string
  label?: keyof T & string
}

/** A tile with an entry: its id - center and config key - its value, its entries and, if the chart names entries, its name. */
type Tile<T> = { id: string; value: number; entries: T[]; name?: string }

/** What the tooltip of a tile reads: the config, the fields, the format and what the reader makes of it. */
type Reading<T extends Record<string, unknown>> = {
  config: ChartConfig
  fields: Fields<T>
} & Pick<GlobeChart3DProps<T>, "format" | "tooltip">

/**
 * A globe of tiles between meridians and parallels, `step` degrees wide, on
 * the land. The tile that holds an entry rises from the globe to the entry's
 * value, in the color of its series; one without an entry is not drawn.
 */
export function GlobeChart3D<T extends Record<string, unknown>>({
  data,
  land,
  lon,
  lat,
  value,
  series,
  label,
  step: requested = STEP,
  format,
  tooltip,
}: GlobeChart3DProps<T>) {
  const { config, camera } = useChart3D()
  // A step of 0 or below, NaN, Infinity or one wider than half the globe makes no tiles at all.
  const step = requested > 0 && requested <= 180 ? requested : STEP
  const fields = { lon, lat, value, series, label }
  const { tiles, target, present } = useTiles(data, fields, step, Object.keys(config)[0])
  // A tile grows from the globe as it fades in and shrinks back as it fades
  // out; the ceiling glides with the data, so the tallest tile never jumps.
  const heights = useTween(target, 0)
  const presence = useTween(present, 0)
  const peak = Object.values(target).reduce((max, v) => Math.max(max, v), 0)
  const { ceiling } = useTween({ ceiling: axis(0, peak).domain[1] })

  const eye = orthographic(camera)
  const ids = Object.keys(heights)
  const shapes = useShapes(ids, step)
  const tooltips = useTileTooltips(tiles, { config, fields, format, tooltip })
  const near = nearTiles(ids, shapes, step, eye)
  const prisms = polygons3D<Point3D>()
    .camera(eye)
    .data<Face>(prismFaces(near, shapes, heights, ceiling, eye.scale()))
    // Mirror tiles share a depth to the last bit, which the server and the
    // browser round differently: rounded, they tie, and the grid order paints
    // west before east on both, so the server HTML hydrates.
    .map((face) =>
      Object.assign(face, { centroid: { ...face.centroid, z: +face.centroid.z.toFixed(9) } })
    )
    .sort(sort)
    // The faces point outwards: the globe shows the ones facing the camera,
    // and hides what lies behind its center plane, as the ocean disc is drawn
    // first and a side of a far tile turned to the camera would show through.
    .filter((face) => face.ccw && face.centroid.z > 0)
    .map((face) =>
      prismMark(face, shapes.get(face.id)!.key, presence[face.id], tooltips.get(face.id))
    )

  const scenery = earth(land, camera, geoOrthographic(), geoPath).marks
  return <Marks3D marks={[...scenery, ...prisms]} />
}

/**
 * The tile of every entry, the value of each and its presence - built once
 * per change of the data, not at every frame the camera turns. A tile is
 * keyed by its place and its series, so a tile that changes color leaves as
 * one and enters as the other.
 */
function useTiles<T extends Record<string, unknown>>(
  data: T[],
  fields: Fields<T>,
  step: number,
  fallback: string
) {
  // The fields one by one: the record of them is new at every render.
  const { lon, lat, value, series, label } = fields
  return React.useMemo(() => {
    const tiles = tileValues(data, { lon, lat, value, series, label }, step, fallback)
    return {
      tiles,
      target: Object.fromEntries([...tiles.values()].map((t) => [t.id, t.value])),
      present: Object.fromEntries([...tiles.keys()].map((k) => [k, 1])),
    }
  }, [data, lon, lat, value, series, label, step, fallback])
}

/** Where a tile stands: the config key of its color, its center and its corners on the globe. */
type Shape = { key: string; center: Point3D; ground: Point3D[] }

/**
 * The shape of every tile `ids` names, read from its id once and not at
 * every frame the camera turns - the gone ones too, while they shrink - and
 * forgotten with the tile, so the memory stays the size of the globe.
 */
function useShapes(ids: string[], step: number) {
  const memory = React.useRef({ step, shapes: new Map<string, Shape>() })
  if (memory.current.step !== step) memory.current = { step, shapes: new Map() }
  const { shapes } = memory.current
  for (const id of ids) {
    if (shapes.has(id)) continue
    const { lon, lat, key } = tile(id)
    shapes.set(id, {
      key,
      center: globe(lon, lat, GLOBE_RADIUS),
      ground: corners(lon, lat, step, GLOBE_RADIUS),
    })
  }
  if (shapes.size > ids.length) {
    const live = new Set(ids)
    for (const id of shapes.keys()) if (!live.has(id)) shapes.delete(id)
  }
  return shapes
}

/**
 * What every tile says on hover, made once per change of the tiles or of
 * what reads them, not at every frame the camera turns; every face of a tile
 * shares it.
 */
function useTileTooltips<T extends Record<string, unknown>>(
  tiles: Map<string, Tile<T>>,
  { config, fields, format, tooltip }: Reading<T>
) {
  // The fields one by one: the record of them is new at every render.
  const { lon, lat, value, series, label } = fields
  return React.useMemo(() => {
    const reading = { config, fields: { lon, lat, value, series, label }, format, tooltip }
    return new Map([...tiles].map(([id, t]) => [id, tileTooltip(t, reading)]))
  }, [tiles, config, lon, lat, value, series, label, format, tooltip])
}

/**
 * The ids of the tiles whose center lies in front of the center plane of the
 * globe, or less than half a tile behind it: every face of any other tile is
 * behind the plane too, and projecting those only to cull them cost half the
 * frame.
 */
function nearTiles(ids: string[], shapes: Map<string, Shape>, step: number, eye: Camera3DInstance) {
  // Half a tile in the world box - y points down, so the north is negative:
  // a corner lies at most this far in front of its center.
  const edge = -globe(0, step / 2, GLOBE_RADIUS).y
  const centers = ids.map((id) => ({ id, ...shapes.get(id)!.center }))
  return points3D<{ id: string } & Point3D>()
    .camera(eye)
    .data(centers)
    .filter((p) => p.rotated.z > -edge)
    .map((p) => p.id)
}

/**
 * The tile of every entry - the last entry on a tile wins - keyed by the
 * center of the tile and the config key of its color, with its value and, if
 * the chart names entries, the name of that last entry, and every entry on
 * the tile.
 */
function tileValues<T extends Record<string, unknown>>(
  data: T[],
  fields: Fields<T>,
  step: number,
  fallback: string
) {
  const tiles = new Map<string, Tile<T>>()
  for (const d of data) {
    // An entry without a place on the globe has no tile.
    if (!finite(d[fields.lon]) || !finite(d[fields.lat])) continue
    const [lon, lat] = [Number(d[fields.lon]), Number(d[fields.lat])]
    const center = `${snap(lon, -180, 180, step)},${snap(lat, -90, 90, step)}`
    const key = fields.series ? String(d[fields.series]) : fallback
    tiles.set(center, {
      id: `${center},${key}`,
      value: nonNegative(d[fields.value]),
      entries: [...(tiles.get(center)?.entries ?? []), d],
      name: fields.label ? String(d[fields.label]) : undefined,
    })
  }
  return new Map([...tiles.values()].map((t) => [t.id, t]))
}

/** The center of the tile between `lo` and `hi` that holds `v`; the last tile holds the far edge and beyond. */
function snap(v: number, lo: number, hi: number, step: number) {
  const index = Math.min(Math.max(0, Math.floor((v - lo) / step)), Math.round((hi - lo) / step) - 1)
  return lo + (index + 0.5) * step
}

/** The center and the config key of a tile that rises, read back from its id. */
function tile(id: string) {
  const [lon, lat, ...key] = id.split(",")
  return { lon: Number(lon), lat: Number(lat), key: key.join(",") }
}

/**
 * The faces of the tiles `ids` - the top of each and, where the tile is a
 * pixel tall on screen, its four sides - the gone ones still shrinking among
 * them. A side thinner than a pixel draws nothing, and on a globe of
 * thousands of flat tiles the sides are most of the faces, so leaving them
 * out turns it about twice as fast.
 */
function prismFaces(
  ids: string[],
  shapes: Map<string, Shape>,
  heights: Record<string, number>,
  ceiling: number,
  scale: number
): Face[] {
  return ids.flatMap((id) => {
    const bottom = shapes.get(id)!.ground
    const lift = (heights[id] / ceiling) * HEIGHT
    // A point on the globe scales with its radius: the top is the ground, lifted.
    const k = (GLOBE_RADIUS + lift) / GLOBE_RADIUS
    const top = Object.assign(
      bottom.map((p) => ({ x: p.x * k, y: p.y * k, z: p.z * k })),
      { id, part: "top" as const }
    )
    if (lift * scale < 1) return [top]
    return [
      top,
      ...bottom.map((b, i) => {
        const j = (i + 1) % 4
        return Object.assign([b, bottom[j], top[j], top[i]], { id, part: `side${i}` as const })
      }),
    ]
  })
}

/** The corners of the tile around `lon` and `lat` at `radius`, wound to face outwards. */
function corners(lon: number, lat: number, step: number, radius: number): Point3D[] {
  const [w, e, s, n] = [lon - step / 2, lon + step / 2, lat - step / 2, lat + step / 2]
  return [globe(w, s, radius), globe(e, s, radius), globe(e, n, radius), globe(w, n, radius)]
}

/**
 * What a tile says on hover, made when the pointer lands on one of its
 * faces: its name, or the label of its series, over its value in the series
 * color and the center of the tile, labelled by the fields - or what
 * `tooltip` makes of that. A tile whose entries have left the data says
 * nothing.
 */
function tileTooltip<T extends Record<string, unknown>>(
  { id, value, name, entries }: Tile<T>,
  { config, fields, format, tooltip = (tip) => tip }: Reading<T>
): Mark3D["tooltip"] {
  return () => {
    const { lon, lat, key } = tile(id)
    return tooltip(
      {
        title: name ?? config[key]?.label ?? key,
        items: [
          { label: fields.value, value: format?.(value) ?? value, color: colorOf(key) },
          { label: fields.lat, value: lat },
          { label: fields.lon, value: lon },
        ],
      },
      { entries }
    )
  }
}

/**
 * The mark of one face of a tile that rises: shaded in the color of its
 * series and faded to its presence. Its group is the tile alone, so hovering
 * highlights one tile, not its series.
 */
function prismMark(
  face: Polygon<Point3D, Face>,
  key: string,
  presence: number,
  tooltip: Mark3D["tooltip"]
) {
  return {
    key: `${face.id}-${face.part}`,
    points: face.map((p) => p.projected),
    fill: faded(shade(face, colorOf(key)), presence),
    groups: [face.id],
    tooltip,
  }
}
