import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import {
  BivariateLegend,
  SchemeSelect,
  bivariateConfig,
  night,
  quakeTiles,
  type Scheme,
} from "@/docs/examples/bivariate"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The earthquakes of 2025 on tiles of 2°: the strongest quake of a tile is
// its height, and its class, magnitude by depth, is its color.
export const step = 2
export const chartData = quakeTiles(step)

export default function GlobeChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const [scheme, setScheme] = useState<Scheme>("BuPu")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={bivariateConfig(scheme)} renderer={renderer} style={night}>
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
      <BivariateLegend scheme={scheme} />
      <div className="flex justify-center gap-4">
        <SchemeSelect scheme={scheme} onChange={setScheme} />
        <RendererSelect renderer={renderer} onChange={setRenderer} />
      </div>
    </div>
  )
}
