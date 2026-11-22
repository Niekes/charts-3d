"use client"

import * as React from "react"
import { group } from "d3-array"
import { geoArea, geoOrthographic, geoPath } from "d3-geo"

import {
  Marks3D,
  earth,
  faded,
  finite,
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
   * The field that identifies an entry by its region: its value, as a string,
   * is the `id` of the region of the land the entry colors - for world-atlas
   * the ISO 3166-1 numeric code, `"276"` for Germany.
   */
  id: keyof T & string
  /**
   * The field of the value of an entry, shown in the tooltip of its region;
   * one that is not a finite number is missing, and the tooltip leaves it out.
   */
  value: keyof T & string
  /**
   * The field whose value is the config key of the color of a region.
   * @defaultValue the first key of the chart config for every region
   */
  series?: keyof T & string
  /**
   * The field that titles the tooltip of the region of an entry.
   * @defaultValue the label of the series
   */
  label?: keyof T & string
  /** Formats the value in the tooltip. */
  format?: { value?: (value: number) => React.ReactNode }
  /**
   * What a region says on hover: `tooltip` is what it would say, its name or
   * its series and its value, `data` the entry behind it; `null` shows none.
   * @defaultValue (tooltip) => tooltip
   */
  tooltip?: (tooltip: Tooltip3D, data: { entry: T }) => Tooltip3D | null
}

/** A region with an entry: its id in the land, the config key of its color, its value, the entry and, if the chart names entries, its name. */
type Region<T> = { rid: string; key: string; value?: number; entry: T; name?: string }

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
  const { regions, present } = useRegions(
    data,
    { id, value, series, label },
    Object.keys(config)[0]
  )
  const presence = useTween(present, 0)

  // A region under an opaque color is drawn once: its land ring is left out.
  const opaque = opaqueOf(presence)
  // A feature without an id is never colored: it is scenery, under every region.
  const {
    marks: scenery,
    path,
    sink,
    ground,
  } = earth(
    { features: land.features.filter((f) => f.id === undefined) },
    camera,
    geoOrthographic(),
    geoPath
  )
  // A region may be several features, as a mainland and its islands.
  const features = group(
    land.features.filter((f) => f.id !== undefined),
    (f) => String(f.id)
  )
  const colors = group(Object.entries(presence), ([pid]) => (JSON.parse(pid) as [string])[0])
  const paint = (part: GeoJSON.Feature, key: string, fill: string) =>
    sink.marks(() => path(part), key, fill)
  // Every region of the land, its land and then its colors, the larger first: a region inside
  // another - Lesotho in South Africa - lies over it, colored or not. An entry naming a
  // region the land has not draws nothing.
  const regionMarks = [...features.keys()].sort(largerFirst).flatMap((rid) => {
    const parts = features.get(rid)!
    const soil = opaque.has(rid)
      ? []
      : parts.flatMap((part, i) => ground(part, `ground-${rid}-${i}`))
    // A region still fading out has no entry, so it says nothing.
    const region = regions.get(rid)
    const says = (key: string) => (region?.key === key ? regionTooltip(region, reading) : undefined)
    return [...soil, ...overlaysOf(rid, parts, colors.get(rid) ?? [], paint, says)]
  })

  return <Marks3D marks={[...scenery, ...regionMarks]} />
}

/** The regions whose color has fully come in, by the presence of every region and series. */
function opaqueOf(presence: Record<string, number>) {
  return new Set(
    Object.entries(presence).flatMap(([pid, o]) =>
      o >= 1 ? [(JSON.parse(pid) as [string])[0]] : []
    )
  )
}

/**
 * The colors of the region `rid`, its `parts` painted in the series of each
 * of its `colors` - a presence id and how far it has come - faded as it
 * enters or leaves. Its group is the region alone, so hovering highlights
 * every ring of it.
 */
function overlaysOf(
  rid: string,
  parts: GeoJSON.Feature[],
  colors: [string, number][],
  paint: (part: GeoJSON.Feature, key: string, fill: string) => Mark3D[],
  says: (key: string) => Mark3D["tooltip"]
) {
  return colors.flatMap(([pid, opacity]) => {
    const key = (JSON.parse(pid) as [string, string])[1]
    const tooltip = says(key)
    return parts.flatMap((part, i) =>
      paint(part, `region-${rid}-${key}-${i}`, faded(colorOf(key), opacity)).map((mark) => ({
        ...mark,
        groups: [rid],
        tooltip,
      }))
    )
  })
}

/**
 * Orders two regions by their ids, the larger region first, so a region
 * inside another - Lesotho in South Africa - is painted on top, where the
 * pointer finds it.
 */
function useLargerFirst(land: GeoJSON.FeatureCollection) {
  const areas = React.useMemo(() => {
    // A region of several features is as large as all of them.
    const areas = new Map<string, number>()
    for (const f of land.features)
      areas.set(String(f.id), (areas.get(String(f.id)) ?? 0) + geoArea(f))
    return areas
  }, [land])
  // Every id the chart orders is that of a feature of `land`, so every one has an area.
  return (a: string, b: string) => areas.get(b)! - areas.get(a)!
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
        // A missing value is no measured 0: the tooltip leaves it out.
        items:
          value === undefined
            ? []
            : [{ label: field, value: format?.value?.(value) ?? value, color: colorOf(key) }],
      },
      { entry }
    )
}

/**
 * The region of every entry and its presence - built once per change of the
 * data, not at every frame the camera turns. The presence is keyed by the
 * region and its series, so a region that changes color leaves as one and
 * enters as the other, each fading.
 */
function useRegions<T extends Record<string, unknown>>(
  data: T[],
  fields: Fields<T>,
  fallback: string
) {
  // The fields one by one: the record of them is new at every render.
  const { id, value, series, label } = fields
  return React.useMemo(() => {
    const regions = regionValues(data, { id, value, series, label }, fallback)
    return {
      regions,
      present: Object.fromEntries(
        [...regions.values()].map((r) => [JSON.stringify([r.rid, r.key]), 1])
      ),
    }
  }, [data, id, value, series, label, fallback])
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
      value: finite(d[fields.value]) ? Number(d[fields.value]) : undefined,
      entry: d,
      // An entry without a label is named by its series, never "undefined".
      name: fields.label && d[fields.label] != null ? String(d[fields.label]) : undefined,
    })
  }
  return regions
}
