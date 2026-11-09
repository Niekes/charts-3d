import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { BivariateLegend, bivariateConfig, night, quakeTiles } from "@/docs/examples/bivariate"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Tiles of 1°: nearly every quake of the year its own spike, thousands of faces.
const step = 1
const chartData = quakeTiles(step)

export default function GlobeChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={bivariateConfig("BuPu")} renderer={renderer} style={night}>
        <GlobeChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value="magnitude"
          series="class"
          step={step}
          format={(magnitude) => magnitude.toFixed(1)}
        />
      </ChartContainer3D>
      <BivariateLegend scheme="BuPu" />
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
