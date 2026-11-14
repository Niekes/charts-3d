import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { land } from "@/docs/examples/land"
import { compact, placeTiles, populationConfig } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The populated places of the world on tiles of 2°: a tile rises to the
// people of its metro areas and takes the color of their class. Thousands
// of tiles turn smoothly on canvas, not on SVG, so the demo starts there.
export const step = 2
export const chartData = placeTiles(step)

export default function GlobeChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={populationConfig} renderer={renderer} legend>
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
