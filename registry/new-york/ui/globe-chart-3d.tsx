"use client"

import * as React from "react"
import { polygons3D, sort, type Point3D, type Polygon } from "d3-3d"

import {
  Marks3D,
  axis,
  faded,
  globe,
  shade,
  useChart3D,
  useTween,
  type ChartConfig,
} from "@/registry/new-york/ui/chart-3d"

export type GlobeChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per tile: the tile that holds an entry rises to its value, and the last entry on a tile wins. */
  data: T[]
  /** The field of the longitude of an entry, in degrees east. */
  lon: keyof T & string
  /** The field of the latitude of an entry, in degrees north. */
  lat: keyof T & string
  /** The field of the value of an entry, the height of its tile; a value below 0, or none, stands as 0. */
  value: keyof T & string
  /**
   * The field whose value is the config key of the color of a tile.
   * @defaultValue the first key of the chart config for every tile
   */
  series?: keyof T & string
  /**
   * The width of a tile in degrees, a divisor of 180.
   * @defaultValue 5
   */
  step?: number
  /** Formats the value in the tooltip. */
  format?: (value: number) => React.ReactNode
}

/** The radius of the globe in the world box, and the height of a tile at the ceiling. */
const RADIUS = 1.15
const HEIGHT = 0.4

/** One face of the globe: the corners of a tile, flat or lifted, with the id of the tile it belongs to. */
type Face = Point3D[] & { id: string; part: "tile" | "top" | `side${number}` }

/** The fields of an entry: its place, its value and, if the chart has one, its series. */
type Fields<T> = {
  lon: keyof T & string
  lat: keyof T & string
  value: keyof T & string
  series?: keyof T & string
}

/**
 * A globe of tiles between meridians and parallels, `step` degrees wide. The
 * tile that holds an entry rises from the globe to the entry's value, in the
 * color of its series; an empty tile lies flat in the wall color, so the
 * tiles together are the globe.
 */
export function GlobeChart3D<T extends Record<string, unknown>>({
  data,
  lon,
  lat,
  value,
  series,
  step = 5,
  format,
}: GlobeChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const fields = { lon, lat, value, series }
  // The value of every tile with an entry, keyed by the tile and its series,
  // so a tile that changes color leaves as one and enters as the other.
  const target = tileValues(data, fields, step, Object.keys(config)[0])
  // A tile grows from the globe as it fades in and shrinks back as it fades
  // out; the ceiling glides with the data, so the tallest tile never jumps.
  const heights = useTween(target, 0)
  const presence = useTween(Object.fromEntries(Object.keys(target).map((k) => [k, 1])), 0)
  const peak = Object.values(target).reduce((max, v) => Math.max(max, v), 0)
  const { ceiling } = useTween({ ceiling: axis(0, peak).domain[1] })

  const marks = polygons3D<Point3D>()
    .camera(camera)
    .data<Face>([...gridFaces(step), ...prismFaces(heights, ceiling, step)])
    // Mirror tiles share a depth to the last bit, which the server and the
    // browser round differently: rounded, they tie, and the grid order paints
    // west before east on both, so the server HTML hydrates.
    .map((face) =>
      Object.assign(face, { centroid: { ...face.centroid, z: +face.centroid.z.toFixed(9) } })
    )
    .sort(sort)
    // The faces point outwards: the globe shows the ones facing the camera.
    .filter((face) => face.ccw)
    .map((face) =>
      face.part === "tile"
        ? tileMark(face)
        : prismMark(face, heights[face.id], presence[face.id], { config, fields, format })
    )

  return <Marks3D marks={marks} />
}

/**
 * The value of the tile of every entry - the last entry on a tile wins -
 * keyed by the center of the tile and the config key of its color.
 */
function tileValues<T extends Record<string, unknown>>(
  data: T[],
  fields: Fields<T>,
  step: number,
  fallback: string
) {
  const tiles = new Map<string, [string, number]>()
  for (const d of data) {
    const [lon, lat] = [Number(d[fields.lon]), Number(d[fields.lat])]
    // An entry without a place on the globe has no tile.
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    const center = `${snap(lon, -180, 180, step)},${snap(lat, -90, 90, step)}`
    const key = fields.series ? String(d[fields.series]) : fallback
    tiles.set(center, [`${center},${key}`, Math.max(0, Number(d[fields.value]) || 0)])
  }
  return Object.fromEntries(tiles.values())
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

/** The flat tiles of the whole grid, `step` degrees wide, west to east and south to north. */
function gridFaces(step: number): Face[] {
  const rows = Math.round(180 / step)
  return Array.from({ length: Math.round(360 / step) * rows }, (_, i) => {
    const lon = -180 + (Math.floor(i / rows) + 0.5) * step
    const lat = -90 + ((i % rows) + 0.5) * step
    return Object.assign(corners(lon, lat, step, RADIUS), {
      id: `${lon},${lat}`,
      part: "tile" as const,
    })
  })
}

/** The faces of every tile that rises - its top and its four sides - the gone ones still shrinking among them. */
function prismFaces(heights: Record<string, number>, ceiling: number, step: number): Face[] {
  return Object.entries(heights).flatMap(([id, value]) => {
    const { lon, lat } = tile(id)
    const bottom = corners(lon, lat, step, RADIUS)
    const top = corners(lon, lat, step, RADIUS + (value / ceiling) * HEIGHT)
    return [
      Object.assign(top, { id, part: "top" as const }),
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

/** The mark of a flat tile: the wall color, lit from the upper left, nothing on hover. */
function tileMark(face: Polygon<Point3D, Face>) {
  return {
    key: `${face.id}-${face.part}`,
    points: face.map((p) => p.projected),
    fill: shade(face, "var(--muted)"),
  }
}

/**
 * The mark of one face of a tile that rises: shaded in the color of its
 * series and faded to its presence, with the series, the value and the
 * center of the tile on hover. Its group is the tile alone, so hovering
 * highlights one tile, not its series.
 */
function prismMark<T extends Record<string, unknown>>(
  face: Polygon<Point3D, Face>,
  value: number,
  presence: number,
  {
    config,
    fields,
    format,
  }: { config: ChartConfig; fields: Fields<T>; format?: (value: number) => React.ReactNode }
) {
  const { lon, lat, key } = tile(face.id)
  const color = `var(--color-${key})`
  return {
    key: `${face.id}-${face.part}`,
    points: face.map((p) => p.projected),
    fill: faded(shade(face, color), presence),
    groups: [face.id],
    tooltip: {
      title: config[key]?.label ?? key,
      items: [
        { label: fields.value, value: format ? format(value) : value, color },
        { label: fields.lat, value: lat },
        { label: fields.lon, value: lon },
      ],
    },
  }
}
