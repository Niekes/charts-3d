import { useState } from "react"
import { geoDistance } from "d3-geo"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"
import { chartView } from "@/docs/examples/routes-chart-3d-demo"

// Every place of half a million people and more, a thousand of them, on one
// route: from the westernmost, each time on to the nearest place not yet
// visited. Deterministic, so the page looks the same on every load.
const left = placeRows(5e5)
const chartData = [left.shift()!]
while (left.length) {
  const { lon, lat } = chartData.at(-1)!
  const far = left.map((place) => geoDistance([lon, lat], [place.lon, place.lat]))
  chartData.push(...left.splice(far.indexOf(Math.min(...far)), 1))
}

const chartConfig = { route: { label: "Places", color: "var(--chart-1)" } } satisfies ChartConfig

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
