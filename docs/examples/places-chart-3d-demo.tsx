import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { compact, placeConfig, placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The places of a million people and more: a dot per place, its area the
// people of its metro area, a capital in its own color.
export const chartData = placeRows(1e6)

export default function PlacesChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={placeConfig} renderer={renderer} legend>
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
