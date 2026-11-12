import type { ChartConfig } from "@/components/ui/chart-3d"
import { countries } from "@/docs/examples/countries"

// The five classes of a region: the fifth of the countries its value falls
// in, in YlOrRd of d3-scale-chromatic.
const FIFTHS = ["lowest fifth", "second fifth", "middle fifth", "fourth fifth", "highest fifth"]
const YL_OR_RD = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"]

/** The chart config: an entry per fifth, labelled and colored. */
export const regionConfig: ChartConfig = Object.fromEntries(
  FIFTHS.map((label, i) => [`q${i + 1}`, { label, color: YL_OR_RD[i] }])
)

/** A country: the id of its region in world-atlas, its name, its people, its GDP in millions of dollars and its class. */
export type Region = { id: string; name: string; population: number; gdp: number; class: string }

/**
 * The countries of `min` people and more, each in the fifth its `value`
 * falls in among them, so the classes shift as the countries do.
 */
export function regionRows(value: "population" | "gdp", min = 0): Region[] {
  const rows = countries
    .filter(([, , population]) => population >= min)
    .map(([id, name, population, gdp]) => ({ id, name, population, gdp, class: "" }))
  const sorted = [...rows].sort((a, b) => a[value] - b[value])
  sorted.forEach((row, i) => {
    row.class = `q${Math.floor((i / sorted.length) * 5) + 1}`
  })
  return rows
}
