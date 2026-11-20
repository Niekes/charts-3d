import { useState } from "react"
import { geoDistance } from "d3-geo"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"
import { chartView } from "@/docs/examples/routes-chart-3d-demo"

// Every capital of the world, two hundred of them, on one route: from
// Reykjavík, each time on to the nearest capital not yet visited.
const capitals = placeRows().filter((place) => place.kind === "capital")
const chartData = [capitals.find((place) => place.name === "Reykjavík")!]
while (chartData.length < capitals.length) {
  const { lon, lat } = chartData.at(-1)!
  const far = (place: (typeof capitals)[number]) => geoDistance([lon, lat], [place.lon, place.lat])
  chartData.push(
    capitals
      .filter((place) => !chartData.includes(place))
      .reduce((a, b) => (far(b) < far(a) ? b : a))
  )
}

const chartConfig = { route: { label: "Capitals", color: "var(--chart-1)" } } satisfies ChartConfig

export default function RoutesChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} defaultView={chartView}>
        <RoutesChart3D data={chartData} land={land} lon="lon" lat="lat" id="name" />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
