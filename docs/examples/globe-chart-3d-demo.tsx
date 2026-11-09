import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Where people live, roughly: a center per populous region, with its weight
// and its spread in degrees. The tiles sum the regions, so the page looks the
// same on every load without a dataset.
const regions: [number, number, number, number][] = [
  [10, 50, 0.7, 9],
  [38, 56, 0.3, 10],
  [45, 30, 0.4, 8],
  [78, 22, 1, 8],
  [115, 32, 1, 9],
  [138, 36, 0.5, 4],
  [105, 12, 0.5, 6],
  [110, -5, 0.5, 6],
  [8, 9, 0.6, 5],
  [37, 2, 0.4, 7],
  [-80, 38, 0.6, 7],
  [-120, 37, 0.4, 5],
  [-100, 22, 0.4, 5],
  [-45, -20, 0.5, 7],
  [-62, -33, 0.3, 6],
  [148, -33, 0.2, 5],
]

/** The population of every tile of `step` degrees, in millions, where anyone lives. */
export function population(step: number) {
  const tiles: { lon: number; lat: number; population: number }[] = []
  for (let lat = -90 + step / 2; lat < 90; lat += step) {
    for (let lon = -180 + step / 2; lon < 180; lon += step) {
      const density = regions.reduce((sum, [x, y, weight, spread]) => {
        const dx = (lon - x) * Math.cos((lat * Math.PI) / 180)
        const dy = lat - y
        return sum + weight * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread))
      }, 0)
      const people = Math.round(density * 120 * (step / 5) ** 2)
      if (people >= 5) tiles.push({ lon, lat, population: people })
    }
  }
  return tiles
}

export const chartData = population(5)

export const chartConfig = {
  population: { label: "Population", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function GlobeChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <GlobeChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value="population"
          format={(people) => `${people} M`}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
