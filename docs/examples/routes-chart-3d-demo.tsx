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

// The capitals by their plain names: a name another place shares, such as
// London, carries its position in the rows, which a stop does not need.
const capitals = new Map(
  placeRows()
    .filter((place) => place.kind === "capital")
    .map((place) => ({ ...place, name: place.name.replace(/ \(.*/, "") }))
    .map((place) => [place.name, place])
)

/** The capitals of `names` as the stops of the route `route`, in that order. */
export const stops = (route: string, names: string[]) =>
  names.map((name) => ({ ...capitals.get(name)!, route }))

// Two routes from capital to capital: one round the Atlantic and back to London - a name
// that repeats is a stop of its own - and one east from Cairo. `series` tells the routes apart.
const routes = [
  ...stops("atlantic", [
    "London",
    "Reykjavík",
    "Ottawa",
    "Havana",
    "Brasília",
    "Dakar",
    "Lisbon",
    "London",
  ]),
  ...stops("east", ["Cairo", "Nairobi", "New Delhi", "Singapore", "Canberra"]),
]

// How each stop was reached: the leg that leads to it takes that color, and so does the stop.
const sailed = new Set(["Havana", "Brasília", "Dakar", "Singapore"])
export const chartData = routes.map((stop) => ({
  ...stop,
  by: sailed.has(stop.name) ? "sea" : "air",
}))

export const chartConfig = {
  air: { label: "By air", color: "var(--chart-1)" },
  sea: { label: "By sea", color: "var(--chart-2)" },
} satisfies ChartConfig

// The globe turned to the middle of the Atlantic, a little north of the equator.
export const chartView = facing(-10, 15)

export default function RoutesChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} defaultView={chartView} legend>
        <RoutesChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          id="name"
          series="route"
          leg="by"
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
