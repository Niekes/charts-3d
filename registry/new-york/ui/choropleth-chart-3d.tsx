"use client"

import * as React from "react"
import { geoArea, geoOrthographic, geoPath } from "d3-geo"

import {
  Marks3D,
  earth,
  faded,
  useChart3D,
  useTween,
  colorOf,
  type ChartConfig,
  type Mark3D,
  type Tooltip3D,
} from "@/registry/new-york/ui/chart-3d"

export type ChoroplethChart3DProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** One entry per region: the region an entry names takes its color, and the last entry on a region wins. */
  data: T[]
  /**
   * The regions of the earth, a GeoJSON feature collection, cut at the
   * horizon; the `id` of a feature is what an entry names. d3-geo reads a
   * region wound clockwise, the opposite of RFC 7946: topojson-client's
   * `feature` winds it so, and a region wound the other way fills the globe
   * around it.
   */
  land: GeoJSON.FeatureCollection
  /**
   * The field whose value, as a string, is the `id` of the region of the land
   * the entry colors: for world-atlas the ISO 3166-1 numeric code, `"276"`
   * for Germany.
   */
  id: keyof T & string
  /** The field of the value of an entry, shown in the tooltip of its region. */
  value: keyof T & string
  /**
   * The field whose value is the config key of the color of a region.
   * @defaultValue the first key of the chart config for every region
   */
  series?: keyof T & string
  /**
   * The field that names an entry: the title of the tooltip of its region.
   * @defaultValue the label of the series
   */
  label?: keyof T & string
  /** Formats the value in the tooltip. */
  format?: (value: number) => React.ReactNode
  /**
   * What a region says on hover: `tooltip` is what it would say, its name or
   * its series and its value, `data` the entry behind it; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

/** A region with an entry: its id in the land, the config key of its color, its value, the entry and, if the chart names entries, its name. */
type Region<T> = { rid: string; key: string; value: number; entry: T; name?: string }

/** The fields of an entry: its region, its value and, if the chart has them, its series and its name. */
type Fields<T> = {
  id: keyof T & string
  value: keyof T & string
  series?: keyof T & string
  label?: keyof T & string
}

/**
 * The regions of the land on a globe, each in the color of its class. The
 * region an entry names is colored over the land, in the config color of
 * its series; one without an entry stays land. Nothing grows: a region fades
 * in with its entry, out without it, and one that changes series leaves as
 * one and enters as the other.
 */
export function ChoroplethChart3D<T extends Record<string, unknown>>({
  data,
  land,
  id,
  value,
  series,
  label,
  format,
  tooltip,
}: ChoroplethChart3DProps<T>) {
  const { config, camera } = useChart3D()
  const largerFirst = useLargerFirst(land)
  const reading = { config, value, format, tooltip }
  const regions = regionValues(data, { id, value, series, label }, Object.keys(config)[0])
  // Keyed by the region and its series, so a region that changes color
  // leaves as one and enters as the other, each fading.
  const presence = useTween(
    Object.fromEntries([...regions.values()].map((r) => [JSON.stringify([r.rid, r.key]), 1])),
    0
  )

  // A region under an opaque color is drawn once: its land ring is left out.
  const opaque = new Set(
    Object.entries(presence).flatMap(([pid, o]) =>
      o >= 1 ? [(JSON.parse(pid) as [string])[0]] : []
    )
  )
  const {
    marks: scenery,
    path,
    sink,
  } = earth(
    { features: land.features.filter((f) => f.id === undefined || !opaque.has(String(f.id))) },
    camera,
    geoOrthographic(),
    geoPath
  )
  // A feature without an id is never colored.
  const features = new Map(
    land.features.filter((f) => f.id !== undefined).map((f) => [String(f.id), f])
  )
  const painted = Object.entries(presence).sort(([a], [b]) => largerFirst(a, b))
  const overlays = painted.flatMap(([pid, opacity]) => {
    const [rid, key] = JSON.parse(pid) as [string, string]
    const feature = features.get(rid)
    // An entry naming a region the land has not draws nothing.
    if (!feature) return []
    // A region still fading out has no entry, so it says nothing.
    const region = regions.get(rid)
    const says = region?.key === key ? regionTooltip(region, reading) : undefined
    // Its group is the region alone, so hovering highlights every ring of it.
    return sink
      .marks(() => path(feature), `region-${rid}-${key}`, faded(colorOf(key), opacity))
      .map((mark) => ({ ...mark, groups: [rid], tooltip: says }))
  })

  return <Marks3D marks={[...scenery, ...overlays]} />
}

/**
 * Orders the presence ids of two regions, the larger region first, so a
 * region inside another - Lesotho in South Africa - is painted on top, where
 * the pointer finds it.
 */
function useLargerFirst(land: GeoJSON.FeatureCollection) {
  const areas = React.useMemo(
    () => new Map(land.features.map((f) => [String(f.id), geoArea(f)])),
    [land]
  )
  const size = (pid: string) => areas.get((JSON.parse(pid) as [string])[0]) ?? 0
  return (a: string, b: string) => size(b) - size(a)
}

/**
 * What a region says on hover, made when the pointer lands on it: its name,
 * or the label of its series, over its value in the series color, labelled
 * by the field - or what `tooltip` makes of that.
 */
function regionTooltip<T extends Record<string, unknown>>(
  { key, value, name, entry }: Region<T>,
  {
    config,
    value: field,
    format,
    tooltip = (tip) => tip,
  }: { config: ChartConfig } & Pick<ChoroplethChart3DProps<T>, "value" | "format" | "tooltip">
): Mark3D["tooltip"] {
  return () =>
    tooltip(
      {
        title: name ?? config[key]?.label ?? key,
        items: [{ label: field, value: format?.(value) ?? value, color: colorOf(key) }],
      },
      { entry }
    )
}

/** The region of every entry - the last entry on a region wins - by the id it names. */
function regionValues<T extends Record<string, unknown>>(
  data: T[],
  fields: Fields<T>,
  fallback: string
) {
  const regions = new Map<string, Region<T>>()
  for (const d of data) {
    const rid = String(d[fields.id])
    regions.set(rid, {
      rid,
      key: fields.series ? String(d[fields.series]) : fallback,
      value: Number(d[fields.value]) || 0,
      entry: d,
      name: fields.label ? String(d[fields.label]) : undefined,
    })
  }
  return regions
}
