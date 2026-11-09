import type { CSSProperties } from "react"

import type { ChartConfig } from "@/components/ui/chart-3d"
import { earthquakes } from "@/docs/examples/earthquakes"
import { Select } from "@/docs/examples/renderer-select"

/**
 * Four bivariate schemes of nine colors: a column per class of the first
 * variable, a row per class of the second, both from low to high.
 */
export const schemes = {
  BuPu: [
    "#e8e8e8",
    "#ace4e4",
    "#5ac8c8",
    "#dfb0d6",
    "#a5add3",
    "#5698b9",
    "#be64ac",
    "#8c62aa",
    "#3b4994",
  ],
  RdBu: [
    "#e8e8e8",
    "#e4acac",
    "#c85a5a",
    "#b0d5df",
    "#ad9ea5",
    "#985356",
    "#64acbe",
    "#627f8c",
    "#574249",
  ],
  GnBu: [
    "#e8e8e8",
    "#b5c0da",
    "#6c83b5",
    "#b8d6be",
    "#90b2b3",
    "#567994",
    "#73ae80",
    "#5a9178",
    "#2a5a5b",
  ],
  PuOr: [
    "#e8e8e8",
    "#e4d9ac",
    "#c8b35a",
    "#cbb8d7",
    "#c8ada0",
    "#af8e53",
    "#9972af",
    "#976b82",
    "#804d36",
  ],
}

export type Scheme = keyof typeof schemes

/** The globe at night: a near-black ocean and a dark slate land, so every class of a scheme reads. */
export const night = {
  "--chart-3d-ocean": "oklch(0.22 0.02 260)",
  "--chart-3d-land": "oklch(0.36 0.02 260)",
} as CSSProperties

// The classes of a quake: its magnitude 5 to 5.5, 5.5 to 6 and 6 and up,
// and its depth shallow under 70 km, intermediate to 300 and deep beyond.
const MAGNITUDE = ["M 5–5.5", "M 5.5–6", "M 6+"]
const DEPTH = ["shallow", "intermediate", "deep"]
const LEVEL = ["low", "mid", "high"]
const magnitudeClass = (magnitude: number) => (magnitude >= 6 ? 2 : magnitude >= 5.5 ? 1 : 0)
const depthClass = (depth: number) => (depth >= 300 ? 2 : depth >= 70 ? 1 : 0)
/** The config key of a class, such as `high-deep`, its label, such as `M 6+ · deep`, and its color in a scheme. */
const keyOf = (magnitude: number, depth: number) => `${LEVEL[magnitude]}-${DEPTH[depth]}`
const labelOf = (magnitude: number, depth: number) => `${MAGNITUDE[magnitude]} · ${DEPTH[depth]}`
const colorOf = (scheme: Scheme, magnitude: number, depth: number) =>
  schemes[scheme][depth * 3 + magnitude]

/** The chart config of a scheme: an entry per class, labelled and colored. */
export function bivariateConfig(scheme: Scheme): ChartConfig {
  return Object.fromEntries(
    DEPTH.flatMap((_, depth) =>
      MAGNITUDE.map((_, magnitude) => [
        keyOf(magnitude, depth),
        { label: labelOf(magnitude, depth), color: colorOf(scheme, magnitude, depth) },
      ])
    )
  )
}

/** A tile of the globe: the strongest quake on it, its class, and how many quakes it holds. */
export type QuakeTile = {
  lon: number
  lat: number
  magnitude: number
  quakes: number
  class: string
}

/**
 * The quakes of the first `months` of 2025 on tiles of `step` degrees. The
 * strongest quake of a tile names its magnitude and its class, and `quakes`
 * counts them, so a chart can rise to either.
 */
export function quakeTiles(step: number, months = 12): QuakeTile[] {
  const tiles = new Map<string, QuakeTile>()
  for (const [lon, lat, magnitude, depth, month] of earthquakes) {
    if (month > months) continue
    const i = Math.min(Math.floor((lon + 180) / step), Math.round(360 / step) - 1)
    const j = Math.min(Math.floor((lat + 90) / step), Math.round(180 / step) - 1)
    const tile = tiles.get(`${i},${j}`) ?? {
      lon: -180 + (i + 0.5) * step,
      lat: -90 + (j + 0.5) * step,
      magnitude: 0,
      quakes: 0,
      class: "",
    }
    tile.quakes += 1
    if (magnitude >= tile.magnitude) {
      tile.magnitude = magnitude
      tile.class = keyOf(magnitudeClass(magnitude), depthClass(depth))
    }
    tiles.set(`${i},${j}`, tile)
  }
  return [...tiles.values()]
}

/** The legend of a scheme: three by three swatches, magnitude running right and depth running up. */
export function BivariateLegend({ scheme }: { scheme: Scheme }) {
  return (
    <div className="flex items-end justify-center gap-2 text-xs text-muted-foreground">
      <span className="rotate-180 [writing-mode:vertical-rl]">depth →</span>
      <div className="flex flex-col items-center gap-1">
        <div className="grid grid-cols-3 gap-0.5">
          {[2, 1, 0].flatMap((depth) =>
            [0, 1, 2].map((magnitude) => (
              <span
                key={keyOf(magnitude, depth)}
                title={labelOf(magnitude, depth)}
                className="size-4 rounded-[2px]"
                style={{ background: colorOf(scheme, magnitude, depth) }}
              />
            ))
          )}
        </div>
        <span>magnitude →</span>
      </div>
    </div>
  )
}

const options = Object.keys(schemes).map((id) => ({ id: id as Scheme, label: id }))

/** The select over the schemes, beside the renderer select. */
export function SchemeSelect({
  scheme,
  onChange,
}: {
  scheme: Scheme
  onChange: (scheme: Scheme) => void
}) {
  return <Select label="Scheme" value={scheme} options={options} onChange={onChange} />
}
