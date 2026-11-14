import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { land } from "@/docs/examples/land"
import { compact, placeTiles, populationConfig } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Tiles of 1°: nearly every place its own spark, five thousand tiles.
const step = 1
const chartData = placeTiles(step)

export default function GlobeChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={populationConfig} renderer={renderer}>
        <GlobeChart3D
          data={chartData}
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
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
