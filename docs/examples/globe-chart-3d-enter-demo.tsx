import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { land } from "@/docs/examples/land"
import { PlaceSelect, compact, placeTiles, populationConfig } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

const step = 2

// The world place by place: lowering the bar, the smaller places enter and
// light up; raising it, they sink back into the globe. A tile that was
// there already grows as a place joins it.
export default function GlobeChart3DEnterDemo() {
  const [min, setMin] = useState(1e6)
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={populationConfig} renderer={renderer} legend>
        <GlobeChart3D
          data={placeTiles(step, min)}
          land={land}
          lon="lon"
          lat="lat"
          value="metro"
          series="class"
          label="place"
          step={step}
          format={compact}
        />
      </ChartContainer3D>
      <PlaceSelect min={min} onChange={setMin} />
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
