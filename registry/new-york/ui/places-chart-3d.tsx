"use client"

import * as React from "react"
import { points3D, sort, type Point3D, type TransformedPoint } from "d3-3d"
import { geoOrthographic, geoPath } from "d3-geo"

import {
  GLOBE_RADIUS,
  Marks3D,
  earth,
  faded,
  finite,
  nonNegative,
  globe,
  orthographic,
  useChart3D,
  useTween,
  colorOf,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

export type PlacesChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per place: a dot on the globe. */
  data: T[]
  /**
   * The regions of the earth under the dots, a GeoJSON feature collection,
   * cut at the horizon. d3-geo reads a region wound clockwise, the opposite
   * of RFC 7946: topojson-client's `feature` winds it so, and a region
   * wound the other way fills the globe around it.
   */
  land: GeoJSON.FeatureCollection
  /** The field of the longitude of an entry, in degrees east. */
  lon: keyof T & string
  /** The field of the latitude of an entry, in degrees north. */
  lat: keyof T & string
  /**
   * The field of the value of an entry: the area of its dot, relative to the
   * largest; a value below 0, or one that is not a finite number, stands as 0.
   * @defaultValue every dot the same size
   */
  value?: keyof T & string
  /**
   * The field whose value is the config key of the color of a dot.
   * @defaultValue the first key of the chart config for every dot
   */
  series?: keyof T & string
  /**
   * The field that names an entry: the title of its tooltip, and its identity
   * through updates, so a new dot grows, a gone one shrinks away and one that
   * moves glides. The names should be unique.
   * @defaultValue the place of the entry
   */
  id?: keyof T & string
  /**
   * The radius of the largest dot - of every dot, without `value` - in the
   * units of the view box.
   * @defaultValue 6
   */
  radius?: number
  /** Formats the value in the tooltip. */
  format?: (value: number) => React.ReactNode
  /**
   * What a dot says on hover: `tooltip` is what it would say, its name or
   * its series, its value and its place, `data` the entry behind it; `null`
   * shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

/** A dot by name, on the sphere, before the camera projects it. */
type Dot = Point3D & { name: string }

/** Where a dot is and which config key colors it, remembered while it leaves. */
type Place = { lon: number; lat: number; key: string }

/** The fields of an entry: its place and, if the chart has them, its value, its series and its name. */
type Fields<T> = {
  lon: keyof T & string
  lat: keyof T & string
  value?: keyof T & string
  series?: keyof T & string
  id?: keyof T & string
}

/** What a dot reads for its mark: the config, the fields, the largest radius, the format and what the reader makes of its tooltip. */
type Reading<T extends Record<string, unknown>> = {
  config: ChartConfig
  fields: Fields<T>
  radius: number
} & Pick<PlacesChart3DProps<T>, "format" | "tooltip">

/**
 * Dots on the land of a globe, one per place, its area its value. A dot on
 * the far side is hidden by the globe.
 */
export function PlacesChart3D<T extends Record<string, unknown>>({
  data,
  land,
  lon,
  lat,
  value,
  series,
  id,
  radius = 6,
  format,
  tooltip,
}: PlacesChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const fields = { lon, lat, value, series, id }
  // An entry without a place on the globe has no dot.
  const entries = data.filter((d) => finite(d[lon]) && finite(d[lat]))
  const names = entries.map((d) => (id ? String(d[id]) : `${Number(d[lon])},${Number(d[lat])}`))
  // The area of a dot is its value, from 0, so a new one grows as it fades
  // in and a gone one shrinks as it fades out; the peak glides along, so no
  // dot jumps when the largest leaves.
  const target = Object.fromEntries(
    entries.map((d, i) => [names[i], value ? nonNegative(d[value]) : 1])
  )
  const sizes = useTween(target, 0)
  const opacity = useTween(Object.fromEntries(names.map((name) => [name, 1])), 0)
  const { peak } = useTween({ peak: Math.max(0, ...Object.values(target)) })
  const place = usePlaces(names, entries, fields, Object.keys(config)[0], sizes)

  const reading = { config, fields, radius, format, tooltip }
  const behind = new Map(entries.map((d, i) => [names[i], d]))
  const dots = points3D<Dot>()
    .camera(orthographic(camera))
    .x((p) => p.x)
    .y((p) => p.y)
    .z((p) => p.z)
    .data(
      Object.keys(sizes).map((name) => {
        const { lon, lat } = place(name)
        return { name, ...globe(lon, lat, GLOBE_RADIUS) }
      })
    )
    // A dot on the far side is hidden by the globe.
    .filter((p) => p.rotated.z > 0)
    .sort(sort)
    .map((p) =>
      dotMark(
        p,
        place(p.name),
        sizes[p.name] / (peak || 1),
        behind.get(p.name),
        opacity[p.name],
        reading
      )
    )

  const scenery = earth(land, camera, geoOrthographic(), geoPath).marks
  return <Marks3D marks={[...scenery, ...dots]} />
}

/**
 * The mark of one dot: a circle whose area is its share of the peak, in the
 * color of its series, faded to its presence and ringed by the background so
 * that dots in front stand out. Its group is the dot alone, so hovering
 * highlights that dot only.
 */
function dotMark<T extends Record<string, unknown>>(
  p: TransformedPoint<Dot>,
  place: Place,
  share: number,
  entry: T | undefined,
  presence: number,
  reading: Reading<T>
) {
  return {
    key: p.name,
    points: [p.projected],
    r: reading.radius * Math.sqrt(share),
    fill: faded(colorOf(place.key), presence),
    stroke: faded("var(--background)", presence),
    groups: [p.name],
    tooltip: dotTooltip(p.name, place, entry, reading),
  }
}

/**
 * What a dot says on hover, made when the pointer lands on it - thousands of
 * dots, one tooltip: its name, or its series, over its value and its place,
 * labelled by the fields - or what `tooltip` makes of that. A dot whose
 * entry has left the data says nothing.
 */
function dotTooltip<T extends Record<string, unknown>>(
  name: string,
  { lon, lat, key }: Place,
  entry: T | undefined,
  { config, fields, format, tooltip = (tip) => tip }: Reading<T>
): Mark3D["tooltip"] {
  if (!entry) return undefined
  const value = fields.value ? nonNegative(entry[fields.value]) : 0
  return () =>
    tooltip(
      {
        title: fields.id ? name : (config[key]?.label ?? key),
        items: [
          ...(fields.value
            ? [
                {
                  label: fields.value,
                  value: format?.(value) ?? value,
                  color: colorOf(key),
                },
              ]
            : []),
          { label: fields.lat, value: lat },
          { label: fields.lon, value: lon },
        ],
      },
      { entry }
    )
}

/**
 * The place and the config key of every dot, by name - remembered while a
 * gone dot shrinks away, since its entry has already left the data - and
 * forgotten with the dot, so the memory stays the size of the chart.
 */
function usePlaces<T extends Record<string, unknown>>(
  names: string[],
  data: T[],
  fields: Fields<T>,
  fallback: string,
  alive: Record<string, number>
) {
  const known = React.useRef(new Map<string, Place>())
  data.forEach((d, i) =>
    known.current.set(names[i], {
      lon: Number(d[fields.lon]),
      lat: Number(d[fields.lat]),
      key: fields.series ? String(d[fields.series]) : fallback,
    })
  )
  const live = new Set(names)
  for (const name of known.current.keys()) {
    if (!(name in alive) && !live.has(name)) known.current.delete(name)
  }
  return (name: string) => known.current.get(name)!
}
