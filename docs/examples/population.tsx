import type { CSSProperties } from "react"

import type { ChartConfig } from "@/components/ui/chart-3d"
import { places } from "@/docs/examples/places"
import { Select } from "@/docs/examples/renderer-select"

// The nine classes of the people on a tile: the steps of the square root up
// to 10 million, as the world population of globe.gl colors its hexagons,
// rounded so the legend reads, in YlOrRd of d3-scale-chromatic.
const BOUNDS = [125e3, 500e3, 1e6, 2e6, 3e6, 4.5e6, 6e6, 8e6]
const YL_OR_RD = [
  "#ffffcc",
  "#ffeda0",
  "#fed976",
  "#feb24c",
  "#fd8d3c",
  "#fc4e2a",
  "#e31a1c",
  "#bd0026",
  "#800026",
]

const formatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
/** A number as the legend and the tooltip show it: `125K`, `4.5M`, `1.4B`. */
export const compact = (n: number) => formatter.format(n)

const classOf = (people: number) => `p${BOUNDS.filter((bound) => people >= bound).length}`
const labelOf = (i: number) =>
  i === 0
    ? `< ${compact(BOUNDS[0])}`
    : i === BOUNDS.length
      ? `${compact(BOUNDS[i - 1])}+`
      : `${compact(BOUNDS[i - 1])}–${compact(BOUNDS[i])}`

/** The chart config: an entry per class, labelled by its bounds and colored. */
export const populationConfig: ChartConfig = Object.fromEntries(
  YL_OR_RD.map((color, i) => [`p${i}`, { label: labelOf(i), color }])
)

/** A tile of the globe: the people of its places, in the metro areas and in the cities proper, its largest place and its class. */
export type PlaceTile = {
  lon: number
  lat: number
  metro: number
  city: number
  place: string
  class: string
}

/**
 * The places of `min` people and more in their metro areas, summed on tiles
 * of `step` degrees; the class of a tile is that of its metro sum, and its
 * largest place names it.
 */
export function placeTiles(step: number, min = 0): PlaceTile[] {
  const tiles = new Map<string, PlaceTile & { largest: number }>()
  for (const [lon, lat, metro, city, name] of places) {
    if (metro < min) continue
    const i = Math.min(Math.floor((lon + 180) / step), Math.round(360 / step) - 1)
    const j = Math.min(Math.floor((lat + 90) / step), Math.round(180 / step) - 1)
    const tile = tiles.get(`${i},${j}`) ?? {
      lon: -180 + (i + 0.5) * step,
      lat: -90 + (j + 0.5) * step,
      metro: 0,
      city: 0,
      place: name,
      largest: metro,
      class: "",
    }
    tile.metro += metro
    tile.city += city
    if (metro > tile.largest) Object.assign(tile, { place: name, largest: metro })
    tiles.set(`${i},${j}`, tile)
  }
  return [...tiles.values()].map(({ lon, lat, metro, city, place }) => ({
    lon,
    lat,
    metro,
    city,
    place,
    class: classOf(metro),
  }))
}

/** The config of the places: a capital or a city, in two colors of the scheme. */
export const placeConfig: ChartConfig = {
  capital: { label: "Capital", color: "#fd8d3c" },
  city: { label: "City", color: "#ffffcc" },
}

/** A place: where it is, the people of its metro area and its city proper, its name and its kind. */
export type PlaceRow = {
  lon: number
  lat: number
  metro: number
  city: number
  name: string
  kind: "capital" | "city"
}

/**
 * The places of `min` people and more in their metro areas. A name two
 * places share - Birmingham, Santiago - carries its position, since the
 * name is the identity of a dot.
 */
export function placeRows(min = 0): PlaceRow[] {
  const rows = places.filter(([, , metro]) => metro >= min)
  const count = new Map<string, number>()
  for (const [, , , , name] of rows) count.set(name, (count.get(name) ?? 0) + 1)
  return rows.map(([lon, lat, metro, city, name, capital]) => ({
    lon,
    lat,
    metro,
    city,
    name: count.get(name)! > 1 ? `${name} (${lat}, ${lon})` : name,
    kind: capital ? "capital" : "city",
  }))
}

/** The smallest place shown, from the megacities down to every place. */
const MIN = [10e6, 5e6, 1e6, 500e3, 100e3, 0]

/** The select over the smallest place shown, below the enter demos of the globe and the places. */
export function PlaceSelect({ min, onChange }: { min: number; onChange: (min: number) => void }) {
  return (
    <Select
      label="Places"
      value={String(min)}
      options={MIN.map((m) => ({
        id: String(m),
        label: m ? `${compact(m)} and up` : "Every place",
      }))}
      onChange={(v) => onChange(Number(v))}
    />
  )
}
