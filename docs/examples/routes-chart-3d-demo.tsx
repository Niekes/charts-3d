import { useState } from "react"

import {
  ChartContainer3D,
  facing,
  type ChartConfig,
  type Renderer3D,
} from "@/components/ui/chart-3d"
import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

const capitals = new Map(placeRows().map((place) => [place.name, place]))

/** The capitals of `names` as the stops of the route `route`, in that order. */
export const stops = (route: string, names: string[]) =>
  names.map((name) => ({ ...capitals.get(name)!, route }))

// Two journeys from capital to capital, one round the Atlantic, one east from Cairo.
export const chartData = [
  ...stops("atlantic", ["London", "Reykjavík", "Ottawa", "Havana", "Brasília", "Dakar", "Lisbon"]),
  ...stops("east", ["Cairo", "Nairobi", "New Delhi", "Singapore", "Canberra"]),
]

export const chartConfig = {
  atlantic: { label: "Round the Atlantic", color: "var(--chart-1)" },
  east: { label: "East from Cairo", color: "var(--chart-2)" },
} satisfies ChartConfig

// The globe turned to the middle of the Atlantic, a little north of the equator.
export const chartView = facing(-10, 15)

export default function RoutesChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} defaultView={chartView} legend>
        <RoutesChart3D data={chartData} land={land} lon="lon" lat="lat" id="name" series="route" />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
