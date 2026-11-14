import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { PlaceSelect, compact, placeConfig, placeRows } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The world place by place: lowering the bar, the smaller places grow out of
// the globe as they fade in; raising it, they shrink away. Every place keeps
// its size, so the only change is which places are there.
export default function PlacesChart3DEnterDemo() {
  const [min, setMin] = useState(1e6)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={placeConfig} renderer={renderer} legend>
        <PlacesChart3D
          data={placeRows(min)}
          land={land}
          lon="lon"
          lat="lat"
          value="metro"
          series="kind"
          id="name"
          format={compact}
        />
      </ChartContainer3D>
      <PlaceSelect min={min} onChange={setMin} />
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
