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
const sailed = new Set(["Havana", "Brasília", "Dakar", "Singapore", "Canberra"])
export const chartData = routes.map((stop) => ({
  ...stop,
  by: sailed.has(stop.name) ? "sea" : "air",
}))

// The symbols of the tips, the plane and the ship of Lucide (ISC License, https://lucide.dev) as
// path data: the `d` of every path of the icon, joined by a space. The plane is one closed
// outline, so it is filled, and drawn it points up and to the right, 45 degrees from up, so it
// turns to the leg it arrives on. The ship is seen from the side: it names no way and stays upright.
const plane = {
  path: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  points: 45,
  fill: true,
}
const ship = {
  path: [
    "M12 2v2",
    "M12 9.189V13",
    "M19 12V6a2 2 0 00-2-2H7a2 2 0 00-2 2v6",
    "M19.38 19A11.6 11.6 0 0021 13l-8.188-3.639a2 2 0 00-1.624 0L3 13.001a11.6 11.6 0 002.81 7.76",
    "M2 20c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
  ].join(" "),
}

// The tip of a route, its last stop, is drawn as the symbol of the key that colors it.
export const chartConfig = {
  air: { label: "By air", color: "var(--chart-1)", symbol: plane },
  sea: { label: "By sea", color: "var(--chart-2)", symbol: ship },
} satisfies ChartConfig

// One route in one color, for the demos that show no legs of their own.
export const routeConfig = {
  route: { label: "Route", color: "var(--chart-1)", symbol: plane },
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
