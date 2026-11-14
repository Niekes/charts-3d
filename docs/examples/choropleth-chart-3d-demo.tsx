import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { land } from "@/docs/examples/land"
import { compact } from "@/docs/examples/population"
import { regionConfig, regionRows } from "@/docs/examples/regions"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The countries of the world by their people, each in the fifth it falls in.
export const chartData = regionRows("population")

export default function ChoroplethChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={regionConfig} renderer={renderer} legend>
        <ChoroplethChart3D
          data={chartData}
          land={land}
          id="id"
          value="population"
          series="class"
          label="name"
          format={compact}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
