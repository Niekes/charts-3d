import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { compact, placeConfig, placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Every place of Natural Earth, seven thousand dots, the smallest a speck.
const chartData = placeRows()

export default function PlacesChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={placeConfig} renderer={renderer}>
        <PlacesChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value="metro"
          series="kind"
          id="name"
          format={compact}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
